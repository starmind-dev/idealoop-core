// ============================================================================
// runners/f1-diagnostic-shared.js
// ============================================================================
// Shared utilities for F1 diagnostic runners (Phase A: Stage 2a stability,
// Phase B: Stage 2b independence). Built per V4S29 Bundle 2 / F1 lock.
//
// Architecture (per F1 lock):
//   - Direct Anthropic SDK calls, NOT the /api/analyze-pro route
//   - Frozen Stage 1 fixtures (cached on disk per case)
//   - Frozen Stage 2a packets (cached on disk per case, used by Phase B)
//   - Sampler config matches production exactly (Stage 1 hardened; Stage 2 not)
//   - Pure additive: no production code changes in Bundle 2
//
// CommonJS (matches run-b10a.js / run-archetypes.js / run-haiku-calibration.js
// runner pattern). Production prompts in src/lib/services/* are ESM and are
// loaded via dynamic import() in loadProductionModules().
//
// Cost: ~$6-7 total for Phase A + Phase B (5 reruns/case). Wall ~15-25 min.
// Tier-2 escalation (10 reruns/case) doubles both.
// ============================================================================

const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

// ============================================================================
// PRODUCTION-MATCHED CONSTANTS
// ============================================================================
//
// Sampler config and max_tokens are read from src/app/api/analyze-pro/route.js
// production state and pinned here. If production sampler config changes, this
// module must be updated to match (the diagnostic is meaningful only if it
// measures production behavior, not a divergent variant).
//
// Stage 1: top_k=1 + top_p=0.1 + temp=0 (V4S28 P0.5 Stage 1 Fix #3 sampler hardening)
// Stage 2a: temp=0 only (no top_k/top_p — F1 cure may add hardening; diagnostic measures unhardened state)
// Stage 2b: temp=0 only (same)

const MODEL_ID = "claude-sonnet-4-20250514";

const STAGE1_SAMPLER = {
  temperature: 0,
  top_k: 1,
  top_p: 0.1,
};

const STAGE2_SAMPLER = {
  temperature: 0,
  // No top_k, no top_p. Production state. Sampler hardening for Stage 2a/2b
  // is part of F1 cure work (regardless of 1A/1B verdict) — the diagnostic
  // measures the unhardened production state.
};

const MAX_TOKENS = {
  stage1: 3000,   // matches route.js line 257
  stage2a: 2000,  // matches route.js line 328
  stage2b: 8192,  // matches route.js line 390
};

// ============================================================================
// PATHS (gitignored cache for fixtures + checkpoints)
// ============================================================================

const FIXTURE_DIR = path.join(__dirname, ".f1-fixtures");
const STAGE1_FIXTURE_DIR = path.join(FIXTURE_DIR, "stage1");
const STAGE2A_FIXTURE_DIR = path.join(FIXTURE_DIR, "stage2a");

function ensureDirs() {
  for (const d of [FIXTURE_DIR, STAGE1_FIXTURE_DIR, STAGE2A_FIXTURE_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

// ============================================================================
// PRODUCTION MODULE LOADER
// ============================================================================
// Production code uses ES module syntax (export const ...). CommonJS runners
// can't require() ESM, but dynamic import() works in Node 14+. Cached after
// first call so repeated load doesn't churn.

let _modCache = null;

async function loadProductionModules() {
  if (_modCache) return _modCache;
  const [stage1, stage2a, stage2b, keywords, github, serper, competitors] = await Promise.all([
    import("../src/lib/services/prompt-stage1.js"),
    import("../src/lib/services/prompt-stage2a.js"),
    import("../src/lib/services/prompt-stage2b.js"),
    import("../src/lib/services/keywords.js"),
    import("../src/lib/services/github.js"),
    import("../src/lib/services/serper.js"),
    import("../src/lib/services/competitors.js"),
  ]);
  _modCache = {
    STAGE1_SYSTEM_PROMPT: stage1.STAGE1_SYSTEM_PROMPT,
    STAGE2A_SYSTEM_PROMPT: stage2a.STAGE2A_SYSTEM_PROMPT,
    STAGE2B_SYSTEM_PROMPT: stage2b.STAGE2B_SYSTEM_PROMPT,
    extractKeywords: keywords.extractKeywords,
    searchGitHub: github.searchGitHub,
    searchSerper: serper.searchSerper,
    buildCompetitorContext: competitors.buildCompetitorContext,
    buildCompetitorInstructions: competitors.buildCompetitorInstructions,
  };
  return _modCache;
}

// ============================================================================
// JSON CLEAN HELPER (verbatim copy from src/app/api/analyze-pro/route.js)
// ============================================================================
// Per Bundle 2 decision: diagnostic stays pure-additive — no production touch.
// If F1 cure ships and route.js is edited, cleanJsonResponse can be extracted
// to a shared production module at THAT point.

function cleanJsonResponse(text) {
  if (!text || typeof text !== "string") return text;
  const trimmed = text.trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return trimmed;
  return trimmed.slice(firstBrace, lastBrace + 1);
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

let _client = null;

function getClient() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY env var required");
  _client = new Anthropic({ apiKey });
  return _client;
}

// ============================================================================
// STAGE 1 FIXTURE — auto-generate on cache miss, persist to disk
// ============================================================================
// Mirrors route.js Phase 1 + Stage 1 logic (keywords → search → Stage 1).
// Skipped on cache hit. Stage 1 is profile-blind (V4S28 B6); profile NOT
// injected.

async function generateStage1Fixture(caseDef) {
  const mods = await loadProductionModules();
  const client = getClient();

  // Specificity gate + keyword/query extraction
  const keywordsResult = await mods.extractKeywords(caseDef.idea);
  if (keywordsResult.specificity_insufficient) {
    throw new Error(
      `Specificity gate fired for ${caseDef.id} — diagnostic cases must pass the gate. ` +
      `If this case legitimately gates in production, it shouldn't be in the F1 diagnostic bank.`
    );
  }
  const { githubQuery1, githubQuery2, serperQuery1, serperQuery2 } = keywordsResult;

  // Search (parallel) — matches route.js
  const [g1, g2, s1, s2] = await Promise.all([
    mods.searchGitHub(githubQuery1),
    mods.searchGitHub(githubQuery2),
    mods.searchSerper(serperQuery1),
    mods.searchSerper(serperQuery2),
  ]);

  // Dedup by URL + slice(0, 7) + sort by URL — matches route.js exactly
  const seen = new Set();
  const dedup = (arr) => {
    const out = [];
    for (const x of arr) {
      if (!seen.has(x.url)) { seen.add(x.url); out.push(x); }
    }
    return out;
  };
  const githubResults = dedup([...g1, ...g2]).slice(0, 7);
  const serperResults = dedup([...s1, ...s2]).slice(0, 7);
  githubResults.sort((a, b) => (a.url || "").localeCompare(b.url || ""));
  serperResults.sort((a, b) => (a.url || "").localeCompare(b.url || ""));

  // Build Stage 1 system prompt with competitor context — matches route.js
  const { context: competitorContext, hasRealData } = mods.buildCompetitorContext(githubResults, serperResults);
  const competitorInstructions = mods.buildCompetitorInstructions(hasRealData);
  const stage1SystemPrompt = mods.STAGE1_SYSTEM_PROMPT + competitorContext + competitorInstructions;

  // Stage 1 user message — profile-blind (matches route.js)
  const stage1UserMessage = `USER'S AI PRODUCT IDEA:
${caseDef.idea}`;

  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: MAX_TOKENS.stage1,
    ...STAGE1_SAMPLER,
    system: stage1SystemPrompt,
    messages: [{ role: "user", content: stage1UserMessage }],
  });

  const text = response.content[0].text;
  let stage1Result;
  try {
    stage1Result = JSON.parse(cleanJsonResponse(text));
  } catch (e) {
    throw new Error(`Stage 1 parse failed for ${caseDef.id}: ${e.message}`);
  }

  if (stage1Result.ethics_blocked) {
    throw new Error(`Stage 1 ethics-blocked ${caseDef.id} — diagnostic cases must pass`);
  }

  return {
    stage1Result,
    meta: {
      caseId: caseDef.id,
      generatedAt: new Date().toISOString(),
      githubCount: githubResults.length,
      serperCount: serperResults.length,
      hasRealData,
    },
  };
}

async function getStage1Fixture(caseDef) {
  ensureDirs();
  const cachePath = path.join(STAGE1_FIXTURE_DIR, `${caseDef.id}.json`);
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  }
  const fixture = await generateStage1Fixture(caseDef);
  fs.writeFileSync(cachePath, JSON.stringify(fixture, null, 2));
  return fixture;
}

// ============================================================================
// STAGE 2a — single call against frozen Stage 1 fixture
// ============================================================================
// Stage 2a is profile-blind (V4S9 quarantine); profile NOT injected.

async function runStage2a(caseDef, stage1Fixture) {
  const mods = await loadProductionModules();
  const client = getClient();

  const userMessage = `USER'S AI PRODUCT IDEA:
${caseDef.idea}

=== STAGE 1 RESULTS: COMPETITION ANALYSIS ===
${JSON.stringify(stage1Fixture.stage1Result)}`;

  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: MAX_TOKENS.stage2a,
    ...STAGE2_SAMPLER,
    system: mods.STAGE2A_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content[0].text;
  return JSON.parse(cleanJsonResponse(text));
}

// Phase B Stage 2a fixture: cache hit reuses Phase A run-1 (saved by Phase A
// runner); cache miss generates a fresh Stage 2a packet. The 5 cases shared
// with Phase A always cache-hit; the 3 Phase-B-only cases (MAT1-intermediate,
// M3, A2) generate fresh.

async function getStage2aFixture(caseDef) {
  ensureDirs();
  const cachePath = path.join(STAGE2A_FIXTURE_DIR, `${caseDef.id}.json`);
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  }
  const stage1 = await getStage1Fixture(caseDef);
  const stage2a = await runStage2a(caseDef, stage1);
  fs.writeFileSync(cachePath, JSON.stringify(stage2a, null, 2));
  return stage2a;
}

// ============================================================================
// STAGE 2b — single call against frozen Stage 2a packet
// ============================================================================
// Stage 2b is profile-blind (V4S28 B6); receives idea + 2a packets only.

async function runStage2b(caseDef, stage2aResult) {
  const mods = await loadProductionModules();
  const client = getClient();

  const userMessage = `USER'S AI PRODUCT IDEA:
${caseDef.idea}

=== EVIDENCE PACKETS FROM STAGE 2a ===
${JSON.stringify(stage2aResult)}`;

  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: MAX_TOKENS.stage2b,
    ...STAGE2_SAMPLER,
    system: mods.STAGE2B_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content[0].text;
  return JSON.parse(cleanJsonResponse(text));
}

// ============================================================================
// SCHEMA VALIDATION (pre-flight runner check)
// ============================================================================
// Per F1 lock: AUDIT-H4 case run first to validate runner shape against
// extractEvaluation() schema. If validation fails on AUDIT-H4 run 1, halt
// before burning calls on a broken runner.

function validateStage2aShape(result) {
  const errors = [];
  if (!result || typeof result !== "object") {
    errors.push("result is not an object");
    return errors;
  }
  if (!result.evidence_packets) errors.push("missing evidence_packets");
  for (const m of ["market_demand", "monetization", "originality"]) {
    const p = result?.evidence_packets?.[m];
    if (!p) { errors.push(`missing evidence_packets.${m}`); continue; }
    if (!Array.isArray(p.admissible_facts)) {
      errors.push(`evidence_packets.${m}.admissible_facts is not an array`);
    }
  }
  return errors;
}

function validateStage2bShape(result) {
  const errors = [];
  if (!result || typeof result !== "object") {
    errors.push("result is not an object");
    return errors;
  }
  const ev = result.evaluation;
  if (!ev) { errors.push("missing evaluation"); return errors; }
  for (const [field, label] of [
    ["market_demand", "MD"],
    ["monetization", "MO"],
    ["originality", "OR"],
  ]) {
    const score = ev?.[field]?.score;
    if (typeof score !== "number") {
      errors.push(`evaluation.${field}.score is not a number (got ${typeof score})`);
    }
  }
  return errors;
}

// ============================================================================
// STATS HELPERS
// ============================================================================

// Jaccard similarity over string sets (exact match post-trim, per Bundle 2
// decision item 1). Empty ∩ empty = 1 (identical).
function jaccard(setA, setB) {
  if (!setA.size && !setB.size) return 1;
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter++;
  const union = setA.size + setB.size - inter;
  return inter / union;
}

// Pairwise Jaccard across N reruns of admissible_facts arrays.
// Returns C(N,2) Jaccard values.
function pairwiseJaccard(arrays) {
  const sets = arrays.map((a) => new Set(a.map((s) => s.trim())));
  const out = [];
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      out.push(jaccard(sets[i], sets[j]));
    }
  }
  return out;
}

function median(values) {
  if (!values || !values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values) {
  if (!values || !values.length) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// Sample standard deviation (n-1 denominator).
function stddev(values) {
  if (!values || values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// 1-indexed average ranks (handles ties).
function rank(values) {
  const indexed = values.map((v, i) => [v, i]);
  indexed.sort((a, b) => a[0] - b[0]);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1][0] === indexed[i][0]) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[indexed[k][1]] = avgRank;
    i = j + 1;
  }
  return ranks;
}

// Spearman rank correlation. Returns 0 if either array has zero variance
// (undefined ρ, treated as no correlation rather than NaN).
function spearman(xs, ys) {
  if (xs.length !== ys.length) throw new Error("Spearman: length mismatch");
  if (xs.length < 2) return 0;
  const rx = rank(xs);
  const ry = rank(ys);
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return 0;
  return num / Math.sqrt(dx * dy);
}

// ============================================================================
// CHECKPOINT (per-case, per-run; --resume support)
// ============================================================================
// Mirrors run-b10a.js checkpoint shape (compatible mental model).

function loadCheckpoint(checkpointPath) {
  if (!fs.existsSync(checkpointPath)) {
    return { runs: [], startedAt: new Date().toISOString() };
  }
  try {
    return JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
  } catch (e) {
    console.error(`⚠️  Checkpoint corrupt (${e.message}), starting fresh`);
    return { runs: [], startedAt: new Date().toISOString() };
  }
}

function saveCheckpoint(checkpointPath, cp) {
  fs.writeFileSync(checkpointPath, JSON.stringify(cp, null, 2));
}

function isCompleted(cp, caseId, runIndex) {
  return cp.runs.some(
    (r) => r.caseId === caseId && r.runIndex === runIndex && r.status === "success"
  );
}

function appendRun(checkpointPath, cp, run) {
  // Replace any prior failed entry for the same (caseId, runIndex)
  cp.runs = cp.runs.filter(
    (r) => !(r.caseId === run.caseId && r.runIndex === run.runIndex)
  );
  cp.runs.push(run);
  saveCheckpoint(checkpointPath, cp);
}

// ============================================================================
// CASE LOADER
// ============================================================================
// cases.js lives at repo root (alongside run-b10a.js). From runners/, that's
// `../cases.js`.

const { ALL_CASES } = require("../cases.js");

function loadCase(caseId) {
  const c = ALL_CASES.find((x) => x.id === caseId);
  if (!c) throw new Error(`Case not found in cases.js: ${caseId}`);
  return c;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Stage callers
  runStage2a,
  runStage2b,
  generateStage1Fixture,
  getStage1Fixture,
  getStage2aFixture,
  // Validation
  validateStage2aShape,
  validateStage2bShape,
  // Stats
  jaccard,
  pairwiseJaccard,
  median,
  mean,
  stddev,
  rank,
  spearman,
  // Checkpoint
  loadCheckpoint,
  saveCheckpoint,
  isCompleted,
  appendRun,
  // Case loader
  loadCase,
  // Constants (exported for runners + tests)
  MODEL_ID,
  STAGE1_SAMPLER,
  STAGE2_SAMPLER,
  MAX_TOKENS,
  FIXTURE_DIR,
  STAGE1_FIXTURE_DIR,
  STAGE2A_FIXTURE_DIR,
};

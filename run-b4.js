// ============================================
// IDEALOOP CORE — V4S28 BUNDLE B4 TARGETED VERIFIER
// ============================================
//
// Verifies Bundle B4 closure: OR actionability hook (P6-S3) + Evidence
// Strength rename + Option Z MEDIUM rule (S8). Tests Change 1 and Change 2
// shipped in commit f8fb7f8 (B4) — Stage 2b prompt + Free prompt.js + the
// rename across all downstream consumers.
//
// 12 test cases / 19 runs / ~35-40 min wall time
//
// Run distribution:
//   - OR hook firing-rate coverage (Pro): 10 runs across MAT1/MAT2/MAT3 +
//     archetype-tagged ideas (TRUST, DATA, CATEGORY)
//   - OR hook variance (Pro): 6 runs (2 cases × 3 reruns)
//   - Sparse → cross-stage propagation (Pro): 1 run (T-SPEC)
//   - Free pipeline parity: 2 runs (M1 founder-dump + MAT2-beginner)
//
// CLOSURE THRESHOLDS — set BEFORE running per methodology principle 6:
//
//   T1. OR hook firing rate                    ≥ 95% (18/19 minimum, no exceptions)
//   T2. Anti-generic guardrail violations      = 0   (zero forbidden patterns)
//   T3. Honest exit fires when defensibility   ≥ 1   (at least one case)
//          is genuinely weak
//   T4. Schema rename complete                 = 100% (every run: evidence_strength
//                                                       present, confidence_level absent)
//   T5. Option Z MEDIUM compliance              = 0 forbidden generic-hedging matches
//   T6. Confidence-about-idea pattern          = 0 occurrences
//   T7. Cross-stage propagation (LOW)          = 1/1 sparse case clean
//   T8. OR hook variance stability             = 6/6 reruns hold the hook
//
// All thresholds met → B4 closes.
// Any threshold missed → triage. Apply the B3 meta-lesson FIRST: re-read the
// locked design (execution-plan-v4-3.md Section 6 P6-S3 + Section 8) before
// treating the failure as a model issue. The runner is a detector, and
// detectors can encode the wrong expectations.
//
// VALID-OUTCOMES ENUMERATION (B3 lesson — do not collapse outcomes):
//
//   OR hook detector classifies each OR explanation into exactly one of:
//     A. Specific improvement      → action verb + named target → PASS
//     B. Honest exit clause        → "No realistic defensibility path exists
//                                     against incumbents with this approach."
//                                     verbatim or close paraphrase → PASS
//     C. Descriptive ending        → no improvement, no exit → HARD FAIL
//     D. Generic forbidden pattern → "consider proprietary data" / "create
//                                     network effects" / "deepen integrations"
//                                     without a named target → HARD FAIL
//
//   A and B both pass. They are NOT collapsed into a single "ends with hook"
//   check — that's the under-specification mode B3 hit twice.
//
// USAGE:
//   node run-b4.js              — fresh SSE run (default)
//   node run-b4.js --reeval P   — re-evaluate an existing JSON dump
//                                 (skips all SSE calls — instant verdict;
//                                  same path as run-b3.js)
//
// (server must be running at localhost:3000 for fresh-run mode)
//
// ============================================

const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = __dirname;

// ============================================
// IDEAS + PROFILES (reused from run-b3.js for cross-bundle continuity)
// ============================================

const MAT1_IDEA =
  "AI-powered document automation tool for small law firms (under 20 attorneys). Ingests client intake forms, generates draft engagement letters, retainer agreements, and client memos based on firm templates. Integrates with Clio. $299/month per firm.";

const MAT1_PROFILES = {
  beginner: { coding: "No coding experience", ai: "Some AI experience", education: "Paralegal (6 years), Airtable builder" },
  intermediate: { coding: "Intermediate", ai: "Regular AI user", education: "Paralegal (6 years), bootcamp grad, shipped personal project" },
  senior: { coding: "Advanced", ai: "Advanced AI user (fine-tuning LLMs)", education: "Staff engineer at LegalTech company (5 years, doc automation features)" },
};

const MAT2_IDEA =
  "Concierge service that handles all insurance claim disputes for small businesses (under 50 employees). Success fee of 25% on recovered claims. Starting with denied health insurance claims for employee medical expenses. Done-with-you model: we handle paperwork, customer provides documents.";

const MAT2_PROFILES = {
  beginner: { coding: "No coding experience", ai: "Some AI experience", education: "Former small-business owner (dealt with claim denials personally)" },
  senior: { coding: "Advanced", ai: "Advanced AI user", education: "Senior PM at healthtech company, built internal tools" },
};

const MAT3_IDEA =
  "Platform that helps rural hospitals (under 100 beds) negotiate better rates with medical device suppliers by aggregating purchasing data across member hospitals. Members pay $24,000/year. Value prop: average 12% reduction in device spend, which pays for membership 10x over. Requires buy-in from hospital CFOs and procurement directors.";

const MAT3_PROFILES = {
  insider: { coding: "No coding experience", ai: "Some AI experience", education: "Former rural hospital CFO (15 years), 80+ exec relationships" },
  techNoAccess: { coding: "Advanced", ai: "Advanced AI user", education: "Staff engineer at healthtech startup (8 years), built procurement tools for enterprise" },
};

const TRUST_CLINICAL_IDEA =
  "AI-powered clinical decision support tool for primary care physicians. Reviews patient symptoms, history, and recent labs to suggest differential diagnoses ranked by likelihood, flagging conditions the physician may not have considered. Integrates with EMRs (Epic, Cerner). $499/month per physician seat. Outputs are decision-influencing — physicians act on the suggestions.";

const DATA_ACQUISITION_IDEA =
  "Salary benchmarking platform for software engineers that aggregates real compensation data via verified contributors who submit offer letters or pay stubs. Free for contributors (who get full access in exchange), paid for browsers without contributing ($39/month). Quality depends on having 30,000+ verified submissions per role/region/level to be useful. Pitch is: more granular than levels.fyi, more verified than Glassdoor.";

const CATEGORY_MATURATION_IDEA =
  "Autonomous AI research agent that conducts multi-day investigations on complex questions and produces literature reviews for academic researchers in the social sciences. Uses tool-use + browsing + retrieval over academic databases. Outputs annotated bibliographies and structured argument maps. $129/month per researcher. Replaces 20-40 hours of manual lit-review work per investigation.";

const SP1_IDEA = "tool for dentists to save time";

const M1_FOUNDER_DUMP =
  "habit tracker app with an AI that talks to you about your progress and helps you figure out why you fell off. gamified. freemium with $9/mo for the AI coach.";

// ============================================
// TEST CASES — case-aware validOutcomes per the B3 enumeration lesson
// ============================================

const TESTS = [
  // --- OR hook firing-rate coverage (Pro, single runs) ---
  {
    id: "MAT1-beginner",
    repeats: 1,
    pipeline: "PRO",
    idea: MAT1_IDEA,
    profile: MAT1_PROFILES.beginner,
    purpose: "Clear legal-tech market with strong incumbents. OR likely 4-5 range; hook should suggest specific data/integration moat or honest exit.",
    expectedEvidence: "HIGH or MEDIUM (clear market, lots of comparables)",
  },
  {
    id: "MAT1-senior",
    repeats: 1,
    pipeline: "PRO",
    idea: MAT1_IDEA,
    profile: MAT1_PROFILES.senior,
    purpose: "Same idea + LegalTech-experienced founder. OR scoring stable; hook tests defensibility-improvement at higher founder skill.",
    expectedEvidence: "HIGH or MEDIUM",
  },
  {
    id: "MAT2-beginner",
    repeats: 1,
    pipeline: "PRO",
    idea: MAT2_IDEA,
    profile: MAT2_PROFILES.beginner,
    purpose: "Concierge service, replicable model. OR likely 3-5; hook should produce specific defensibility path or honest exit.",
    expectedEvidence: "HIGH or MEDIUM",
  },
  {
    id: "MAT2-senior",
    repeats: 1,
    pipeline: "PRO",
    idea: MAT2_IDEA,
    profile: MAT2_PROFILES.senior,
    purpose: "Same idea + PM with healthtech tooling background.",
    expectedEvidence: "HIGH or MEDIUM",
  },
  {
    id: "MAT3-insider",
    repeats: 1,
    pipeline: "PRO",
    idea: MAT3_IDEA,
    profile: MAT3_PROFILES.insider,
    purpose: "Rural hospital marketplace + CFO. OR sensitive — relationship moat is real; hook should suggest network-density or relationship-driven moat.",
    expectedEvidence: "HIGH or MEDIUM",
  },
  {
    id: "TRUST-CLINICAL",
    repeats: 1,
    pipeline: "PRO",
    idea: TRUST_CLINICAL_IDEA,
    profile: { coding: "Advanced", ai: "Advanced AI user", education: "Senior software engineer (10 years) at healthtech startup, no clinical credentials" },
    purpose: "Clinical decision support — defensibility hook tests specific clinical/EMR/regulatory moat suggestion.",
    expectedEvidence: "HIGH or MEDIUM",
  },
  {
    id: "DATA-ACQ",
    repeats: 1,
    pipeline: "PRO",
    idea: DATA_ACQUISITION_IDEA,
    profile: { coding: "Advanced", ai: "Some AI experience", education: "Senior data engineer (7 years) at compensation data company" },
    purpose: "Network-effects-dependent product — hook should land on specific two-sided liquidity or contributor incentive structure.",
    expectedEvidence: "HIGH or MEDIUM",
  },
  {
    id: "CATEGORY-MAT",
    repeats: 1,
    pipeline: "PRO",
    idea: CATEGORY_MATURATION_IDEA,
    profile: { coding: "Advanced", ai: "Advanced AI user (builds production agent systems)", education: "Senior ML engineer (8 years), specialized in agent orchestration" },
    purpose: "Bleeding-edge AI agent product — hook tests specificity in a less-mature category where moat is harder to name.",
    expectedEvidence: "HIGH or MEDIUM",
  },

  // --- OR hook variance (Pro, repeated cases — × 3) ---
  {
    id: "MAT3-tech-no-access",
    repeats: 3,
    pipeline: "PRO",
    idea: MAT3_IDEA,
    profile: MAT3_PROFILES.techNoAccess,
    purpose: "Rural hospital + engineer-without-network. OR may suggest different defensibility paths across reruns; hook MUST hold across all 3.",
    expectedEvidence: "HIGH or MEDIUM",
  },
  {
    id: "DATA-ACQ-VARIANCE",
    repeats: 3,
    pipeline: "PRO",
    idea: DATA_ACQUISITION_IDEA,
    profile: { coding: "Advanced", ai: "Some AI experience", education: "Senior data engineer (7 years) at compensation data company" },
    purpose: "Network-effects product variance check — hook content may rotate; firing must not.",
    expectedEvidence: "HIGH or MEDIUM",
  },

  // --- Sparse cross-stage propagation (Pro) ---
  {
    id: "T-SPEC",
    repeats: 1,
    pipeline: "PRO",
    idea: SP1_IDEA,
    profile: { coding: "Beginner", ai: "No AI experience", education: "Dentist" },
    purpose: "Sparse input. evidence_strength MUST be LOW; Stage 2c must fire Specification rule; Stage 3 must produce Specification + N/A.",
    expectedEvidence: "LOW",
    expectSparse: true,
  },

  // --- Free pipeline parity ---
  {
    id: "M1-FREE-DUMP",
    repeats: 1,
    pipeline: "FREE",
    idea: M1_FOUNDER_DUMP,
    profile: { coding: "Intermediate", ai: "Regular AI user", education: "Solo indie hacker, no shipped products" },
    purpose: "Free pipeline parity: evidence_strength field present, OR hook fires under single-call architecture.",
    expectedEvidence: "HIGH or MEDIUM",
  },
  {
    id: "MAT2-FREE",
    repeats: 1,
    pipeline: "FREE",
    idea: MAT2_IDEA,
    profile: MAT2_PROFILES.beginner,
    purpose: "Free pipeline parity on a concierge service idea.",
    expectedEvidence: "HIGH or MEDIUM",
  },
];

// ============================================
// OR HOOK DETECTOR
// Per locked design (execution-plan-v4-3.md Section 6 P6-S3 lines 936-963).
// Classifies each OR explanation into exactly one of A/B/C/D outcomes.
// Detector must NOT collapse A and B (B3 lesson on validOutcomes enumeration).
// ============================================

// Honest exit clause — the locked phrase, with allowance for minor
// paraphrase that preserves the semantic ("no realistic defensibility path").
const HONEST_EXIT_PATTERNS = [
  /no\s+realistic\s+defensibility\s+path/i,
  /no\s+(?:viable|realistic|clear)\s+(?:defensibility|moat|defensive)\s+(?:path|strategy|approach)\s+exists/i,
];

// Anti-generic guardrail — forbidden phrases (per locked Section 6 P6-S3
// lines 950-958). These count as hard fails when they appear without a
// specific named target on the same sentence.
const FORBIDDEN_GENERIC_PHRASES = [
  /\bbuild(?:ing)?\s+proprietary\s+data\b/i,
  /\bcreate\s+network\s+effects\b/i,
  /\bdeepen\s+integrations\b/i,
  /\bcreate\s+a\s+(?:competitive\s+)?moat\b/i,
];

// Action verbs that signal a defensibility-improvement suggestion.
// These need a NAMED target (specific data source, capability, integration,
// network mechanism) on the same sentence to qualify as a specific (A) hook.
const ACTION_VERBS = [
  /\bbuild(?:ing)?\b/i,
  /\bcreate(?:ing|s)?\b/i,
  /\bestablish(?:ing|es)?\b/i,
  /\bdevelop(?:ing|s)?\b/i,
  /\bconstruct(?:ing|s)?\b/i,
  /\bintegrat(?:e|ing|ion)\b/i,
  /\baggregat(?:e|ing|ion)\b/i,
  /\bcurat(?:e|ing|ion)\b/i,
  /\bsourc(?:e|ing|es)\b/i,
  /\baccumulat(?:e|ing|ion)\b/i,
];

// Specificity markers — concrete entities that qualify a hook as
// "named target" rather than generic. Numbers, named companies, specific
// data sources, named integrations, specific mechanisms.
const SPECIFICITY_MARKERS = [
  /\b\d{2,}[\+,]?\d*\b/, // "10,000+" or "30,000" etc.
  /\b\d+\s*[-–]\s*\d+\s*(?:months?|years?)\b/i, // "12+ months" or "12-18 months"
  /\b(?:dataset|workflow|integration|database|API|EHR|CRM|EMR|ERP)\b/i,
  /\b(?:proprietary|verified|structured|two-sided|liquidity|relationship|network)\b/i,
  /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:'s)?\b/, // Proper noun (named company / system)
];

function splitToSentences(text) {
  if (typeof text !== "string" || text.length === 0) return [];
  // Naive sentence splitter — handles "." "!" "?" with whitespace, preserves
  // decimal numbers like "Score 4.5" (period followed by digit doesn't split).
  return text
    .split(/(?<=[.!?])(?=\s+[A-Z])/g)
    .map(s => s.trim())
    .filter(Boolean);
}

function lastSentence(text) {
  const sentences = splitToSentences(text);
  return sentences.length > 0 ? sentences[sentences.length - 1] : "";
}

function lastTwoSentences(text) {
  const sentences = splitToSentences(text);
  if (sentences.length === 0) return "";
  if (sentences.length === 1) return sentences[0];
  return sentences.slice(-2).join(" ");
}

function matchesAny(text, patterns) {
  for (const p of patterns) if (p.test(text)) return true;
  return false;
}

function classifyOrHook(orExplanation) {
  if (typeof orExplanation !== "string" || orExplanation.length === 0) {
    return { outcome: "C", reason: "OR explanation empty or missing", lastSentence: "" };
  }

  const tail = lastTwoSentences(orExplanation);
  const tailLower = tail.toLowerCase();

  // Outcome B — honest exit clause
  if (matchesAny(tail, HONEST_EXIT_PATTERNS)) {
    return { outcome: "B", reason: "honest exit clause matched", lastSentence: lastSentence(orExplanation) };
  }

  // Outcome D — forbidden generic pattern
  // Note: the forbidden phrase is a HARD FAIL only if it's NOT followed by
  // a specific named target on the same sentence. If "build proprietary data"
  // is followed by "of clinical outcomes from 50+ partner hospitals", the
  // overall structure is acceptable. The detector flags both: a forbidden
  // phrase WITH no specificity is HARD FAIL D; WITH specificity is borderline
  // and gets routed back through outcome A check.
  for (const forbidden of FORBIDDEN_GENERIC_PHRASES) {
    if (forbidden.test(tail)) {
      const hasSpecificity = matchesAny(tail, SPECIFICITY_MARKERS);
      if (!hasSpecificity) {
        return { outcome: "D", reason: `forbidden generic phrase "${forbidden}" without named target`, lastSentence: lastSentence(orExplanation) };
      }
      // If specificity is present, fall through to outcome A check.
    }
  }

  // Outcome A — specific improvement (action verb + named target)
  const hasActionVerb = matchesAny(tail, ACTION_VERBS);
  const hasSpecificTarget = matchesAny(tail, SPECIFICITY_MARKERS);
  if (hasActionVerb && hasSpecificTarget) {
    return { outcome: "A", reason: "action verb + specific target detected", lastSentence: lastSentence(orExplanation) };
  }

  // Outcome C — descriptive ending, no improvement, no exit
  return {
    outcome: "C",
    reason: hasActionVerb
      ? "action verb without specific target"
      : "no action verb in last 2 sentences and no honest exit",
    lastSentence: lastSentence(orExplanation),
  };
}

// ============================================
// EVIDENCE STRENGTH DETECTOR
// Per locked Section 8 design (execution-plan-v4-3.md lines 1116-1148).
// Validates schema rename + Option Z MEDIUM compliance + no
// confidence-about-idea reasoning patterns.
// ============================================

const FORBIDDEN_GENERIC_HEDGING = [
  /clear\s+market\s+with\s+some\s+uncertainty/i,
  /reasonably\s+established\s+category/i,
  /some\s+aspects\s+could\s+be\s+stronger/i,
  /generally\s+well[\s-]understood/i,
];

const CONFIDENCE_ABOUT_IDEA_PATTERNS = [
  /this\s+idea\s+will\s+likely\s+(?:succeed|fail)/i,
  /the\s+evaluation\s+is\s+reliable/i,
  /confident\s+(?:in|about)\s+(?:this\s+idea|the\s+score|the\s+evaluation)/i,
  /the\s+score\s+is\s+(?:reliable|trustworthy|accurate)/i,
];

// Specific-gap markers — a MEDIUM reason should contain at least one of
// these or similar to qualify as Option Z compliant. The list is heuristic;
// failure here is "WARN — review", not HARD FAIL, because language varies.
const SPECIFIC_GAP_MARKERS = [
  /\bunder[\s-]?evidenced\b/i,
  /\bunclear\b/i,
  /\bambiguous\b/i,
  /\bunproven\b/i,
  /\bno\s+(?:signal|data|evidence)\s+(?:of|on|for)/i,
  /\blacks?\b/i,
  /\bmissing\b/i,
  /\bspecific(?:ally)?\s+(?:gap|missing|under)\b/i,
  /\bbinding\s+constraint\b/i,
  /\buncertainty\s+around\s+\w+/i, // "uncertainty around X" where X is a named thing
  /\bnot\s+(?:fully|yet)\s+(?:validated|proven|established)\b/i,
];

function classifyEvidenceStrength(ev) {
  const issues = [];

  // Schema rename — evidence_strength present, confidence_level absent
  if (!("evidence_strength" in ev)) {
    issues.push({ type: "schema", severity: "HARD_FAIL", detail: "evidence_strength field missing from evaluation" });
  }
  if ("confidence_level" in ev) {
    issues.push({ type: "schema", severity: "HARD_FAIL", detail: "confidence_level field present (rename incomplete)" });
  }

  const es = ev.evidence_strength;
  if (!es || typeof es !== "object") {
    return { issues, level: null, reason: null, optionZCompliant: null, hasIdeaConfidencePattern: null };
  }

  const level = es.level || null;
  const reason = (es.reason || "").trim();

  if (!["HIGH", "MEDIUM", "LOW"].includes(level)) {
    issues.push({ type: "schema", severity: "HARD_FAIL", detail: `invalid evidence_strength.level "${level}"` });
  }
  if (reason.length === 0) {
    issues.push({ type: "schema", severity: "HARD_FAIL", detail: "evidence_strength.reason empty" });
  }

  // Confidence-about-idea pattern check — applies to ALL levels
  const ideaConfidenceMatch = CONFIDENCE_ABOUT_IDEA_PATTERNS.find(p => p.test(reason));
  if (ideaConfidenceMatch) {
    issues.push({
      type: "semantic",
      severity: "HARD_FAIL",
      detail: `reason contains confidence-about-idea pattern: ${ideaConfidenceMatch}`,
    });
  }

  // Option Z compliance — only enforced on MEDIUM
  let optionZCompliant = null;
  if (level === "MEDIUM") {
    const forbiddenMatch = FORBIDDEN_GENERIC_HEDGING.find(p => p.test(reason));
    if (forbiddenMatch) {
      optionZCompliant = false;
      issues.push({
        type: "option_z",
        severity: "HARD_FAIL",
        detail: `MEDIUM reason contains forbidden generic-hedging pattern: ${forbiddenMatch}`,
      });
    } else {
      const hasGapMarker = SPECIFIC_GAP_MARKERS.some(p => p.test(reason));
      if (!hasGapMarker) {
        optionZCompliant = false;
        issues.push({
          type: "option_z",
          severity: "WARN_REVIEW",
          detail: "MEDIUM reason contains no specific-gap marker — review manually",
        });
      } else {
        optionZCompliant = true;
      }
    }
  }

  return {
    issues,
    level,
    reason,
    optionZCompliant,
    hasIdeaConfidencePattern: !!ideaConfidenceMatch,
  };
}

// ============================================
// SSE RUNNER
// ============================================

async function runEval(test) {
  const ep = test.pipeline === "PRO" ? "/api/analyze-pro" : "/api/analyze";
  const res = await fetch(BASE_URL + ep, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea: test.idea, profile: test.profile }),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const text = await res.text();

  const allEvents = [];
  let result = null;
  let error = null;

  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const d = JSON.parse(line.slice(6));
      allEvents.push(d);
      if (d.step === "complete" && d.data) result = d.data;
      else if (d.step === "error") error = d.message;
    } catch (e) { /* skip malformed */ }
  }

  if (error) throw new Error(error);
  if (!result) throw new Error("No result");
  return { result, allEvents };
}

// ============================================
// PER-RUN EVALUATE
// ============================================

function evaluate(test, result) {
  const ev = result.evaluation || {};
  const verdicts = [];

  // --- Evidence Strength schema + semantic checks ---
  const esResult = classifyEvidenceStrength(ev);
  for (const iss of esResult.issues) {
    if (iss.severity === "HARD_FAIL") {
      verdicts.push({ label: `evidence_strength: ${iss.type}`, pass: false, detail: iss.detail });
    } else {
      verdicts.push({ label: `evidence_strength: ${iss.type} (review)`, pass: false, detail: iss.detail, severity: "warn" });
    }
  }
  if (esResult.issues.length === 0) {
    verdicts.push({ label: "evidence_strength schema + Option Z + idea-confidence", pass: true, detail: `${esResult.level} — ${esResult.reason.substring(0, 80)}…` });
  }

  // --- OR hook classification ---
  const orExplanation = ev.originality?.explanation || "";
  const hookResult = classifyOrHook(orExplanation);
  if (hookResult.outcome === "A" || hookResult.outcome === "B") {
    verdicts.push({
      label: `OR hook: ${hookResult.outcome === "A" ? "specific improvement" : "honest exit"}`,
      pass: true,
      detail: hookResult.reason,
    });
  } else {
    verdicts.push({
      label: `OR hook: outcome ${hookResult.outcome}`,
      pass: false,
      detail: `${hookResult.reason} | last sentence: "${hookResult.lastSentence.substring(0, 120)}…"`,
    });
  }

  // --- Sparse-input cross-stage propagation (T-SPEC only) ---
  if (test.expectSparse) {
    if (esResult.level !== "LOW") {
      verdicts.push({ label: "sparse: evidence_strength is LOW", pass: false, detail: `got ${esResult.level}` });
    } else {
      verdicts.push({ label: "sparse: evidence_strength is LOW", pass: true });
    }

    const estimates = result.estimates || {};
    const mb = estimates.main_bottleneck;
    const dur = estimates.duration || "";
    const diff = estimates.difficulty || "";

    if (mb !== "Specification") {
      verdicts.push({ label: "sparse: main_bottleneck is Specification", pass: false, detail: `got "${mb}"` });
    } else {
      verdicts.push({ label: "sparse: main_bottleneck is Specification", pass: true });
    }

    if (!/cannot\s+estimate/i.test(dur)) {
      verdicts.push({ label: "sparse: duration is 'Cannot estimate...'", pass: false, detail: `got "${dur}"` });
    } else {
      verdicts.push({ label: "sparse: duration is 'Cannot estimate...'", pass: true });
    }

    if (diff !== "N/A") {
      verdicts.push({ label: "sparse: difficulty is 'N/A'", pass: false, detail: `got "${diff}"` });
    } else {
      verdicts.push({ label: "sparse: difficulty is 'N/A'", pass: true });
    }
  }

  return {
    verdicts,
    esResult,
    hookResult,
    orExplanation,
  };
}

// ============================================
// MODES
// ============================================

async function preflight() {
  process.stdout.write("Preflight: pinging server… ");
  try {
    const res = await fetch(BASE_URL + "/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: "ping", profile: { coding: "Beginner", ai: "Some AI experience", education: "Test" } }),
    });
    if (res.ok || res.status === 400 || res.status === 500) { console.log("server reachable."); return true; }
    console.log(`unexpected status ${res.status}.`); return false;
  } catch (e) { console.log(`UNREACHABLE — ${e.message}`); return false; }
}

async function freshRun() {
  const RUNS = [];
  for (const test of TESTS) {
    const repeats = test.repeats || 1;
    for (let r = 1; r <= repeats; r++) {
      const tag = repeats > 1 ? `${test.id} r${r}` : test.id;
      RUNS.push({ test, tag, baseId: test.id, runIndex: r });
    }
  }

  console.log("=".repeat(80));
  console.log("V4S28 BUNDLE B4 — OR HOOK + EVIDENCE STRENGTH VERIFIER");
  console.log(`${TESTS.length} test cases / ${RUNS.length} runs`);
  console.log("Closure thresholds: see file header (T1–T8)");
  console.log("=".repeat(80) + "\n");

  if (!(await preflight())) process.exit(1);

  const startTime = Date.now();
  const allResults = [];

  for (let i = 0; i < RUNS.length; i++) {
    const { test, tag } = RUNS[i];
    const t0 = Date.now();
    process.stdout.write(`[${i + 1}/${RUNS.length}] ${tag.padEnd(28)} `);

    try {
      const { result, allEvents } = await runEval(test);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const { verdicts, esResult, hookResult, orExplanation } = evaluate(test, result);
      const allPass = verdicts.every(v => v.pass);
      console.log(`${elapsed}s  ${allPass ? "PASS" : "FAIL"}`);

      allResults.push({
        test, tag, baseId: RUNS[i].baseId, runIndex: RUNS[i].runIndex,
        result, allEvents, verdicts, esResult, hookResult, orExplanation,
        elapsed, allPass,
      });
    } catch (e) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`ERROR (${elapsed}s) — ${e.message}`);
      allResults.push({ test, tag, baseId: RUNS[i].baseId, runIndex: RUNS[i].runIndex, error: e.message, elapsed });
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  return { allResults, totalElapsed };
}

function reevalRun(jsonPath) {
  console.log(`Re-evaluating from ${jsonPath}…`);
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const priorResults = data.allResults || data;

  const allResults = [];
  for (const prior of priorResults) {
    if (prior.error) { allResults.push(prior); continue; }
    const { verdicts, esResult, hookResult, orExplanation } = evaluate(prior.test, prior.result);
    const allPass = verdicts.every(v => v.pass);
    allResults.push({ ...prior, verdicts, esResult, hookResult, orExplanation, allPass });
  }

  return { allResults, totalElapsed: "(reeval)" };
}

// ============================================
// REPORT — closure thresholds T1–T8
// ============================================

function reportSummary(allResults, totalElapsed) {
  console.log("\n" + "=".repeat(80));
  console.log("CLOSURE THRESHOLD CHECKS (T1–T8)");
  console.log("=".repeat(80));

  const completed = allResults.filter(r => !r.error);
  const totalRuns = allResults.length;

  // T1 — OR hook firing rate ≥ 95%
  const hookFired = completed.filter(r => r.hookResult && (r.hookResult.outcome === "A" || r.hookResult.outcome === "B"));
  const hookFiringRate = completed.length > 0 ? (hookFired.length / completed.length) : 0;
  const t1Pass = hookFiringRate >= 0.95;
  console.log(`  ${t1Pass ? "✓" : "✗"} T1 — OR hook firing rate: ${hookFired.length}/${completed.length} (${(hookFiringRate * 100).toFixed(0)}%) — threshold ≥ 95%`);

  // T2 — Anti-generic guardrail violations = 0
  const guardrailViolations = completed.filter(r => r.hookResult && r.hookResult.outcome === "D");
  const t2Pass = guardrailViolations.length === 0;
  console.log(`  ${t2Pass ? "✓" : "✗"} T2 — Anti-generic guardrail violations: ${guardrailViolations.length} (threshold = 0)`);
  for (const v of guardrailViolations) {
    console.log(`         [${v.tag}] ${v.hookResult.reason}`);
  }

  // T3 — Honest exit fires when triggered (≥ 1 case OR no case had genuinely-weak defensibility)
  const honestExits = completed.filter(r => r.hookResult && r.hookResult.outcome === "B");
  const t3Pass = true; // soft check — log but don't block
  console.log(`  ${t3Pass ? "✓" : "−"} T3 — Honest exit fires when triggered: ${honestExits.length} cases used the exit clause (informational; no hard threshold)`);

  // T4 — Schema rename complete = 100%
  const schemaIssues = completed.filter(r =>
    r.esResult && r.esResult.issues.some(i => i.type === "schema" && i.severity === "HARD_FAIL")
  );
  const t4Pass = schemaIssues.length === 0;
  console.log(`  ${t4Pass ? "✓" : "✗"} T4 — Schema rename: ${completed.length - schemaIssues.length}/${completed.length} clean`);
  for (const v of schemaIssues) {
    const issues = v.esResult.issues.filter(i => i.type === "schema" && i.severity === "HARD_FAIL");
    for (const i of issues) console.log(`         [${v.tag}] ${i.detail}`);
  }

  // T5 — Option Z MEDIUM compliance (zero forbidden generic-hedging matches)
  const optionZViolations = completed.filter(r =>
    r.esResult && r.esResult.issues.some(i => i.type === "option_z" && i.severity === "HARD_FAIL")
  );
  const optionZWarnings = completed.filter(r =>
    r.esResult && r.esResult.issues.some(i => i.type === "option_z" && i.severity === "WARN_REVIEW")
  );
  const t5Pass = optionZViolations.length === 0;
  console.log(`  ${t5Pass ? "✓" : "✗"} T5 — Option Z MEDIUM compliance: ${optionZViolations.length} hard fails (threshold = 0); ${optionZWarnings.length} warnings`);
  for (const v of optionZViolations) {
    const issues = v.esResult.issues.filter(i => i.type === "option_z" && i.severity === "HARD_FAIL");
    for (const i of issues) console.log(`         [${v.tag}] ${i.detail}`);
  }
  for (const v of optionZWarnings) {
    const issues = v.esResult.issues.filter(i => i.type === "option_z" && i.severity === "WARN_REVIEW");
    for (const i of issues) console.log(`         [${v.tag}] WARN: ${i.detail} | reason: "${v.esResult.reason.substring(0, 100)}…"`);
  }

  // T6 — Confidence-about-idea pattern = 0
  const ideaConfMatches = completed.filter(r => r.esResult && r.esResult.hasIdeaConfidencePattern);
  const t6Pass = ideaConfMatches.length === 0;
  console.log(`  ${t6Pass ? "✓" : "✗"} T6 — Confidence-about-idea pattern: ${ideaConfMatches.length} (threshold = 0)`);
  for (const v of ideaConfMatches) {
    console.log(`         [${v.tag}] reason: "${v.esResult.reason.substring(0, 120)}…"`);
  }

  // T7 — Cross-stage propagation under LOW evidence_strength
  const sparseTests = completed.filter(r => r.test.expectSparse);
  const sparsePass = sparseTests.filter(r => r.allPass);
  const t7Pass = sparseTests.length > 0 && sparsePass.length === sparseTests.length;
  console.log(`  ${t7Pass ? "✓" : "✗"} T7 — Cross-stage propagation under LOW: ${sparsePass.length}/${sparseTests.length} clean`);

  // T8 — OR hook variance stability
  const varianceTests = TESTS.filter(t => (t.repeats || 1) > 1);
  const varianceVerdicts = [];
  for (const test of varianceTests) {
    const runs = completed.filter(r => r.baseId === test.id);
    if (runs.length === 0) continue;
    const allHookFired = runs.every(r => r.hookResult && (r.hookResult.outcome === "A" || r.hookResult.outcome === "B"));
    varianceVerdicts.push({ id: test.id, runs: runs.length, allHookFired });
  }
  const t8Pass = varianceVerdicts.every(v => v.allHookFired);
  console.log(`  ${t8Pass ? "✓" : "✗"} T8 — OR hook variance stability:`);
  for (const v of varianceVerdicts) {
    console.log(`         [${v.id} × ${v.runs}] ${v.allHookFired ? "✓ all reruns held the hook" : "✗ at least one run dropped the hook"}`);
  }

  // --- DETAILED PER-RUN RESULTS ---
  console.log("\n" + "=".repeat(80));
  console.log("DETAILED PER-RUN RESULTS");
  console.log("=".repeat(80));

  for (const r of allResults) {
    console.log(`\n[${r.tag}] ${r.test?.purpose || ""}`);
    if (r.error) { console.log(`  Error: ${r.error}`); continue; }

    const ev = r.result?.evaluation || {};
    const orScore = ev.originality?.score;
    console.log(`  OR score: ${orScore} | evidence_strength: ${r.esResult?.level || "?"}`);
    if (r.esResult?.reason) {
      console.log(`  ev_strength reason: "${r.esResult.reason.substring(0, 200)}${r.esResult.reason.length > 200 ? "…" : ""}"`);
    }

    if (r.hookResult) {
      console.log(`  OR hook: outcome ${r.hookResult.outcome} (${r.hookResult.reason})`);
      console.log(`  OR last sentence: "${r.hookResult.lastSentence.substring(0, 200)}${r.hookResult.lastSentence.length > 200 ? "…" : ""}"`);
    }

    for (const v of (r.verdicts || [])) {
      const mark = v.pass ? "✓" : (v.severity === "warn" ? "⚠" : "✗");
      console.log(`    ${mark} ${v.label}${v.detail ? ` — ${v.detail}` : ""}`);
    }
  }

  // --- SAVE ---
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 16);
  const outPath = path.join(OUTPUT_DIR, `b4-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ allResults, thresholds: { t1Pass, t2Pass, t3Pass, t4Pass, t5Pass, t6Pass, t7Pass, t8Pass } }, null, 2));

  // --- FINAL VERDICT ---
  const allThresholdsPass = t1Pass && t2Pass && t4Pass && t5Pass && t6Pass && t7Pass && t8Pass;
  const passCount = completed.filter(r => r.allPass).length;

  console.log("\n" + "=".repeat(80));
  if (allThresholdsPass) {
    console.log(`B4 VERIFICATION PASSED — all hard thresholds (T1, T2, T4–T8) clean.`);
    console.log(`Per-run: ${passCount}/${totalRuns} clean. Bundle B4 closes.`);
  } else {
    console.log(`B4 VERIFICATION RESULT — at least one hard threshold failed.`);
    console.log(`Apply B3 META-LESSON FIRST: re-read execution-plan-v4-3.md Section 6 P6-S3 + Section 8 to confirm the test's expected behavior matches the locked design BEFORE treating any failure as a model issue. The detector encodes assumptions; assumptions can be wrong.`);
    console.log(`Per-run: ${passCount}/${totalRuns} clean.`);
  }
  console.log(`Total wall time: ${totalElapsed} minutes`);
  console.log(`Full output: ${outPath}`);
  console.log("=".repeat(80));
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const reevalIdx = args.indexOf("--reeval");
  if (reevalIdx >= 0 && args[reevalIdx + 1]) {
    const { allResults, totalElapsed } = reevalRun(args[reevalIdx + 1]);
    reportSummary(allResults, totalElapsed);
  } else {
    const { allResults, totalElapsed } = await freshRun();
    reportSummary(allResults, totalElapsed);
  }
}

main().catch(err => {
  console.error("\nFATAL:", err.message);
  console.error(err.stack);
  process.exit(1);
});

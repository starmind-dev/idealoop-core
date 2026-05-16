// ============================================================================
// runners/run-v4s29-stage2c-prose-verification-http.js
// ============================================================================
// V4S29 Stage 2c Structural Reorganization — full-pipeline prose verification.
//
// Pattern: forked from run-v4s29-stage2b-rigor-verification-http.js. Same HTTP
// + SSE + fixture-mode + checkpoint/resume architecture. Different surface:
// Stage 2b verified score drift; Stage 2c verifies prose discipline (archetype
// routing, sentence-1 subject discipline, summary opener archetype selection,
// anti-template structural diversity).
//
// PREREQUISITE: Dev server running with IDEALOOP_USE_FIXTURES=1 in another
// terminal:
//     IDEALOOP_USE_FIXTURES=1 npm run dev
//
// PREREQUISITE: New prompt-stage2c.js already at src/lib/services/prompt-stage2c.js
// (V4S29 reorganization with 33 rows + D2 definition + Risk 3 Decision Procedure
//  + 65 worked examples; subtype split A1/A2/A3 internal, emits "A" in JSON).
//
// Cases: 13 (selected for Stage 2c surface coverage — tri-bucket + all 7
// archetypes + 2 FP guards + 4 of 5 B4 frames + low/mid band coverage)
// Reruns: 3 (default) — Stage 2c at temp=0 has lower variance than Stage 2b
// Total runs: 39
// Wall time estimate: ~90 min with fixtures cached (~140s per run)
//
// Verification has THREE tiers (Phase 3 spec):
//   1. AUTOMATED HARD GATES — pattern detection on emitted prose. Per-case
//      check function returns pass/fail. Hard failure breaks overall verdict.
//   2. SOFT DIAGNOSTICS — distribution metrics across all runs (archetype
//      distribution, summary length, "Your..." prevalence, firing rate).
//      Informational; documented in report.
//   3. PROSE DUMP FOR MANUAL REVIEW — full Summary + Risk 1/2/3 prose per
//      case per rerun, organized for the human reviewer to evaluate
//      synthesis-not-enumeration, specificity test, predicate balance, etc.
//      per Phase 3 manual-hard-gate spec.
//
// Verification criteria are LOCKED before launch (Methodology Principle 6).
//
// Usage:
//   node run-v4s29-stage2c-prose-verification-http.js
//   node run-v4s29-stage2c-prose-verification-http.js --resume
//   node run-v4s29-stage2c-prose-verification-http.js --reruns 5
//   node run-v4s29-stage2c-prose-verification-http.js --no-require-fixtures
//   node run-v4s29-stage2c-prose-verification-http.js --base-url http://...
//
// Outputs (in runners/):
//   v4s29-stage2c-http-checkpoint.json — resume state
//   v4s29-stage2c-http-results.json    — full per-case prose + auto gate results
//   v4s29-stage2c-http-report.md       — human-readable verdict + prose dump
// ============================================================================

const fs = require("fs");
const path = require("path");
const { ALL_CASES } = require("../cases.js");

// ============================================================================
// CONFIG
// ============================================================================

const args = process.argv.slice(2);
const RESUME = args.includes("--resume");
const NO_REQUIRE_FIXTURES = args.includes("--no-require-fixtures");
const RERUN_COUNT = (() => {
  const idx = args.indexOf("--reruns");
  if (idx !== -1 && args[idx + 1]) return parseInt(args[idx + 1], 10) || 3;
  return 3;
})();
const BASE_URL = (() => {
  const idx = args.indexOf("--base-url");
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return process.env.IDEALOOP_BASE_URL || "http://localhost:3000";
})();

const CHECKPOINT_PATH = path.join(__dirname, "v4s29-stage2c-http-checkpoint.json");
const RESULTS_PATH    = path.join(__dirname, "v4s29-stage2c-http-results.json");
const REPORT_PATH     = path.join(__dirname, "v4s29-stage2c-http-report.md");
const FIXTURES_DIR    = path.join(__dirname, "fixtures", "data");

// 13 PRO cases. Order: AUDIT-MAT3-partial first (CRITICAL F14 PARTIAL-INSIDER
// test + pre-flight sanity).
const CASES = [
  "AUDIT-MAT3-partial",        // F14 PARTIAL-INSIDER bucket test (CRITICAL)
  "AUDIT-MAT3-insider",        // BUCKET 1 INSIDER → Risk 3 drop (FP guard)
  "AUDIT-MAT3-tech-no-access", // OUTSIDER → Risk 3 fire archetype B
  "AUDIT-A3",                  // Archetype A3 subtype (regulated infra)
  "AUDIT-MAT1-beginner",       // Archetype A1 subtype (engineering)
  "AUDIT-M3",                  // Archetype A2 subtype (AI/data systems)
  "ARC-C1",                    // Archetype C activation (credibility)
  "ARC-D1",                    // Archetype D activation (capital)
  "ARC-E1",                    // Archetype E activation (sales motion)
  "AUDIT-M2",                  // Well-justified CONTROL — Risk 3 FP guard
  "AUDIT-H2",                  // β-archetype mid-band + Frame 2 (consolidation)
  "AUDIT-L2",                  // Low-band α1/α2 Summary opener
  "AUDIT-M1",                  // Frame 3 Risk 1 (LLM substitution)
];

// ============================================================================
// BANNED PATTERNS — automated hard gates
// ============================================================================
//
// Each pattern detects a documented Stage 2c disease from B10a findings:
//   F17 — Summary "Your N years..." opener (cured by Bundle 3/3.5)
//   F18 — Risk 1 "is increasingly consolidated around established platforms"
//   F2  — Risk 3 archetype A "Building X requires Y..." skeleton
//   Risk 5 — Per-archetype templating B/C/D/E
//   D6  — Internal label hygiene
// ============================================================================

const SUMMARY_F17_PATTERN = /^\s*your\s+\d+\s+years?/i;

const RISK1_F18_PATTERN = /is\s+increasingly\s+consolidated\s+around\s+established\s+platforms/i;

// Archetype A (A1, A2, A3) banned sentence-1 opener
const RISK3_A_BUILDING_PATTERN = /^\s*Building\s+\S+.+\brequires?\b/i;

// Archetype B banned sentence-1 opener
const RISK3_B_REACHING_PATTERN = /^\s*(Reaching|Converting)\s+\S+.{0,80}\btypically\s+requires?\b/i;

// Archetype C banned sentence-1 opener (e.g., "Rural physicians evaluate clinical decision support based on")
const RISK3_C_EVALUATE_PATTERN = /^\s*\S+(\s+\S+){0,6}\s+evaluate\s+\S+(\s+\S+){0,6}\s+based\s+on/i;

// Archetype D banned sentence-1 opener
const RISK3_D_REQUIRES_DOLLAR_PATTERN = /^\s*(This\s+idea\s+requires|The\s+\$\d)/i;

// Archetype E banned sentence-1 opener
const RISK3_E_CONVERTING_NAVIGATING_PATTERN = /^\s*Converting\s+\S+.{0,80}\brequires?\s+navigating/i;

// Generic Risk 3 duration ban anywhere in text (per C5 generic "12+ months" forbidden)
const RISK3_GENERIC_DURATION_PATTERN = /\b12\+\s+months\b/i;

// D6 internal labels — must not appear in user-facing prose
const INTERNAL_LABEL_PATTERNS = [
  /\bRisk\s+[123]\b/i,
  /\bfounder_fit\s+slot\b/i,
  /\bmarket_category\s+slot\b/i,
  /\btrust_adoption\s+slot\b/i,
  /\barchetype\s+[A-E][123]?\b/i,
  /\bSTEP\s+[12]\b/i,
  /\bBucket\s+[123]\b/i,
  /\b(INSIDER|PARTIAL-INSIDER|OUTSIDER)\b/,
  /\b(α[12]|β[123]|γ[1234])\b/,
  /\bcase-truth\b/i,
  /\bBlock\s+[A-E]-prompt\b/i,
];

// ============================================================================
// PER-CASE EXPECTATIONS
// ============================================================================
//
// Each case has:
//   - label: short description
//   - expected_risk3_fire: true | false | null (null = either acceptable)
//   - expected_archetype: "A" | "B" | "C" | "D" | "E" | null (null = either)
//   - tier3_test: optional special-case test (e.g., MAT3-partial classification)
// ============================================================================

const CASE_EXPECTATIONS = {
  "AUDIT-MAT3-partial": {
    label: "F14 PARTIAL-INSIDER bucket test (CRITICAL)",
    expected_risk3_fire: true,
    expected_archetype: "B", // partial-insider lacks specific buyer-side decision-maker access
    notes: "Hospital marketing director building hospital procurement platform. PARTIAL-INSIDER per C3 — adjacent operational role but not the buyer-side decision-maker. Substantive-fire test: YES, Risk 3 fires. Archetype B likely (network/access gap to CFOs/procurement leaders). Watch: does prose treat as partial-insider (not full insider, not full outsider)?",
  },
  "AUDIT-MAT3-insider": {
    label: "BUCKET 1 INSIDER → Risk 3 drop (FP guard)",
    expected_risk3_fire: false,
    expected_archetype: null,
    notes: "Former rural hospital CFO building hospital procurement platform. BUCKET 1 INSIDER per C3 — multi-year practitioner role IN target domain. Risk 3 should DROP per Step 2 STOP.",
  },
  "AUDIT-MAT3-tech-no-access": {
    label: "OUTSIDER → Risk 3 fire archetype B",
    expected_risk3_fire: true,
    expected_archetype: "B",
    notes: "Engineer at healthtech (not hospital insider). OUTSIDER per C3. Substantive-fire YES. Archetype B (no buyer-side network in hospital procurement).",
  },
  "AUDIT-A3": {
    label: "Archetype A3 subtype test (regulated infrastructure)",
    expected_risk3_fire: true,
    expected_archetype: "A", // emits "A" per Option C JSON output (A3 internal subtype)
    notes: "HIPAA-regulated telehealth requiring compliance infrastructure. Internal subtype A3 (regulated infra), emits 'A' in JSON. Watch: does prose draw on regulated-infrastructure evidence (HIPAA, audit trails, regulated APIs) rather than generic engineering build description?",
  },
  "AUDIT-MAT1-beginner": {
    label: "Archetype A1 subtype test (engineering capacity)",
    expected_risk3_fire: true,
    expected_archetype: "A",
    notes: "Beginner coder, legal doc automation idea. Internal subtype A1 (engineering capacity), emits 'A' in JSON. Watch: does prose anchor to generalist software build difficulty (not regulated infra, not AI/data systems)?",
  },
  "AUDIT-M3": {
    label: "Archetype A2 subtype test (AI/data systems) — speculative routing",
    expected_risk3_fire: null,
    expected_archetype: null,
    notes: "AI manuscript editing for non-native PhDs. Founder is PhD computational biology. Product value depends on ML/model quality (discipline-specific writing conventions). Possible A2 subtype (AI/data systems gap), but could also route differently. Open routing test.",
  },
  "ARC-C1": {
    label: "Archetype C activation (credibility)",
    expected_risk3_fire: true,
    expected_archetype: "C",
    notes: "Clinical decision support idea + non-medical founder. High-trust domain, no credential. Archetype C should fire.",
  },
  "ARC-D1": {
    label: "Archetype D activation (capital/runway)",
    expected_risk3_fire: true,
    expected_archetype: "D",
    notes: "Hardware product requiring substantial pre-revenue investment. Archetype D should fire.",
  },
  "ARC-E1": {
    label: "Archetype E activation (sales motion)",
    expected_risk3_fire: true,
    expected_archetype: "E",
    notes: "Enterprise procurement target, founder lacks enterprise sales motion. Archetype E should fire.",
  },
  "AUDIT-M2": {
    label: "Well-justified CONTROL — Risk 3 FP guard",
    expected_risk3_fire: false,
    expected_archetype: null,
    notes: "Trade association marketing director building newsletter platform for trade associations. Founder IS the relevant insider (marketing AT trade associations is the relevant role for selling TO trade associations). Risk 3 should DROP.",
  },
  "AUDIT-H2": {
    label: "INSIDER β-archetype + Frame 2 (consolidation)",
    expected_risk3_fire: false,
    expected_archetype: null,
    notes: "Restaurant consultant building restaurant POS tool. INSIDER per C3. Risk 3 should DROP. Watch Risk 1 frame selection (Frame 2 consolidation expected — MarginEdge).",
  },
  "AUDIT-L2": {
    label: "Low-band α1/α2 Summary opener test",
    expected_risk3_fire: null, // depends on substantive-fire judgment
    expected_archetype: null,
    notes: "Former elementary school principal, no coding, two-sided tutor marketplace. Low overall (4.2). Watch Summary opener: should be α1 (binding weakness — marketplace cold-start + commoditized alternative) OR α2 (founder gap if it's the binding weakness). Risk 3 routing is open; market_category likely dominant.",
  },
  "AUDIT-M1": {
    label: "Frame 3 Risk 1 (LLM substitution) + FP-adjacent",
    expected_risk3_fire: null,
    expected_archetype: null,
    notes: "Solo indie hacker, habit tracker w/ AI coach. Saturated category, LLM substitution. Watch Risk 1: should fire Frame 3 (substitution). Risk 3 substantive-fire: marginal — founder identity doesn't materially change saturated-category/LLM-substitute binding constraints; Risk 3 drop is defensible.",
  },
};

// ============================================================================
// SSE EVAL (run-v4s29-stage2b-rigor-verification-http.js pattern)
// ============================================================================

async function runEval(caseDef) {
  const ep = caseDef.pipeline === "PRO" ? "/api/analyze-pro" : "/api/analyze";
  const runStart = Date.now();
  const res = await fetch(BASE_URL + ep, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea: caseDef.idea, profile: caseDef.profile }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  let errMsg = null;
  let gateFired = false;

  const consumeLine = (line) => {
    if (!line.startsWith("data: ")) return;
    try {
      const d = JSON.parse(line.slice(6));
      if (d.step === "complete" && d.data) result = d.data;
      else if (d.step === "error") errMsg = d.message;
      if (d.specificity_insufficient === true || d.data?.specificity_insufficient === true) {
        gateFired = true;
      }
    } catch { /* skip malformed */ }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) consumeLine(line);
  }
  if (buffer) consumeLine(buffer);

  if (errMsg) throw new Error(errMsg);
  if (!gateFired && !result) throw new Error("No result and no gate fire (stream ended without complete event)");

  return { result, gateFired, totalMs: Date.now() - runStart };
}

// ============================================================================
// STAGE 2c EXTRACTION
// ============================================================================

function firstSentence(text) {
  if (!text || typeof text !== "string") return "";
  // Naive sentence split — first period/!/? not preceded by abbreviation context.
  // Good enough for the openers we care about.
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : trimmed;
}

function extractStage2c(result, gateFired) {
  if (gateFired) {
    return {
      gated: true,
      summary: null,
      summary_length: 0,
      summary_sentence1: null,
      summary_starts_with_your_n_years: false,
      risks: [],
      risk_count: 0,
      risk3_fired: false,
      risk3_archetype: null,
      evidence_level: null,
    };
  }
  const ev = result?.evaluation || {};
  const summary = ev.summary || "";
  const risks = Array.isArray(ev.failure_risks) ? ev.failure_risks : [];

  const risk3 = risks.find((r) => r.slot === "founder_fit") || null;
  const risk1Entries = risks.filter((r) => r.slot === "market_category");
  const risk2Entries = risks.filter((r) => r.slot === "trust_adoption");

  return {
    gated: false,
    summary,
    summary_length: summary.length,
    summary_sentence1: firstSentence(summary),
    summary_starts_with_your_n_years: SUMMARY_F17_PATTERN.test(summary),
    risks,
    risk_count: risks.length,
    risk1: risk1Entries[0] || null,
    risk1_all: risk1Entries,
    risk2: risk2Entries[0] || null,
    risk2_all: risk2Entries,
    risk3,
    risk3_fired: !!risk3,
    risk3_archetype: risk3?.archetype ?? null,
    risk3_text: risk3?.text || null,
    risk3_sentence1: risk3 ? firstSentence(risk3.text || "") : null,
    risk1_sentence1: risk1Entries[0] ? firstSentence(risk1Entries[0].text || "") : null,
    risk2_sentence1: risk2Entries[0] ? firstSentence(risk2Entries[0].text || "") : null,
    evidence_level: ev.evidence_strength?.level || null,
  };
}

// ============================================================================
// AUTOMATED HARD GATE CHECKS
// ============================================================================

function checkAutoGates(extracted, caseId) {
  if (extracted.gated) return { failures: [], naReason: "gated upstream" };

  const failures = [];

  // F17 — Summary "Your N years..." opener
  if (extracted.summary_starts_with_your_n_years) {
    failures.push({
      gate: "F17_SUMMARY_YOUR_N_YEARS",
      detail: `Summary sentence-1 opens with "Your N years..." pattern: "${extracted.summary_sentence1?.substring(0, 120)}"`,
    });
  }

  // F18 — Risk 1 banned consolidation phrase (check ALL Risk 1 entries if multiple)
  for (const r1 of extracted.risk1_all || []) {
    if (RISK1_F18_PATTERN.test(r1.text || "")) {
      failures.push({
        gate: "F18_RISK1_CONSOLIDATED_PATTERN",
        detail: `Risk 1 contains banned 5-gram: "${(r1.text || "").substring(0, 160)}"`,
      });
    }
  }

  // D6 — Internal label hygiene (Summary + all Risk text fields)
  const proseFields = [
    { label: "summary", text: extracted.summary || "" },
    ...((extracted.risks || []).map((r, i) => ({ label: `risk[${i}].text`, text: r.text || "" }))),
  ];
  for (const { label, text } of proseFields) {
    for (const pat of INTERNAL_LABEL_PATTERNS) {
      const m = text.match(pat);
      if (m) {
        failures.push({
          gate: "D6_INTERNAL_LABEL",
          detail: `${label} contains internal label "${m[0]}" — full match context: "${text.substring(Math.max(0, m.index - 30), Math.min(text.length, m.index + 60))}"`,
        });
      }
    }
  }

  // Risk 3 specific checks (only if Risk 3 fired)
  if (extracted.risk3_fired) {
    const r3text = extracted.risk3_text || "";
    const r3s1 = extracted.risk3_sentence1 || "";
    const archetype = extracted.risk3_archetype;

    // Archetype field validity — must be A/B/C/D/E (Option C: subtype split internal, emits "A")
    if (!["A", "B", "C", "D", "E"].includes(archetype)) {
      failures.push({
        gate: "ARCHETYPE_FIELD_VALIDITY",
        detail: `Risk 3 archetype field is "${archetype}" — expected one of A/B/C/D/E (subtype A1/A2/A3 should emit "A" per Option C JSON output mapping)`,
      });
    }

    // Generic duration ban
    if (RISK3_GENERIC_DURATION_PATTERN.test(r3text)) {
      failures.push({
        gate: "RISK3_GENERIC_DURATION",
        detail: `Risk 3 contains generic "12+ months" pattern (forbidden per C5): "${r3text.substring(0, 200)}"`,
      });
    }

    // F2 — Archetype A banned skeleton
    if (archetype === "A" && RISK3_A_BUILDING_PATTERN.test(r3s1)) {
      failures.push({
        gate: "F2_ARCHETYPE_A_BUILDING_SKELETON",
        detail: `Archetype A Risk 3 sentence-1 opens with banned "Building X requires Y..." pattern: "${r3s1}"`,
      });
    }

    // Archetype B banned skeleton
    if (archetype === "B" && RISK3_B_REACHING_PATTERN.test(r3s1)) {
      failures.push({
        gate: "RISK5_ARCHETYPE_B_REACHING_SKELETON",
        detail: `Archetype B Risk 3 sentence-1 opens with banned "Reaching/Converting [buyer] typically requires..." pattern: "${r3s1}"`,
      });
    }

    // Archetype C banned skeleton
    if (archetype === "C" && RISK3_C_EVALUATE_PATTERN.test(r3s1)) {
      failures.push({
        gate: "RISK5_ARCHETYPE_C_EVALUATE_SKELETON",
        detail: `Archetype C Risk 3 sentence-1 opens with banned "[Buyer segment] evaluate [service] based on..." pattern: "${r3s1}"`,
      });
    }

    // Archetype D banned skeleton
    if (archetype === "D" && RISK3_D_REQUIRES_DOLLAR_PATTERN.test(r3s1)) {
      failures.push({
        gate: "RISK5_ARCHETYPE_D_DOLLAR_SKELETON",
        detail: `Archetype D Risk 3 sentence-1 opens with banned "This idea requires $X..." pattern: "${r3s1}"`,
      });
    }

    // Archetype E banned skeleton
    if (archetype === "E" && RISK3_E_CONVERTING_NAVIGATING_PATTERN.test(r3s1)) {
      failures.push({
        gate: "RISK5_ARCHETYPE_E_NAVIGATING_SKELETON",
        detail: `Archetype E Risk 3 sentence-1 opens with banned "Converting [buyer] requires navigating..." pattern: "${r3s1}"`,
      });
    }
  } else {
    // Risk 3 did not fire — verify it's not silently miscategorized in another slot
    // (no automated check for now; manual review territory)
  }

  // Per-case expected firing
  const expected = CASE_EXPECTATIONS[caseId] || {};
  if (expected.expected_risk3_fire === true && !extracted.risk3_fired) {
    failures.push({
      gate: "EXPECTED_RISK3_FIRE_MISSING",
      detail: `Case expected Risk 3 to fire (${expected.label}) but Risk 3 was dropped.`,
    });
  }
  if (expected.expected_risk3_fire === false && extracted.risk3_fired) {
    failures.push({
      gate: "UNEXPECTED_RISK3_FIRE",
      detail: `Case expected Risk 3 to drop (${expected.label}) but Risk 3 fired with archetype "${extracted.risk3_archetype}". This is a False-Positive event.`,
    });
  }
  if (expected.expected_archetype && extracted.risk3_fired && extracted.risk3_archetype !== expected.expected_archetype) {
    failures.push({
      gate: "ARCHETYPE_DRIFT",
      detail: `Expected archetype "${expected.expected_archetype}" but got "${extracted.risk3_archetype}".`,
    });
  }

  return { failures, naReason: null };
}

// ============================================================================
// SOFT DIAGNOSTICS (aggregated across all runs)
// ============================================================================

function computeSoftDiagnostics(allRuns) {
  const successfulNonGated = allRuns.filter((r) => r.status === "success" && !r.extracted?.gated);
  const fires = successfulNonGated.filter((r) => r.extracted?.risk3_fired);
  const archetypeCounts = {};
  for (const r of fires) {
    const a = r.extracted.risk3_archetype || "null";
    archetypeCounts[a] = (archetypeCounts[a] || 0) + 1;
  }

  const summaryLengths = successfulNonGated.map((r) => r.extracted?.summary_length || 0);
  const over1000 = summaryLengths.filter((l) => l > 1000).length;
  const over1200 = summaryLengths.filter((l) => l > 1200).length;
  const overMedian = summaryLengths.length > 0
    ? [...summaryLengths].sort((a, b) => a - b)[Math.floor(summaryLengths.length / 2)]
    : 0;

  const yourNYearsCount = successfulNonGated.filter((r) => r.extracted?.summary_starts_with_your_n_years).length;

  return {
    total_successful_non_gated: successfulNonGated.length,
    total_gated: allRuns.filter((r) => r.status === "success" && r.extracted?.gated).length,
    total_errors: allRuns.filter((r) => r.status === "error").length,

    // Risk 3 firing
    risk3_fire_rate: successfulNonGated.length > 0
      ? `${fires.length}/${successfulNonGated.length} (${((fires.length / successfulNonGated.length) * 100).toFixed(1)}%)`
      : "N/A",
    archetype_distribution: archetypeCounts,
    risk3_fire_count: fires.length,

    // Summary length (F21 cure indicator)
    summary_length_median: overMedian,
    summary_length_over_1000: successfulNonGated.length > 0
      ? `${over1000}/${successfulNonGated.length} (${((over1000 / successfulNonGated.length) * 100).toFixed(1)}%)`
      : "N/A",
    summary_length_over_1200: successfulNonGated.length > 0
      ? `${over1200}/${successfulNonGated.length} (${((over1200 / successfulNonGated.length) * 100).toFixed(1)}%)`
      : "N/A",

    // F17 cure indicator
    your_n_years_opener_prevalence: successfulNonGated.length > 0
      ? `${yourNYearsCount}/${successfulNonGated.length} (${((yourNYearsCount / successfulNonGated.length) * 100).toFixed(1)}%)`
      : "N/A",
  };
}

// ============================================================================
// FIXTURE MODE PROBE
// ============================================================================

async function checkFixtureMode() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(BASE_URL + "/api/diag/fixture-mode");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { ok: true, enabled: data.enabled === true };
    } catch (e) {
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return { ok: false };
}

function countFixtures(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
}

// ============================================================================
// CHECKPOINT
// ============================================================================

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return { runs: [], startedAt: new Date().toISOString() };
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8")); }
  catch (e) { console.error("Checkpoint corrupt:", e.message); return { runs: [], startedAt: new Date().toISOString() }; }
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

function isCompleted(cp, caseId, runIndex) {
  return cp.runs.some((r) => r.caseId === caseId && r.runIndex === runIndex && r.status === "success");
}

function appendRun(cp, run) {
  cp.runs = cp.runs.filter((r) => !(r.caseId === run.caseId && r.runIndex === run.runIndex));
  cp.runs.push(run);
  saveCheckpoint(cp);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("============================================");
  console.log("V4S29 Stage 2c Prose Verification — HTTP");
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Reruns per case: ${RERUN_COUNT}`);
  console.log(`  Cases: ${CASES.length}`);
  console.log(`  Total calls: ${CASES.length * RERUN_COUNT}`);
  console.log(`  Est. wall time: ~${Math.ceil(CASES.length * RERUN_COUNT * 140 / 60)} min (fixtures cached)`);
  console.log("============================================");

  if (!RESUME && fs.existsSync(CHECKPOINT_PATH)) {
    console.error(`\n⚠️  Existing checkpoint at ${CHECKPOINT_PATH}\n   Use --resume to continue, or delete to start fresh.`);
    process.exit(1);
  }

  // Fixture mode probe
  console.log(`\n🔬 Fixture mode probe: ${BASE_URL}/api/diag/fixture-mode`);
  const fm = await checkFixtureMode();
  if (!fm.ok) {
    if (NO_REQUIRE_FIXTURES) {
      console.log(`   ⏭️  Endpoint unreachable, --no-require-fixtures set, proceeding`);
    } else {
      console.error(`\n❌ Cannot verify fixture mode (endpoint unreachable).`);
      console.error(`   Either the dev server is down, or /api/diag/fixture-mode doesn't exist.`);
      console.error(`\n   Make sure dev server is running:`);
      console.error(`       IDEALOOP_USE_FIXTURES=1 npm run dev`);
      console.error(`\n   Override (NOT RECOMMENDED, Layer E noise):`);
      console.error(`       node ${path.basename(__filename)} --no-require-fixtures`);
      process.exit(1);
    }
  } else if (!fm.enabled) {
    if (NO_REQUIRE_FIXTURES) {
      console.log(`   ⚠️  Server NOT in fixture mode but --no-require-fixtures set; proceeding`);
    } else {
      console.error(`\n❌ Server is NOT in fixture mode. Layer E noise will corrupt the verification.`);
      console.error(`   Restart with:  IDEALOOP_USE_FIXTURES=1 npm run dev`);
      console.error(`   Or override:   node ${path.basename(__filename)} --no-require-fixtures`);
      process.exit(1);
    }
  } else {
    console.log(`   ✅ Server in fixture mode (${countFixtures(FIXTURES_DIR)} fixtures present)`);
  }

  // Validate cases exist
  const caseDefs = {};
  for (const id of CASES) {
    const c = ALL_CASES.find((x) => x.id === id);
    if (!c) {
      console.error(`\n❌ Case not found in cases.js: ${id}`);
      process.exit(1);
    }
    caseDefs[id] = c;
  }

  let cp = loadCheckpoint();
  if (RESUME) {
    const completed = cp.runs.filter((r) => r.status === "success").length;
    console.log(`\n🔄 Resume mode: ${completed} runs already completed`);
  }

  // Build queue
  const queue = [];
  for (const id of CASES) {
    for (let runIndex = 1; runIndex <= RERUN_COUNT; runIndex++) {
      queue.push({ caseDef: caseDefs[id], runIndex });
    }
  }

  // Execute
  let consecutiveFailures = 0;
  const wallStart = Date.now();
  for (let i = 0; i < queue.length; i++) {
    const { caseDef, runIndex } = queue[i];
    const label = `[${i + 1}/${queue.length}] ${caseDef.id}__run${runIndex}`;
    if (isCompleted(cp, caseDef.id, runIndex)) {
      console.log(`${label} ⏭️  (completed)`);
      continue;
    }
    process.stdout.write(`${label} ... `);
    const t0 = Date.now();
    try {
      const { result, gateFired, totalMs } = await runEval(caseDef);
      const extracted = extractStage2c(result, gateFired);
      const { failures, naReason } = checkAutoGates(extracted, caseDef.id);
      const elapsed = (totalMs / 1000).toFixed(1);

      if (gateFired) {
        console.log(`🚪 GATED (${elapsed}s)`);
      } else {
        const fcount = failures.length;
        const r3 = extracted.risk3_fired ? `R3=${extracted.risk3_archetype}` : "R3=drop";
        const sLen = extracted.summary_length;
        const gateMark = fcount === 0 ? "✅" : `❌${fcount}`;
        console.log(`${gateMark} ${elapsed}s — ${r3} | sum=${sLen}c | risks=${extracted.risk_count}`);
      }

      appendRun(cp, {
        caseId: caseDef.id,
        runIndex,
        status: "success",
        extracted,
        autoGateFailures: failures,
        autoGateNaReason: naReason,
        durationMs: totalMs,
        ts: new Date().toISOString(),
      });
      consecutiveFailures = 0;
    } catch (e) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`❌ FAIL (${elapsed}s) — ${e.message}`);
      appendRun(cp, {
        caseId: caseDef.id, runIndex, status: "error",
        errorMessage: e.message,
        ts: new Date().toISOString(),
      });
      consecutiveFailures++;
      if (consecutiveFailures >= 5) {
        console.error(`\n🛑 5 consecutive failures — halting. Use --resume after investigating.`);
        process.exit(2);
      }
    }
  }
  const wallElapsed = ((Date.now() - wallStart) / 1000).toFixed(0);

  // Evaluate
  console.log(`\n═══ Evaluating ═══`);
  const evaluation = evaluateAllCases(cp);
  const soft = computeSoftDiagnostics(cp.runs);
  const costEstimate = estimateCost(cp.runs);

  fs.writeFileSync(RESULTS_PATH, JSON.stringify({
    runs: cp.runs,
    evaluation,
    softDiagnostics: soft,
    costEstimate,
    wallElapsedSeconds: parseInt(wallElapsed, 10),
  }, null, 2));

  const report = renderReport(evaluation, soft, costEstimate, parseInt(wallElapsed, 10));
  fs.writeFileSync(REPORT_PATH, report);

  console.log("\n" + report);
  console.log(`\n📁 Outputs:\n   ${RESULTS_PATH}\n   ${REPORT_PATH}`);
}

// ============================================================================
// EVALUATION — per-case aggregation
// ============================================================================

function evaluateAllCases(cp) {
  const byCase = {};
  for (const run of cp.runs) {
    if (run.status !== "success") continue;
    if (!byCase[run.caseId]) byCase[run.caseId] = [];
    byCase[run.caseId].push(run);
  }

  const results = {};
  let passCount = 0;
  const hardFailures = [];

  for (const caseId of CASES) {
    const runs = byCase[caseId] || [];
    const expected = CASE_EXPECTATIONS[caseId] || {};

    if (runs.length === 0) {
      results[caseId] = {
        pass: false,
        label: expected.label || "(no label)",
        notes: expected.notes || "",
        gateFailures: ["no successful runs recorded"],
        runs: [],
      };
      hardFailures.push(`${caseId}: no successful runs`);
      continue;
    }

    // Collect all auto-gate failures across reruns for this case
    const allCaseFailures = [];
    for (const r of runs) {
      const runFailures = r.autoGateFailures || [];
      for (const f of runFailures) {
        allCaseFailures.push({ runIndex: r.runIndex, ...f });
      }
    }

    // Risk 3 firing consistency across reruns
    const r3FireRates = runs.map((r) => r.extracted?.risk3_fired);
    const r3Fires = r3FireRates.filter(Boolean).length;
    const r3FireConsistency = r3Fires === runs.length ? "all fire" : r3Fires === 0 ? "all drop" : `mixed (${r3Fires}/${runs.length} fire)`;

    // Archetype consistency (when Risk 3 fires)
    const archetypes = runs
      .filter((r) => r.extracted?.risk3_fired)
      .map((r) => r.extracted?.risk3_archetype);
    const uniqueArchetypes = [...new Set(archetypes)];
    const archetypeConsistency = uniqueArchetypes.length <= 1 ? "stable" : `drift (${uniqueArchetypes.join(",")})`;

    const pass = allCaseFailures.length === 0;
    if (pass) passCount++;
    else {
      for (const f of allCaseFailures) {
        hardFailures.push(`${caseId} run${f.runIndex}: [${f.gate}] ${f.detail}`);
      }
    }

    results[caseId] = {
      pass,
      label: expected.label || "(no label)",
      notes: expected.notes || "",
      expectedRisk3Fire: expected.expected_risk3_fire,
      expectedArchetype: expected.expected_archetype,
      gateFailures: allCaseFailures,
      risk3FireConsistency: r3FireConsistency,
      archetypeConsistency,
      runs: runs.map((r) => ({
        runIndex: r.runIndex,
        risk3_fired: r.extracted?.risk3_fired,
        risk3_archetype: r.extracted?.risk3_archetype,
        summary_length: r.extracted?.summary_length,
        gated: !!r.extracted?.gated,
      })),
    };
  }

  const overallPass = passCount === CASES.length && hardFailures.length === 0;

  return {
    perCase: results,
    passCount,
    totalCases: CASES.length,
    hardFailures,
    overallPass,
    rerunCount: RERUN_COUNT,
  };
}

// ============================================================================
// COST ESTIMATE
// ============================================================================

function estimateCost(runs) {
  // Sonnet 4 pricing baseline (May 2026): roughly $3/MTok input, $15/MTok output.
  // We don't have direct token counts from the route's SSE stream, so we estimate
  // based on observed wall time + typical pipeline profile.
  //
  // Per V4S29 cost analysis:
  //   - Prior Stage 2c prompt: ~5K input tokens
  //   - V4S29 Stage 2c prompt: ~23K input tokens (+18K delta)
  //   - 5 Sonnet calls per PRO eval; only Stage 2c changes
  //   - Output tokens unchanged
  //   - Cost delta per PRO eval: ~$0.06 (just from Stage 2c prompt size)
  //
  // Rough per-eval baseline: $0.50-0.65 PRO. Use $0.55 as central estimate.

  const successful = runs.filter((r) => r.status === "success").length;
  const perEvalEstimate = 0.55;
  const totalEstimate = successful * perEvalEstimate;

  // Stage 2c delta vs prior prompt
  const stage2cDeltaPerEval = 0.06;
  const totalStage2cDelta = successful * stage2cDeltaPerEval;

  return {
    successful_runs: successful,
    per_eval_central_estimate_usd: perEvalEstimate,
    total_estimate_usd: +totalEstimate.toFixed(2),
    stage2c_prompt_size_delta_per_eval_usd: stage2cDeltaPerEval,
    total_stage2c_prompt_delta_usd: +totalStage2cDelta.toFixed(2),
    note: "Estimate is ROUGH. Use Anthropic API console for ground truth.",
  };
}

// ============================================================================
// REPORT
// ============================================================================

function renderReport(evaluation, soft, costEstimate, wallSeconds) {
  const lines = [];
  const L = (s) => lines.push(s);
  const HR = () => lines.push("\n---\n");

  L(`# V4S29 Stage 2c Prose Verification — Report`);
  L("");
  L(`**OVERALL VERDICT: ${evaluation.overallPass ? "✅ PASS (automated hard gates)" : "❌ FAIL (automated hard gates)"}**`);
  L("");
  L(`> Automated hard gates only. Manual review (synthesis-not-enumeration, specificity, predicate balance, MAT3-partial classification) required against the prose dump below before final ship decision.`);
  L("");

  L(`## Headline numbers`);
  L(`- Cases passing automated hard gates: **${evaluation.passCount} of ${evaluation.totalCases}**`);
  L(`- Reruns per case: **${evaluation.rerunCount}**`);
  L(`- Total runs: **${evaluation.totalCases * evaluation.rerunCount}**`);
  L(`- Hard failures: **${evaluation.hardFailures.length}**`);
  L(`- Wall time: **${Math.floor(wallSeconds / 60)}m ${wallSeconds % 60}s**`);
  L(`- Estimated cost: **~$${costEstimate.total_estimate_usd}** (Stage 2c prompt delta vs prior: ~$${costEstimate.total_stage2c_prompt_delta_usd})`);
  L("");

  if (evaluation.hardFailures.length > 0) {
    L(`## ❌ Hard failures (automated gate violations)`);
    L("");
    for (const f of evaluation.hardFailures) {
      L(`- ${f}`);
    }
    L("");
  }

  HR();

  L(`## Soft diagnostics (informational)`);
  L("");
  L(`- **Risk 3 fire rate**: ${soft.risk3_fire_rate}`);
  L(`- **Archetype distribution** (across Risk 3 fires):`);
  for (const [a, count] of Object.entries(soft.archetype_distribution).sort()) {
    L(`    - ${a}: ${count}`);
  }
  L(`- **Summary length**:`);
  L(`    - Median: ${soft.summary_length_median} chars`);
  L(`    - Over 1000 chars: ${soft.summary_length_over_1000}`);
  L(`    - Over 1200 chars: ${soft.summary_length_over_1200}`);
  L(`    - F21 baseline (May 10): 21% over 1000. Target: meaningful decrease.`);
  L(`- **F17 "Your N years..." opener prevalence**: ${soft.your_n_years_opener_prevalence}`);
  L(`    - F17 baseline (May 10 post-Bundle 3/3.5): 3%. Target: ≤5%.`);
  L(`- Gated runs: ${soft.total_gated}`);
  L(`- Error runs: ${soft.total_errors}`);
  L("");

  HR();

  L(`## Per-case verdicts`);
  L("");

  for (const caseId of CASES) {
    const r = evaluation.perCase[caseId];
    if (!r) continue;
    const mark = r.pass ? "✅" : "❌";
    L(`### ${mark} ${caseId}`);
    L(`*${r.label}*`);
    L("");
    if (r.notes) {
      L(`**Expectation:** ${r.notes}`);
      L("");
    }
    L(`- Expected Risk 3 fire: ${r.expectedRisk3Fire === null ? "(open)" : r.expectedRisk3Fire ? "yes" : "no"}`);
    if (r.expectedArchetype) L(`- Expected archetype: ${r.expectedArchetype}`);
    L(`- Observed Risk 3: ${r.risk3FireConsistency}`);
    L(`- Archetype consistency: ${r.archetypeConsistency}`);
    L(`- Auto gate failures: ${r.gateFailures.length}`);
    if (r.gateFailures.length > 0) {
      for (const f of r.gateFailures) {
        L(`    - **run${f.runIndex}** [${f.gate}]: ${f.detail}`);
      }
    }
    L("");
    L(`Per-run snapshot:`);
    for (const run of r.runs) {
      const tag = run.gated ? "🚪 gated" : `R3=${run.risk3_fired ? run.risk3_archetype : "drop"}, sum=${run.summary_length}c`;
      L(`  - run${run.runIndex}: ${tag}`);
    }
    L("");
  }

  HR();

  L(`## Prose dump for manual review`);
  L("");
  L(`Per Phase 3 manual-hard-gate spec, the following surfaces require human reading:`);
  L(`- **A1 synthesis-not-enumeration:** did Summary list 3+ named threat categories with handles?`);
  L(`- **A6 specificity test:** does Summary closing name specific segment / uncertainty / behavior / price / channel / evidence gap?`);
  L(`- **A10 sentence advancement:** are all Summary sentences advancing (not restating)?`);
  L(`- **B2 mechanism specification:** do Risk 1 and Risk 2 name the operating mechanism, not just the threat category?`);
  L(`- **C1 substantive-fire:** for cases where Risk 3 fired, does founder identity materially change the case's read?`);
  L(`- **C3 PARTIAL-INSIDER classification (AUDIT-MAT3-partial):** does prose treat as partial-insider (not full insider, not full outsider)?`);
  L(`- **C4 archetype A internal subtype routing:** does archetype A prose draw on subtype-appropriate evidence (A1=engineering, A2=AI/data, A3=regulated infra)?`);
  L(`- **C5 predicate balance:** for archetype A Risk 3, does the predicate stay anchored to founder-task relationship (not independent build-difficulty description)?`);
  L(`- **A9/C10 verbatim discipline:** any forbidden inferences in profile references (employer-domain, capability-level, role-type, intensifiers, seniority)?`);
  L(`- **B4 frame diversity:** do Risk 1 openers across cases show structural diversity (not all consolidation, not all relational moat)?`);
  L("");

  // Per case, dump all reruns
  // Need access to runs by case — recompute here from CASE_EXPECTATIONS pattern
  // We'll re-read from results file if needed, but since this is invoked inline
  // with the cp, we can pass it. For simplicity in this render, look up via evaluation.
  L(`---`);
  L("");

  // We need the actual prose. evaluation.perCase[caseId].runs only has snapshots.
  // Add the full extracted output from results.json reading.
  // Actually, the caller can pass cp; for this render we need the cp.runs.
  // To keep this contained, we re-load from the results file we just wrote.
  // BUT: at this point in main() we already wrote results.json. Read it back.
  let cpRuns = [];
  try {
    const j = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8"));
    cpRuns = j.runs || [];
  } catch { /* leave empty */ }

  for (const caseId of CASES) {
    L(`### ${caseId}`);
    const expected = CASE_EXPECTATIONS[caseId] || {};
    L(`*${expected.label || ""}*`);
    L("");
    const caseRuns = cpRuns.filter((r) => r.caseId === caseId && r.status === "success");
    for (const run of caseRuns) {
      const ex = run.extracted || {};
      L(`#### Run ${run.runIndex}`);
      if (ex.gated) {
        L(`🚪 *Gated upstream — no Stage 2c output*`);
        L("");
        continue;
      }
      L(`**Risk 3 fired:** ${ex.risk3_fired ? `yes (archetype=${ex.risk3_archetype})` : "no (dropped)"}`);
      L(`**Summary length:** ${ex.summary_length} chars`);
      L(`**Evidence strength:** ${ex.evidence_level || "—"}`);
      L("");
      L(`**Summary:**`);
      L(`> ${(ex.summary || "(empty)").replace(/\n/g, "\n> ")}`);
      L("");

      if (ex.risk1_all && ex.risk1_all.length > 0) {
        for (let i = 0; i < ex.risk1_all.length; i++) {
          L(`**Risk 1${ex.risk1_all.length > 1 ? ` (#${i+1})` : ""} [market_category]:**`);
          L(`> ${(ex.risk1_all[i].text || "").replace(/\n/g, "\n> ")}`);
          L("");
        }
      }

      if (ex.risk2_all && ex.risk2_all.length > 0) {
        for (let i = 0; i < ex.risk2_all.length; i++) {
          L(`**Risk 2${ex.risk2_all.length > 1 ? ` (#${i+1})` : ""} [trust_adoption]:**`);
          L(`> ${(ex.risk2_all[i].text || "").replace(/\n/g, "\n> ")}`);
          L("");
        }
      }

      if (ex.risk3) {
        L(`**Risk 3 [founder_fit, archetype=${ex.risk3_archetype}]:**`);
        L(`> ${(ex.risk3_text || "").replace(/\n/g, "\n> ")}`);
        L("");
      } else {
        L(`**Risk 3:** *not fired — founder profile aligns with idea or case-truth in market/trust territory*`);
        L("");
      }
    }
    L("");
  }

  HR();

  L(`## Cost & performance`);
  L("");
  L(`- Successful runs: ${costEstimate.successful_runs}`);
  L(`- Wall time: ${Math.floor(wallSeconds / 60)}m ${wallSeconds % 60}s`);
  L(`- Avg per-run wall time: ${costEstimate.successful_runs > 0 ? Math.round(wallSeconds / costEstimate.successful_runs) : 0}s`);
  L(`- Estimated total cost: ~$${costEstimate.total_estimate_usd} (rough; verify in Anthropic API console)`);
  L(`- Stage 2c prompt-size delta vs prior: ~$${costEstimate.total_stage2c_prompt_delta_usd} extra across these runs`);
  L(`- Per-eval Stage 2c delta: ~$${costEstimate.stage2c_prompt_size_delta_per_eval_usd}`);
  L("");
  L(`${costEstimate.note}`);
  L("");

  L(`---`);
  L("");
  L(`*Generated by run-v4s29-stage2c-prose-verification-http.js*`);

  return lines.join("\n");
}

// ============================================================================
// ENTRY POINT
// ============================================================================

main().catch((err) => {
  console.error("\n💥 Fatal error:", err);
  process.exit(1);
});

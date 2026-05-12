// ============================================================================
// runners/run-v4s29-stage2b-rigor-verification-http.js
// ============================================================================
// V4S29 Stage 2b Structural Rigor Template — full-pipeline verification.
//
// Pattern: run-b10a.js style — HTTP against local dev server, SSE-streaming
// consumption, fixture-mode preflight check. Tests the new prompt-stage2b.js
// in the actual production code path, end-to-end through Stage 1 → 2a → 2b
// → 2c → 3.
//
// PREREQUISITE: Dev server running with IDEALOOP_USE_FIXTURES=1 in another
// terminal:
//     IDEALOOP_USE_FIXTURES=1 npm run dev
//
// PREREQUISITE: New prompt-stage2b.js already at src/lib/services/prompt-stage2b.js
//
// Cases: 8 canonical · Reruns: 5 (default) or 10 (--tier-2) = 40 or 80 runs
// Wall time: ~95 min (140s per PRO run × 40 runs)
//
// Verification criteria are LOCKED before launch (Methodology Principle 6).
//
// Usage:
//   node run-v4s29-stage2b-rigor-verification-http.js
//   node run-v4s29-stage2b-rigor-verification-http.js --resume
//   node run-v4s29-stage2b-rigor-verification-http.js --tier-2
//   node run-v4s29-stage2b-rigor-verification-http.js --no-require-fixtures
//   node run-v4s29-stage2b-rigor-verification-http.js --base-url http://...
//
// Outputs (in runners/):
//   v4s29-stage2b-http-checkpoint.json — resume state
//   v4s29-stage2b-http-results.json    — full per-case stats + verdict
//   v4s29-stage2b-http-report.md       — human-readable verdict
// ============================================================================

const fs = require("fs");
const path = require("path");
const { ALL_CASES } = require("../cases.js");
// ============================================================================
// CONFIG
// ============================================================================

const args = process.argv.slice(2);
const RESUME = args.includes("--resume");
const TIER_2 = args.includes("--tier-2");
const NO_REQUIRE_FIXTURES = args.includes("--no-require-fixtures");
const RERUN_COUNT = TIER_2 ? 10 : 5;
const BASE_URL = (() => {
  const idx = args.indexOf("--base-url");
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return process.env.IDEALOOP_BASE_URL || "http://localhost:3000";
})();

const CHECKPOINT_PATH = path.join(__dirname, "v4s29-stage2b-http-checkpoint.json");
const RESULTS_PATH    = path.join(__dirname, "v4s29-stage2b-http-results.json");
const REPORT_PATH     = path.join(__dirname, "v4s29-stage2b-http-report.md");
const FIXTURES_DIR    = path.join(__dirname, "fixtures", "data");

// 8 canonical cases. Order: B2 first (false-positive guard, also pre-flight).
const CASES = [
  "AUDIT-B2",
  "AUDIT-A3",
  "AUDIT-MAT3-tech-no-access",
  "AUDIT-MAT2-beginner",
  "AUDIT-MAT2-senior",
  "AUDIT-L1",
  "AUDIT-L2",
  "AUDIT-M2",
];

// ============================================================================
// VERIFICATION CRITERIA — LOCKED (Methodology Principle 6)
// ============================================================================

const N_OF_5 = (count) => count >= Math.ceil(0.8 * RERUN_COUNT);

// M2 baseline from May 10 clean B10a (2 runs): MD=6.5 MO=5.25 OR=4.5
const M2_BASELINE = { md: 6.5, mo: 5.25, or: 4.5 };

const VERIFICATION_CRITERIA = {
  "AUDIT-A3": {
    label: "Generous (MD 6.5 trigger uncertainty)",
    expectation: "Hard pass: no MD 7.0+ AND no MO 7.0+. Strong pass: 4/5 runs MD ≤ 6.0 AND MO ≤ 6.0.",
    check: (runs) => {
      const md = runs.map(r => r.scores.md);
      const mo = runs.map(r => r.scores.mo);
      const noHigh = md.every(s => s < 7.0) && mo.every(s => s < 7.0);
      const mdLowCount = md.filter(s => s <= 6.0).length;
      const moLowCount = mo.filter(s => s <= 6.0).length;
      const moOKCount  = mo.filter(s => s <= 6.5).length;
      const strongPass = N_OF_5(mdLowCount) && N_OF_5(moLowCount);
      const hardPass = noHigh && N_OF_5(moOKCount);
      const hardFailure = !noHigh ? `MD 7.0+ or MO 7.0+ event(s): MD=[${md.join(",")}] MO=[${mo.join(",")}]` : null;
      const watchZone = !strongPass && hardPass ? `Mostly landed at 6.5 not 6.0 — Row 8/Row 6 partial discipline` : null;
      return { pass: hardPass, na: false, hardFailure, watchZone, detail: { md, mo, mdLowCount, moLowCount, moOKCount, noHigh, strongPass } };
    },
  },
  "AUDIT-MAT3-tech-no-access": {
    label: "Generous (MO 7.0 'requires critical mass' hedge attacks core)",
    expectation: "Hard pass: no MO 7.0+. Strong pass: 4/5 MO ≤ 6.0.",
    check: (runs) => {
      const mo = runs.map(r => r.scores.mo);
      const noHigh = mo.every(s => s < 7.0);
      const moOKCount = mo.filter(s => s <= 6.5).length;
      const moLowCount = mo.filter(s => s <= 6.0).length;
      const strongPass = N_OF_5(moLowCount);
      const hardPass = noHigh && N_OF_5(moOKCount);
      const hardFailure = !noHigh ? `MO 7.0+ event(s): MO=[${mo.join(",")}]` : null;
      const watchZone = !strongPass && hardPass ? `Mostly 6.5 not 6.0 — hedge discipline fired but Row 8 partial` : null;
      return { pass: hardPass, na: false, hardFailure, watchZone, detail: { mo, moOKCount, moLowCount, noHigh, strongPass } };
    },
  },
  "AUDIT-MAT2-beginner": {
    label: "Generous (MO 7.0 success-fee structural alignment)",
    expectation: "Hard pass: no MO 7.0+. Strong pass: 4/5 MO ≤ 6.0.",
    check: (runs) => {
      const mo = runs.map(r => r.scores.mo);
      const noHigh = mo.every(s => s < 7.0);
      const moOKCount = mo.filter(s => s <= 6.5).length;
      const moLowCount = mo.filter(s => s <= 6.0).length;
      const strongPass = N_OF_5(moLowCount);
      const hardPass = noHigh && N_OF_5(moOKCount);
      const hardFailure = !noHigh ? `MO 7.0+ event(s): MO=[${mo.join(",")}]` : null;
      const watchZone = !strongPass && hardPass ? `Mostly 6.5 not 6.0 — 'success-fee aligns' invalid-base rule partial` : null;
      return { pass: hardPass, na: false, hardFailure, watchZone, detail: { mo, moOKCount, moLowCount, noHigh, strongPass } };
    },
  },
  "AUDIT-MAT2-senior": {
    label: "OR volatility canonical (May 5 Layer E event 5.5→7.0→5.5)",
    expectation: "No OR 7.0+ events; OR stays 5.0-6.5",
    check: (runs) => {
      const or = runs.map(r => r.scores.or);
      const noHigh = or.every(s => s < 7.0);
      const inBand = or.filter(s => s >= 5.0 && s <= 6.5).length;
      const hardPass = noHigh && N_OF_5(inBand);
      const hardFailure = !noHigh ? `OR 7.0+ event(s): OR=[${or.join(",")}]` : null;
      return { pass: hardPass, na: false, hardFailure, watchZone: null, detail: { or, noHigh, inBand } };
    },
  },
  "AUDIT-L1": {
    label: "Anchor disease (likely gates upstream)",
    expectation: "If gates: N/A (excluded from denominator). If scores: MO ≤ 6.0.",
    check: (runs) => {
      const gatedCount = runs.filter(r => r.gated).length;
      if (gatedCount === runs.length) {
        return { pass: false, na: true, hardFailure: null, watchZone: null, detail: { gated: gatedCount, reason: "all runs gated upstream" } };
      }
      const ungated = runs.filter(r => !r.gated);
      const md = ungated.map(r => r.scores.md);
      const mo = ungated.map(r => r.scores.mo);
      const moOK    = mo.every(s => s <= 6.0);
      const noHighMO = mo.every(s => s < 7.0);
      const noHighMD = md.every(s => s < 7.0);
      const pass = moOK && noHighMO && noHighMD;
      const hardFailure = (!noHighMO || !noHighMD) ? `MO 7.0+ or MD 7.0+: MD=[${md.join(",")}] MO=[${mo.join(",")}]` : null;
      return { pass, na: false, hardFailure, watchZone: null, detail: { gated: gatedCount, md, mo, moOK } };
    },
  },
  "AUDIT-L2": {
    label: "Anchor disease (MO at cap boundary)",
    expectation: "Hard pass: no MO 7.0+ events.",
    check: (runs) => {
      const mo = runs.map(r => r.scores.mo);
      const noHigh = mo.every(s => s < 7.0);
      const hardFailure = !noHigh ? `MO 7.0+ event(s): MO=[${mo.join(",")}]` : null;
      return { pass: noHigh, na: false, hardFailure, watchZone: null, detail: { mo, noHigh } };
    },
  },
  "AUDIT-B2": {
    label: "Mixed CONTROL (false-positive guard, MO 6.5 defensible)",
    expectation: "4/5 MO in [6.0, 6.5]; no MO < 5.0 (downward FP); no MO ≥ 7.0 (upward FP).",
    check: (runs) => {
      const mo = runs.map(r => r.scores.mo);
      const inBand = mo.filter(s => s >= 6.0 && s <= 6.5).length;
      const noDownFP = mo.every(s => s >= 5.0);
      const noUpFP   = mo.every(s => s < 7.0);
      const hardFailure = !noDownFP ? `MO < 5.0 (downward FP): MO=[${mo.join(",")}]` :
                         !noUpFP   ? `MO ≥ 7.0 (upward FP): MO=[${mo.join(",")}]` : null;
      const pass = N_OF_5(inBand) && noDownFP && noUpFP;
      return { pass, na: false, hardFailure, watchZone: null, detail: { mo, inBand, noDownFP, noUpFP } };
    },
  },
  "AUDIT-M2": {
    label: "Well-justified CONTROL (false-positive guard, domain-relevant founder)",
    expectation: `Baseline May 10: MD=${M2_BASELINE.md} MO=${M2_BASELINE.mo} OR=${M2_BASELINE.or}. 4/5 within ±0.5; no metric drops ≥1.0 in more than 1 run.`,
    check: (runs) => {
      const md = runs.map(r => r.scores.md);
      const mo = runs.map(r => r.scores.mo);
      const or = runs.map(r => r.scores.or);
      const within = (val, base) => Math.abs(val - base) <= 0.5;
      const dropBy1 = (val, base) => (base - val) >= 1.0;
      const allWithinBand = runs.filter(r =>
        within(r.scores.md, M2_BASELINE.md) &&
        within(r.scores.mo, M2_BASELINE.mo) &&
        within(r.scores.or, M2_BASELINE.or)
      ).length;
      const dropEventCount = runs.filter(r =>
        dropBy1(r.scores.md, M2_BASELINE.md) ||
        dropBy1(r.scores.mo, M2_BASELINE.mo) ||
        dropBy1(r.scores.or, M2_BASELINE.or)
      ).length;
      const pass = N_OF_5(allWithinBand) && dropEventCount <= 1;
      const hardFailure = dropEventCount > 1 ? `Well-justified case unfairly downgraded in ${dropEventCount} of ${runs.length} runs (≥1.0 drop from baseline)` : null;
      return { pass, na: false, hardFailure, watchZone: null, detail: { md, mo, or, allWithinBand, dropEventCount, baseline: M2_BASELINE } };
    },
  },
};

// ============================================================================
// SSE EVAL (run-b10a.js pattern)
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

function extractScores(result, gateFired) {
  if (gateFired) {
    return { gated: true, scores: { md: null, mo: null, or: null, tc: null, overall: null }, evidenceLevel: null, explanations: { md: "", mo: "", or: "" } };
  }
  const ev = result?.evaluation || {};
  return {
    gated: false,
    scores: {
      md: ev.market_demand?.score ?? null,
      mo: ev.monetization?.score ?? null,
      or: ev.originality?.score ?? null,
      tc: ev.technical_complexity?.score ?? null,
      overall: ev.overall_score ?? null,
    },
    evidenceLevel: ev.evidence_strength?.level || null,
    explanations: {
      md: ev.market_demand?.explanation || "",
      mo: ev.monetization?.explanation || "",
      or: ev.originality?.explanation || "",
    },
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
  console.log("V4S29 Stage 2b Rigor Template — HTTP Verification");
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Reruns per case: ${RERUN_COUNT}${TIER_2 ? " (TIER-2)" : ""}`);
  console.log(`  Cases: ${CASES.length}`);
  console.log(`  Total calls: ${CASES.length * RERUN_COUNT}`);
  console.log(`  Est. wall time: ~${Math.ceil(CASES.length * RERUN_COUNT * 140 / 60)} min`);
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
      const extracted = extractScores(result, gateFired);
      const elapsed = (totalMs / 1000).toFixed(1);

      if (gateFired) {
        console.log(`🚪 GATED (${elapsed}s)`);
      } else {
        const s = extracted.scores;
        console.log(`✅ ${elapsed}s — MD:${s.md} MO:${s.mo} OR:${s.or} TC:${s.tc} O:${s.overall} [${extracted.evidenceLevel || "-"}]`);
      }

      appendRun(cp, {
        caseId: caseDef.id, runIndex, status: "success",
        gated: extracted.gated,
        scores: extracted.scores,
        evidenceLevel: extracted.evidenceLevel,
        explanations: extracted.explanations,
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

  // Evaluate
  console.log(`\n═══ Evaluating criteria ═══`);
  const evaluation = evaluateAllCriteria(cp);
  fs.writeFileSync(RESULTS_PATH, JSON.stringify({ runs: cp.runs, evaluation }, null, 2));
  const report = renderReport(evaluation);
  fs.writeFileSync(REPORT_PATH, report);

  console.log("\n" + report);
  console.log(`\n📁 Outputs:\n   ${RESULTS_PATH}\n   ${REPORT_PATH}`);
}

// ============================================================================
// EVALUATION (same logic as F1-isolation version)
// ============================================================================

function evaluateAllCriteria(cp) {
  const byCase = {};
  for (const run of cp.runs) {
    if (run.status !== "success") continue;
    if (!byCase[run.caseId]) byCase[run.caseId] = [];
    byCase[run.caseId].push(run);
  }

  const results = {};
  let passCount = 0;
  let naCount = 0;
  let b2Passed = null, m2Passed = null;
  const hardFailures = [], watchZones = [];

  for (const caseId of CASES) {
    const runs = byCase[caseId] || [];
    const criterion = VERIFICATION_CRITERIA[caseId];
    if (!criterion) continue;

    if (runs.length === 0) {
      results[caseId] = {
        pass: false, na: false, hardFailure: "no runs recorded", watchZone: null,
        detail: {}, label: criterion.label, expectation: criterion.expectation, runs: [],
      };
      hardFailures.push(`${caseId}: no runs recorded`);
      continue;
    }

    const verdict = criterion.check(runs);
    results[caseId] = {
      pass: verdict.pass, na: verdict.na, hardFailure: verdict.hardFailure,
      watchZone: verdict.watchZone, detail: verdict.detail,
      label: criterion.label, expectation: criterion.expectation,
      runs: runs.map(r => ({ runIndex: r.runIndex, gated: !!r.gated, scores: r.scores })),
    };

    if (verdict.na) naCount++;
    else if (verdict.pass) passCount++;
    if (verdict.hardFailure) hardFailures.push(`${caseId}: ${verdict.hardFailure}`);
    if (verdict.watchZone) watchZones.push(`${caseId}: ${verdict.watchZone}`);
    if (caseId === "AUDIT-B2") b2Passed = verdict.pass && !verdict.hardFailure;
    if (caseId === "AUDIT-M2") m2Passed = verdict.pass && !verdict.hardFailure;
  }

  const assessedCases = CASES.length - naCount;
  const requiredPasses = Math.ceil(0.875 * assessedCases);
  const overallPass = (
    passCount >= requiredPasses &&
    hardFailures.length === 0 &&
    b2Passed === true &&
    m2Passed === true
  );

  return {
    perCase: results, passCount, naCount, assessedCases, requiredPasses,
    totalCases: CASES.length, hardFailures, watchZones,
    b2Passed, m2Passed, overallPass, rerunCount: RERUN_COUNT,
  };
}

// ============================================================================
// REPORT
// ============================================================================

function renderReport(evaluation) {
  const lines = [];
  lines.push(`# V4S29 Stage 2b Rigor Template — HTTP Verification Report`);
  lines.push("");
  lines.push(`**OVERALL VERDICT: ${evaluation.overallPass ? "✅ PASS" : "❌ FAIL"}**`);
  lines.push("");
  lines.push(`### Headline numbers`);
  lines.push(`- Cases passing: **${evaluation.passCount} of ${evaluation.assessedCases}** (need ≥ ${evaluation.requiredPasses})`);
  if (evaluation.naCount > 0) {
    lines.push(`- N/A (excluded): **${evaluation.naCount}** of ${evaluation.totalCases}`);
  }
  lines.push(`- B2 false-positive guard: **${evaluation.b2Passed ? "✅ pass" : "❌ FAIL"}**`);
  lines.push(`- M2 false-positive guard: **${evaluation.m2Passed ? "✅ pass" : "❌ FAIL"}**`);
  lines.push(`- Hard failures: **${evaluation.hardFailures.length}** (need 0)`);
  if (evaluation.hardFailures.length) {
    for (const hf of evaluation.hardFailures) lines.push(`  - ❌ ${hf}`);
  }
  lines.push(`- Watch zones (soft, not failing): **${evaluation.watchZones.length}**`);
  if (evaluation.watchZones.length) {
    for (const wz of evaluation.watchZones) lines.push(`  - ⚠️ ${wz}`);
  }
  lines.push(`- Reruns per case: ${evaluation.rerunCount}`);
  lines.push("");

  lines.push(`### Overall pass requirements (all must be true)`);
  lines.push(`1. ${evaluation.passCount >= evaluation.requiredPasses ? "✅" : "❌"} ${evaluation.passCount} of ${evaluation.assessedCases} cases passed (need ≥ ${evaluation.requiredPasses})`);
  lines.push(`2. ${evaluation.hardFailures.length === 0 ? "✅" : "❌"} No hard failures`);
  lines.push(`3. ${evaluation.b2Passed ? "✅" : "❌"} B2 false-positive guard passed`);
  lines.push(`4. ${evaluation.m2Passed ? "✅" : "❌"} M2 false-positive guard passed`);
  lines.push("");

  lines.push(`## Per-case results`);
  lines.push("");
  lines.push(`| Case | Label | Status |`);
  lines.push(`|---|---|---|`);
  for (const caseId of CASES) {
    const r = evaluation.perCase[caseId];
    if (!r) { lines.push(`| ${caseId} | — | ⚠️ no data |`); continue; }
    let status = r.na ? "🚪 N/A" :
                 r.hardFailure ? "❌ HARD FAIL" :
                 (r.pass && r.watchZone) ? "✅ pass ⚠️ watch" :
                 r.pass ? "✅ pass" : "❌ fail";
    lines.push(`| ${caseId} | ${r.label} | ${status} |`);
  }
  lines.push("");

  lines.push(`## Score arrays per case`);
  lines.push("");
  lines.push(`| Case | MD | MO | OR | Gated? |`);
  lines.push(`|---|---|---|---|---|`);
  for (const caseId of CASES) {
    const r = evaluation.perCase[caseId];
    if (!r || !r.runs.length) { lines.push(`| ${caseId} | — | — | — | — |`); continue; }
    const md = r.runs.map(x => x.scores.md ?? "G").join(", ");
    const mo = r.runs.map(x => x.scores.mo ?? "G").join(", ");
    const or = r.runs.map(x => x.scores.or ?? "G").join(", ");
    const gated = r.runs.filter(x => x.gated).length;
    lines.push(`| ${caseId} | ${md} | ${mo} | ${or} | ${gated} / ${r.runs.length} |`);
  }
  lines.push("");

  lines.push(`## Per-case verdicts`);
  lines.push("");
  for (const caseId of CASES) {
    const r = evaluation.perCase[caseId];
    if (!r) continue;
    let header = r.na ? "🚪 N/A" :
                 r.hardFailure ? "❌ HARD FAIL" :
                 (r.pass && r.watchZone) ? "✅ PASS (⚠️ WATCH ZONE)" :
                 r.pass ? "✅ PASS" : "❌ FAIL";
    lines.push(`### ${caseId} — ${header}`);
    lines.push(`**Label:** ${r.label}`);
    lines.push("");
    lines.push(`**Expectation:** ${r.expectation}`);
    lines.push("");
    if (r.hardFailure) { lines.push(`**Hard failure:** ${r.hardFailure}`); lines.push(""); }
    if (r.watchZone)   { lines.push(`**Watch zone:** ${r.watchZone}`);     lines.push(""); }
    lines.push(`**Detail:** \`${JSON.stringify(r.detail)}\``);
    lines.push("");
  }

  lines.push(`## Next steps`);
  lines.push("");
  if (evaluation.overallPass) {
    lines.push(`- ✅ Verification PASSED. Stage 2b structural rigor template ships.`);
    if (evaluation.watchZones.length) {
      lines.push(`- ⚠️ ${evaluation.watchZones.length} watch zone(s) flagged — manually review explanations for those cases.`);
    }
    lines.push(`- Next: run full B10a regression to verify downstream effects on the rest of the bank, then begin Stage 2a session.`);
  } else {
    lines.push(`- ❌ Verification FAILED. Do NOT ship.`);
    if (evaluation.hardFailures.length) {
      lines.push(`- ${evaluation.hardFailures.length} hard failure(s) — these are catastrophic; diagnose each before iterating.`);
    }
    if (!evaluation.b2Passed) {
      lines.push(`- B2 guard failed: prompt may be over- or under-firing. Check MO direction.`);
    }
    if (!evaluation.m2Passed) {
      lines.push(`- M2 guard failed: well-justified case being unfairly downgraded. Check Row 4 over-fire or honest-exit misuse.`);
    }
  }

  return lines.join("\n");
}

main().catch((e) => {
  console.error("\nFatal:", e.stack || e.message || e);
  process.exit(1);
});

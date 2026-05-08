// ============================================================================
// runners/run-stage2a-stability.js
// ============================================================================
// F1 Phase A — Stage 2a stability diagnostic.
//
// Per F1 lock (execution-plan-v5.2.md):
//   Phase A — Stage 2a stability (5 cases × 5 reruns = 25 calls)
//   Cases: AUDIT-MAT2-beginner, ARC-D2, AUDIT-H4, AUDIT-L2, AUDIT-MD1
//   Pre-flight: AUDIT-H4 case run first to validate runner shape against
//               extractEvaluation() schema
//   Measurement: Jaccard similarity of evidence-packet admissible_facts
//                across 5 reruns of same case
//   Pass criterion: median Jaccard ≥ 0.7 across all 5 cases
//   FAIL outcome: Stage 2a is itself nondeterministic; upstream architectural
//                 conversation needed before Phase B
//
// Side effect: run-1 Stage 2a output for each case is persisted to
// .f1-fixtures/stage2a/{caseId}.json so Phase B can reuse it as the frozen
// packet (per Bundle 2 decision item 2: reuse Phase A run-1).
//
// Usage:
//   node runners/run-stage2a-stability.js                  # 5 reruns/case
//   node runners/run-stage2a-stability.js --resume         # resume from checkpoint
//   node runners/run-stage2a-stability.js --tier-2         # 10 reruns/case escalation
//   node runners/run-stage2a-stability.js --resume --tier-2  # extend 5 → 10
//
// Outputs (in runners/):
//   f1-phase-a-checkpoint.json     — resume state
//   f1-phase-a-results.json        — full per-case stats
//   f1-phase-a-report.md           — human-readable verdict
//   .f1-fixtures/stage1/{id}.json  — Stage 1 fixtures (regenerable)
//   .f1-fixtures/stage2a/{id}.json — Stage 2a run-1 (consumed by Phase B)
// ============================================================================

const path = require("path");
const fs = require("fs");
const shared = require("./f1-diagnostic-shared.js");
const { JACCARD_PASS_THRESHOLD, evaluatePhaseA } = require("./f1-diagnostic-thresholds.js");

// ============================================================================
// CONFIG
// ============================================================================

const args = process.argv.slice(2);
const RESUME = args.includes("--resume");
const TIER_2 = args.includes("--tier-2");
const RERUN_COUNT = TIER_2 ? 10 : 5;

// AUDIT-H4 first — it's the pre-flight schema-validation case per F1 lock.
// Order of remaining cases is arbitrary but kept stable for deterministic
// runner output across invocations.
const PHASE_A_CASES = [
  "AUDIT-H4",
  "AUDIT-MAT2-beginner",
  "ARC-D2",
  "AUDIT-L2",
  "AUDIT-MD1",
];

const CHECKPOINT_PATH = path.join(__dirname, "f1-phase-a-checkpoint.json");
const RESULTS_PATH    = path.join(__dirname, "f1-phase-a-results.json");
const REPORT_PATH     = path.join(__dirname, "f1-phase-a-report.md");
const PREFLIGHT_DUMP  = path.join(__dirname, "f1-phase-a-preflight-failure.json");

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("============================================");
  console.log("F1 Phase A — Stage 2a stability diagnostic");
  console.log(`Reruns per case: ${RERUN_COUNT}${TIER_2 ? " (TIER-2 escalation)" : ""}`);
  console.log(`Cases: ${PHASE_A_CASES.length}`);
  console.log("============================================");

  // Existing-checkpoint guard (require explicit --resume)
  if (!RESUME && fs.existsSync(CHECKPOINT_PATH)) {
    console.error(
      `\n⚠️  Existing checkpoint at ${CHECKPOINT_PATH}\n` +
      `   Use --resume to continue, or delete the file to start fresh.`
    );
    process.exit(1);
  }

  let cp = shared.loadCheckpoint(CHECKPOINT_PATH);
  if (RESUME) {
    console.log(`\nResuming from checkpoint (${cp.runs.length} runs already recorded)`);
  }

  // Iterate cases
  for (const caseId of PHASE_A_CASES) {
    let caseDef;
    try {
      caseDef = shared.loadCase(caseId);
    } catch (e) {
      console.error(`\n❌ ${e.message}`);
      process.exit(1);
    }

    console.log(`\n═══ Case: ${caseId} ═══`);

    // Stage 1 fixture (auto-generate on cache miss)
    console.log(`  📁 Stage 1 fixture...`);
    const t0f = Date.now();
    let stage1;
    try {
      stage1 = await shared.getStage1Fixture(caseDef);
    } catch (e) {
      console.error(`  ❌ Stage 1 fixture failed: ${e.message}`);
      throw e;
    }
    const fixSec = ((Date.now() - t0f) / 1000).toFixed(1);
    console.log(
      `     github=${stage1.meta?.githubCount ?? "?"} ` +
      `serper=${stage1.meta?.serperCount ?? "?"} ` +
      `hasRealData=${stage1.meta?.hasRealData ?? "?"} (${fixSec}s)`
    );

    // Stage 2a reruns
    for (let runIndex = 1; runIndex <= RERUN_COUNT; runIndex++) {
      if (shared.isCompleted(cp, caseId, runIndex)) {
        console.log(`  ⏭️  Run ${runIndex}: already in checkpoint`);
        continue;
      }
      const t0 = Date.now();
      let result, errors;
      try {
        result = await shared.runStage2a(caseDef, stage1);
        errors = shared.validateStage2aShape(result);
      } catch (e) {
        errors = [`exception: ${e.message}`];
      }
      const elapsedMs = Date.now() - t0;

      // Pre-flight gate: AUDIT-H4 run 1 must validate cleanly. If not, halt
      // before burning the rest of the diagnostic on a broken runner.
      if (caseId === "AUDIT-H4" && runIndex === 1 && errors.length) {
        console.error(`\n❌ Pre-flight failed (AUDIT-H4 run 1) — schema errors:`);
        for (const e of errors) console.error(`     - ${e}`);
        fs.writeFileSync(
          PREFLIGHT_DUMP,
          JSON.stringify({ result, errors }, null, 2)
        );
        console.error(`   Last response dumped to ${PREFLIGHT_DUMP}`);
        console.error(`   Halting before burning the rest of the diagnostic budget.`);
        process.exit(2);
      }

      if (errors.length) {
        console.log(`  ⚠️  Run ${runIndex}: shape errors (${errors.length}) — recording, continuing`);
        for (const e of errors) console.log(`       - ${e}`);
        shared.appendRun(CHECKPOINT_PATH, cp, {
          caseId, runIndex, status: "shape_error", errors, elapsedMs,
        });
        continue;
      }

      // Persist run-1 Stage 2a output as Phase B fixture
      if (runIndex === 1) {
        const stage2aFixturePath = path.join(shared.STAGE2A_FIXTURE_DIR, `${caseId}.json`);
        fs.writeFileSync(stage2aFixturePath, JSON.stringify(result, null, 2));
      }

      // Extract admissible_facts per packet for stats
      const ep = result.evidence_packets;
      const facts = {
        md: ep.market_demand.admissible_facts,
        mo: ep.monetization.admissible_facts,
        or: ep.originality.admissible_facts,
      };

      shared.appendRun(CHECKPOINT_PATH, cp, {
        caseId, runIndex, status: "success",
        admissibleFacts: facts,
        elapsedMs,
      });
      console.log(
        `  ✓ Run ${runIndex}: MD=${facts.md.length} MO=${facts.mo.length} OR=${facts.or.length} ` +
        `facts (${(elapsedMs / 1000).toFixed(1)}s)`
      );
    }
  }

  // ============================================================================
  // COMPUTE STATS + RENDER REPORT
  // ============================================================================
  console.log("\n═══ Computing stats ═══");
  const stats = computeStats(cp);
  const verdict = evaluatePhaseA(stats);

  fs.writeFileSync(RESULTS_PATH, JSON.stringify({ stats, verdict }, null, 2));
  const report = renderReport(stats, verdict);
  fs.writeFileSync(REPORT_PATH, report);

  console.log("\n" + report);
  console.log(`\n📁 Outputs:`);
  console.log(`   ${RESULTS_PATH}`);
  console.log(`   ${REPORT_PATH}`);
}

// ============================================================================
// STATS COMPUTATION
// ============================================================================
// For each case:
//   - Per packet (MD, MO, OR): pairwise Jaccard across N reruns = C(N,2) values
//   - Case median = median of all 3 × C(N,2) pairwise values combined
//   - Per-packet median also reported for diagnostic clarity
// Overall:
//   - Median across the 5 case medians

function computeStats(cp) {
  const byCase = {};
  for (const run of cp.runs) {
    if (run.status !== "success") continue;
    if (!byCase[run.caseId]) byCase[run.caseId] = [];
    byCase[run.caseId].push(run);
  }

  const cases = {};
  const allCaseMedians = [];

  for (const caseId of Object.keys(byCase)) {
    const runs = byCase[caseId].sort((a, b) => a.runIndex - b.runIndex);
    const factsByPacket = {
      md: runs.map((r) => r.admissibleFacts.md),
      mo: runs.map((r) => r.admissibleFacts.mo),
      or: runs.map((r) => r.admissibleFacts.or),
    };
    const jaccards = {
      md: shared.pairwiseJaccard(factsByPacket.md),
      mo: shared.pairwiseJaccard(factsByPacket.mo),
      or: shared.pairwiseJaccard(factsByPacket.or),
    };
    const allJaccards = [...jaccards.md, ...jaccards.mo, ...jaccards.or];
    const caseMedian = shared.median(allJaccards);

    cases[caseId] = {
      runs: runs.length,
      jaccards,
      medianByPacket: {
        md: shared.median(jaccards.md),
        mo: shared.median(jaccards.mo),
        or: shared.median(jaccards.or),
      },
      median: caseMedian,
      factCounts: {
        md: factsByPacket.md.map((f) => f.length),
        mo: factsByPacket.mo.map((f) => f.length),
        or: factsByPacket.or.map((f) => f.length),
      },
    };
    allCaseMedians.push(caseMedian);
  }

  return {
    cases,
    overallMedian: shared.median(allCaseMedians),
    rerunCount: Object.values(byCase)[0]?.length ?? 0,
  };
}

// ============================================================================
// REPORT RENDERING
// ============================================================================

function renderReport(stats, verdict) {
  const f = (v) => (v == null ? "n/a" : v.toFixed(3));
  const lines = [];

  lines.push(`# F1 Phase A — Stage 2a Stability Report`);
  lines.push("");
  lines.push(`**VERDICT:** ${verdict.result} — ${verdict.note}`);
  lines.push("");
  lines.push(`- Pass threshold: median Jaccard ≥ ${JACCARD_PASS_THRESHOLD}`);
  lines.push(`- Reruns per case: ${stats.rerunCount}`);
  lines.push(`- Overall median Jaccard: ${f(stats.overallMedian)}`);
  lines.push("");

  lines.push(`## Per-case Jaccard medians`);
  lines.push("");
  lines.push(`| Case | Runs | Median (all packets) | MD | MO | OR |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (const [caseId, s] of Object.entries(stats.cases)) {
    lines.push(
      `| ${caseId} | ${s.runs} | ${f(s.median)} | ${f(s.medianByPacket.md)} | ${f(s.medianByPacket.mo)} | ${f(s.medianByPacket.or)} |`
    );
  }
  lines.push("");

  lines.push(`## Fact counts per rerun`);
  lines.push("");
  lines.push(`| Case | MD counts | MO counts | OR counts |`);
  lines.push(`|---|---|---|---|`);
  for (const [caseId, s] of Object.entries(stats.cases)) {
    lines.push(
      `| ${caseId} | ${s.factCounts.md.join(", ")} | ${s.factCounts.mo.join(", ")} | ${s.factCounts.or.join(", ")} |`
    );
  }
  lines.push("");

  lines.push(`## Interpretation`);
  lines.push("");
  if (verdict.result === "PASS") {
    lines.push(
      `Stage 2a is sufficiently stable across reruns. Phase B can proceed and ` +
      `will measure Stage 2b's independence with confidence that variance ` +
      `flowing into Stage 2b reruns is not Stage 2a-driven.`
    );
  } else if (verdict.result === "FAIL") {
    lines.push(
      `Stage 2a is itself nondeterministic. The F1 architecture conversation ` +
      `must address Stage 2a stabilization (likely candidate: sampler hardening ` +
      `with top_k=1, top_p=0.1 to match Stage 1's V4S28 P0.5 Fix #3) BEFORE ` +
      `Phase B can produce a clean 1A vs 1B verdict. Phase B against unstable ` +
      `Stage 2a fixtures would conflate Stage 2a variance with Stage 2b ` +
      `cross-metric judgment-sharing.`
    );
  } else {
    lines.push(
      `Inconclusive — investigate the checkpoint and run logs before proceeding.`
    );
  }
  return lines.join("\n");
}

main().catch((e) => {
  console.error("\nFatal:", e.stack || e.message || e);
  process.exit(1);
});

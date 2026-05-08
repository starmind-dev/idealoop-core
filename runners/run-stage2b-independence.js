// ============================================================================
// runners/run-stage2b-independence.js
// ============================================================================
// F1 Phase B — Stage 2b independence diagnostic.
//
// Per F1 lock (execution-plan-v5.2.md):
//   Phase B — Stage 2b independence (8 cases × 5 reruns = 40 calls)
//   Cases: Phase A 5 + AUDIT-MAT1-intermediate, AUDIT-M3, AUDIT-A2
//   Measurement: per-case stddev of MD, MO, OR across 5 reruns;
//                cross-metric Spearman correlation within reruns
//   Verdict logic (in f1-diagnostic-thresholds.js):
//     1B (FULL_SPLIT): ARC-D2 OR-only stddev ≥0.6 with MD/MO ≤0.25;
//                      L2 MO-only pattern (MO > MD > OR);
//                      median Spearman ≤0.25 across the bank
//     1A (OR_ONLY):    H4/M3 case-level Spearman ≥0.5;
//                      ARC-D2 MD/MO stddev ≥50% of OR's;
//                      median Spearman ≥0.5 across the bank
//     AMBIGUOUS:       neither signature fully fires → escalate via --tier-2
//
// Stage 2a fixture sourcing per case:
//   - 5 cases shared with Phase A: cache-hit on .f1-fixtures/stage2a/{id}.json
//     (saved by run-stage2a-stability.js's run-1)
//   - 3 Phase-B-only cases (MAT1-intermediate, M3, A2): cache-miss → runner
//     auto-generates via getStage2aFixture (1 fresh Stage 2a call each)
//
// Usage:
//   node runners/run-stage2b-independence.js                  # 5 reruns/case
//   node runners/run-stage2b-independence.js --resume         # resume
//   node runners/run-stage2b-independence.js --tier-2         # 10 reruns/case
//   node runners/run-stage2b-independence.js --resume --tier-2  # extend 5 → 10
//
// Outputs (in runners/):
//   f1-phase-b-checkpoint.json     — resume state
//   f1-phase-b-results.json        — full per-case stats + verdict
//   f1-phase-b-report.md           — human-readable verdict
// ============================================================================

const path = require("path");
const fs = require("fs");
const shared = require("./f1-diagnostic-shared.js");
const { evaluatePhaseB, PHASE_B_THRESHOLDS } = require("./f1-diagnostic-thresholds.js");

// ============================================================================
// CONFIG
// ============================================================================

const args = process.argv.slice(2);
const RESUME = args.includes("--resume");
const TIER_2 = args.includes("--tier-2");
const RERUN_COUNT = TIER_2 ? 10 : 5;

// AUDIT-H4 first — pre-flight schema-validation case per F1 lock pattern.
const PHASE_B_CASES = [
  "AUDIT-H4",
  "AUDIT-MAT2-beginner",
  "ARC-D2",
  "AUDIT-L2",
  "AUDIT-MD1",
  "AUDIT-MAT1-intermediate",
  "AUDIT-M3",
  "AUDIT-A2",
];

const CHECKPOINT_PATH = path.join(__dirname, "f1-phase-b-checkpoint.json");
const RESULTS_PATH    = path.join(__dirname, "f1-phase-b-results.json");
const REPORT_PATH     = path.join(__dirname, "f1-phase-b-report.md");
const PREFLIGHT_DUMP  = path.join(__dirname, "f1-phase-b-preflight-failure.json");

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("============================================");
  console.log("F1 Phase B — Stage 2b independence diagnostic");
  console.log(`Reruns per case: ${RERUN_COUNT}${TIER_2 ? " (TIER-2 escalation)" : ""}`);
  console.log(`Cases: ${PHASE_B_CASES.length}`);
  console.log("============================================");

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

  for (const caseId of PHASE_B_CASES) {
    let caseDef;
    try {
      caseDef = shared.loadCase(caseId);
    } catch (e) {
      console.error(`\n❌ ${e.message}`);
      process.exit(1);
    }

    console.log(`\n═══ Case: ${caseId} ═══`);

    // Stage 2a fixture (cache-hit for Phase A cases; fresh generation for new ones)
    console.log(`  📁 Stage 2a fixture...`);
    const t0f = Date.now();
    let stage2aPacket;
    try {
      stage2aPacket = await shared.getStage2aFixture(caseDef);
    } catch (e) {
      console.error(`  ❌ Stage 2a fixture failed: ${e.message}`);
      throw e;
    }
    const fixSec = ((Date.now() - t0f) / 1000).toFixed(1);
    const factCounts = {
      md: stage2aPacket?.evidence_packets?.market_demand?.admissible_facts?.length ?? "?",
      mo: stage2aPacket?.evidence_packets?.monetization?.admissible_facts?.length ?? "?",
      or: stage2aPacket?.evidence_packets?.originality?.admissible_facts?.length ?? "?",
    };
    console.log(`     facts MD=${factCounts.md} MO=${factCounts.mo} OR=${factCounts.or} (${fixSec}s)`);

    // Stage 2b reruns
    for (let runIndex = 1; runIndex <= RERUN_COUNT; runIndex++) {
      if (shared.isCompleted(cp, caseId, runIndex)) {
        console.log(`  ⏭️  Run ${runIndex}: already in checkpoint`);
        continue;
      }
      const t0 = Date.now();
      let result, errors;
      try {
        result = await shared.runStage2b(caseDef, stage2aPacket);
        errors = shared.validateStage2bShape(result);
      } catch (e) {
        errors = [`exception: ${e.message}`];
      }
      const elapsedMs = Date.now() - t0;

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

      const ev = result.evaluation;
      const scores = {
        md: ev.market_demand.score,
        mo: ev.monetization.score,
        or: ev.originality.score,
      };
      const evidenceLevel = ev.evidence_strength?.level ?? null;

      shared.appendRun(CHECKPOINT_PATH, cp, {
        caseId, runIndex, status: "success",
        scores,
        evidenceLevel,
        elapsedMs,
      });
      console.log(
        `  ✓ Run ${runIndex}: MD=${scores.md} MO=${scores.mo} OR=${scores.or} ` +
        `(EvStr=${evidenceLevel ?? "?"}, ${(elapsedMs / 1000).toFixed(1)}s)`
      );
    }
  }

  // ============================================================================
  // COMPUTE STATS + RENDER REPORT
  // ============================================================================
  console.log("\n═══ Computing stats ═══");
  const stats = computeStats(cp);
  const verdict = evaluatePhaseB(stats);

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
// Per case (across N reruns):
//   - Sample stddev of MD, MO, OR scores
//   - Spearman correlation between each metric pair: ρ(MD,MO), ρ(MD,OR), ρ(MO,OR)
//   - Case median Spearman = median of the 3 pair correlations
// Bank-wide:
//   - bankMedianSpearman = median of the 8 case medians

function computeStats(cp) {
  const byCase = {};
  for (const run of cp.runs) {
    if (run.status !== "success") continue;
    if (!byCase[run.caseId]) byCase[run.caseId] = [];
    byCase[run.caseId].push(run);
  }

  const cases = {};
  const caseMedianSpearmans = [];

  for (const caseId of Object.keys(byCase)) {
    const runs = byCase[caseId].sort((a, b) => a.runIndex - b.runIndex);
    const md = runs.map((r) => r.scores.md);
    const mo = runs.map((r) => r.scores.mo);
    const or = runs.map((r) => r.scores.or);

    const stddev = {
      md: shared.stddev(md),
      mo: shared.stddev(mo),
      or: shared.stddev(or),
    };
    const spearmanPairs = {
      mdMo: shared.spearman(md, mo),
      mdOr: shared.spearman(md, or),
      moOr: shared.spearman(mo, or),
    };
    const medianSpearman = shared.median([
      spearmanPairs.mdMo,
      spearmanPairs.mdOr,
      spearmanPairs.moOr,
    ]);

    cases[caseId] = {
      runs: runs.length,
      scores: { md, mo, or },
      stddev,
      spearman: spearmanPairs,
      medianSpearman,
    };
    caseMedianSpearmans.push(medianSpearman);
  }

  return {
    cases,
    bankMedianSpearman: shared.median(caseMedianSpearmans),
    rerunCount: Object.values(byCase)[0]?.length ?? 0,
  };
}

// ============================================================================
// REPORT RENDERING
// ============================================================================

function renderReport(stats, verdict) {
  const f = (v) => (v == null ? "n/a" : v.toFixed(3));
  const lines = [];

  lines.push(`# F1 Phase B — Stage 2b Independence Report`);
  lines.push("");
  lines.push(`**VERDICT:** ${verdict.result} — ${verdict.note}`);
  lines.push("");
  lines.push(`- Reruns per case: ${stats.rerunCount}`);
  lines.push(`- Bank median Spearman: ${f(stats.bankMedianSpearman)}`);
  lines.push("");

  lines.push(`## Per-case stddev + Spearman`);
  lines.push("");
  lines.push(`| Case | Runs | σ(MD) | σ(MO) | σ(OR) | ρ(MD,MO) | ρ(MD,OR) | ρ(MO,OR) | median ρ |`);
  lines.push(`|---|---|---|---|---|---|---|---|---|`);
  for (const [caseId, s] of Object.entries(stats.cases)) {
    lines.push(
      `| ${caseId} | ${s.runs} | ${f(s.stddev.md)} | ${f(s.stddev.mo)} | ${f(s.stddev.or)} | ` +
      `${f(s.spearman.mdMo)} | ${f(s.spearman.mdOr)} | ${f(s.spearman.moOr)} | ${f(s.medianSpearman)} |`
    );
  }
  lines.push("");

  lines.push(`## Score arrays (per rerun)`);
  lines.push("");
  lines.push(`| Case | MD | MO | OR |`);
  lines.push(`|---|---|---|---|`);
  for (const [caseId, s] of Object.entries(stats.cases)) {
    lines.push(`| ${caseId} | ${s.scores.md.join(", ")} | ${s.scores.mo.join(", ")} | ${s.scores.or.join(", ")} |`);
  }
  lines.push("");

  lines.push(`## Verdict signature trace`);
  lines.push("");
  if (verdict.conditions) {
    lines.push("```json");
    lines.push(JSON.stringify(verdict.conditions, null, 2));
    lines.push("```");
    lines.push("");
  }

  lines.push(`## Cure direction`);
  lines.push("");
  if (verdict.result === "1B") {
    lines.push(
      `**FULL_SPLIT cure ships.** Stage MD ‖ Stage MO ‖ Stage OR each operate ` +
      `independently with their own packets. Stage 2c owns evidence_strength ` +
      `(folded into synthesis). Larger architectural change; cross-metric ` +
      `contamination eliminated entirely.`
    );
    lines.push("");
    lines.push(
      `**F8a content port required:** Bundle 1's F8a textual content (HIGH ` +
      `reason content rule + anti-templating rule + 3 Example A/B/C frames) ` +
      `ports mechanically to Stage 2c's new EvStr section per location-` +
      `portability rule. Mechanical copy operation, not new authoring. ` +
      `Verify Higher-order Principle gate passes on the moved content.`
    );
  } else if (verdict.result === "1A") {
    lines.push(
      `**OR_ONLY cure ships.** Stage 2b continues to score MD + MO + EvStr. ` +
      `Stage OR moves to its own sidecar Sonnet call with OR-bounded packet ` +
      `only. Cross-metric contamination between MD/MO eliminated for OR; ` +
      `MD/MO retain shared scoring context. Smaller architectural change.`
    );
    lines.push("");
    lines.push(
      `**F8a content stays in Stage 2b.** Bundle 1's edits remain in place; ` +
      `no port required. EvStr stays in Stage 2b.`
    );
  } else if (verdict.result === "AMBIGUOUS") {
    lines.push(
      `**Escalate to Tier-2 verification.** Re-run with \`--tier-2 --resume\` ` +
      `to extend 5 reruns/case to 10 reruns/case. Tier-2 may resolve the ` +
      `ambiguity by tightening confidence intervals on the per-case stddev ` +
      `and Spearman estimates.`
    );
    lines.push("");
    lines.push(
      `If Tier-2 still produces AMBIGUOUS, the architectural conversation ` +
      `re-opens with this data — the verdict logic needs design review, not ` +
      `threshold relaxation (per Methodology Principle 6).`
    );
  } else {
    lines.push(`Inconclusive — investigate the checkpoint and run logs before proceeding.`);
  }
  return lines.join("\n");
}

main().catch((e) => {
  console.error("\nFatal:", e.stack || e.message || e);
  process.exit(1);
});

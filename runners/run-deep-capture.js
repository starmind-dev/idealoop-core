// ============================================================================
// runners/run-deep-capture.js
// ============================================================================
// F1 Phase 1 — Observational deep capture.
//
// Captures FULL Stage 2b output (scores + explanations + evidence_strength
// reason + extras) across reruns of bimodal cases. Production prompt and
// sampler unchanged.
//
// Cases: 4 bimodal (AUDIT-L2, ARC-D2, AUDIT-M3, AUDIT-MAT2-beginner)
// Reruns: 10 per case = 40 calls, ~$4, ~10 min wall
// ============================================================================

const path = require("path");
const fs = require("fs");
const inv = require("./f1-investigation-shared.js");

const args = process.argv.slice(2);
const RESUME = args.includes("--resume");
const RERUN_COUNT = 10;

const CASES = [
  "AUDIT-L2",
  "ARC-D2",
  "AUDIT-M3",
  "AUDIT-MAT2-beginner",
];

const CHECKPOINT_PATH = path.join(__dirname, "f1-phase1-deep-checkpoint.json");
const RESULTS_PATH    = path.join(__dirname, "f1-phase1-deep-results.json");
const REPORT_PATH     = path.join(__dirname, "f1-phase1-deep-report.md");

async function main() {
  console.log("============================================");
  console.log("F1 Phase 1 — Deep capture (full Stage 2b output)");
  console.log(`Reruns per case: ${RERUN_COUNT}`);
  console.log(`Cases: ${CASES.length}`);
  console.log("============================================");

  if (!RESUME && fs.existsSync(CHECKPOINT_PATH)) {
    console.error(`\n⚠️  Existing checkpoint at ${CHECKPOINT_PATH}\n   Use --resume to continue, or delete to start fresh.`);
    process.exit(1);
  }

  let cp = inv.loadCheckpoint(CHECKPOINT_PATH);
  if (RESUME) console.log(`\nResuming (${cp.runs.length} runs already recorded)`);

  for (const caseId of CASES) {
    const caseDef = inv.loadCase(caseId);
    console.log(`\n═══ Case: ${caseId} ═══`);

    const stage2aPacket = await inv.getStage2aFixture(caseDef);
    console.log(`  📁 Stage 2a fixture loaded`);

    for (let runIndex = 1; runIndex <= RERUN_COUNT; runIndex++) {
      if (inv.isCompleted(cp, caseId, runIndex)) {
        console.log(`  ⏭️  Run ${runIndex}: already in checkpoint`);
        continue;
      }
      const t0 = Date.now();
      let fullOutput;
      try {
        fullOutput = await inv.runStage2bWithOptions(caseDef, stage2aPacket);
      } catch (e) {
        console.log(`  ⚠️  Run ${runIndex}: ${e.message}`);
        inv.appendRun(CHECKPOINT_PATH, cp, {
          caseId, runIndex, status: "error", error: e.message, elapsedMs: Date.now() - t0,
        });
        continue;
      }
      const record = inv.extractFullStage2bRecord(fullOutput);
      const elapsedMs = Date.now() - t0;
      inv.appendRun(CHECKPOINT_PATH, cp, {
        caseId, runIndex, status: "success",
        ...record,
        elapsedMs,
      });
      const s = record.scores;
      console.log(`  ✓ Run ${runIndex}: MD=${s.md} MO=${s.mo} OR=${s.or} (EvStr=${record.evidence_strength?.level}, ${(elapsedMs/1000).toFixed(1)}s)`);
    }
  }

  console.log("\n═══ Computing mode groupings ═══");
  const analysis = analyzeModeGroupings(cp);
  fs.writeFileSync(RESULTS_PATH, JSON.stringify({ runs: cp.runs, analysis }, null, 2));
  const report = renderReport(analysis);
  fs.writeFileSync(REPORT_PATH, report);

  console.log("\n" + report);
  console.log(`\n📁 Outputs:\n   ${RESULTS_PATH}\n   ${REPORT_PATH}`);
}

function analyzeModeGroupings(cp) {
  const byCase = {};
  for (const run of cp.runs) {
    if (run.status !== "success") continue;
    if (!byCase[run.caseId]) byCase[run.caseId] = [];
    byCase[run.caseId].push(run);
  }
  const result = {};
  for (const [caseId, runs] of Object.entries(byCase)) {
    const groups = {};
    for (const r of runs) {
      const key = `MD=${r.scores.md}|MO=${r.scores.mo}|OR=${r.scores.or}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    const sorted = Object.entries(groups)
      .sort(([, a], [, b]) => b.length - a.length)
      .map(([key, members]) => ({
        key,
        scores: members[0].scores,
        count: members.length,
        runIndices: members.map((m) => m.runIndex).sort((a, b) => a - b),
        representative: {
          explanations: members[0].explanations,
          evidence_strength: members[0].evidence_strength,
          extras: members[0].extras,
        },
      }));
    result[caseId] = {
      totalRuns: runs.length,
      modeCount: sorted.length,
      modes: sorted,
    };
  }
  return result;
}

function renderReport(analysis) {
  const lines = [];
  lines.push(`# F1 Phase 1 — Deep Capture Report`);
  lines.push("");
  lines.push(`Goal: compare reasoning text across score modes within bimodal cases.`);
  lines.push(`If different modes cite different rubric language, band-boundary fuzziness is the cause.`);
  lines.push("");

  for (const [caseId, info] of Object.entries(analysis)) {
    lines.push(`---`);
    lines.push(`## ${caseId}`);
    lines.push(`Total reruns: ${info.totalRuns} · Distinct score modes: ${info.modeCount}`);
    lines.push("");

    if (info.modeCount === 1) {
      lines.push(`**MONOMODAL** — all reruns produced identical scores. No reasoning split to inspect.`);
      lines.push("");
      const m = info.modes[0];
      lines.push(`Scores: MD=${m.scores.md} · MO=${m.scores.mo} · OR=${m.scores.or}`);
      lines.push("");
      lines.push(`**MO explanation:**`);
      lines.push(`> ${(m.representative.explanations.mo || "").replace(/\n/g, " ")}`);
      lines.push("");
      continue;
    }

    lines.push(`**MULTIMODAL** — ${info.modeCount} distinct score tuples observed.`);
    lines.push("");

    for (let i = 0; i < info.modes.length; i++) {
      const m = info.modes[i];
      lines.push(`### Mode ${i + 1}: MD=${m.scores.md} · MO=${m.scores.mo} · OR=${m.scores.or}  (${m.count}/${info.totalRuns} runs · runs ${m.runIndices.join(", ")})`);
      lines.push("");
      lines.push(`**MD explanation:**`);
      lines.push(`> ${(m.representative.explanations.md || "").replace(/\n/g, " ")}`);
      lines.push("");
      lines.push(`**MO explanation:**`);
      lines.push(`> ${(m.representative.explanations.mo || "").replace(/\n/g, " ")}`);
      lines.push("");
      lines.push(`**OR explanation:**`);
      lines.push(`> ${(m.representative.explanations.or || "").replace(/\n/g, " ")}`);
      lines.push("");
      lines.push(`**Evidence strength:** ${m.representative.evidence_strength?.level} — ${m.representative.evidence_strength?.reason || ""}`);
      lines.push("");
    }

    lines.push(`### Cross-mode reasoning diff for ${caseId}`);
    lines.push("");
    const m1 = info.modes[0], m2 = info.modes[1];
    const moDiff = m1.scores.mo !== m2.scores.mo;
    const mdDiff = m1.scores.md !== m2.scores.md;
    const orDiff = m1.scores.or !== m2.scores.or;
    const diffMetrics = [];
    if (mdDiff) diffMetrics.push(`MD (${m1.scores.md} vs ${m2.scores.md})`);
    if (moDiff) diffMetrics.push(`MO (${m1.scores.mo} vs ${m2.scores.mo})`);
    if (orDiff) diffMetrics.push(`OR (${m1.scores.or} vs ${m2.scores.or})`);
    lines.push(`Differs on: ${diffMetrics.join(", ")}`);
    lines.push("");
  }

  lines.push(`---`);
  lines.push(`## How to read this report`);
  lines.push("");
  lines.push(`For each multimodal case, compare the explanation text between modes:`);
  lines.push(`- **If different modes cite different rubric levels** ("rubric 5-6" vs "rubric 7-8"), or use different anchor language ("moderate pricing" vs "clear, strong"): the model is selecting between two coherent rubric-level interpretations. **Band-boundary fuzziness confirmed.**`);
  lines.push(`- **If both modes cite the same rubric level** with similar language, just differing on the 0.5-step score: the cause is closer to discretization or near-tied probability collapse, not boundary fuzziness.`);
  lines.push(`- **If explanations describe different facts being weighted**: the model is making different evidence-weighting choices per run. Different mechanism — could indicate prompt instructions are not constraining evidence-weighting tightly enough.`);
  return lines.join("\n");
}

main().catch((e) => {
  console.error("\nFatal:", e.stack || e.message || e);
  process.exit(1);
});
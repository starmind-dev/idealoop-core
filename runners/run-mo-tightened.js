// ============================================================================
// runners/run-mo-tightened.js
// ============================================================================
// F1 Phase 2A — MO band tightening interventional test.
// Cases: 3 MO-bimodal (L2, ARC-D2, M3) · Reruns: 10 = 30 calls, ~$3, ~6 min
// ============================================================================

const path = require("path");
const fs = require("fs");
const inv = require("./f1-investigation-shared.js");
const { buildMoTightenedPrompt } = require("./prompts/stage2b-mo-tightened.js");

const args = process.argv.slice(2);
const RESUME = args.includes("--resume");
const RERUN_COUNT = 10;

const CASES = [
  "AUDIT-L2",
  "ARC-D2",
  "AUDIT-M3",
];

const CHECKPOINT_PATH = path.join(__dirname, "f1-phase2a-mo-checkpoint.json");
const RESULTS_PATH    = path.join(__dirname, "f1-phase2a-mo-results.json");
const REPORT_PATH     = path.join(__dirname, "f1-phase2a-mo-report.md");

async function main() {
  console.log("============================================");
  console.log("F1 Phase 2A — MO band tightening test");
  console.log(`Counterfactual prompt: MO bands enumerated, all else byte-identical`);
  console.log(`Cases: ${CASES.length} · Reruns/case: ${RERUN_COUNT}`);
  console.log("============================================");

  if (!RESUME && fs.existsSync(CHECKPOINT_PATH)) {
    console.error(`\n⚠️  Existing checkpoint at ${CHECKPOINT_PATH}\n   Use --resume to continue, or delete to start fresh.`);
    process.exit(1);
  }

  console.log("\nBuilding MO-tightened prompt from production base...");
  const moTightenedPrompt = await buildMoTightenedPrompt();
  console.log(`Prompt built: ${moTightenedPrompt.length} chars`);

  let cp = inv.loadCheckpoint(CHECKPOINT_PATH);
  if (RESUME) console.log(`Resuming (${cp.runs.length} runs already recorded)`);

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
      let result;
      try {
        result = await inv.runStage2bWithOptions(caseDef, stage2aPacket, {
          systemPrompt: moTightenedPrompt,
        });
      } catch (e) {
        console.log(`  ⚠️  Run ${runIndex}: ${e.message}`);
        inv.appendRun(CHECKPOINT_PATH, cp, {
          caseId, runIndex, status: "error", error: e.message, elapsedMs: Date.now() - t0,
        });
        continue;
      }
      const ev = result.evaluation;
      const scores = {
        md: ev.market_demand.score,
        mo: ev.monetization.score,
        or: ev.originality.score,
      };
      const explanations = {
        md: ev.market_demand?.explanation,
        mo: ev.monetization?.explanation,
        or: ev.originality?.explanation,
      };
      const evidenceLevel = ev.evidence_strength?.level ?? null;
      const elapsedMs = Date.now() - t0;
      inv.appendRun(CHECKPOINT_PATH, cp, {
        caseId, runIndex, status: "success",
        scores, explanations, evidenceLevel, elapsedMs,
      });
      console.log(`  ✓ Run ${runIndex}: MD=${scores.md} MO=${scores.mo} OR=${scores.or} (${(elapsedMs/1000).toFixed(1)}s)`);
    }
  }

  console.log("\n═══ Computing stats ═══");
  const stats = computeStats(cp);
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(stats, null, 2));
  const report = renderReport(stats);
  fs.writeFileSync(REPORT_PATH, report);

  console.log("\n" + report);
  console.log(`\n📁 Outputs:\n   ${RESULTS_PATH}\n   ${REPORT_PATH}`);
}

const PRODUCTION_BASELINE = {
  "AUDIT-L2":  { mdSigma: 0.000, moSigma: 0.775, orSigma: 0.258, moSet: "{4.5, 6}", moRatio: "4:6" },
  "ARC-D2":    { mdSigma: 0.000, moSigma: 0.632, orSigma: 0.158, moSet: "{4.5, 6}", moRatio: "8:2" },
  "AUDIT-M3":  { mdSigma: 0.000, moSigma: 0.211, orSigma: 0.000, moSet: "{4.5, 5}", moRatio: "2:8" },
};

function computeStats(cp) {
  const byCase = {};
  for (const run of cp.runs) {
    if (run.status !== "success") continue;
    if (!byCase[run.caseId]) byCase[run.caseId] = [];
    byCase[run.caseId].push(run);
  }
  const cases = {};
  for (const caseId of Object.keys(byCase)) {
    const runs = byCase[caseId].sort((a, b) => a.runIndex - b.runIndex);
    const md = runs.map((r) => r.scores.md);
    const mo = runs.map((r) => r.scores.mo);
    const or = runs.map((r) => r.scores.or);
    cases[caseId] = {
      runs: runs.length,
      scores: { md, mo, or },
      stddev: { md: inv.stddev(md), mo: inv.stddev(mo), or: inv.stddev(or) },
      explanations: runs.map((r) => r.explanations),
      uniqueMOscores: [...new Set(mo)].sort((a, b) => a - b),
      uniqueMDscores: [...new Set(md)].sort((a, b) => a - b),
      uniqueORscores: [...new Set(or)].sort((a, b) => a - b),
    };
  }
  return { cases, rerunCount: Object.values(byCase)[0]?.length ?? 0 };
}

function renderReport(stats) {
  const f = (v) => (v == null ? "n/a" : v.toFixed(3));
  const lines = [];

  lines.push(`# F1 Phase 2A — MO Tightening Test`);
  lines.push("");
  lines.push(`**Hypothesis:** Replacing MO's fuzzy band descriptors with enumerable anchors eliminates MO bimodality.`);
  lines.push("");
  lines.push(`Counterfactual prompt: MO commercial bands rewritten (decidable conditions per band, mirroring OR's structure). Everything else byte-identical to production.`);
  lines.push(`Production sampler retained: \`temperature=0\` only.`);
  lines.push(`Reruns per case: ${stats.rerunCount}`);
  lines.push("");

  lines.push(`## Result vs production baseline`);
  lines.push("");
  lines.push(`| Case | σ(MD) prod → counterfactual | σ(MO) prod → counterfactual | σ(OR) prod → counterfactual | MO unique scores |`);
  lines.push(`|---|---|---|---|---|`);
  for (const [caseId, s] of Object.entries(stats.cases)) {
    const baseline = PRODUCTION_BASELINE[caseId];
    if (!baseline) continue;
    lines.push(
      `| ${caseId} | ${baseline.mdSigma.toFixed(3)} → ${f(s.stddev.md)} | ` +
      `${baseline.moSigma.toFixed(3)} → ${f(s.stddev.mo)} | ` +
      `${baseline.orSigma.toFixed(3)} → ${f(s.stddev.or)} | ` +
      `${JSON.stringify(s.uniqueMOscores)} |`
    );
  }
  lines.push("");

  lines.push(`## Score arrays per case (counterfactual)`);
  lines.push("");
  lines.push(`| Case | MD | MO | OR |`);
  lines.push(`|---|---|---|---|`);
  for (const [caseId, s] of Object.entries(stats.cases)) {
    lines.push(`| ${caseId} | ${s.scores.md.join(", ")} | ${s.scores.mo.join(", ")} | ${s.scores.or.join(", ")} |`);
  }
  lines.push("");

  lines.push(`## Verdict`);
  lines.push("");
  let resolvedCount = 0;
  let totalBimodalIn = 0;
  for (const [caseId, s] of Object.entries(stats.cases)) {
    const baseline = PRODUCTION_BASELINE[caseId];
    if (baseline.moSigma > 0.1) {
      totalBimodalIn++;
      if (s.stddev.mo === 0) resolvedCount++;
    }
  }
  if (resolvedCount === totalBimodalIn) {
    lines.push(`**MO BIMODALITY ELIMINATED** — all ${totalBimodalIn} previously-bimodal MO cases now show σ(MO)=0.`);
    lines.push(`Band-boundary fuzziness mechanism causally confirmed. Surgical prompt fix is sufficient at the MO level.`);
  } else if (resolvedCount > 0) {
    lines.push(`**PARTIAL** — ${resolvedCount}/${totalBimodalIn} bimodal cases resolved by tightening alone.`);
    lines.push(`Some cases retained variance — investigate per-case explanations for remaining mechanism.`);
  } else {
    lines.push(`**TIGHTENING INEFFECTIVE** — bimodality persists despite enumerable bands.`);
    lines.push(`Cause is elsewhere. Re-examine: discretization artifact? Cross-metric judgment-sharing? Architectural?`);
  }
  lines.push("");

  lines.push(`## Reasoning text spot-check (first 2 reruns per case)`);
  lines.push("");
  for (const [caseId, s] of Object.entries(stats.cases)) {
    lines.push(`### ${caseId}`);
    for (let i = 0; i < Math.min(2, s.explanations.length); i++) {
      const e = s.explanations[i];
      lines.push(`**Run ${i + 1}** (MD=${s.scores.md[i]} MO=${s.scores.mo[i]} OR=${s.scores.or[i]}):`);
      lines.push(`> MO: ${(e.mo || "").replace(/\n/g, " ")}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

main().catch((e) => {
  console.error("\nFatal:", e.stack || e.message || e);
  process.exit(1);
});
// ============================================================================
// runners/run-sampler-hardened.js
// ============================================================================
// F1 Phase 2C — Sampler hardening interventional test.
// Cases: full bank (8 cases) · Reruns: 10 = 80 calls, ~$8, ~15 min
// ============================================================================

const path = require("path");
const fs = require("fs");
const inv = require("./f1-investigation-shared.js");

const args = process.argv.slice(2);
const RESUME = args.includes("--resume");
const RERUN_COUNT = 10;

const CASES = [
  "AUDIT-H4",
  "AUDIT-MAT2-beginner",
  "ARC-D2",
  "AUDIT-L2",
  "AUDIT-MD1",
  "AUDIT-MAT1-intermediate",
  "AUDIT-M3",
  "AUDIT-A2",
];

const HARDENED_SAMPLER = {
  temperature: 0,
  top_k: 1,
  top_p: 0.1,
};

const CHECKPOINT_PATH = path.join(__dirname, "f1-phase2c-sampler-checkpoint.json");
const RESULTS_PATH    = path.join(__dirname, "f1-phase2c-sampler-results.json");
const REPORT_PATH     = path.join(__dirname, "f1-phase2c-sampler-report.md");

async function main() {
  console.log("============================================");
  console.log("F1 Phase 2C — Sampler hardening test");
  console.log(`Sampler: temp=0, top_k=1, top_p=0.1`);
  console.log(`Cases: ${CASES.length} · Reruns/case: ${RERUN_COUNT}`);
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
      let result;
      try {
        result = await inv.runStage2bWithOptions(caseDef, stage2aPacket, {
          sampler: HARDENED_SAMPLER,
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
      const evidenceLevel = ev.evidence_strength?.level ?? null;
      const elapsedMs = Date.now() - t0;
      inv.appendRun(CHECKPOINT_PATH, cp, {
        caseId, runIndex, status: "success",
        scores, evidenceLevel, elapsedMs,
      });
      console.log(`  ✓ Run ${runIndex}: MD=${scores.md} MO=${scores.mo} OR=${scores.or} (EvStr=${evidenceLevel ?? "?"}, ${(elapsedMs/1000).toFixed(1)}s)`);
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
      md: inv.stddev(md), mo: inv.stddev(mo), or: inv.stddev(or),
    };
    const sp = {
      mdMo: inv.spearman(md, mo),
      mdOr: inv.spearman(md, or),
      moOr: inv.spearman(mo, or),
    };
    const medianSpearman = inv.median([sp.mdMo, sp.mdOr, sp.moOr]);
    cases[caseId] = {
      runs: runs.length,
      scores: { md, mo, or },
      stddev, spearman: sp, medianSpearman,
    };
    caseMedianSpearmans.push(medianSpearman);
  }
  return {
    cases,
    bankMedianSpearman: inv.median(caseMedianSpearmans),
    rerunCount: Object.values(byCase)[0]?.length ?? 0,
    samplerConfig: HARDENED_SAMPLER,
  };
}

function renderReport(stats) {
  const f = (v) => (v == null ? "n/a" : v.toFixed(3));
  const lines = [];

  lines.push(`# F1 Phase 2C — Sampler Hardening Test`);
  lines.push("");
  lines.push(`**Hypothesis:** top_k=1 + top_p=0.1 collapses the MO bimodality observed in production Phase B.`);
  lines.push("");
  lines.push(`Sampler used: \`temperature=0, top_k=1, top_p=0.1\``);
  lines.push(`Reruns per case: ${stats.rerunCount}`);
  lines.push(`Bank median Spearman: ${f(stats.bankMedianSpearman)}`);
  lines.push("");

  let fullyStable = 0;
  for (const s of Object.values(stats.cases)) {
    if (s.stddev.md === 0 && s.stddev.mo === 0 && s.stddev.or === 0) fullyStable++;
  }
  lines.push(`**Fully zero-variance cases: ${fullyStable} / ${Object.keys(stats.cases).length}**`);
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

  lines.push(`## Score arrays per case`);
  lines.push("");
  lines.push(`| Case | MD | MO | OR |`);
  lines.push(`|---|---|---|---|`);
  for (const [caseId, s] of Object.entries(stats.cases)) {
    lines.push(`| ${caseId} | ${s.scores.md.join(", ")} | ${s.scores.mo.join(", ")} | ${s.scores.or.join(", ")} |`);
  }
  lines.push("");

  lines.push(`## Comparison vs production Phase B (n=10)`);
  lines.push("");
  lines.push(`Production Phase B observed: σ(MO) up to 0.78 (L2), 0.63 (ARC-D2), 0.21 (M3); MAT2-beginner had ρ(MO,OR)=−1 outlier.`);
  lines.push("");
  if (fullyStable === Object.keys(stats.cases).length) {
    lines.push(`**SAMPLER HARDENING SUFFICIENT.** All cases zero-variance. F1 cure may be achievable as a 4-line route.js change (top_k=1, top_p=0.1 on Stage 2a/2b/2c/TC).`);
  } else if (fullyStable > Object.keys(stats.cases).length / 2) {
    lines.push(`**PARTIAL EFFECT.** Sampler hardening reduced variance on most cases but did not fully eliminate it. Layered fix likely required (sampler + prompt structure).`);
  } else {
    lines.push(`**SAMPLER INSUFFICIENT.** Most bimodal cases retain variance even under hardened sampler. Prompt structure is the dominant cause; proceed to Phase 2A.`);
  }
  return lines.join("\n");
}

main().catch((e) => {
  console.error("\nFatal:", e.stack || e.message || e);
  process.exit(1);
});
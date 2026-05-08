// ============================================================================
// runners/run-combined-cure.js
// ============================================================================
// F1 Test 3 — Combined sampler hardening + MO tightening on full bank.
// Cases: full bank (8) · Reruns: 10 = 80 calls, ~$8, ~15 min wall
// ============================================================================

const path = require("path");
const fs = require("fs");
const inv = require("./f1-investigation-shared.js");
const { buildMoTightenedPrompt } = require("./prompts/stage2b-mo-tightened.js");

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

const CHECKPOINT_PATH = path.join(__dirname, "f1-test3-combined-checkpoint.json");
const RESULTS_PATH    = path.join(__dirname, "f1-test3-combined-results.json");
const REPORT_PATH     = path.join(__dirname, "f1-test3-combined-report.md");

async function main() {
  console.log("============================================");
  console.log("F1 Test 3 — Combined sampler + MO tightening");
  console.log("Full bank · 10 reruns/case = 80 calls");
  console.log("Sampler: temp=0, top_k=1, top_p=0.1");
  console.log("Prompt: MO bands enumerated, all else byte-identical");
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

const PRODUCTION = {
  "AUDIT-H4":                 { md: 0.000, mo: 0.000, or: 0.000 },
  "AUDIT-MAT2-beginner":      { md: 0.000, mo: 0.316, or: 0.316 },
  "ARC-D2":                   { md: 0.000, mo: 0.632, or: 0.158 },
  "AUDIT-L2":                 { md: 0.000, mo: 0.775, or: 0.258 },
  "AUDIT-MD1":                { md: 0.000, mo: 0.000, or: 0.000 },
  "AUDIT-MAT1-intermediate":  { md: 0.000, mo: 0.000, or: 0.000 },
  "AUDIT-M3":                 { md: 0.000, mo: 0.211, or: 0.000 },
  "AUDIT-A2":                 { md: 0.000, mo: 0.000, or: 0.000 },
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
      spearman: {
        mdMo: inv.spearman(md, mo),
        mdOr: inv.spearman(md, or),
        moOr: inv.spearman(mo, or),
      },
      explanations: runs.map((r) => r.explanations),
      uniqueMOscores: [...new Set(mo)].sort((a, b) => a - b),
    };
  }
  return { cases, rerunCount: Object.values(byCase)[0]?.length ?? 0 };
}

function renderReport(stats) {
  const f = (v) => (v == null ? "n/a" : v.toFixed(3));
  const lines = [];

  lines.push(`# F1 Test 3 — Combined Sampler Hardening + MO Tightening`);
  lines.push("");
  lines.push(`**Hypothesis:** Combining sampler hardening (Layer A cure) with MO band tightening (Layer B cure) eliminates bimodality across the full bank.`);
  lines.push("");
  lines.push(`Sampler: \`temperature=0, top_k=1, top_p=0.1\``);
  lines.push(`Prompt: MO commercial bands rewritten with enumerable anchors, all else byte-identical to production.`);
  lines.push(`Reruns per case: ${stats.rerunCount}`);
  lines.push("");

  let fullyStable = 0;
  for (const s of Object.values(stats.cases)) {
    if (s.stddev.md === 0 && s.stddev.mo === 0 && s.stddev.or === 0) fullyStable++;
  }
  lines.push(`**Fully zero-variance cases: ${fullyStable} / ${Object.keys(stats.cases).length}**`);
  lines.push("");

  lines.push(`## Result vs production baseline`);
  lines.push("");
  lines.push(`| Case | σ(MD) prod → combined | σ(MO) prod → combined | σ(OR) prod → combined | Unique MO |`);
  lines.push(`|---|---|---|---|---|`);
  for (const [caseId, s] of Object.entries(stats.cases)) {
    const baseline = PRODUCTION[caseId];
    if (!baseline) continue;
    lines.push(
      `| ${caseId} | ${baseline.md.toFixed(3)} → ${f(s.stddev.md)} | ` +
      `${baseline.mo.toFixed(3)} → ${f(s.stddev.mo)} | ` +
      `${baseline.or.toFixed(3)} → ${f(s.stddev.or)} | ` +
      `${JSON.stringify(s.uniqueMOscores)} |`
    );
  }
  lines.push("");

  lines.push(`## Score arrays per case (combined cure)`);
  lines.push("");
  lines.push(`| Case | MD | MO | OR |`);
  lines.push(`|---|---|---|---|`);
  for (const [caseId, s] of Object.entries(stats.cases)) {
    lines.push(`| ${caseId} | ${s.scores.md.join(", ")} | ${s.scores.mo.join(", ")} | ${s.scores.or.join(", ")} |`);
  }
  lines.push("");

  lines.push(`## Verdict`);
  lines.push("");
  const total = Object.keys(stats.cases).length;
  if (fullyStable === total) {
    lines.push(`**FULL CURE.** All ${total} cases fully zero-variance under combined intervention.`);
    lines.push(`Cure shape:`);
    lines.push(`- Sampler hardening on Stage 2a/2b/2c/TC (top_k=1, top_p=0.1)`);
    lines.push(`- MO band rewrite to enumerable anchors`);
    lines.push("");
    lines.push(`No architectural change required. F1 cure ships as prompt + sampler edits.`);
  } else if (fullyStable >= total - 2) {
    lines.push(`**NEAR-FULL CURE.** ${fullyStable}/${total} cases fully zero-variance.`);
    lines.push(`Residual variance on ${total - fullyStable} case(s) — investigate per-case to determine if Layer C (cross-metric prompt-reading) is the remaining mechanism. Decision needed: accept residual or escalate to architectural cure.`);
  } else {
    lines.push(`**PARTIAL.** ${fullyStable}/${total} cases fully zero-variance.`);
    lines.push(`Combined intervention insufficient for substantial portion of bank. Architectural cure (MO sidecar or full split) is the remaining option.`);
  }
  lines.push("");

  lines.push(`## Reasoning text spot-check (residual-variance cases only)`);
  lines.push("");
  let anyResidual = false;
  for (const [caseId, s] of Object.entries(stats.cases)) {
    if (s.stddev.md === 0 && s.stddev.mo === 0 && s.stddev.or === 0) continue;
    anyResidual = true;
    lines.push(`### ${caseId}`);
    lines.push(`σ(MD)=${f(s.stddev.md)} σ(MO)=${f(s.stddev.mo)} σ(OR)=${f(s.stddev.or)} · ρ(MO,OR)=${f(s.spearman.moOr)}`);
    lines.push("");
    for (let i = 0; i < Math.min(2, s.explanations.length); i++) {
      const e = s.explanations[i];
      lines.push(`**Run ${i + 1}** (MD=${s.scores.md[i]} MO=${s.scores.mo[i]} OR=${s.scores.or[i]}):`);
      lines.push(`> MO: ${(e.mo || "").replace(/\n/g, " ")}`);
      lines.push("");
    }
  }
  if (!anyResidual) {
    lines.push(`No cases with residual variance — all cases zero-variance.`);
  }
  return lines.join("\n");
}

main().catch((e) => {
  console.error("\nFatal:", e.stack || e.message || e);
  process.exit(1);
});
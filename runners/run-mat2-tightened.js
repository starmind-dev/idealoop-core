// ============================================================================
// runners/run-mat2-tightened.js
// ============================================================================
// F1 Test 4 — MAT2-beginner under MO tightening.
// Tests whether the MO↔OR swap pattern survives band tightening.
// 1 case · 10 reruns = 10 calls, ~$1, ~2 min wall
// ============================================================================

const path = require("path");
const fs = require("fs");
const inv = require("./f1-investigation-shared.js");
const { buildMoTightenedPrompt } = require("./prompts/stage2b-mo-tightened.js");

const args = process.argv.slice(2);
const RESUME = args.includes("--resume");
const RERUN_COUNT = 10;

const CASES = ["AUDIT-MAT2-beginner"];

const CHECKPOINT_PATH = path.join(__dirname, "f1-test4-mat2-checkpoint.json");
const RESULTS_PATH    = path.join(__dirname, "f1-test4-mat2-results.json");
const REPORT_PATH     = path.join(__dirname, "f1-test4-mat2-report.md");

async function main() {
  console.log("============================================");
  console.log("F1 Test 4 — MAT2-beginner under MO tightening");
  console.log("Tests whether MO↔OR swap pattern survives band tightening");
  console.log("Sampler: temp=0 only (production)");
  console.log(`Reruns: ${RERUN_COUNT}`);
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
    };
  }
  return { cases, rerunCount: Object.values(byCase)[0]?.length ?? 0 };
}

function renderReport(stats) {
  const f = (v) => (v == null ? "n/a" : v.toFixed(3));
  const lines = [];

  lines.push(`# F1 Test 4 — MAT2-beginner under MO Tightening`);
  lines.push("");
  lines.push(`**Hypothesis:** MO band tightening eliminates the MO↔OR swap pattern observed in production at 1/10 rate.`);
  lines.push("");
  lines.push(`Production baseline (n=10): σ(MO)=0.316, σ(OR)=0.316, ρ(MO,OR)=−1.000. Run 8 outlier: MO 5.5→4.5, OR 4.5→5.5.`);
  lines.push("");

  const s = stats.cases["AUDIT-MAT2-beginner"];
  if (!s) {
    lines.push(`No data — runner did not produce results.`);
    return lines.join("\n");
  }

  lines.push(`## Counterfactual results (n=${s.runs})`);
  lines.push("");
  lines.push(`| Metric | σ counterfactual | σ production | Outcome |`);
  lines.push(`|---|---|---|---|`);
  lines.push(`| MD | ${f(s.stddev.md)} | 0.000 | (no change expected) |`);
  lines.push(`| MO | ${f(s.stddev.mo)} | 0.316 | ${s.stddev.mo === 0 ? "ELIMINATED" : (s.stddev.mo < 0.316 ? "reduced" : "persisted")} |`);
  lines.push(`| OR | ${f(s.stddev.or)} | 0.316 | ${s.stddev.or === 0 ? "ELIMINATED" : (s.stddev.or < 0.316 ? "reduced" : "persisted")} |`);
  lines.push(`| ρ(MO,OR) | ${f(s.spearman.moOr)} | -1.000 | ${s.spearman.moOr === 0 ? "decoupled" : (s.spearman.moOr === -1 ? "swap intact" : "altered")} |`);
  lines.push("");

  lines.push(`## Score arrays`);
  lines.push("");
  lines.push(`MD: ${s.scores.md.join(", ")}`);
  lines.push(`MO: ${s.scores.mo.join(", ")}`);
  lines.push(`OR: ${s.scores.or.join(", ")}`);
  lines.push("");

  lines.push(`## Verdict`);
  lines.push("");
  if (s.stddev.mo === 0 && s.stddev.or === 0) {
    lines.push(`**SWAP PATTERN ELIMINATED.** MO tightening eliminates the MO↔OR swap on this case. Combined with Phase 2A's L2/ARC-D2/M3 results, MO tightening covers all observed bimodal patterns including the rare swap variant.`);
  } else if (s.spearman.moOr === -1 && s.stddev.mo > 0) {
    lines.push(`**SWAP PATTERN PERSISTS.** MO and OR remain inversely correlated with non-zero σ. MO tightening did not address the cross-metric budget rebalancing mechanism. This case requires deeper intervention — anti-cross-leakage prompt instruction or architectural separation.`);
  } else if (s.stddev.mo < 0.316 && s.stddev.or < 0.316) {
    lines.push(`**SWAP PATTERN PARTIALLY REDUCED.** Variance lower under tightening but not eliminated. Mechanism partially addressed. Inspect explanations to characterize residual.`);
  } else {
    lines.push(`**ALTERED PATTERN.** Variance present but the swap correlation has changed shape. Inspect explanations to characterize new mechanism.`);
  }
  lines.push("");

  lines.push(`## Reasoning text per run`);
  lines.push("");
  for (let i = 0; i < s.explanations.length; i++) {
    const e = s.explanations[i];
    lines.push(`### Run ${i + 1} (MD=${s.scores.md[i]} MO=${s.scores.mo[i]} OR=${s.scores.or[i]})`);
    lines.push(`**MO:** ${(e.mo || "").replace(/\n/g, " ")}`);
    lines.push("");
    lines.push(`**OR:** ${(e.or || "").replace(/\n/g, " ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

main().catch((e) => {
  console.error("\nFatal:", e.stack || e.message || e);
  process.exit(1);
});
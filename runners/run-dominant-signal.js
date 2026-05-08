// ============================================================================
// runners/run-dominant-signal.js
// ============================================================================
// F1 Test 5 — Sampler hardening + dominant-signal-selection instruction.
//
// Scope: 4 cases (residuals from Test 3 + cure-validated baselines for regression check)
//   - AUDIT-L2          — frame-selection residual after Test 3
//   - AUDIT-MAT2-beginner — swap pattern residual after Test 3
//   - ARC-D2            — already cured by sampler+tightening (regression check)
//   - AUDIT-M3          — already cured by sampler+tightening (regression check)
//
// Reruns: 10/case = 40 calls, ~$4, ~10 min wall.
//
// Decision criteria locked BEFORE running (per Methodology Principle 6):
//   PASS    → ship sampler + dominant-signal as F1 cure
//   PARTIAL → ship sampler + dominant-signal, document MAT2 residual
//   FAIL    → ship sampler-only, archive dominant-signal
// ============================================================================

const path = require("path");
const fs = require("fs");
const inv = require("./f1-investigation-shared.js");
const { buildDominantSignalPrompt } = require("./prompts/stage2b-dominant-signal.js");

const args = process.argv.slice(2);
const RESUME = args.includes("--resume");
const RERUN_COUNT = 10;

const CASES = [
  "AUDIT-L2",
  "AUDIT-MAT2-beginner",
  "ARC-D2",
  "AUDIT-M3",
];

const HARDENED_SAMPLER = {
  temperature: 0,
  top_k: 1,
  top_p: 0.1,
};

const CHECKPOINT_PATH = path.join(__dirname, "f1-test5-domsignal-checkpoint.json");
const RESULTS_PATH    = path.join(__dirname, "f1-test5-domsignal-results.json");
const REPORT_PATH     = path.join(__dirname, "f1-test5-domsignal-report.md");

async function main() {
  console.log("============================================");
  console.log("F1 Test 5 — Sampler + Dominant-Signal Selection");
  console.log("4 cases · 10 reruns/case = 40 calls");
  console.log("Sampler: temp=0, top_k=1, top_p=0.1");
  console.log("Prompt: production MO bands (NOT rewritten) + dominant-signal blocks injected into MO and OR");
  console.log("============================================");

  if (!RESUME && fs.existsSync(CHECKPOINT_PATH)) {
    console.error(`\n⚠️  Existing checkpoint at ${CHECKPOINT_PATH}\n   Use --resume to continue, or delete to start fresh.`);
    process.exit(1);
  }

  console.log("\nBuilding dominant-signal prompt from production base...");
  const prompt = await buildDominantSignalPrompt();
  console.log(`Prompt built: ${prompt.length} chars`);

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
          systemPrompt: prompt,
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
  "AUDIT-L2":            { md: 0.000, mo: 0.775, or: 0.258 },
  "AUDIT-MAT2-beginner": { md: 0.000, mo: 0.316, or: 0.316 },
  "ARC-D2":              { md: 0.000, mo: 0.632, or: 0.158 },
  "AUDIT-M3":            { md: 0.000, mo: 0.211, or: 0.000 },
};

const TEST3 = {
  "AUDIT-L2":            { md: 0.316, mo: 0.158, or: 0.316 },
  "AUDIT-MAT2-beginner": { md: 0.211, mo: 0.615, or: 0.632 },
  "ARC-D2":              { md: 0.000, mo: 0.000, or: 0.258 },
  "AUDIT-M3":            { md: 0.000, mo: 0.000, or: 0.000 },
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

  lines.push(`# F1 Test 5 — Sampler + Dominant-Signal Selection`);
  lines.push("");
  lines.push(`**Hypothesis:** Adding dominant-signal-selection instruction to MO and OR (without rewriting MO bands) addresses the L2 frame-selection mechanism and the MAT2-beginner cross-metric swap.`);
  lines.push("");
  lines.push(`Sampler: \`temperature=0, top_k=1, top_p=0.1\``);
  lines.push(`Prompt: production MO bands retained, dominant-signal blocks injected into MO and OR sections symmetrically.`);
  lines.push(`Reruns per case: ${stats.rerunCount}`);
  lines.push("");

  lines.push(`## Result vs production AND Test 3 baselines`);
  lines.push("");
  lines.push(`| Case | σ(MD) prod / T3 / T5 | σ(MO) prod / T3 / T5 | σ(OR) prod / T3 / T5 | ρ(MO,OR) T5 |`);
  lines.push(`|---|---|---|---|---|`);
  for (const caseId of ["AUDIT-L2", "AUDIT-MAT2-beginner", "ARC-D2", "AUDIT-M3"]) {
    const s = stats.cases[caseId];
    if (!s) continue;
    const p = PRODUCTION[caseId];
    const t3 = TEST3[caseId];
    lines.push(
      `| ${caseId} | ${p.md.toFixed(3)} / ${t3.md.toFixed(3)} / **${f(s.stddev.md)}** | ` +
      `${p.mo.toFixed(3)} / ${t3.mo.toFixed(3)} / **${f(s.stddev.mo)}** | ` +
      `${p.or.toFixed(3)} / ${t3.or.toFixed(3)} / **${f(s.stddev.or)}** | ` +
      `${f(s.spearman.moOr)} |`
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

  const l2 = stats.cases["AUDIT-L2"];
  const mat2 = stats.cases["AUDIT-MAT2-beginner"];
  const arc = stats.cases["ARC-D2"];
  const m3 = stats.cases["AUDIT-M3"];

  const passL2 = l2 && l2.stddev.mo <= 0.20 && l2.stddev.md <= 0.20;
  const passMat2 = mat2 && mat2.stddev.mo <= 0.20 && mat2.stddev.or <= 0.20;
  const passArc = arc && arc.stddev.md === 0 && arc.stddev.mo === 0;
  const passM3 = m3 && m3.stddev.md === 0 && m3.stddev.mo === 0 && m3.stddev.or === 0;

  lines.push(`## Decision-criterion evaluation (locked before run)`);
  lines.push("");
  lines.push(`| Criterion | Threshold | Actual | Pass? |`);
  lines.push(`|---|---|---|---|`);
  if (l2) {
    lines.push(`| L2 σ(MO) | ≤ 0.20 | ${f(l2.stddev.mo)} | ${l2.stddev.mo <= 0.20 ? "✅" : "❌"} |`);
    lines.push(`| L2 σ(MD) — no cross-metric coupling | ≤ 0.20 | ${f(l2.stddev.md)} | ${l2.stddev.md <= 0.20 ? "✅" : "❌"} |`);
  }
  if (mat2) {
    lines.push(`| MAT2 σ(MO) | ≤ 0.20 | ${f(mat2.stddev.mo)} | ${mat2.stddev.mo <= 0.20 ? "✅" : "❌"} |`);
    lines.push(`| MAT2 σ(OR) | ≤ 0.20 | ${f(mat2.stddev.or)} | ${mat2.stddev.or <= 0.20 ? "✅" : "❌"} |`);
  }
  if (arc) {
    lines.push(`| ARC-D2 regression check (MD,MO=0) | 0 | MD=${f(arc.stddev.md)} MO=${f(arc.stddev.mo)} | ${passArc ? "✅" : "❌"} |`);
  }
  if (m3) {
    lines.push(`| M3 regression check (all=0) | 0 | MD=${f(m3.stddev.md)} MO=${f(m3.stddev.mo)} OR=${f(m3.stddev.or)} | ${passM3 ? "✅" : "❌"} |`);
  }
  lines.push("");

  lines.push(`## Verdict`);
  lines.push("");
  if (passL2 && passMat2 && passArc && passM3) {
    lines.push(`**PASS — full cure.** Sampler hardening + dominant-signal-selection (no MO band rewrite) addresses all four cases.`);
    lines.push(`Recommended ship: sampler hardening + dominant-signal blocks injected into Stage 2b MO and OR sections.`);
    lines.push(`No MO band rewrite. No architectural change. F1 fully cured.`);
  } else if (passL2 && passArc && passM3 && !passMat2) {
    lines.push(`**PARTIAL — L2 cured, MAT2-beginner persists.** Dominant-signal addresses frame-selection (L2) but not cross-metric budget swap (MAT2-beginner).`);
    lines.push(`Recommended ship: sampler + dominant-signal as Bundle 2 cure. Document MAT2-beginner-style swap as known residual. Future bundle: Stage 2a packeting fix for cross-cutting facts.`);
  } else if (!passL2 && passArc && passM3) {
    lines.push(`**FAIL — L2 frame-selection not addressed.** Dominant-signal instruction did not collapse L2's bimodality. Mechanism may be deeper than fact-weighting.`);
    lines.push(`Recommended ship: sampler-only (Path 1A from prior decision tree). Archive dominant-signal as not-effective for this mechanism.`);
  } else if (!passArc || !passM3) {
    lines.push(`**REGRESSION — previously cured cases broke.** Dominant-signal instruction destabilized cases that sampler-only had cured.`);
    lines.push(`Recommended ship: sampler-only (Path 1A). Do not add dominant-signal — it introduces new instability.`);
  } else {
    lines.push(`**MIXED.** Outcome doesn't fit a clean decision criterion. Inspect per-case explanations to characterize.`);
  }
  lines.push("");

  lines.push(`## Reasoning text spot-check (first 2 reruns per case)`);
  lines.push("");
  for (const [caseId, s] of Object.entries(stats.cases)) {
    lines.push(`### ${caseId}`);
    lines.push(`σ(MD)=${f(s.stddev.md)} σ(MO)=${f(s.stddev.mo)} σ(OR)=${f(s.stddev.or)} · ρ(MO,OR)=${f(s.spearman.moOr)}`);
    lines.push("");
    for (let i = 0; i < Math.min(2, s.explanations.length); i++) {
      const e = s.explanations[i];
      lines.push(`**Run ${i + 1}** (MD=${s.scores.md[i]} MO=${s.scores.mo[i]} OR=${s.scores.or[i]}):`);
      lines.push(`> MO: ${(e.mo || "").replace(/\n/g, " ")}`);
      lines.push("");
      lines.push(`> OR: ${(e.or || "").replace(/\n/g, " ")}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

main().catch((e) => {
  console.error("\nFatal:", e.stack || e.message || e);
  process.exit(1);
});
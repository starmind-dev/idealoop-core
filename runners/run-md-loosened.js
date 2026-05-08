// ============================================================================
// runners/run-md-loosened.js
// ============================================================================
// F1 Phase 2B — MD loosening interventional test (reverse direction).
// Cases: 4 fully-stable in production · Reruns: 10 = 40 calls, ~$4, ~8 min
// ============================================================================

const path = require("path");
const fs = require("fs");
const inv = require("./f1-investigation-shared.js");
const { buildMdLoosenedPrompt } = require("./prompts/stage2b-md-loosened.js");

const args = process.argv.slice(2);
const RESUME = args.includes("--resume");
const RERUN_COUNT = 10;

const CASES = [
  "AUDIT-H4",
  "AUDIT-MD1",
  "AUDIT-MAT1-intermediate",
  "AUDIT-A2",
];

const CHECKPOINT_PATH = path.join(__dirname, "f1-phase2b-md-checkpoint.json");
const RESULTS_PATH    = path.join(__dirname, "f1-phase2b-md-results.json");
const REPORT_PATH     = path.join(__dirname, "f1-phase2b-md-report.md");

async function main() {
  console.log("============================================");
  console.log("F1 Phase 2B — MD loosening test (reverse direction)");
  console.log(`Counterfactual prompt: MD anti-inflation caps removed + bands fuzzified`);
  console.log(`Cases: ${CASES.length} (production: all fully stable) · Reruns/case: ${RERUN_COUNT}`);
  console.log("============================================");

  if (!RESUME && fs.existsSync(CHECKPOINT_PATH)) {
    console.error(`\n⚠️  Existing checkpoint at ${CHECKPOINT_PATH}\n   Use --resume to continue, or delete to start fresh.`);
    process.exit(1);
  }

  console.log("\nBuilding MD-loosened prompt from production base...");
  const mdLoosenedPrompt = await buildMdLoosenedPrompt();
  console.log(`Prompt built: ${mdLoosenedPrompt.length} chars`);

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
          systemPrompt: mdLoosenedPrompt,
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
      explanations: runs.map((r) => r.explanations),
      uniqueMDscores: [...new Set(md)].sort((a, b) => a - b),
    };
  }
  return { cases, rerunCount: Object.values(byCase)[0]?.length ?? 0 };
}

function renderReport(stats) {
  const f = (v) => (v == null ? "n/a" : v.toFixed(3));
  const lines = [];

  lines.push(`# F1 Phase 2B — MD Loosening Test (Reverse Direction)`);
  lines.push("");
  lines.push(`**Hypothesis:** Removing MD's anti-inflation caps + fuzzifying MD's band descriptors causes MD to become bimodal — proving the structural mechanism in the reverse direction.`);
  lines.push("");
  lines.push(`Counterfactual prompt: MD cap-clauses removed, bands replaced with fuzzy adjectives (matching production MO's structure). Everything else byte-identical.`);
  lines.push(`Production sampler retained: \`temperature=0\` only.`);
  lines.push(`Reruns per case: ${stats.rerunCount}`);
  lines.push("");

  lines.push(`## Production baseline (n=10, original Phase B)`);
  lines.push(`All cases listed below were observed at σ(MD)=0, σ(MO)=0, σ(OR)=0 — i.e. fully zero-variance under production prompt.`);
  lines.push("");

  lines.push(`## Counterfactual results`);
  lines.push("");
  lines.push(`| Case | σ(MD) | σ(MO) | σ(OR) | Unique MD scores |`);
  lines.push(`|---|---|---|---|---|`);
  for (const [caseId, s] of Object.entries(stats.cases)) {
    lines.push(
      `| ${caseId} | ${f(s.stddev.md)} | ${f(s.stddev.mo)} | ${f(s.stddev.or)} | ${JSON.stringify(s.uniqueMDscores)} |`
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
  let bimodalCount = 0;
  for (const s of Object.values(stats.cases)) {
    if (s.stddev.md > 0.1) bimodalCount++;
  }
  const total = Object.keys(stats.cases).length;
  if (bimodalCount === total) {
    lines.push(`**STRUCTURAL MECHANISM CONFIRMED IN REVERSE.** All ${total} previously-stable MD cases became bimodal under structural loosening.`);
    lines.push(`Combined with Phase 2A: prompt structure (specifically band-boundary anchor density and cap-clause concreteness) is the causal mechanism. Sampler hardening + structural prompt fix is the cure shape.`);
  } else if (bimodalCount > 0) {
    lines.push(`**PARTIAL CONFIRMATION.** ${bimodalCount}/${total} cases became bimodal. Mechanism is real but case-dependent — likely interacts with evidence content (e.g., cases where evidence sits cleanly inside one band may stay stable even with loose rubric).`);
  } else {
    lines.push(`**MECHANISM NOT REPLICATED IN REVERSE.** No cases became bimodal under loose MD. This is unexpected — interpretation: either the cap-clauses don't drive MD's stability (something else does), or these test cases have unambiguous-enough evidence that structural anchors don't matter for them. Re-examine.`);
  }
  lines.push("");

  lines.push(`## Reasoning text spot-check (first 2 reruns per case)`);
  lines.push("");
  for (const [caseId, s] of Object.entries(stats.cases)) {
    lines.push(`### ${caseId}`);
    for (let i = 0; i < Math.min(2, s.explanations.length); i++) {
      const e = s.explanations[i];
      lines.push(`**Run ${i + 1}** (MD=${s.scores.md[i]} MO=${s.scores.mo[i]} OR=${s.scores.or[i]}):`);
      lines.push(`> MD: ${(e.md || "").replace(/\n/g, " ")}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

main().catch((e) => {
  console.error("\nFatal:", e.stack || e.message || e);
  process.exit(1);
});
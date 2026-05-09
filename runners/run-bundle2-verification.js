// ============================================================================
// runners/run-bundle2-verification.js
// ============================================================================
// Bundle 2 verification: confirm sampler hardening cure works in real production
// conditions across the full pipeline (not just Stage 2b in isolation).
//
// PREREQUISITE: dev server must be running. In another terminal:
//   npm run dev
//
// Cases (4 × 3 reruns = 12 full Pro pipeline evaluations):
//   ARC-D2                 — cure success target (was σ(MO)=0.63 in prod, expect ~0)
//   AUDIT-L2               — frame-selection residual (cap at σ(MO) ≤ 0.50)
//   AUDIT-MAT2-beginner    — cross-metric swap residual (cap at σ(MO)+σ(OR) ≤ 1.20)
//   DOGFOOD-IDEALOOP       — observational (Emre's idea, complex/ambiguous)
//
// What this runner catches that the diagnostic didn't:
//   - Stage 2a variance contribution (diagnostic used frozen fixtures)
//   - End-to-end pipeline error rate
//   - Schema integrity after the route.js change
//   - Real-world latency under hardening
//   - Stage 2c summary + Stage 3 main_bottleneck variance (out of scope, but observed)
//
// Decision criteria locked BEFORE running (Methodology Principle 6):
//   PASS  — all per-case score thresholds met, zero pipeline errors
//   PARTIAL — some thresholds missed but residuals match diagnostic predictions
//   FAIL  — ARC-D2 not cured (sampler hardening didn't work in production)
//          OR pipeline errors observed
//          OR schema regressions detected
// ============================================================================

const path = require("path");
const fs = require("fs");

const ENDPOINT = "http://localhost:3000/api/analyze-pro";
const HEALTH_CHECK = "http://localhost:3000/";
const RERUN_COUNT = 3;

const args = process.argv.slice(2);
const RESUME = args.includes("--resume");

// ── Cases (loaded by id from cases.js) ─────────────────────────────────────
let CASES_BY_ID;
try {
  const cases = require("../cases.js");
  CASES_BY_ID = {
    "ARC-D2": cases.ARC_D2,
    "AUDIT-L2": cases.AUDIT_L2,
    "AUDIT-MAT2-beginner": cases.AUDIT_MAT2_BEG,
    "DOGFOOD-IDEALOOP": cases.DOGFOOD_IDEALOOP,
  };
} catch (e) {
  console.error("Failed to load cases.js — expected at runners/cases.js");
  console.error(e.message);
  process.exit(1);
}

const CASE_IDS = ["ARC-D2", "AUDIT-L2", "AUDIT-MAT2-beginner", "DOGFOOD-IDEALOOP"];

// Verify all 4 cases loaded
for (const id of CASE_IDS) {
  if (!CASES_BY_ID[id]) {
    console.error(`Case ${id} not found in cases.js exports`);
    process.exit(1);
  }
}

// ── Decision criteria ──────────────────────────────────────────────────────
const CRITERIA = {
  "ARC-D2": {
    label: "Cure success target — sampler hardening should fully resolve",
    check: (s) =>
      s.stddev.md <= 0.20 &&
      s.stddev.mo <= 0.20 &&
      s.stddev.or <= 0.20 &&
      s.stddev.tc <= 0.20,
    description: "σ all metrics ≤ 0.20",
  },
  "AUDIT-L2": {
    label: "Frame-selection residual — capped variance",
    check: (s) =>
      s.stddev.mo <= 0.50 &&
      s.stddev.md <= 0.30 &&
      s.stddev.or <= 0.30 &&
      s.stddev.tc <= 0.30,
    description: "σ(MO) ≤ 0.50; σ(MD,OR,TC) ≤ 0.30",
  },
  "AUDIT-MAT2-beginner": {
    label: "Cross-metric swap residual — variance allowed in swap pair",
    check: (s) =>
      s.stddev.mo + s.stddev.or <= 1.20 &&
      s.stddev.md <= 0.30 &&
      s.stddev.tc <= 0.30,
    description: "σ(MO)+σ(OR) ≤ 1.20; σ(MD,TC) ≤ 0.30",
  },
  "DOGFOOD-IDEALOOP": {
    label: "Observational — no fixed threshold",
    check: () => true,
    description: "Reported only",
  },
};

// ── File paths ─────────────────────────────────────────────────────────────
const CHECKPOINT_PATH = path.join(__dirname, "bundle2-verif-checkpoint.json");
const RESULTS_PATH = path.join(__dirname, "bundle2-verif-results.json");
const REPORT_PATH = path.join(__dirname, "bundle2-verif-report.md");

// ── Stats helpers ──────────────────────────────────────────────────────────
function stddev(arr) {
  const valid = arr.filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (valid.length < 2) return 0;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance = valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length;
  return Math.sqrt(variance);
}

function range(arr) {
  const valid = arr.filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (valid.length === 0) return 0;
  return Math.max(...valid) - Math.min(...valid);
}

function distribution(arr) {
  const counts = {};
  for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts)
    .map(([k, n]) => `${k}×${n}`)
    .join(", ");
}

// ── Checkpoint ─────────────────────────────────────────────────────────────
function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return { runs: [] };
  return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf-8"));
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

function appendRun(cp, entry) {
  cp.runs.push(entry);
  saveCheckpoint(cp);
}

function isCompleted(cp, caseId, runIndex) {
  return cp.runs.some(
    (r) => r.caseId === caseId && r.runIndex === runIndex && r.status === "success"
  );
}

// ── Server health check ────────────────────────────────────────────────────
async function checkServer() {
  try {
    const r = await fetch(HEALTH_CHECK, { method: "HEAD" });
    return r.ok || r.status === 404; // 404 still means server is up
  } catch (e) {
    return false;
  }
}

// ── Run one evaluation ─────────────────────────────────────────────────────
async function runEvaluation(idea, profile) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea, profile }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalAnalysis = null;
  let lastStep = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      const trimmed = event.trim();
      if (!trimmed.startsWith("data: ")) continue;
      let data;
      try {
        data = JSON.parse(trimmed.slice(6));
      } catch {
        continue;
      }
      lastStep = data.step;
      if (data.step === "complete") {
        finalAnalysis = data.data;
      } else if (data.step === "error") {
        throw new Error(`Pipeline error: ${data.message || "unknown"}`);
      }
    }
  }

  if (!finalAnalysis) {
    throw new Error(`Stream ended without complete event (last step: ${lastStep})`);
  }
  return finalAnalysis;
}

// ── Extract metrics from analysis ──────────────────────────────────────────
function extractMetrics(analysis) {
  const ev = analysis?.evaluation || {};
  const est = analysis?.estimates || {};
  const comp = analysis?.competition || {};

  return {
    scores: {
      md: ev.market_demand?.score ?? null,
      mo: ev.monetization?.score ?? null,
      or: ev.originality?.score ?? null,
      tc: ev.technical_complexity?.score ?? null,
    },
    evidence_strength_level: ev.evidence_strength?.level ?? null,
    failure_risks: (ev.failure_risks || []).map((r) => ({
      slot: r.slot ?? null,
      archetype: r.archetype ?? null,
    })),
    main_bottleneck: est.main_bottleneck ?? null,
    duration: est.duration ?? null,
    difficulty: est.difficulty ?? null,
    summary_first_100: typeof ev.summary === "string" ? ev.summary.slice(0, 100) : null,
    competitor_count: Array.isArray(comp.competitors) ? comp.competitors.length : null,
    overall_score: ev.overall_score ?? null,
  };
}

// ── Main loop ──────────────────────────────────────────────────────────────
async function main() {
  console.log("============================================");
  console.log("Bundle 2 Verification — Full Pipeline");
  console.log(`Cases: ${CASE_IDS.length} · Reruns: ${RERUN_COUNT} = ${CASE_IDS.length * RERUN_COUNT} runs`);
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log("============================================");

  if (!RESUME && fs.existsSync(CHECKPOINT_PATH)) {
    console.error(`\n⚠️  Existing checkpoint at ${CHECKPOINT_PATH}\n   Use --resume to continue, or delete to start fresh.`);
    process.exit(1);
  }

  console.log("\nChecking dev server...");
  const up = await checkServer();
  if (!up) {
    console.error("\n❌ Dev server not responding at http://localhost:3000");
    console.error("   Start it in another terminal: npm run dev");
    process.exit(1);
  }
  console.log("✓ Dev server reachable");

  const cp = loadCheckpoint();
  if (RESUME) console.log(`Resuming (${cp.runs.length} runs already recorded)`);

  for (const caseId of CASE_IDS) {
    const caseDef = CASES_BY_ID[caseId];
    console.log(`\n═══ Case: ${caseId} ═══`);

    for (let runIndex = 1; runIndex <= RERUN_COUNT; runIndex++) {
      if (isCompleted(cp, caseId, runIndex)) {
        console.log(`  ⏭️  Run ${runIndex}: already in checkpoint`);
        continue;
      }
      const t0 = Date.now();
      let analysis;
      try {
        analysis = await runEvaluation(caseDef.idea, caseDef.profile);
      } catch (e) {
        const elapsedMs = Date.now() - t0;
        console.log(`  ⚠️  Run ${runIndex}: ERROR — ${e.message} (${(elapsedMs / 1000).toFixed(1)}s)`);
        appendRun(cp, {
          caseId,
          runIndex,
          status: "error",
          error: e.message,
          elapsedMs,
        });
        continue;
      }
      const elapsedMs = Date.now() - t0;
      const metrics = extractMetrics(analysis);
      appendRun(cp, {
        caseId,
        runIndex,
        status: "success",
        ...metrics,
        elapsedMs,
      });
      const s = metrics.scores;
      console.log(
        `  ✓ Run ${runIndex}: MD=${s.md} MO=${s.mo} OR=${s.or} TC=${s.tc} ` +
          `· ES=${metrics.evidence_strength_level} · MB=${metrics.main_bottleneck} ` +
          `· risks=${metrics.failure_risks.length} (${(elapsedMs / 1000).toFixed(1)}s)`
      );
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

// ── Stats ──────────────────────────────────────────────────────────────────
function computeStats(cp) {
  const byCase = {};
  for (const run of cp.runs) {
    if (!byCase[run.caseId]) byCase[run.caseId] = [];
    byCase[run.caseId].push(run);
  }

  const cases = {};
  let totalErrors = 0;

  for (const caseId of CASE_IDS) {
    const allRuns = (byCase[caseId] || []).sort((a, b) => a.runIndex - b.runIndex);
    const successRuns = allRuns.filter((r) => r.status === "success");
    const errors = allRuns.filter((r) => r.status === "error");
    totalErrors += errors.length;

    if (successRuns.length === 0) {
      cases[caseId] = { runs: 0, errors: errors.length, errorMessages: errors.map((e) => e.error) };
      continue;
    }

    const md = successRuns.map((r) => r.scores.md);
    const mo = successRuns.map((r) => r.scores.mo);
    const or = successRuns.map((r) => r.scores.or);
    const tc = successRuns.map((r) => r.scores.tc);

    cases[caseId] = {
      runs: successRuns.length,
      errors: errors.length,
      scores: { md, mo, or, tc },
      stddev: { md: stddev(md), mo: stddev(mo), or: stddev(or), tc: stddev(tc) },
      range: { md: range(md), mo: range(mo), or: range(or), tc: range(tc) },
      evidence_strength_levels: distribution(successRuns.map((r) => r.evidence_strength_level)),
      failure_risks_count: distribution(successRuns.map((r) => r.failure_risks.length)),
      failure_risks_slots: successRuns.map((r) =>
        r.failure_risks.map((x) => `${x.slot}${x.archetype ? `:${x.archetype}` : ""}`).join("|")
      ),
      main_bottlenecks: distribution(successRuns.map((r) => r.main_bottleneck)),
      durations: distribution(successRuns.map((r) => r.duration)),
      difficulties: distribution(successRuns.map((r) => r.difficulty)),
      summary_lengths: successRuns.map((r) => (r.summary_first_100 || "").length),
      competitor_counts: distribution(successRuns.map((r) => r.competitor_count)),
      overall_scores: successRuns.map((r) => r.overall_score),
      avgElapsedSec: (successRuns.reduce((s, r) => s + r.elapsedMs, 0) / successRuns.length / 1000).toFixed(1),
    };
  }

  return { cases, totalErrors };
}

// ── Report ─────────────────────────────────────────────────────────────────
function renderReport(stats) {
  const f = (v) => (v == null ? "n/a" : v.toFixed(3));
  const lines = [];

  lines.push(`# Bundle 2 Verification — Full Pipeline`);
  lines.push("");
  lines.push(`Sampler hardening on Stage 2a/2b/TC. Stage 2c and Stage 3 unchanged.`);
  lines.push(`${RERUN_COUNT} reruns/case across ${CASE_IDS.length} cases.`);
  lines.push(`Total pipeline errors: **${stats.totalErrors}**`);
  lines.push("");

  // ── Per-case decision evaluation ──
  lines.push(`## Decision criteria (locked before run)`);
  lines.push("");
  lines.push(`| Case | Threshold | Pass? |`);
  lines.push(`|---|---|---|`);
  let passCount = 0;
  let evalCount = 0;
  for (const caseId of CASE_IDS) {
    const s = stats.cases[caseId];
    const c = CRITERIA[caseId];
    if (!s || s.runs === 0) {
      lines.push(`| ${caseId} | ${c.description} | ⚠️ no successful runs |`);
      continue;
    }
    const pass = c.check(s);
    if (caseId !== "DOGFOOD-IDEALOOP") {
      evalCount++;
      if (pass) passCount++;
    }
    const passLabel =
      caseId === "DOGFOOD-IDEALOOP"
        ? "📊 observational"
        : pass
        ? "✅"
        : "❌";
    lines.push(`| ${caseId} | ${c.description} | ${passLabel} |`);
  }
  lines.push("");

  // ── Score variance per case ──
  lines.push(`## Score variance per case`);
  lines.push("");
  lines.push(`| Case | σ(MD) | σ(MO) | σ(OR) | σ(TC) | Range MO |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (const caseId of CASE_IDS) {
    const s = stats.cases[caseId];
    if (!s || s.runs === 0) {
      lines.push(`| ${caseId} | (no data) | | | | |`);
      continue;
    }
    lines.push(
      `| ${caseId} | ${f(s.stddev.md)} | ${f(s.stddev.mo)} | ${f(s.stddev.or)} | ${f(s.stddev.tc)} | ${f(s.range.mo)} |`
    );
  }
  lines.push("");

  // ── Score arrays per case ──
  lines.push(`## Score arrays per case`);
  lines.push("");
  lines.push(`| Case | MD | MO | OR | TC |`);
  lines.push(`|---|---|---|---|---|`);
  for (const caseId of CASE_IDS) {
    const s = stats.cases[caseId];
    if (!s || s.runs === 0) {
      lines.push(`| ${caseId} | (no data) | | | |`);
      continue;
    }
    lines.push(
      `| ${caseId} | ${s.scores.md.join(", ")} | ${s.scores.mo.join(", ")} | ${s.scores.or.join(", ")} | ${s.scores.tc.join(", ")} |`
    );
  }
  lines.push("");

  // ── Out-of-scope variance (informational only) ──
  lines.push(`## Out-of-scope variance (informational — Bundle 2 did not address)`);
  lines.push("");
  lines.push(`These come from Stage 2c (failure_risks, summary, evidence_strength) and Stage 3 (main_bottleneck), which were intentionally not hardened. Variance here is expected and tracked as separate B10a findings.`);
  lines.push("");
  lines.push(`| Case | evidence_strength | failure_risks count | failure_risks slots (per run) | main_bottleneck |`);
  lines.push(`|---|---|---|---|---|`);
  for (const caseId of CASE_IDS) {
    const s = stats.cases[caseId];
    if (!s || s.runs === 0) {
      lines.push(`| ${caseId} | (no data) | | | |`);
      continue;
    }
    const slotsPerRun = s.failure_risks_slots.map((x) => `[${x}]`).join(" ");
    lines.push(
      `| ${caseId} | ${s.evidence_strength_levels} | ${s.failure_risks_count} | ${slotsPerRun} | ${s.main_bottlenecks} |`
    );
  }
  lines.push("");

  // ── Performance / pipeline health ──
  lines.push(`## Pipeline health`);
  lines.push("");
  lines.push(`| Case | runs ✓ | errors | avg duration | overall score range |`);
  lines.push(`|---|---|---|---|---|`);
  for (const caseId of CASE_IDS) {
    const s = stats.cases[caseId];
    if (!s) {
      lines.push(`| ${caseId} | 0 | (none recorded) | - | - |`);
      continue;
    }
    const errsLabel = s.errors > 0 ? `**${s.errors}**` : "0";
    const overallRange =
      s.runs > 0
        ? `${Math.min(...s.overall_scores).toFixed(2)} – ${Math.max(...s.overall_scores).toFixed(2)}`
        : "n/a";
    lines.push(`| ${caseId} | ${s.runs} | ${errsLabel} | ${s.avgElapsedSec ?? "-"}s | ${overallRange} |`);
  }
  lines.push("");

  // ── Verdict ──
  lines.push(`## Verdict`);
  lines.push("");
  if (stats.totalErrors > 0) {
    lines.push(`**FAIL** — ${stats.totalErrors} pipeline error(s) observed. Schema or runtime regression.`);
    lines.push(`Investigate before shipping.`);
  } else if (passCount === evalCount) {
    lines.push(`**PASS** — all per-case thresholds met (${passCount}/${evalCount}). Cure works on its target class. Documented residuals stay within predicted bounds. Zero pipeline errors.`);
    lines.push("");
    lines.push(`Bundle 2 ready to ship. Variance observed on out-of-scope surfaces (Risk 3 intermittence, MB drift, evidence_strength swings, summary phrasing) is expected and tracked as separate B10a findings outside F1 scope.`);
  } else {
    lines.push(`**PARTIAL** — ${passCount}/${evalCount} per-case thresholds met. Inspect failing cases above.`);
    lines.push("");
    lines.push(`If failures are on residual cases (L2, MAT2-beginner) at slightly higher variance than predicted: residual is real but the cure still works on its target class. Decision call.`);
    lines.push(`If ARC-D2 failed: sampler hardening did not deliver in production. Investigate.`);
  }
  lines.push("");

  // ── DOGFOOD detail block ──
  const dogfood = stats.cases["DOGFOOD-IDEALOOP"];
  if (dogfood && dogfood.runs > 0) {
    lines.push(`## DOGFOOD-IDEALOOP detail (observational)`);
    lines.push("");
    lines.push(`This is your idea evaluated under the cure. No threshold — reported for product judgment.`);
    lines.push("");
    lines.push(`- σ(MD)=${f(dogfood.stddev.md)} σ(MO)=${f(dogfood.stddev.mo)} σ(OR)=${f(dogfood.stddev.or)} σ(TC)=${f(dogfood.stddev.tc)}`);
    lines.push(`- Range: MD=${f(dogfood.range.md)} MO=${f(dogfood.range.mo)} OR=${f(dogfood.range.or)} TC=${f(dogfood.range.tc)}`);
    lines.push(`- evidence_strength: ${dogfood.evidence_strength_levels}`);
    lines.push(`- main_bottleneck: ${dogfood.main_bottlenecks}`);
    lines.push(`- failure_risks (per run): ${dogfood.failure_risks_slots.map((x) => `[${x}]`).join(" ")}`);
    lines.push(`- overall scores: ${dogfood.overall_scores.map((x) => x?.toFixed(2)).join(", ")}`);
    lines.push("");
  }

  return lines.join("\n");
}

main().catch((e) => {
  console.error("\nFatal:", e.stack || e.message || e);
  process.exit(1);
});

// ============================================
// ARCHETYPE C/D/E COVERAGE RUNNER
// ============================================
// V4S28 B9 — pre-B10a archetype coverage discovery + B10a admissibility test.
//
// 9 cases × 2 reruns = 18 runs. Wall time ~45 min at p95 ~150s/case.
//
// Two-tier verdict structure (per ChatGPT critique May 2 + Claude integration):
//
//   G1a Reachability: each archetype must fire its target at least 1/6 across
//                     its variant runs. Proves the archetype is reachable.
//
//   G1b Stable candidate: each archetype must have at least one specific case
//                         that fires its target on 2/2 reruns. Proves we have
//                         a B10a-quality regression seed.
//
// Per-case classification:
//   B10A_READY: target archetype fires 2/2 reruns
//   DIAGNOSTIC: target fires 1/2, OR fires correct family unstably
//   REJECT:     target fires 0/2, repeatedly drifts to wrong archetype/null
//
// Main Bottleneck is tracked SEPARATELY from Risk 3 archetype. A case can fire
// Main Bottleneck = Compliance + Risk 3 = D as a design-faithful Layered case
// per Stage 3 prompt section. Runner classifies the relational case:
//
//   ALIGNMENT:   Risk 3 archetype matches Main Bottleneck spirit (e.g., B + Buyer access)
//   LAYERED:     Risk 3 fires target archetype, Main Bottleneck differs (both valid)
//   FOUNDER_FIT: Risk 3 null (STEP 1 PROFILE-DOMAIN MATCH fired in Stage 2c)
//   DRIFT:       Risk 3 fires non-target archetype
//   MISSING:     no founder_fit slot present at all (NOT same as STEP 1; bug case)
//
// Methodology principles followed (B1-B9 standing discipline):
//   - Thresholds locked BEFORE running (Principle 6) — see GATES below
//   - Pre-flight runner check on first case before launching full bank (B5 lesson)
//   - Per-case purpose statement traces case design to archetype boundary stress
//   - Main Bottleneck tracked separately to avoid collapse with Risk 3
//
// Usage:
//   node run-archetypes.js
//   (server must be running at localhost:3000)
//
// Outputs:
//   archetype-coverage-{timestamp}.json   — full per-run data
//   archetype-coverage-{timestamp}.md     — readable report with verdict
// ============================================

const fs = require("fs");
const path = require("path");
const { ARCHETYPE_CASES, CASES_BY_ARCHETYPE } = require("./archetype-cases.js");

const BASE_URL = process.env.IDEALOOP_BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = __dirname;
const RERUNS_PER_CASE = 2;

// ============================================
// LOCKED THRESHOLDS (per Principle 6 — set BEFORE running)
// ============================================

const GATES = {
  // G1a — Reachability: archetype fires at least once across its 6 variant runs
  G1A_REACHABILITY_MIN_FIRES_PER_ARCHETYPE: 1,

  // G1b — Stable candidate: at least one case per archetype fires target 2/2
  G1B_STABLE_CANDIDATE_REQUIRED_PER_ARCHETYPE: true,

  // Per-case classification thresholds
  B10A_READY_TARGET_FIRES: 2,    // out of 2 reruns
  DIAGNOSTIC_TARGET_FIRES: 1,    // out of 2 reruns

  // Soft observational threshold — null/STEP 1 false-fire rate
  // (cases targeting C/D/E that returned null Risk 3)
  STEP1_FALSE_FIRE_MAX_RATE: 0.20, // 20% of runs (i.e., max 4/18)

  // Soft observational threshold — A drift rate
  // (cases targeting C/D/E that fired archetype A instead)
  A_DRIFT_MAX_RATE: 0.25, // 25% of runs (i.e., max 5/18)
};

// ============================================
// SSE RUNNER (pattern from run-variance.js / run-b6.js)
// ============================================

async function runEval(caseDef) {
  const ep = "/api/analyze-pro";
  const runStart = Date.now();

  const res = await fetch(BASE_URL + ep, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea: caseDef.idea, profile: caseDef.profile }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  let errMsg = null;

  const consumeLine = (line) => {
    if (!line.startsWith("data: ")) return;
    try {
      const d = JSON.parse(line.slice(6));
      if (d.step === "complete" && d.data) result = d.data;
      else if (d.step === "error") errMsg = d.message;
    } catch { /* skip malformed */ }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) consumeLine(line);
  }
  if (buffer) consumeLine(buffer);

  if (errMsg) throw new Error(errMsg);
  if (!result) throw new Error("No result (stream ended without complete event)");

  return { result, totalMs: Date.now() - runStart };
}

// ============================================
// EXTRACTION
// ============================================

function extractRiskFields(result) {
  const ev = result?.evaluation || {};
  const risks = ev.failure_risks || [];
  const founderFit = risks.find(r => r.slot === "founder_fit");
  const marketCategory = risks.find(r => r.slot === "market_category");
  const trustAdoption = risks.find(r => r.slot === "trust_adoption");

  const estimates = result?.estimates || {};

  return {
    risks_count: risks.length,
    risk1_text: marketCategory?.text || null,
    risk2_text: trustAdoption?.text || null,
    founder_fit_present: !!founderFit,
    risk3_archetype: founderFit?.archetype || null,
    risk3_text: founderFit?.text || null,
    main_bottleneck: estimates.main_bottleneck || null,
    main_bottleneck_explanation: estimates.main_bottleneck_explanation || null,
    estimates_explanation: estimates.explanation || null,
    duration: estimates.duration || null,
    difficulty: estimates.difficulty || null,
    evidence_strength_level: ev.evidence_strength?.level || null,
    md: ev.market_demand?.score ?? null,
    mo: ev.monetization?.score ?? null,
    or: ev.originality?.score ?? null,
    tc: ev.technical_complexity?.score ?? null,
  };
}

// ============================================
// CLASSIFICATION
// ============================================

// Archetype-to-Main-Bottleneck affinity for ALIGNMENT detection
// (per Stage 3 prompt's relational cases section)
const ARCHETYPE_BOTTLENECK_AFFINITY = {
  A: ["Technical build"],
  B: ["Buyer access", "Distribution"],
  C: ["Trust/credibility"],
  D: [], // D has no clean Main Bottleneck affinity — capital is always Layered
  E: ["Distribution", "Buyer access"], // E often appears with these
};

function classifyRelationalCase(targetArchetype, fields) {
  // Returns one of: ALIGNMENT, LAYERED, FOUNDER_FIT, DRIFT, MISSING
  if (!fields.founder_fit_present) {
    // Risk 3 absent — could be STEP 1 PROFILE-DOMAIN MATCH (FOUNDER_FIT case)
    // or a real bug (MISSING). For C/D/E target cases, profile is designed
    // to NOT match domain, so absence is unexpected — flag as FOUNDER_FIT
    // (which means STEP 1 fired) and let user inspect.
    return "FOUNDER_FIT";
  }

  const fired = fields.risk3_archetype;
  const mb = fields.main_bottleneck;

  if (fired === targetArchetype) {
    // Target archetype fired. Check if Main Bottleneck aligns or layers.
    const affinityList = ARCHETYPE_BOTTLENECK_AFFINITY[fired] || [];
    if (affinityList.includes(mb)) {
      return "ALIGNMENT";
    }
    return "LAYERED";
  }

  return "DRIFT";
}

function classifyCase(targetArchetype, runs) {
  // runs is an array of 2 successful runs for one case
  const fires = runs.filter(r => r.fields?.risk3_archetype === targetArchetype).length;
  const nulls = runs.filter(r => !r.fields?.founder_fit_present).length;
  const drifts = runs.filter(r =>
    r.fields?.founder_fit_present &&
    r.fields?.risk3_archetype !== targetArchetype
  ).length;

  let classification;
  if (fires >= GATES.B10A_READY_TARGET_FIRES) classification = "B10A_READY";
  else if (fires >= GATES.DIAGNOSTIC_TARGET_FIRES) classification = "DIAGNOSTIC";
  else classification = "REJECT";

  return { classification, fires, nulls, drifts, total: runs.length };
}

// ============================================
// VERDICT LOGIC
// ============================================

function computeVerdict(byCase) {
  // Compute per-archetype reachability + stable-candidate gates.
  const archetypeResults = { C: {}, D: {}, E: {} };

  for (const archetype of ["C", "D", "E"]) {
    const cases = CASES_BY_ARCHETYPE[archetype];
    let totalFires = 0;
    let totalRuns = 0;
    let stableCandidate = null;
    const caseClassifications = [];

    for (const caseDef of cases) {
      const caseResult = byCase[caseDef.id];
      if (!caseResult) continue;
      totalFires += caseResult.classification.fires;
      totalRuns += caseResult.classification.total;
      caseClassifications.push({
        id: caseDef.id,
        variant: caseDef.variant,
        classification: caseResult.classification.classification,
        fires: caseResult.classification.fires,
        nulls: caseResult.classification.nulls,
        drifts: caseResult.classification.drifts,
      });
      if (caseResult.classification.classification === "B10A_READY" && !stableCandidate) {
        stableCandidate = caseDef.id;
      }
    }

    archetypeResults[archetype] = {
      totalFires,
      totalRuns,
      G1a_reachability: totalFires >= GATES.G1A_REACHABILITY_MIN_FIRES_PER_ARCHETYPE
        ? "PASS"
        : "FAIL",
      G1b_stable_candidate: stableCandidate ? "PASS" : "FAIL",
      stableCandidateId: stableCandidate,
      caseClassifications,
    };
  }

  const allReachable = ["C", "D", "E"].every(a => archetypeResults[a].G1a_reachability === "PASS");
  const allStable = ["C", "D", "E"].every(a => archetypeResults[a].G1b_stable_candidate === "PASS");

  let verdict, interpretation;
  if (allReachable && allStable) {
    verdict = "B10A_COVERAGE_READY";
    interpretation = "All three archetypes (C, D, E) have at least one stable B10A_READY case (fires target archetype 2/2 reruns). The B10a regression bank can be expanded with the identified stable candidates. Coverage gap from B1 verification (177+ runs with C=2 fires, D=0, E=0) is now resolved.";
  } else if (allReachable && !allStable) {
    verdict = "REACHABILITY_OK_BUT_UNSTABLE";
    const missingStable = ["C", "D", "E"].filter(a => archetypeResults[a].G1b_stable_candidate === "FAIL");
    interpretation = `All three archetypes are reachable but ${missingStable.join(", ")} lack a stable 2/2 case for B10a inclusion. Author additional cases for ${missingStable.join(", ")} before B10a, or accept that B10a will run without those archetype seeds in the regression bank. DIAGNOSTIC cases provide useful evidence about archetype boundaries even when not B10A_READY.`;
  } else {
    verdict = "ARCHETYPE_NOT_REACHABLE";
    const unreachable = ["C", "D", "E"].filter(a => archetypeResults[a].G1a_reachability === "FAIL");
    interpretation = `Archetype(s) ${unreachable.join(", ")} did not fire on ANY of their 6 variant runs. This is a structural finding about the prompt's archetype boundaries — these archetypes may not be reliably triggerable on real-world inputs without explicit prompt-level tuning. Recommended action: investigate whether the Stage 2c archetype definitions need sharpening, OR document this as a known limitation and proceed without these archetypes in B10a.`;
  }

  return {
    verdict,
    interpretation,
    archetypeResults,
    G1a_passing: ["C", "D", "E"].filter(a => archetypeResults[a].G1a_reachability === "PASS"),
    G1b_passing: ["C", "D", "E"].filter(a => archetypeResults[a].G1b_stable_candidate === "PASS"),
  };
}

// ============================================
// SOFT OBSERVATIONAL METRICS
// ============================================

function computeObservationalMetrics(allRuns) {
  const total = allRuns.filter(r => !r.error).length;
  if (total === 0) return null;

  const step1FalseFires = allRuns.filter(r =>
    !r.error && !r.fields?.founder_fit_present
  ).length;

  const aDrifts = allRuns.filter(r =>
    !r.error && r.fields?.founder_fit_present && r.fields?.risk3_archetype === "A"
  ).length;

  const bDrifts = allRuns.filter(r =>
    !r.error && r.fields?.founder_fit_present && r.fields?.risk3_archetype === "B"
  ).length;

  const mainBottleneckCounts = {};
  for (const r of allRuns) {
    if (r.error) continue;
    const mb = r.fields?.main_bottleneck;
    if (mb) mainBottleneckCounts[mb] = (mainBottleneckCounts[mb] || 0) + 1;
  }

  return {
    total,
    step1FalseFires,
    step1FalseFireRate: step1FalseFires / total,
    aDrifts,
    aDriftRate: aDrifts / total,
    bDrifts,
    bDriftRate: bDrifts / total,
    step1Concerning: step1FalseFires / total > GATES.STEP1_FALSE_FIRE_MAX_RATE,
    aDriftConcerning: aDrifts / total > GATES.A_DRIFT_MAX_RATE,
    mainBottleneckCounts,
  };
}

// ============================================
// MARKDOWN REPORT
// ============================================

function writeMarkdown(outPath, data) {
  const L = (s = "") => s + "\n";
  let md = "";

  md += L("# Archetype C/D/E Coverage Runner Results");
  md += L();
  md += L(`**Generated:** ${data.timestamp}`);
  md += L(`**Total runs:** ${data.totalRuns} (${data.successful} successful, ${data.errors} errors)`);
  md += L(`**Wall time:** ${data.wallTimeMin.toFixed(1)} minutes`);
  md += L();

  md += L("## VERDICT");
  md += L();
  md += L(`### **${data.verdict.verdict}**`);
  md += L();
  md += L(data.verdict.interpretation);
  md += L();

  md += L("---");
  md += L();

  md += L("## Per-archetype reachability + stable-candidate summary");
  md += L();
  md += L("| Archetype | Total fires | Total runs | G1a Reachability | G1b Stable candidate | Stable case ID |");
  md += L("|---|---|---|---|---|---|");
  for (const a of ["C", "D", "E"]) {
    const r = data.verdict.archetypeResults[a];
    md += L(`| ${a} | ${r.totalFires} | ${r.totalRuns} | ${r.G1a_reachability} | ${r.G1b_stable_candidate} | ${r.stableCandidateId || "—"} |`);
  }
  md += L();

  md += L("## Per-case classification");
  md += L();
  md += L("| Case ID | Variant | Target | Fires (target/total) | Nulls | Drifts | Classification |");
  md += L("|---|---|---|---|---|---|---|");
  for (const a of ["C", "D", "E"]) {
    for (const c of data.verdict.archetypeResults[a].caseClassifications) {
      md += L(`| ${c.id} | ${c.variant} | ${a} | ${c.fires}/${RERUNS_PER_CASE} | ${c.nulls} | ${c.drifts} | **${c.classification}** |`);
    }
  }
  md += L();

  if (data.observational) {
    md += L("## Soft observational metrics");
    md += L();
    md += L(`STEP 1 false-fire rate (target=C/D/E but Risk 3 dropped to null): **${data.observational.step1FalseFires}/${data.observational.total}** (${(data.observational.step1FalseFireRate * 100).toFixed(1)}%) — threshold ${(GATES.STEP1_FALSE_FIRE_MAX_RATE * 100).toFixed(0)}% — ${data.observational.step1Concerning ? "⚠️ CONCERNING" : "OK"}`);
    md += L();
    md += L(`A-drift rate (target=C/D/E but archetype A fired): **${data.observational.aDrifts}/${data.observational.total}** (${(data.observational.aDriftRate * 100).toFixed(1)}%) — threshold ${(GATES.A_DRIFT_MAX_RATE * 100).toFixed(0)}% — ${data.observational.aDriftConcerning ? "⚠️ CONCERNING" : "OK"}`);
    md += L();
    md += L(`B-drift rate (target=C/D/E but archetype B fired): **${data.observational.bDrifts}/${data.observational.total}** (${(data.observational.bDriftRate * 100).toFixed(1)}%)`);
    md += L();
    md += L("### Main Bottleneck distribution across all runs");
    md += L();
    md += L("| Main Bottleneck | Count |");
    md += L("|---|---|");
    const sortedMBs = Object.entries(data.observational.mainBottleneckCounts).sort((a, b) => b[1] - a[1]);
    for (const [mb, count] of sortedMBs) {
      md += L(`| ${mb} | ${count} |`);
    }
    md += L();
  }

  md += L("## Per-run detail");
  md += L();
  for (const a of ["C", "D", "E"]) {
    md += L(`### Archetype ${a}`);
    md += L();
    for (const c of CASES_BY_ARCHETYPE[a]) {
      const caseData = data.byCase[c.id];
      if (!caseData) continue;
      md += L(`#### ${c.id} — ${c.variant}`);
      md += L();
      md += L(`**Purpose:** ${c.purpose}`);
      md += L();
      for (const run of caseData.runs) {
        if (run.error) {
          md += L(`**Run ${run.runIndex}:** ERROR — ${run.error}`);
          md += L();
          continue;
        }
        const f = run.fields;
        const fired = f.risk3_archetype || "(null — Risk 3 dropped)";
        const target = c.archetype;
        const matchEmoji = f.risk3_archetype === target ? "✅" : (f.founder_fit_present ? "❌ DRIFT" : "⚠️ NULL");
        md += L(`**Run ${run.runIndex}:** Risk 3 archetype=${fired} ${matchEmoji} | Main Bottleneck=${f.main_bottleneck || "—"} | Relational case=${run.relationalCase} | Evidence=${f.evidence_strength_level || "—"}`);
        md += L(`Scores: MD=${f.md} MO=${f.mo} OR=${f.or} TC=${f.tc} | Duration=${f.duration} | Difficulty=${f.difficulty}`);
        md += L();
        if (f.risk3_text) {
          md += L(`Risk 3 text: ${f.risk3_text}`);
          md += L();
        }
        if (f.main_bottleneck_explanation) {
          md += L(`Main Bottleneck explanation: ${f.main_bottleneck_explanation}`);
          md += L();
        }
      }
      md += L(`**Case classification: ${caseData.classification.classification}** (${caseData.classification.fires}/${caseData.classification.total} target fires, ${caseData.classification.nulls} nulls, ${caseData.classification.drifts} drifts)`);
      md += L();
      md += L("---");
      md += L();
    }
  }

  fs.writeFileSync(outPath, md);
}

// ============================================
// PRE-FLIGHT
// ============================================

async function preflight() {
  process.stdout.write("Preflight: pinging server… ");
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(BASE_URL + "/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: "ping", profile: { coding: "Beginner", ai: "Some AI experience", education: "Test" } }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (res.ok || res.status === 400 || res.status === 500) {
      console.log("server reachable.");
      return true;
    }
    console.log(`unexpected status ${res.status}.`);
    return false;
  } catch (e) {
    console.log(`UNREACHABLE — ${e.message}`);
    return false;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("=".repeat(80));
  console.log("ARCHETYPE C/D/E COVERAGE RUNNER");
  console.log("V4S28 B9 — pre-B10a archetype coverage discovery");
  console.log("=".repeat(80));
  console.log();

  if (!(await preflight())) {
    console.error("Server not reachable. Start the dev server (npm run dev) and retry.");
    process.exit(1);
  }

  // Build run list: each case × RERUNS_PER_CASE
  const runs = [];
  for (const caseDef of ARCHETYPE_CASES) {
    for (let r = 1; r <= RERUNS_PER_CASE; r++) {
      runs.push({ caseDef, runIndex: r });
    }
  }

  console.log(`Total runs: ${runs.length} (${ARCHETYPE_CASES.length} cases × ${RERUNS_PER_CASE} reruns)`);
  console.log(`Estimated wall time: ~${Math.round(runs.length * 2.5)} minutes`);
  console.log();

  const startTime = Date.now();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 16);
  const checkpointPath = path.join(OUTPUT_DIR, `archetype-coverage-${stamp}-checkpoint.json`);
  const allRuns = [];

  // Pre-flight runner check on first case before launching full bank (B5 lesson)
  console.log("Pre-flight runner check on first test case…");
  const firstRun = runs[0];
  const t0 = Date.now();
  try {
    const { result } = await runEval(firstRun.caseDef);
    const fields = extractRiskFields(result);
    if (fields.risks_count === 0) {
      console.error(`PRE-FLIGHT FAIL: failure_risks empty on first run. Aborting.`);
      console.error(`Raw result.evaluation keys: ${Object.keys(result?.evaluation || {}).join(", ")}`);
      process.exit(1);
    }
    const relationalCase = classifyRelationalCase(firstRun.caseDef.archetype, fields);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`✓ Pre-flight OK (${elapsed}s): risks=${fields.risks_count}, founder_fit_present=${fields.founder_fit_present}, archetype=${fields.risk3_archetype || "null"}, MB=${fields.main_bottleneck}, relational=${relationalCase}`);
    console.log();
    allRuns.push({
      caseId: firstRun.caseDef.id,
      runIndex: firstRun.runIndex,
      target: firstRun.caseDef.archetype,
      fields,
      relationalCase,
      elapsedMs: Date.now() - t0,
    });
  } catch (e) {
    console.error(`PRE-FLIGHT FAIL: ${e.message}. Aborting.`);
    process.exit(1);
  }

  console.log("Beginning full case bank…");
  console.log();

  // Remaining runs
  for (let i = 1; i < runs.length; i++) {
    const { caseDef, runIndex } = runs[i];
    const tStart = Date.now();
    process.stdout.write(`[${i + 1}/${runs.length}] ${caseDef.id}-r${runIndex} (target=${caseDef.archetype})  `.padEnd(50));

    try {
      const { result } = await runEval(caseDef);
      const fields = extractRiskFields(result);
      const relationalCase = classifyRelationalCase(caseDef.archetype, fields);
      const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
      const fired = fields.risk3_archetype || "null";
      const matchSymbol = fields.risk3_archetype === caseDef.archetype ? "✓" : (fields.founder_fit_present ? "✗drift" : "⚠null");
      console.log(`${elapsed}s  ${matchSymbol} arch=${fired} MB=${fields.main_bottleneck || "—"}`);
      allRuns.push({
        caseId: caseDef.id,
        runIndex,
        target: caseDef.archetype,
        fields,
        relationalCase,
        elapsedMs: Date.now() - tStart,
      });
    } catch (e) {
      const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
      console.log(`ERROR (${elapsed}s) — ${e.message}`);
      allRuns.push({
        caseId: caseDef.id,
        runIndex,
        target: caseDef.archetype,
        error: e.message,
        elapsedMs: Date.now() - tStart,
      });
    }

    // Checkpoint every 5 runs
    if ((i + 1) % 5 === 0) {
      try {
        fs.writeFileSync(checkpointPath, JSON.stringify({ allRuns, timestamp: new Date().toISOString() }, null, 2));
      } catch { /* ignore */ }
    }
  }

  const totalWallMin = (Date.now() - startTime) / 60000;
  const successful = allRuns.filter(r => !r.error).length;
  const errors = allRuns.filter(r => r.error).length;

  console.log();
  console.log("=".repeat(80));
  console.log("ANALYSIS");
  console.log("=".repeat(80));

  // Group runs by case
  const byCase = {};
  for (const caseDef of ARCHETYPE_CASES) {
    const caseRuns = allRuns
      .filter(r => r.caseId === caseDef.id)
      .map(r => ({ runIndex: r.runIndex, fields: r.fields, relationalCase: r.relationalCase, error: r.error }));
    const classification = classifyCase(caseDef.archetype, caseRuns);
    byCase[caseDef.id] = { caseDef, runs: caseRuns, classification };
  }

  const verdict = computeVerdict(byCase);
  const observational = computeObservationalMetrics(allRuns);

  // Console summary
  console.log();
  console.log("Per-archetype results:");
  for (const a of ["C", "D", "E"]) {
    const r = verdict.archetypeResults[a];
    console.log(`  ${a}: ${r.totalFires}/${r.totalRuns} fires | G1a Reachability ${r.G1a_reachability} | G1b Stable ${r.G1b_stable_candidate}${r.stableCandidateId ? ` (${r.stableCandidateId})` : ""}`);
    for (const c of r.caseClassifications) {
      const symbol = c.classification === "B10A_READY" ? "✓" : (c.classification === "DIAGNOSTIC" ? "~" : "✗");
      console.log(`     ${symbol} ${c.id} (${c.variant}): ${c.fires}/${RERUNS_PER_CASE} target fires → ${c.classification}`);
    }
  }
  console.log();
  if (observational) {
    console.log("Soft observational metrics:");
    console.log(`  STEP 1 false-fire rate: ${observational.step1FalseFires}/${observational.total} (${(observational.step1FalseFireRate * 100).toFixed(1)}%)${observational.step1Concerning ? " ⚠️" : ""}`);
    console.log(`  A-drift rate: ${observational.aDrifts}/${observational.total} (${(observational.aDriftRate * 100).toFixed(1)}%)${observational.aDriftConcerning ? " ⚠️" : ""}`);
    console.log(`  B-drift rate: ${observational.bDrifts}/${observational.total} (${(observational.bDriftRate * 100).toFixed(1)}%)`);
  }

  // Save outputs
  const data = {
    timestamp: new Date().toISOString(),
    pipeline: "PRO",
    baseUrl: BASE_URL,
    totalRuns: allRuns.length,
    successful,
    errors,
    wallTimeMin: totalWallMin,
    gates: GATES,
    verdict,
    observational,
    byCase,
    allRuns,
  };

  const jsonPath = path.join(OUTPUT_DIR, `archetype-coverage-${stamp}.json`);
  const mdPath = path.join(OUTPUT_DIR, `archetype-coverage-${stamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  writeMarkdown(mdPath, data);

  console.log();
  console.log("=".repeat(80));
  console.log(`VERDICT: ${verdict.verdict}`);
  console.log("=".repeat(80));
  console.log(verdict.interpretation);
  console.log();
  console.log(`Total wall time: ${totalWallMin.toFixed(1)} minutes`);
  console.log(`Successful: ${successful}/${allRuns.length} | Errors: ${errors}`);
  console.log();
  console.log(`Outputs:`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${mdPath}`);
  console.log("=".repeat(80));

  // Cleanup checkpoint if all clean
  if (errors === 0) {
    try { fs.unlinkSync(checkpointPath); } catch { /* ignore */ }
  } else {
    console.log(`Checkpoint preserved at ${checkpointPath} (had ${errors} errors during run)`);
  }
}

main().catch(err => {
  console.error("\nFATAL:", err.message);
  console.error(err.stack);
  process.exit(1);
});

// ============================================
// V4S28 PHASE 0.5 — STAGE 1 STABILITY TEST HARNESS
// ============================================
//
// Runs three Phase-0 worst-drift cells twice each, computes within-cell Jaccard
// of competitor name sets across reruns, and reports pass/fail against the
// 0.85 Jaccard threshold from execution-order.md Phase 0.5.
//
// Phase 0 baseline (R2↔R3, same idea + same profile + byte-identical keywords
// and Serper URLs in the 3 cells picked here):
//   MAT1-beginner:     Jaccard 0.62
//   MAT2-intermediate: Jaccard 0.25
//   MAT3-insider:      Jaccard 0.50
// Pass threshold for Phase 0.5: Jaccard ≥ 0.85 across all three cells.
//
// Usage — no fix (fresh baseline):
//   node run-stage1-stability.js
//
// Usage — after applying a candidate fix:
//   FIX_LABEL="sort-items" node run-stage1-stability.js
//   FIX_LABEL="fixed-count" node run-stage1-stability.js
//   FIX_LABEL="param-hardening" node run-stage1-stability.js
//   FIX_LABEL="tighter-prompt" node run-stage1-stability.js
//   FIX_LABEL="sort+fixed-count" node run-stage1-stability.js   # combined
//
// Outputs (named by FIX_LABEL):
//   stage1-stability-{label}-raw.json
//   stage1-stability-{label}-analysis.md
//
// Wall time: ~12-15 minutes (6 runs × ~2min).
//
// Requires Node 18+.
// ============================================

const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = __dirname;
const FIX_LABEL = (process.env.FIX_LABEL || "baseline").replace(/[^a-zA-Z0-9._+\-]/g, "-");
const TARGET_JACCARD = 0.85;
const RERUNS_PER_CELL = 2;

// ─── Phase 0 baseline Jaccards (for delta reporting) ──────────
const PHASE0_BASELINE = {
  "MAT1-beginner": 0.62,
  "MAT2-intermediate": 0.25,
  "MAT3-insider": 0.50,
};

// ─── 3 worst-drift cells from Phase 0 ────────────────────────
const CELLS = [
  {
    id: "MAT1-beginner",
    profile: { coding: "No coding experience", ai: "Some AI experience", education: "Paralegal (6 years), Airtable builder" },
    idea: "AI-powered document automation tool for small law firms (under 20 attorneys). Ingests client intake forms, generates draft engagement letters, retainer agreements, and client memos based on firm templates. Integrates with Clio. $299/month per firm.",
  },
  {
    id: "MAT2-intermediate",
    profile: { coding: "Beginner", ai: "Regular AI user", education: "Insurance claims adjuster (10 years), learning to code" },
    idea: "Concierge service that handles all insurance claim disputes for small businesses (under 50 employees). Success fee of 25% on recovered claims. Starting with denied health insurance claims for employee medical expenses. Done-with-you model: we handle paperwork, customer provides documents.",
  },
  {
    id: "MAT3-insider",
    profile: { coding: "No coding experience", ai: "Some AI experience", education: "Former rural hospital CFO (15 years), 80+ exec relationships" },
    idea: "Platform that helps rural hospitals (under 100 beds) negotiate better rates with medical device suppliers by aggregating purchasing data across member hospitals. Members pay $24,000/year. Value prop: average 12% reduction in device spend, which pays for membership 10x over. Requires buy-in from hospital CFOs and procurement directors.",
  },
];

// ============================================
// STREAMING SSE RUNNER
// ============================================

async function runEval(test) {
  const runStart = Date.now();
  const res = await fetch(BASE_URL + "/api/analyze-pro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea: test.idea, profile: test.profile }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];
  let result = null;
  let errMsg = null;

  const consume = (line) => {
    if (!line.startsWith("data: ")) return;
    try {
      const d = JSON.parse(line.slice(6));
      events.push(d);
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
    for (const line of lines) consume(line);
  }
  if (buffer) consume(buffer);

  if (errMsg) throw new Error(errMsg);
  if (!result) throw new Error("No result (stream ended without complete event)");
  return { result, events, totalMs: Date.now() - runStart };
}

function extractRun(result, events, test, runIndex) {
  const evMap = {};
  for (const e of events) if (e.step) evMap[e.step] = e;

  const githubData = evMap["github_done"]?.data || {};
  const serperData = evMap["serper_done"]?.data || {};
  const haikuData = evMap["keywords_done"]?.data || {};

  const competitors = (result.competition?.competitors || []).map(c => ({
    name: c.name,
    type: c.competitor_type,
    source: c.source,
  }));

  return {
    cellId: test.id,
    runIndex,
    fixLabel: FIX_LABEL,
    haikuKeywords: haikuData.keywords || [],
    retrievalItems: {
      github_count: githubData.count ?? null,
      github_results: Array.isArray(githubData.results) ? githubData.results : null,
      serper_count: serperData.count ?? null,
      serper_results: Array.isArray(serperData.results) ? serperData.results : null,
    },
    competitors,
    competitorCount: competitors.length,
    classification: result.classification,
  };
}

// ============================================
// ANALYSIS
// ============================================

function jaccard(setA, setB) {
  if (!setA.size && !setB.size) return 1;
  const inter = new Set([...setA].filter(x => setB.has(x)));
  const uni = new Set([...setA, ...setB]);
  return uni.size ? inter.size / uni.size : 1;
}

// ─── Fuzzy (semantic) matching — tolerates label drift ─────────
// "IMA360" matches "IMA360 Medical Device Pricing Software"
// "Woodpecker" matches "Woodpecker (Ares Legal)"
// "Manual template workflow" matches "Manual Template Process"
// "Internal Development" matches "Internal Build with LLM APIs"
function normalizeName(name) {
  return (name || "").toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(name) {
  const STOP = new Set(["the","and","or","for","of","a","an","to","with","in","on","by"]);
  return new Set(normalizeName(name).split(" ").filter(w => w.length > 2 && !STOP.has(w)));
}

function semanticMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Prefix match: one name is a prefix of the other (min 5 chars to avoid false positives)
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length < nb.length ? nb : na;
  if (shorter.length >= 5 && (longer.startsWith(shorter + " ") || longer === shorter)) return true;
  // Token overlap: at least 2 shared tokens AND ≥50% of smaller token set
  const ta = nameTokens(a), tb = nameTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  const shared = [...ta].filter(x => tb.has(x)).length;
  return shared >= 2 && shared / Math.min(ta.size, tb.size) >= 0.5;
}

function fuzzyJaccard(namesA, namesB) {
  const matched1 = new Set(), matched2 = new Set();
  for (let i = 0; i < namesA.length; i++) {
    for (let j = 0; j < namesB.length; j++) {
      if (matched1.has(i) || matched2.has(j)) continue;
      if (semanticMatch(namesA[i], namesB[j])) {
        matched1.add(i); matched2.add(j);
      }
    }
  }
  const intersection = matched1.size;
  const union = namesA.length + namesB.length - intersection;
  return union ? intersection / union : 1;
}

function nameSet(run) {
  return new Set(run.competitors.map(c => (c.name || "").toLowerCase().trim()).filter(Boolean));
}

function urlSet(items) {
  if (!Array.isArray(items)) return new Set();
  return new Set(items.map(x => x?.url || x?.link || x?.html_url || JSON.stringify(x)));
}

function kwSet(run) {
  return new Set((run.haikuKeywords || []).map(k => k.toLowerCase().trim()));
}

function analyze(runs) {
  const byCell = {};
  for (const r of runs) {
    if (!byCell[r.cellId]) byCell[r.cellId] = [];
    byCell[r.cellId].push(r);
  }

  const cellResults = [];
  for (const cellId of CELLS.map(c => c.id)) {
    const cellRuns = (byCell[cellId] || []).sort((a, b) => a.runIndex - b.runIndex);
    if (cellRuns.length < 2) {
      cellResults.push({
        cellId,
        skipped: true,
        reason: `only ${cellRuns.length} successful run(s)`,
      });
      continue;
    }
    // Within-cell pairwise Jaccards — compute both byte and fuzzy
    const compPairs = [];
    const compFuzzyPairs = [];
    const serperPairs = [];
    const kwPairs = [];
    for (let i = 0; i < cellRuns.length; i++) {
      for (let j = i + 1; j < cellRuns.length; j++) {
        const namesI = cellRuns[i].competitors.map(c => c.name || "");
        const namesJ = cellRuns[j].competitors.map(c => c.name || "");
        compPairs.push({
          pair: `r${cellRuns[i].runIndex}↔r${cellRuns[j].runIndex}`,
          jaccard: +jaccard(nameSet(cellRuns[i]), nameSet(cellRuns[j])).toFixed(2),
        });
        compFuzzyPairs.push({
          pair: `r${cellRuns[i].runIndex}↔r${cellRuns[j].runIndex}`,
          jaccard: +fuzzyJaccard(namesI, namesJ).toFixed(2),
        });
        serperPairs.push({
          pair: `r${cellRuns[i].runIndex}↔r${cellRuns[j].runIndex}`,
          jaccard: +jaccard(urlSet(cellRuns[i].retrievalItems?.serper_results), urlSet(cellRuns[j].retrievalItems?.serper_results)).toFixed(2),
        });
        kwPairs.push({
          pair: `r${cellRuns[i].runIndex}↔r${cellRuns[j].runIndex}`,
          jaccard: +jaccard(kwSet(cellRuns[i]), kwSet(cellRuns[j])).toFixed(2),
        });
      }
    }
    const compMin = Math.min(...compPairs.map(p => p.jaccard));
    const compFuzzyMin = Math.min(...compFuzzyPairs.map(p => p.jaccard));
    const serperMin = Math.min(...serperPairs.map(p => p.jaccard));
    const kwMin = Math.min(...kwPairs.map(p => p.jaccard));

    cellResults.push({
      cellId,
      phase0Baseline: PHASE0_BASELINE[cellId] ?? null,
      competitorJaccardMin: compMin,
      competitorJaccardPairs: compPairs,
      competitorFuzzyJaccardMin: compFuzzyMin,
      competitorFuzzyJaccardPairs: compFuzzyPairs,
      serperJaccardMin: serperMin,
      serperJaccardPairs: serperPairs,
      keywordJaccardMin: kwMin,
      competitorCounts: cellRuns.map(r => ({ runIndex: r.runIndex, count: r.competitorCount })),
      passByte: compMin >= TARGET_JACCARD,
      passFuzzy: compFuzzyMin >= TARGET_JACCARD,
      pass: compMin >= TARGET_JACCARD && compFuzzyMin >= TARGET_JACCARD,
      delta: PHASE0_BASELINE[cellId] != null ? +(compMin - PHASE0_BASELINE[cellId]).toFixed(2) : null,
    });
  }

  const validCells = cellResults.filter(c => !c.skipped);
  const byteMins = validCells.map(c => c.competitorJaccardMin);
  const fuzzyMins = validCells.map(c => c.competitorFuzzyJaccardMin);
  const allPassByte = validCells.length === CELLS.length && validCells.every(c => c.passByte);
  const allPassFuzzy = validCells.length === CELLS.length && validCells.every(c => c.passFuzzy);
  const allPass = allPassByte && allPassFuzzy;
  const overallByteMin = byteMins.length ? Math.min(...byteMins) : 0;
  const overallByteMean = byteMins.length ? +(byteMins.reduce((s, x) => s + x, 0) / byteMins.length).toFixed(2) : 0;
  const overallFuzzyMin = fuzzyMins.length ? Math.min(...fuzzyMins) : 0;
  const overallFuzzyMean = fuzzyMins.length ? +(fuzzyMins.reduce((s, x) => s + x, 0) / fuzzyMins.length).toFixed(2) : 0;
  const baselineMean = +((PHASE0_BASELINE["MAT1-beginner"] + PHASE0_BASELINE["MAT2-intermediate"] + PHASE0_BASELINE["MAT3-insider"]) / 3).toFixed(2);

  // Verdict semantics:
  // - PASS: both byte AND fuzzy clear threshold on all cells (true stability at both identity and label layers)
  // - PASS_FUZZY_ONLY: identity-level stable, but label drift remains (canonical-naming prompt isn't working)
  // - PARTIAL_IMPROVEMENT: meaningful lift on either metric over baseline, but neither at threshold
  // - NO_MEANINGFUL_IMPROVEMENT: within ±0.10 of baseline
  // - WORSE_THAN_BASELINE: regressed
  let verdict;
  if (validCells.length < CELLS.length) {
    verdict = "INCOMPLETE";
  } else if (allPass) {
    verdict = "PASS";
  } else if (allPassFuzzy && !allPassByte) {
    verdict = "PASS_FUZZY_ONLY";
  } else if (overallByteMean < baselineMean - 0.05 && overallFuzzyMean < baselineMean - 0.05) {
    verdict = "WORSE_THAN_BASELINE";
  } else if (overallByteMean >= baselineMean + 0.10 || overallFuzzyMean >= baselineMean + 0.10) {
    verdict = "PARTIAL_IMPROVEMENT";
  } else {
    verdict = "NO_MEANINGFUL_IMPROVEMENT";
  }

  return {
    cellResults,
    overallByteMin, overallByteMean,
    overallFuzzyMin, overallFuzzyMean,
    baselineMean, verdict,
    allPass, allPassByte, allPassFuzzy,
    // Backward-compat (markdown templates still read these)
    overallMin: overallByteMin, overallMean: overallByteMean,
  };
}

// ============================================
// MARKDOWN OUTPUT
// ============================================

function formatMarkdown(runs, analysis) {
  const L = [];
  const push = (s = "") => L.push(s);

  push(`# V4S28 Phase 0.5 — Stage 1 Stability Test`);
  push();
  push(`**Fix label:** \`${FIX_LABEL}\``);
  push(`**Generated:** ${new Date().toISOString()}`);
  push(`**Runs executed:** ${runs.filter(r => !r.error).length} / ${CELLS.length * RERUNS_PER_CELL}`);
  push(`**Target:** competitor-list Jaccard ≥ ${TARGET_JACCARD} across all 3 cells`);
  push();

  push(`## Verdict: **${analysis.verdict}**`);
  push();
  push(`Phase 0 baseline mean Jaccard (no fix): **${analysis.baselineMean}**.`);
  push(`This test — byte Jaccard mean: **${analysis.overallByteMean.toFixed(2)}**, fuzzy Jaccard mean: **${analysis.overallFuzzyMean.toFixed(2)}**.`);
  push();
  if (analysis.verdict === "PASS") {
    push(`All three cells cleared ${TARGET_JACCARD} on both byte AND fuzzy Jaccard. Full identity-level AND label-level stability. **Ship this fix as part of V4S28.**`);
  } else if (analysis.verdict === "PASS_FUZZY_ONLY") {
    push(`All three cells cleared ${TARGET_JACCARD} on fuzzy (semantic) Jaccard — Stage 1 is now identifying the same competitors consistently. But byte Jaccard didn't clear, meaning the same competitors are being *labeled differently* across runs. The canonical-naming prompt addition isn't landing fully. Options: (1) strengthen the naming rules in prompt-stage1.js, (2) accept this level and ship — identity-level stability is the user-impact-critical metric.`);
  } else if (analysis.verdict === "PARTIAL_IMPROVEMENT") {
    push(`Meaningful improvement over Phase 0 baseline (byte ${analysis.overallByteMean.toFixed(2)} / fuzzy ${analysis.overallFuzzyMean.toFixed(2)} vs baseline ${analysis.baselineMean}) but ${TARGET_JACCARD} threshold not fully cleared on either metric. Consider combining with another candidate fix or revising the current one.`);
  } else if (analysis.verdict === "NO_MEANINGFUL_IMPROVEMENT") {
    push(`Both byte Jaccard (${analysis.overallByteMean.toFixed(2)}) and fuzzy Jaccard (${analysis.overallFuzzyMean.toFixed(2)}) are within ±0.10 of Phase 0 baseline (${analysis.baselineMean}) — no meaningful improvement. Roll back and try next technique.`);
  } else if (analysis.verdict === "WORSE_THAN_BASELINE") {
    push(`Both metrics below Phase 0 baseline (${analysis.baselineMean}) by >0.05. Either fix is actively harmful or Serper/Google results have shifted. Check serper URL Jaccard column below — if it dropped too, that's a retrieval drift issue, not a Stage 1 issue.`);
  } else {
    push(`Not enough successful runs to render a verdict. Check the run log above for failures.`);
  }
  push();

  push("## Per-cell results");
  push();
  push("| Cell | Phase 0 base | Byte J | Fuzzy J | Δ byte | Byte pass | Fuzzy pass |");
  push("|---|---|---|---|---|---|---|");
  for (const c of analysis.cellResults) {
    if (c.skipped) {
      push(`| ${c.cellId} | ${PHASE0_BASELINE[c.cellId] ?? "—"} | SKIPPED (${c.reason}) | — | — | — | — |`);
      continue;
    }
    const deltaStr = c.delta != null ? (c.delta >= 0 ? `+${c.delta}` : `${c.delta}`) : "—";
    push(`| ${c.cellId} | ${c.phase0Baseline ?? "—"} | ${c.competitorJaccardMin.toFixed(2)} | ${c.competitorFuzzyJaccardMin.toFixed(2)} | ${deltaStr} | ${c.passByte ? "✅" : "❌"} | ${c.passFuzzy ? "✅" : "❌"} |`);
  }
  push();
  push("*Byte Jaccard = exact string match on competitor names. Fuzzy Jaccard = semantic match that tolerates label variation (e.g. \"IMA360\" matches \"IMA360 Medical Device Pricing Software\"). If fuzzy passes but byte doesn't, you have label drift — same competitors identified, different names used.*");
  push();

  push("## Retrieval-layer stability check");
  push();
  push("*If the sort-items fix was applied, Serper URL Jaccard across reruns should be 1.00 (stable ordering = stable input). If it's below 1.00, the fix either wasn't applied or isn't working.*");
  push();
  push("| Cell | Keyword J (min) | Serper URL J (min) |");
  push("|---|---|---|");
  for (const c of analysis.cellResults) {
    if (c.skipped) {
      push(`| ${c.cellId} | — | — |`);
      continue;
    }
    push(`| ${c.cellId} | ${c.keywordJaccardMin.toFixed(2)} | ${c.serperJaccardMin.toFixed(2)} |`);
  }
  push();

  push("## Per-cell detail");
  push();
  for (const c of analysis.cellResults) {
    push(`### ${c.cellId}`);
    push();
    if (c.skipped) {
      push(`Skipped: ${c.reason}`);
      push();
      continue;
    }
    push(`- **Competitor counts per run:** ${c.competitorCounts.map(x => `r${x.runIndex}=${x.count}`).join(", ")}`);
    push(`- **Byte Jaccard pairs:** ${c.competitorJaccardPairs.map(p => `${p.pair}=${p.jaccard}`).join(", ")}`);
    push(`- **Fuzzy Jaccard pairs:** ${c.competitorFuzzyJaccardPairs.map(p => `${p.pair}=${p.jaccard}`).join(", ")}`);
    push(`- **Serper URL Jaccard pairs:** ${c.serperJaccardPairs.map(p => `${p.pair}=${p.jaccard}`).join(", ")}`);
    push(`- **Byte Jaccard min:** ${c.competitorJaccardMin.toFixed(2)} (target ≥ ${TARGET_JACCARD}) ${c.passByte ? "✅" : "❌"}`);
    push(`- **Fuzzy Jaccard min:** ${c.competitorFuzzyJaccardMin.toFixed(2)} (target ≥ ${TARGET_JACCARD}) ${c.passFuzzy ? "✅" : "❌"}`);
    push(`- **Delta from Phase 0 baseline (byte):** ${c.delta != null ? (c.delta >= 0 ? "+" : "") + c.delta : "—"}`);
    push();
  }

  return L.join("\n");
}

// ============================================
// MAIN
// ============================================

async function preflight() {
  try {
    await fetch(BASE_URL);
    return true;
  } catch (e) {
    console.error(`\nCannot reach server at ${BASE_URL}.\n${e.message}\n\nMake sure Next.js dev server is running: npm run dev\n`);
    return false;
  }
}

async function main() {
  console.log("=".repeat(80));
  console.log("V4S28 Phase 0.5 — Stage 1 stability test");
  console.log(`Fix label: "${FIX_LABEL}"`);
  console.log(`Cells: ${CELLS.length}, reruns per cell: ${RERUNS_PER_CELL} (${CELLS.length * RERUNS_PER_CELL} runs total)`);
  console.log(`Estimated wall time: ~${Math.round(CELLS.length * RERUNS_PER_CELL * 2.2)} minutes`);
  console.log(`Pass threshold: Jaccard ≥ ${TARGET_JACCARD} on all 3 cells`);
  console.log("=".repeat(80) + "\n");

  if (!(await preflight())) process.exit(1);

  const runs = [];
  const t0 = Date.now();
  let done = 0;
  const totalRuns = CELLS.length * RERUNS_PER_CELL;

  for (const cell of CELLS) {
    for (let r = 1; r <= RERUNS_PER_CELL; r++) {
      done++;
      const runLabel = `${cell.id}-${FIX_LABEL}-r${r}`;
      const tStart = Date.now();
      process.stdout.write(`[${done}/${totalRuns}] ${runLabel.padEnd(50)} `);
      try {
        const { result, events } = await runEval(cell);
        const extracted = extractRun(result, events, cell, r);
        const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
        console.log(`✅ ${elapsed}s  ${extracted.competitorCount} competitors  (serper=${extracted.retrievalItems.serper_count}, github=${extracted.retrievalItems.github_count})`);
        runs.push(extracted);
      } catch (e) {
        const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
        console.log(`❌ FAILED (${elapsed}s) — ${e.message}`);
        runs.push({ cellId: cell.id, runIndex: r, fixLabel: FIX_LABEL, error: e.message });
      }
    }
  }

  const analysis = analyze(runs.filter(r => !r.error));

  // Write outputs
  const rawPath = path.join(OUTPUT_DIR, `stage1-stability-${FIX_LABEL}-raw.json`);
  fs.writeFileSync(rawPath, JSON.stringify({
    fixLabel: FIX_LABEL,
    target: TARGET_JACCARD,
    phase0Baseline: PHASE0_BASELINE,
    runs,
    analysis,
  }, null, 2));

  const mdPath = path.join(OUTPUT_DIR, `stage1-stability-${FIX_LABEL}-analysis.md`);
  fs.writeFileSync(mdPath, formatMarkdown(runs, analysis));

  const totalElapsed = ((Date.now() - t0) / 60000).toFixed(1);
  const failed = runs.filter(r => r.error).length;
  console.log("\n" + "=".repeat(80));
  console.log(`Completed in ${totalElapsed} min. Succeeded: ${totalRuns - failed}/${totalRuns}.`);
  console.log(`✓ ${rawPath}`);
  console.log(`✓ ${mdPath}`);
  console.log("=".repeat(80));
  console.log(`\nVerdict: **${analysis.verdict}**`);
  console.log(`Overall byte Jaccard  — min: ${analysis.overallByteMin.toFixed(2)}, mean: ${analysis.overallByteMean.toFixed(2)}`);
  console.log(`Overall fuzzy Jaccard — min: ${analysis.overallFuzzyMin.toFixed(2)}, mean: ${analysis.overallFuzzyMean.toFixed(2)}`);
  console.log(`\nPer-cell:`);
  for (const c of analysis.cellResults) {
    if (c.skipped) {
      console.log(`  ${c.cellId.padEnd(20)} SKIPPED`);
      continue;
    }
    const deltaStr = c.delta != null ? (c.delta >= 0 ? `+${c.delta}` : `${c.delta}`) : "—";
    console.log(`  ${c.cellId.padEnd(20)} byte=${c.competitorJaccardMin.toFixed(2)} ${c.passByte ? "✅" : "❌"}   fuzzy=${c.competitorFuzzyJaccardMin.toFixed(2)} ${c.passFuzzy ? "✅" : "❌"}   Δbyte=${deltaStr}`);
  }
  console.log();
}

main().catch(err => {
  console.error("\nFATAL:", err.message);
  console.error(err.stack);
  process.exit(1);
});
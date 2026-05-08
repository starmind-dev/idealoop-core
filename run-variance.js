// ============================================
// IDEALOOP CORE — V4S28 PHASE 0 VARIANCE DIAGNOSTIC
// ============================================
//
// Purpose: Verify three cross-profile variance findings from the 34-run audit
// by re-running the MAT1 / MAT2 / MAT3 matrices and SP1 with expanded capture,
// to determine whether the observed variance is:
//   (a) systematic (persists across reruns) → ship targeted fixes
//   (b) stochastic (doesn't persist)        → drop from V4S28 scope
//
// Four Phase 0 analysis questions (execution-order.md §Phase 0):
//   Q1. Does MAT2 MO contamination persist? (>1.0 range → systematic; <0.5 → stochastic)
//   Q2. Does MAT1 confidence flip persist?
//   Q3. Does MAT3 competitor drift persist?
//   Q4. CASCADE TEST: do the three findings correlate across (matrix × profile) cells?
//       → phi correlation > 0.5 on all three signal pairs → Stage 1 is the cascade source
//       → Stage 1 profile strip is primary fix; P6-S1 / P8-S2 collapse into it
//
// Run set: 19 total
//   MAT1 × 2 reruns per profile × 3 profiles = 6 runs
//   MAT2 × 2 reruns per profile × 3 profiles = 6 runs
//   MAT3 × 2 reruns per profile × 3 profiles = 6 runs
//   SP1  × 1 rerun                            = 1 run
//
// Expanded capture (vs run-audit.js):
//   - Per-event wall-clock timing via SSE stream-parse (not buffered read)
//   - Raw GitHub + Serper retrieval items (requires backend patch — see route file
//     change below; script works without the patch and flags absence in output)
//   - Derived per-stage timing (haiku | retrieval | stage1 | stage2a | stage2b | stage3)
//
// If audit-raw.json is present next to this script, R1 baselines are loaded and
// combined with the new R2/R3 runs — giving 3 observations per MAT profile (R1
// audit + R2 + R3 new) and 2 for SP1.
//
// Requires Node 18+ (uses built-in fetch streaming).
//
// Usage:
//   node run-variance.js              # server must be running at localhost:3000
//
// Outputs (next to this script):
//   variance-raw.json                 # every field from every run + per-event timings
//   variance-analysis.md              # Q1-Q4 pre-organized tables + verdicts
//
// ============================================

const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = __dirname;
const AUDIT_BASELINE_PATH = path.join(OUTPUT_DIR, "audit-raw.json");

// ─── Threshold knobs ────────────────────────────────────────────────────────
// MO range > this → "drift" binary signal for Q4 cascade test.
const MO_DRIFT_THRESHOLD = 0.5;
// Within-profile competitor-set min Jaccard < this → "drift" binary signal.
const COMPETITOR_JACCARD_DRIFT = 0.7;
// Phi correlation > this on all three signal pairs → cascade confirmed (Q4 verdict).
const CASCADE_CORR_THRESHOLD = 0.5;
// Rerun counts (excluding R1 audit baseline).
const RERUNS_PER_MAT_PROFILE = 2;  // R2, R3
const RERUNS_PER_SP1 = 1;           // R2

// ============================================
// IDEA + PROFILE DEFINITIONS
// (copied verbatim from run-audit.js so this script is standalone)
// ============================================

const MAT1_IDEA =
  "AI-powered document automation tool for small law firms (under 20 attorneys). Ingests client intake forms, generates draft engagement letters, retainer agreements, and client memos based on firm templates. Integrates with Clio. $299/month per firm.";

const MAT1_PROFILES = {
  beginner: { coding: "No coding experience", ai: "Some AI experience", education: "Paralegal (6 years), Airtable builder" },
  intermediate: { coding: "Intermediate", ai: "Regular AI user", education: "Paralegal (6 years), bootcamp grad, shipped personal project" },
  senior: { coding: "Advanced", ai: "Advanced AI user (fine-tuning LLMs)", education: "Staff engineer at LegalTech company (5 years, doc automation features)" },
};

const MAT2_IDEA =
  "Concierge service that handles all insurance claim disputes for small businesses (under 50 employees). Success fee of 25% on recovered claims. Starting with denied health insurance claims for employee medical expenses. Done-with-you model: we handle paperwork, customer provides documents.";

const MAT2_PROFILES = {
  beginner: { coding: "No coding experience", ai: "Some AI experience", education: "Former small-business owner (dealt with claim denials personally)" },
  intermediate: { coding: "Beginner", ai: "Regular AI user", education: "Insurance claims adjuster (10 years), learning to code" },
  senior: { coding: "Advanced", ai: "Advanced AI user", education: "Senior PM at healthtech company, built internal tools" },
};

const MAT3_IDEA =
  "Platform that helps rural hospitals (under 100 beds) negotiate better rates with medical device suppliers by aggregating purchasing data across member hospitals. Members pay $24,000/year. Value prop: average 12% reduction in device spend, which pays for membership 10x over. Requires buy-in from hospital CFOs and procurement directors.";

const MAT3_PROFILES = {
  insider: { coding: "No coding experience", ai: "Some AI experience", education: "Former rural hospital CFO (15 years), 80+ exec relationships" },
  "tech-no-access": { coding: "Advanced", ai: "Advanced AI user", education: "Staff engineer at healthtech startup (8 years), built procurement tools for enterprise" },
  partial: { coding: "Intermediate", ai: "Regular AI user", education: "Former consultant at hospital purchasing group (3 years), now building SaaS" },
};

const SP1_PROFILE = { coding: "Beginner", ai: "No AI experience", education: "Dentist" };
const SP1_IDEA = "tool for dentists to save time";

function buildTests() {
  const tests = [];
  const addMatrix = (matrixGroup, idea, profiles) => {
    for (const [profileName, profile] of Object.entries(profiles)) {
      for (let r = 2; r <= 1 + RERUNS_PER_MAT_PROFILE; r++) {
        tests.push({
          id: `${matrixGroup}-${profileName}-r${r}`,
          baselineId: `${matrixGroup}-${profileName}`,
          matrixGroup,
          profileName,
          runIndex: r,
          pipeline: "PRO",
          idea,
          profile,
        });
      }
    }
  };
  addMatrix("MAT1", MAT1_IDEA, MAT1_PROFILES);
  addMatrix("MAT2", MAT2_IDEA, MAT2_PROFILES);
  addMatrix("MAT3", MAT3_IDEA, MAT3_PROFILES);
  for (let r = 2; r <= 1 + RERUNS_PER_SP1; r++) {
    tests.push({
      id: `SP1-r${r}`,
      baselineId: "SP1",
      matrixGroup: "SP1",
      profileName: "dentist",
      runIndex: r,
      pipeline: "PRO",
      idea: SP1_IDEA,
      profile: SP1_PROFILE,
    });
  }
  return tests;
}

// ============================================
// STREAMING SSE RUNNER — per-event timestamps (not buffered)
// ============================================

async function runEval(test) {
  const ep = test.pipeline === "PRO" ? "/api/analyze-pro" : "/api/analyze";
  const runStart = Date.now();

  const res = await fetch(BASE_URL + ep, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea: test.idea, profile: test.profile }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];
  const eventTimings = [];
  let result = null;
  let errMsg = null;

  const consumeLine = (line) => {
    if (!line.startsWith("data: ")) return;
    const ts = Date.now() - runStart;
    try {
      const d = JSON.parse(line.slice(6));
      events.push(d);
      eventTimings.push(ts);
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
  return { result, events, eventTimings, totalMs: Date.now() - runStart };
}

// ============================================
// EXTRACTION — full capture + retrieval items + stage timings
// ============================================

function extractAll(result, events, eventTimings, totalMs, test) {
  const ev = result.evaluation || {};
  const comp = result.competition || {};
  const pro = result._pro || {};

  // Index events by step (last event wins for a given step — shouldn't matter, each fires once)
  const evMap = {};
  events.forEach((e, i) => {
    if (e.step) evMap[e.step] = { event: e, ts: eventTimings[i] };
  });
  const stageMs = (startStep, endStep) => {
    const s = evMap[startStep]?.ts;
    const t = evMap[endStep]?.ts;
    return s != null && t != null ? t - s : null;
  };
  const pipelineTiming = {
    haiku_ms: stageMs("keywords_start", "keywords_done"),
    retrieval_ms: stageMs("search_start", "evidence_ready"),
    stage1_ms: stageMs("stage1_start", "stage1_done"),
    stage2a_ms: stageMs("stage2a_start", "stage2a_done"),
    stage2b_ms: stageMs("stage2b_start", "stage2b_done"),
    stage3_ms: stageMs("stage3_start", "stage3_done"),
    total_ms: totalMs,
  };

  // Raw retrieval items — opportunistic; populated iff backend emits `results` array
  const githubData = evMap["github_done"]?.event?.data || {};
  const serperData = evMap["serper_done"]?.event?.data || {};
  const retrievalItems = {
    github_count: githubData.count ?? null,
    github_results: Array.isArray(githubData.results) ? githubData.results : null,
    serper_count: serperData.count ?? null,
    serper_results: Array.isArray(serperData.results) ? serperData.results : null,
  };

  // Haiku keywords
  const haikuKeywords = Array.isArray(evMap["keywords_done"]?.event?.data?.keywords)
    ? evMap["keywords_done"].event.data.keywords
    : [];

  return {
    // Meta
    id: test.id,
    baselineId: test.baselineId,
    matrixGroup: test.matrixGroup,
    profileName: test.profileName,
    runIndex: test.runIndex,
    pipeline: test.pipeline,
    profile: test.profile,
    idea: test.idea,
    wordCount: test.idea.trim().split(/\s+/).length,

    // Scores
    scores: {
      md: ev.market_demand?.score ?? null,
      mo: ev.monetization?.score ?? null,
      or: ev.originality?.score ?? null,
      tc: ev.technical_complexity?.score ?? null,
      overall: ev.overall_score ?? null,
    },

    // Confidence
    confidence: {
      level: ev.confidence_level?.level ?? null,
      reason: ev.confidence_level?.reason ?? "",
    },

    // Metric explanations
    metricExplanations: {
      md: ev.market_demand?.explanation ?? "",
      mo: ev.monetization?.explanation ?? "",
      or: ev.originality?.explanation ?? "",
      tc: ev.technical_complexity?.explanation ?? "",
      tcBase: ev.technical_complexity?.base_score_explanation ?? "",
      tcAdjustment: ev.technical_complexity?.adjustment_explanation ?? "",
    },

    // Classification / flags
    classification: result.classification ?? "",
    scopeWarning: result.scope_warning ?? false,
    domainFlags: pro.domain_risk_flags ?? {},

    // Summary + risks
    summary: ev.summary ?? "",
    failureRisks: ev.failure_risks ?? [],

    // Competition
    competition: {
      landscape: comp.landscape_analysis ?? comp.summary ?? "",
      differentiation: comp.differentiation ?? "",
      entryBarriers: comp.entry_barriers ?? "",
      competitors: (comp.competitors ?? []).map(c => ({
        name: c.name ?? "",
        type: c.competitor_type ?? "",
        source: c.source ?? "",
        evidenceStrength: c.evidence_strength ?? "",
        description: c.description ?? "",
        url: c.url ?? "",
      })),
    },

    // Roadmap / tools / estimates
    phases: result.phases ?? ev.phases ?? [],
    tools: result.tools ?? ev.tools ?? [],
    estimates: result.estimates ?? ev.estimates ?? {},
    evidencePackets: pro.evidence_packets ?? null,

    // Expanded variance-test capture
    haikuKeywords,
    retrievalItems,
    pipelineTiming,

    // Event trace (for timing forensics)
    eventTrace: events.map((e, i) => ({
      step: e.step ?? null,
      msFromStart: eventTimings[i],
      message: e.message ?? null,
      dataKeys: e.data ? Object.keys(e.data) : [],
    })),

    // Safety net
    _rawResult: result,
  };
}

// ============================================
// AUDIT BASELINE LOADER — pulls R1 per cell from audit-raw.json
// ============================================

function loadBaseline() {
  if (!fs.existsSync(AUDIT_BASELINE_PATH)) return null;
  let audit;
  try {
    audit = JSON.parse(fs.readFileSync(AUDIT_BASELINE_PATH, "utf8"));
  } catch (e) {
    console.warn(`⚠️  Could not parse audit-raw.json: ${e.message}`);
    return null;
  }
  const baselineByKey = {};
  for (const r of audit) {
    if (!r || r.error) continue;
    if (!r.id) continue;

    // Only keep the cells this diagnostic re-runs (MAT1/MAT2/MAT3/SP1)
    const isTarget =
      r.id.startsWith("MAT1-") || r.id.startsWith("MAT2-") || r.id.startsWith("MAT3-") || r.id === "SP1";
    if (!isTarget) continue;

    // Normalize to variance-record shape
    let matrixGroup = r.matrixGroup || null;
    let profileName = null;
    if (r.id === "SP1") {
      matrixGroup = "SP1";
      profileName = "dentist";
    } else {
      const [mg, ...rest] = r.id.split("-");
      matrixGroup = matrixGroup || mg;
      profileName = rest.join("-");
    }

    const streamEvents = r.streamEvents || [];
    const kwEv = streamEvents.find(e => e.step === "keywords_done");
    const ghEv = streamEvents.find(e => e.step === "github_done");
    const spEv = streamEvents.find(e => e.step === "serper_done");

    baselineByKey[r.id] = {
      id: `${r.id}-r1`,
      baselineId: r.id,
      matrixGroup,
      profileName,
      runIndex: 1,
      pipeline: r.pipeline,
      profile: r.profile,
      idea: r.idea,
      wordCount: r.wordCount ?? null,
      scores: r.scores || {},
      confidence: r.confidence || {},
      metricExplanations: r.metricExplanations || {},
      classification: r.classification || "",
      scopeWarning: r.scopeWarning || false,
      domainFlags: r.domainFlags || {},
      summary: r.summary || "",
      failureRisks: r.failureRisks || [],
      competition: r.competition || { competitors: [] },
      phases: r.phases || [],
      tools: r.tools || [],
      estimates: r.estimates || {},
      evidencePackets: r.evidencePackets || null,
      haikuKeywords: kwEv?.keywords || kwEv?.raw?.data?.keywords || [],
      retrievalItems: {
        github_count: ghEv?.raw?.data?.count ?? null,
        github_results: Array.isArray(ghEv?.raw?.data?.results) ? ghEv.raw.data.results : null,
        serper_count: spEv?.raw?.data?.count ?? null,
        serper_results: Array.isArray(spEv?.raw?.data?.results) ? spEv.raw.data.results : null,
      },
      pipelineTiming: null,  // not reconstructable from audit records
      eventTrace: [],
      _fromAuditBaseline: true,
    };
  }
  return baselineByKey;
}

// ============================================
// ANALYSIS HELPERS
// ============================================

function groupByCell(runs) {
  // Returns: { MAT1: { beginner: [run, run, ...], ... }, MAT2: {...}, MAT3: {...}, SP1: {...} }
  const map = {};
  for (const r of runs) {
    if (!r.matrixGroup || !r.profileName) continue;
    if (!map[r.matrixGroup]) map[r.matrixGroup] = {};
    if (!map[r.matrixGroup][r.profileName]) map[r.matrixGroup][r.profileName] = [];
    map[r.matrixGroup][r.profileName].push(r);
  }
  for (const mg of Object.keys(map)) {
    for (const p of Object.keys(map[mg])) {
      map[mg][p].sort((a, b) => (a.runIndex || 0) - (b.runIndex || 0));
    }
  }
  return map;
}

function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  const inter = new Set([...setA].filter(x => setB.has(x)));
  const uni = new Set([...setA, ...setB]);
  return uni.size === 0 ? 1 : inter.size / uni.size;
}

function competitorSet(run) {
  return new Set(
    (run.competition?.competitors || [])
      .map(c => (c.name || "").toLowerCase().trim())
      .filter(Boolean)
  );
}

function phi(a, b) {
  // Pearson correlation on binary vectors = phi coefficient.
  if (!a.length || a.length !== b.length) return null;
  const n = a.length;
  const mean = arr => arr.reduce((s, x) => s + x, 0) / arr.length;
  const ma = mean(a), mb = mean(b);
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    denA += (a[i] - ma) ** 2;
    denB += (b[i] - mb) ** 2;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? null : +(num / den).toFixed(3);
}

// ─── Q1: MAT2 MO contamination ───
function analyzeQ1_MO(grouped) {
  const mat = grouped["MAT2"] || {};
  const rows = [];
  for (const [profile, runs] of Object.entries(mat)) {
    const mos = runs.map(r => r.scores?.mo).filter(v => typeof v === "number");
    if (!mos.length) continue;
    const min = Math.min(...mos);
    const max = Math.max(...mos);
    const range = +(max - min).toFixed(2);
    const verdict = range > 1.0 ? "SYSTEMATIC" : range < 0.5 ? "stochastic" : "inconclusive";
    rows.push({
      profile,
      runsObserved: runs.map(r => r.runIndex),
      observations: mos,
      min,
      max,
      range,
      verdict,
    });
  }
  return rows;
}

// ─── Q2: MAT1 confidence flip ───
function analyzeQ2_ConfFlip(grouped) {
  const mat = grouped["MAT1"] || {};
  const rows = [];
  for (const [profile, runs] of Object.entries(mat)) {
    const confs = runs.map(r => r.confidence?.level).filter(Boolean);
    const unique = new Set(confs);
    rows.push({
      profile,
      runsObserved: runs.map(r => r.runIndex),
      observations: confs,
      flipped: unique.size > 1,
    });
  }
  return rows;
}

// ─── Q3: MAT3 competitor drift ───
function analyzeQ3_CompDrift(grouped) {
  const mat = grouped["MAT3"] || {};
  const rows = [];
  for (const [profile, runs] of Object.entries(mat)) {
    const sets = runs.map(competitorSet);
    const withinPairs = [];
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        withinPairs.push({
          pair: `r${runs[i].runIndex}↔r${runs[j].runIndex}`,
          jaccard: +jaccard(sets[i], sets[j]).toFixed(2),
        });
      }
    }
    const minJ = withinPairs.length ? Math.min(...withinPairs.map(p => p.jaccard)) : null;
    rows.push({
      profile,
      runs: runs.map(r => ({ runIdx: r.runIndex, competitorCount: (r.competition?.competitors || []).length })),
      withinProfileJaccard: withinPairs,
      minJaccard: minJ,
      drifted: minJ != null && minJ < COMPETITOR_JACCARD_DRIFT,
    });
  }
  return rows;
}

// ─── Q4: cascade correlation ───
function analyzeQ4_Cascade(grouped) {
  const cells = [];
  for (const mg of ["MAT1", "MAT2", "MAT3"]) {
    const mat = grouped[mg] || {};
    for (const [profile, runs] of Object.entries(mat)) {
      if (runs.length < 2) continue;  // Need at least 2 runs to compute within-cell drift

      const mos = runs.map(r => r.scores?.mo).filter(v => typeof v === "number");
      const moRange = mos.length >= 2 ? Math.max(...mos) - Math.min(...mos) : 0;

      const confs = runs.map(r => r.confidence?.level).filter(Boolean);
      const confFlip = new Set(confs).size > 1;

      const sets = runs.map(competitorSet);
      let minJ = 1;
      for (let i = 0; i < sets.length; i++) {
        for (let j = i + 1; j < sets.length; j++) {
          minJ = Math.min(minJ, jaccard(sets[i], sets[j]));
        }
      }

      cells.push({
        matrix: mg,
        profile,
        reruns: runs.length,
        moRange: +moRange.toFixed(2),
        mo_drift: moRange > MO_DRIFT_THRESHOLD ? 1 : 0,
        conf_flip: confFlip ? 1 : 0,
        min_jaccard: +minJ.toFixed(2),
        comp_drift: minJ < COMPETITOR_JACCARD_DRIFT ? 1 : 0,
      });
    }
  }

  const mo = cells.map(c => c.mo_drift);
  const cf = cells.map(c => c.conf_flip);
  const cp = cells.map(c => c.comp_drift);

  const correlations = {
    mo_vs_conf: phi(mo, cf),
    mo_vs_comp: phi(mo, cp),
    conf_vs_comp: phi(cf, cp),
  };

  const nonNull = Object.values(correlations).filter(v => v != null);
  let verdict;
  if (cells.length < 3 || nonNull.length < 3) {
    verdict = "INSUFFICIENT_DATA";
  } else if (nonNull.every(v => v > CASCADE_CORR_THRESHOLD)) {
    verdict = "CASCADE_CONFIRMED";
  } else if (nonNull.some(v => v > CASCADE_CORR_THRESHOLD)) {
    verdict = "PARTIAL_CASCADE";
  } else {
    verdict = "INDEPENDENT_VARIATION";
  }

  const rate = arr => arr.length ? +(arr.reduce((s, x) => s + x, 0) / arr.length).toFixed(2) : 0;
  const coRate = (a, b) => {
    if (!a.length) return 0;
    let co = 0;
    for (let i = 0; i < a.length; i++) if (a[i] && b[i]) co++;
    return +(co / a.length).toFixed(2);
  };

  const rates = {
    mo_drift_rate: rate(mo),
    conf_flip_rate: rate(cf),
    comp_drift_rate: rate(cp),
    mo_and_conf_rate: coRate(mo, cf),
    mo_and_comp_rate: coRate(mo, cp),
    conf_and_comp_rate: coRate(cf, cp),
  };

  return { cells, correlations, rates, verdict };
}

// ─── Retrieval integrity (cascade source localization) ───
function analyzeRetrievalIntegrity(grouped) {
  const rows = [];
  for (const mg of ["MAT1", "MAT2", "MAT3"]) {
    const mat = grouped[mg] || {};
    for (const [profile, runs] of Object.entries(mat)) {
      if (runs.length < 2) continue;

      const kwSets = runs.map(r => new Set((r.haikuKeywords || []).map(k => k.toLowerCase().trim())));
      let minKw = 1;
      for (let i = 0; i < kwSets.length; i++) {
        for (let j = i + 1; j < kwSets.length; j++) {
          minKw = Math.min(minKw, jaccard(kwSets[i], kwSets[j]));
        }
      }

      const hasRetrievalItems = runs.every(r =>
        Array.isArray(r.retrievalItems?.serper_results) && Array.isArray(r.retrievalItems?.github_results)
      );
      let serperJaccard = null, githubJaccard = null;
      if (hasRetrievalItems) {
        const keyOf = (x) => x?.url || x?.link || x?.html_url || x?.full_name || JSON.stringify(x);
        const serperSets = runs.map(r => new Set((r.retrievalItems.serper_results || []).map(keyOf)));
        const githubSets = runs.map(r => new Set((r.retrievalItems.github_results || []).map(keyOf)));
        let minS = 1, minG = 1;
        for (let i = 0; i < serperSets.length; i++) {
          for (let j = i + 1; j < serperSets.length; j++) {
            minS = Math.min(minS, jaccard(serperSets[i], serperSets[j]));
            minG = Math.min(minG, jaccard(githubSets[i], githubSets[j]));
          }
        }
        serperJaccard = +minS.toFixed(2);
        githubJaccard = +minG.toFixed(2);
      }

      rows.push({
        matrix: mg,
        profile,
        minKeywordJaccard: +minKw.toFixed(2),
        hasRetrievalItems,
        serperJaccard,
        githubJaccard,
      });
    }
  }
  return rows;
}

// ============================================
// MARKDOWN GENERATION
// ============================================

function formatAnalysis(runs, q1, q2, q3, q4, retrieval) {
  const out = [];
  const L = (s = "") => out.push(s);
  const T = (headers, rows) => {
    L("| " + headers.join(" | ") + " |");
    L("| " + headers.map(() => "---").join(" | ") + " |");
    for (const r of rows) L("| " + r.map(v => (v == null ? "—" : String(v))).join(" | ") + " |");
  };

  L("# V4S28 — Phase 0 Variance Analysis");
  L();
  L(`Generated: ${new Date().toISOString()}`);
  L(`Runs analyzed: ${runs.length}`);

  const hasBaseline = runs.some(r => r._fromAuditBaseline);
  const hasRetrieval = runs.some(r => Array.isArray(r.retrievalItems?.serper_results));
  L(`Audit baseline (R1) loaded: ${hasBaseline ? "YES" : "NO — only new reruns included"}`);
  L(`Raw retrieval items captured: ${hasRetrieval ? "YES" : "NO — cascade localization will be blurred; apply backend patch and re-run to resolve"}`);
  L();
  L("## Thresholds");
  L(`- MO drift binary (Q4): range > ${MO_DRIFT_THRESHOLD}`);
  L(`- Competitor drift binary (Q4): within-profile min Jaccard < ${COMPETITOR_JACCARD_DRIFT}`);
  L(`- Cascade confirmed verdict: all 3 phi correlations > ${CASCADE_CORR_THRESHOLD}`);
  L();

  // ───────── Run Index ─────────
  L("## Run index");
  L();
  T(
    ["ID", "Matrix", "Profile", "Run", "MD", "MO", "OR", "TC", "Overall", "Conf", "# Competitors"],
    runs.map(r => [
      r.id,
      r.matrixGroup,
      r.profileName,
      r.runIndex,
      r.scores?.md,
      r.scores?.mo,
      r.scores?.or,
      r.scores?.tc,
      r.scores?.overall,
      r.confidence?.level,
      (r.competition?.competitors || []).length,
    ])
  );
  L();

  // ───────── Q1 ─────────
  L("## Q1 — MAT2 MO contamination");
  L();
  L("*Does the 1.5-pt cross-profile MO range from the audit persist across reruns? Range > 1.0 → systematic; < 0.5 → stochastic; in between → inconclusive (add another rerun for that profile).*");
  L();
  T(
    ["Profile", "Runs observed", "MO observations", "Min", "Max", "Range", "Verdict"],
    q1.map(r => [
      r.profile,
      r.runsObserved.map(i => `r${i}`).join(", "),
      r.observations.join(", "),
      r.min,
      r.max,
      r.range,
      `**${r.verdict}**`,
    ])
  );
  L();

  // ───────── Q2 ─────────
  L("## Q2 — MAT1 confidence flip persistence");
  L();
  L("*Does the confidence-level variation from the audit persist across reruns of the same (MAT1, profile) pair?*");
  L();
  T(
    ["Profile", "Runs observed", "Confidence observations", "Flipped?"],
    q2.map(r => [
      r.profile,
      r.runsObserved.map(i => `r${i}`).join(", "),
      r.observations.join(" → "),
      r.flipped ? "**YES**" : "no",
    ])
  );
  L();

  // ───────── Q3 ─────────
  L("## Q3 — MAT3 competitor drift persistence");
  L();
  L("*Within the same (MAT3, profile) cell, how much does the competitor list change across reruns? Jaccard similarity of competitor-name sets. < 0.7 → meaningful drift.*");
  L();
  for (const r of q3) {
    const runSummary = r.runs.map(x => `r${x.runIdx}: ${x.competitorCount}`).join(", ");
    L(`**${r.profile}** — competitor counts (${runSummary}); min within-profile Jaccard = **${r.minJaccard != null ? r.minJaccard.toFixed(2) : "—"}** (${r.drifted ? "DRIFTED" : "stable"})`);
    for (const p of r.withinProfileJaccard) L(`  - ${p.pair}: Jaccard ${p.jaccard}`);
    L();
  }

  // ───────── Q4 — THE KEY TEST ─────────
  L("## Q4 — Cascade correlation (KEY TEST)");
  L();
  L("*If MO contamination + confidence flip + competitor drift all co-vary across (matrix × profile) cells, the three findings share a common upstream cause — Stage 1 profile contamination — and the Stage 1 profile strip handles all three. If they vary independently, each needs a separate fix.*");
  L();
  L("### Per-cell binary signals");
  L();
  T(
    ["Matrix", "Profile", "Reruns", "MO range", "MO drift?", "Conf flip?", "Min comp Jaccard", "Comp drift?"],
    q4.cells.map(c => [
      c.matrix,
      c.profile,
      c.reruns,
      c.moRange,
      c.mo_drift ? "**Y**" : "n",
      c.conf_flip ? "**Y**" : "n",
      c.min_jaccard,
      c.comp_drift ? "**Y**" : "n",
    ])
  );
  L();
  L("### Independent drift rates");
  L();
  T(
    ["Signal", "Rate (cells with drift)"],
    [
      ["MO drift", q4.rates.mo_drift_rate],
      ["Confidence flip", q4.rates.conf_flip_rate],
      ["Competitor drift", q4.rates.comp_drift_rate],
    ]
  );
  L();
  L("### Co-drift rates (observed vs independence baseline)");
  L();
  T(
    ["Signal pair", "Observed co-drift", "Independence baseline (A × B)"],
    [
      ["MO ∧ Conf", q4.rates.mo_and_conf_rate, +(q4.rates.mo_drift_rate * q4.rates.conf_flip_rate).toFixed(2)],
      ["MO ∧ Comp", q4.rates.mo_and_comp_rate, +(q4.rates.mo_drift_rate * q4.rates.comp_drift_rate).toFixed(2)],
      ["Conf ∧ Comp", q4.rates.conf_and_comp_rate, +(q4.rates.conf_flip_rate * q4.rates.comp_drift_rate).toFixed(2)],
    ]
  );
  L();
  L("*Observed co-drift meaningfully above the independence baseline is a stronger signal than simple co-occurrence count.*");
  L();
  L("### Phi correlation coefficients");
  L();
  const phiRow = (label, v) => [label, v ?? "—", (v != null && v > CASCADE_CORR_THRESHOLD) ? "**YES**" : "no"];
  T(
    ["Signal pair", "Phi", `> ${CASCADE_CORR_THRESHOLD}?`],
    [
      phiRow("MO vs Conf", q4.correlations.mo_vs_conf),
      phiRow("MO vs Comp", q4.correlations.mo_vs_comp),
      phiRow("Conf vs Comp", q4.correlations.conf_vs_comp),
    ]
  );
  L();
  L(`### Verdict: **${q4.verdict}**`);
  L();
  L("**Interpretation:**");
  L("- `CASCADE_CONFIRMED`: All 3 phi correlations > threshold. Stage 1 profile strip handles all three findings; P6-S1 and P8-S2 drop from V4S28 scope.");
  L("- `PARTIAL_CASCADE`: Some phi > threshold, some not. Stage 1 strip ships anyway; additional targeted fixes needed for the independent findings.");
  L("- `INDEPENDENT_VARIATION`: No correlation above threshold. Each finding requires its own fix; cascade hypothesis does not hold.");
  L("- `INSUFFICIENT_DATA`: Too few cells with measurable variance to compute phi reliably.");
  L();

  // ───────── Retrieval integrity ─────────
  L("## Retrieval integrity (cascade source localization)");
  L();
  L("*Within each (matrix, profile) cell, are the Haiku keywords and raw retrieval items identical across reruns? If retrieval is deterministic but the downstream competitor list drifts → the leak is in Stage 1 synthesis (profile strip fixes it). If retrieval itself varies → some of the observed drift is upstream noise, not profile leak.*");
  L();
  T(
    ["Matrix", "Profile", "Keyword Jaccard (min)", "Serper item Jaccard (min)", "GitHub item Jaccard (min)"],
    retrieval.map(r => [
      r.matrix,
      r.profile,
      r.minKeywordJaccard,
      r.hasRetrievalItems ? r.serperJaccard : "N/A (no backend patch)",
      r.hasRetrievalItems ? r.githubJaccard : "N/A (no backend patch)",
    ])
  );
  L();
  L("*If Serper/GitHub Jaccard is consistently high (>0.9) but competitor drift is still present → cascade localizes cleanly to Stage 1 synthesis. If retrieval Jaccard is low (<0.7) → retrieval itself is a source of variance and some observed cross-profile drift is upstream noise rather than profile leak.*");
  L();

  L("---");
  L();
  L("Full per-run data with all evaluation fields, event traces, and per-stage timings: `variance-raw.json`.");
  L();
  return out.join("\n");
}

// ============================================
// MAIN
// ============================================

async function preflight() {
  try {
    const r = await fetch(BASE_URL, { method: "GET" });
    // Any response (including 404) means the server is up.
    return true;
  } catch (e) {
    console.error(`\nCannot reach server at ${BASE_URL}.`);
    console.error(`Error: ${e.message}`);
    console.error(`\nMake sure your Next.js dev server is running:  npm run dev\n`);
    return false;
  }
}

async function main() {
  const tests = buildTests();
  const total = tests.length;
  const matCount = tests.filter(t => t.matrixGroup !== "SP1").length;
  const spCount = tests.filter(t => t.matrixGroup === "SP1").length;

  console.log("=".repeat(80));
  console.log("V4S28 — PHASE 0 VARIANCE DIAGNOSTIC");
  console.log(`${total} new runs  (${matCount} MAT + ${spCount} SP1)`);
  console.log(`Estimated wall time: ~${Math.round(total * 2)}-${Math.round(total * 2.5)} minutes`);
  console.log("=".repeat(80) + "\n");

  if (!(await preflight())) process.exit(1);

  const baseline = loadBaseline();
  if (baseline) {
    const n = Object.keys(baseline).length;
    console.log(`✓ Loaded audit baseline: ${n} MAT/SP runs available as R1.\n`);
  } else {
    console.log("ℹ  No audit-raw.json found — analyzing new reruns only (no R1 baseline).\n");
  }

  const runs = [];
  const t0 = Date.now();
  let done = 0;
  for (const test of tests) {
    done++;
    const tStart = Date.now();
    process.stdout.write(`[${String(done).padStart(2, " ")}/${total}] ${test.id.padEnd(30)} `);
    try {
      const { result, events, eventTimings, totalMs } = await runEval(test);
      const extracted = extractAll(result, events, eventTimings, totalMs, test);
      const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
      const s = extracted.scores;
      const capturedRetrieval = Array.isArray(extracted.retrievalItems.serper_results);
      console.log(
        `✅ ${elapsed}s  MD:${s.md} MO:${s.mo} OR:${s.or} TC:${s.tc} → ${s.overall}  [${extracted.confidence.level}]  comp:${extracted.competition.competitors.length}${capturedRetrieval ? "" : "  (retrieval items not captured)"}`
      );
      runs.push(extracted);
    } catch (e) {
      const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
      console.log(`❌ FAILED (${elapsed}s) — ${e.message}`);
      runs.push({
        id: test.id,
        baselineId: test.baselineId,
        matrixGroup: test.matrixGroup,
        profileName: test.profileName,
        runIndex: test.runIndex,
        error: e.message,
      });
    }
  }

  // Merge baseline R1 with new runs for analysis
  const successful = runs.filter(r => !r.error);
  const allRuns = [];
  if (baseline) {
    const needed = new Set(successful.map(r => r.baselineId).filter(Boolean));
    for (const k of needed) {
      if (baseline[k]) allRuns.push(baseline[k]);
    }
  }
  allRuns.push(...successful);

  // Analyze
  const grouped = groupByCell(allRuns);
  const q1 = analyzeQ1_MO(grouped);
  const q2 = analyzeQ2_ConfFlip(grouped);
  const q3 = analyzeQ3_CompDrift(grouped);
  const q4 = analyzeQ4_Cascade(grouped);
  const retrieval = analyzeRetrievalIntegrity(grouped);

  // Write outputs
  const rawPath = path.join(OUTPUT_DIR, "variance-raw.json");
  fs.writeFileSync(rawPath, JSON.stringify(runs, null, 2));
  const rawKB = Math.round(fs.statSync(rawPath).size / 1024);

  const mdPath = path.join(OUTPUT_DIR, "variance-analysis.md");
  fs.writeFileSync(mdPath, formatAnalysis(allRuns, q1, q2, q3, q4, retrieval));
  const mdKB = Math.round(fs.statSync(mdPath).size / 1024);

  const totalElapsed = ((Date.now() - t0) / 60000).toFixed(1);
  const failed = runs.filter(r => r.error).length;

  console.log("\n" + "=".repeat(80));
  console.log(`Completed in ${totalElapsed} min. Succeeded: ${total - failed}/${total}.`);
  console.log(`✓ ${rawPath}  (${rawKB} KB)`);
  console.log(`✓ ${mdPath}  (${mdKB} KB)`);
  console.log("=".repeat(80));
  console.log(`\nQ4 verdict: ${q4.verdict}`);
  console.log(`Phi correlations:`);
  console.log(`  MO vs Conf:   ${q4.correlations.mo_vs_conf ?? "—"}`);
  console.log(`  MO vs Comp:   ${q4.correlations.mo_vs_comp ?? "—"}`);
  console.log(`  Conf vs Comp: ${q4.correlations.conf_vs_comp ?? "—"}`);
  console.log(`\nNext: review variance-analysis.md end-to-end to finalize V4S28 scope.\n`);
}

main().catch(err => {
  console.error("\nFATAL:", err.message);
  console.error(err.stack);
  process.exit(1);
});

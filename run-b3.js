// ============================================
// IDEALOOP CORE — V4S28 BUNDLE B3 TARGETED VERIFIER (v2 — case-aware, comprehensive)
// ============================================
//
// Comprehensive variance characterization for B3 closure decision.
//
// Total: 17 test cases / 38 runs / ~60-70 min wall time
//
// Variance distribution (deliberately weighted toward under-tested cases):
//   - Founder-fit cases: 18 runs across 8 tests
//   - Alignment cases: 12 runs across 5 tests (A: 2, B: 6, C: 3, plus borderline ANTI-TC)
//   - Layered cases: 7 runs across 2 tests (E-LAYERED × 4 + E-PRIORITY-COMPLIANCE × 3)
//   - Sparse handling: 5 runs across 2 tests (T-SPEC × 3 Pro + E-FREE-TIER-SPEC × 2 Free)
//
// Closure thresholds (set BEFORE running per methodology):
//   - Per-run pass rate ≥ 90% (35/38 minimum)
//   - All variance groups design-faithful (every run matches some validOutcome)
//   - Layered cases ≥ 80% design-faithful (5/6 minimum on E-LAYERED + E-PRIORITY-COMPLIANCE
//     LAYERED-detected runs combined; cases that drop to founder_fit don't count against)
//   - No section-name leaks (38/38 on prose hygiene)
//   - MAT1 duration ordering still holds (senior < beginner upper bounds)
//   - F2 closure: ≥ 2 distinct chips across MAT3 first-run trio
//
// All thresholds met → B3 closes with comprehensive evidence.
// Any threshold missed → triage, possibly strike one prompt patch.
//
// What changed from v1:
//   - Case-aware evaluation per Section 4 lock (execution-plan-v4-2.md lines 627-631).
//     Each run is classified into one of three relational cases (Alignment, Layered,
//     Founder-fit) based on Risk 3 archetype + Main Bottleneck enum + a fixed
//     archetype-to-enum mapping. Verdict is whether the case matches a design-faithful
//     `validOutcome` declared per test.
//   - Removed the "MAT1-all-Technical-build" cross-case check (it was conceptually
//     wrong — the design explicitly allows different MAT1 profiles to land on
//     different Main Bottleneck values when their founder_fit firings differ).
//   - F2 closure check kept (user-visible outcome of the audit's headline-equivalence
//     finding — three different MAT3 profiles should not produce identical chips).
//   - Bumped repeats on under-tested cases:
//       T-TRUST × 2 → × 3 (only archetype-C samples in suite)
//       T-COMPLIANCE × 1 → × 2 (Founder-fit Compliance validation)
//       T-SPEC × 2 → × 3 (sparse structural confidence)
//       MAT3-partial × 2 → × 3 (most ambiguous MAT3 case)
//       MAT1-* × 1 → × 2 each (per-case variance across alignment-A / founder-fit / alignment-B)
//       ANTI-TC × 2 → × 5 (borderline Stage 2c domain match characterization)
//       E-LAYERED × 1 → × 4 (heaviest sampling — Layered case is the under-tested relational case)
//       E-PRIORITY-COMPLIANCE × 1 → × 3 (priority rule + Layered)
//       E-MARKETPLACE × 1 → × 2 (Distribution typology)
//       E-FREE-TIER-SPEC × 1 → × 2 (Free pipeline)
//   - Two modes:
//       node run-b3.js              — fresh SSE run (default)
//       node run-b3.js --reeval PATH — re-evaluate an existing JSON dump
//                                       (skips all SSE calls — instant verdict)
//
// Design map for case detection (archetype → aligned-MB-enum):
//   A (Technical execution gap)     ↔ "Technical build"
//   B (Buyer access gap)            ↔ "Buyer access"
//   C (Domain credibility gap)      ↔ "Trust/credibility"
//   D (Capital/runway gap)          ↔ ambiguous (no clean enum mapping; routes to Layered)
//   E (Sales/conversion gap)        ↔ ambiguous (Buyer access / Distribution / Monetization /
//                                                Trust/credibility — context-dependent; routes to Layered)
//
// Case detection rule:
//   - founder_fit slot absent  → Founder-fit case (Risk 3 null, MB stands alone)
//   - founder_fit slot present, archetype maps to MB enum  → Alignment case
//   - founder_fit slot present, archetype DOES NOT map to MB enum  → Layered case
//
// ============================================

const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = __dirname;

const ARCHETYPE_TO_ALIGNED_ENUM = {
  A: ["Technical build"],
  B: ["Buyer access"],
  C: ["Trust/credibility"],
  // D and E are deliberately empty — these archetypes have no clean canonical
  // alignment with a single MB enum. Any D or E firing routes to Layered case
  // detection by default; per-test validOutcomes can declare layered+specific-MB
  // combinations that are design-faithful for that test scenario.
  // - D (Capital/runway gap): could pair with Compliance, Distribution, Buyer access
  //   depending on the specific capital-blocking constraint.
  // - E (Sales/conversion gap): could pair with Buyer access (reach), Distribution
  //   (scale), Monetization (willingness-to-pay), or Trust/credibility (proof gating).
  // Coverage gap noted in handoff: archetypes C+D+E rarely fire in seed bank;
  // authored test pairs needed before B10 launch gate to validate D/E routing.
  D: [],
  E: [],
};

const VALID_ENUM = new Set([
  "Technical build", "Buyer access", "Trust/credibility", "Compliance",
  "Distribution", "Data acquisition", "Category maturation", "Specification",
]);

// ============================================
// IDEAS + PROFILES
// ============================================

const MAT1_IDEA = "AI-powered document automation tool for small law firms (under 20 attorneys). Ingests client intake forms, generates draft engagement letters, retainer agreements, and client memos based on firm templates. Integrates with Clio. $299/month per firm.";

const MAT3_IDEA = "Platform that helps rural hospitals (under 100 beds) negotiate better rates with medical device suppliers by aggregating purchasing data across member hospitals. Members pay $24,000/year. Value prop: average 12% reduction in device spend, which pays for membership 10x over. Requires buy-in from hospital CFOs and procurement directors.";

const TRUST_CLINICAL_IDEA = "AI-powered clinical decision support tool for primary care physicians. Reviews patient symptoms, history, and recent labs to suggest differential diagnoses ranked by likelihood, flagging conditions the physician may not have considered. Integrates with EMRs (Epic, Cerner). $499/month per physician seat. Outputs are decision-influencing — physicians act on the suggestions.";

const COMPLIANCE_MEDDEVICE_IDEA = "AI-driven echocardiogram analysis tool that detects early-stage heart valve disease from standard echo videos. Designed for cardiologists in outpatient practices. Analyzes the video and outputs measurements + suspected pathologies. Marketed as a clinical diagnostic aid — requires FDA 510(k) clearance to be sold for clinical use. $1,200/month per practice.";

const DISTRIBUTION_CONSUMER_IDEA = "Social fitness app where friends compete on weekly step counts, workout consistency, and active minutes. AI matchmaker groups users by activity level and goals. Push-notification challenges and shared streaks. Free with $4.99/month premium tier (advanced analytics, custom challenges, no ads). Targets 25-40 year-olds with existing fitness habits looking for accountability.";

const DATA_ACQUISITION_IDEA = "Salary benchmarking platform for software engineers that aggregates real compensation data via verified contributors who submit offer letters or pay stubs. Free for contributors (who get full access in exchange), paid for browsers without contributing ($39/month). Quality depends on having 30,000+ verified submissions per role/region/level to be useful. Pitch is: more granular than levels.fyi, more verified than Glassdoor.";

const CATEGORY_MATURATION_IDEA = "Autonomous AI research agent that conducts multi-day investigations on complex questions and produces literature reviews for academic researchers in the social sciences. Uses tool-use + browsing + retrieval over academic databases. Outputs annotated bibliographies and structured argument maps. $129/month per researcher. Replaces 20-40 hours of manual lit-review work per investigation.";

const FINANCIAL_ADVISOR_IDEA = "AI-powered financial advisor that gives personalized buy/sell/hold recommendations to retail investors based on their portfolio, risk tolerance, and life goals. Suggestions are decision-influencing — users act on them. Subscription is $49/month for retail clients. Operating in the US requires SEC registration as a Registered Investment Adviser (RIA), FINRA broker-dealer registration for any execution flow, plus SOC2 Type II for client trust on financial data handling.";

const MARKETPLACE_IDEA = "Two-sided marketplace connecting freelance copywriters with small businesses (under 50 employees). Businesses post short copy projects (product descriptions, email sequences, landing page copy), copywriters bid or accept fixed-rate listings. 15% take rate on completed projects. Quality depends on having both sides simultaneously active — businesses won't post without copywriters available, copywriters won't sign up without projects flowing. $99/month minimum spend for businesses to maintain a posting account.";

const SP1_IDEA = "tool for dentists to save time";

// ============================================
// TEST CASES — case-aware validOutcomes
// ============================================

const TESTS = [
  {
    id: "T-TECH",
    repeats: 3,
    pipeline: "PRO",
    idea: MAT3_IDEA,
    profile: { coding: "No coding experience", ai: "Some AI experience", education: "Former rural hospital CFO (15 years), 80+ exec relationships" },
    purpose: "MAT3-insider — CFO + hospital domain MATCH. Founder-fit case expected, MB stands alone as idea-intrinsic.",
    validOutcomes: [
      { case: "founder_fit", mb: "Trust/credibility", label: "idea-intrinsic Trust (rural hospitals must displace GPO relationships)" },
      { case: "founder_fit", mb: "Buyer access", label: "idea-intrinsic Buyer access (alternative idea-level reading)" },
      { case: "founder_fit", mb: "Distribution", label: "idea-intrinsic Distribution (network density across hospitals)" },
    ],
  },

  {
    id: "T-BUYER",
    repeats: 3,
    pipeline: "PRO",
    idea: MAT3_IDEA,
    profile: { coding: "Advanced", ai: "Advanced AI user", education: "Staff engineer at healthtech startup (8 years), built procurement tools for enterprise" },
    purpose: "MAT3-tech-no-access — engineer with adjacent procurement experience but no hospital network. Alignment case expected.",
    validOutcomes: [
      { case: "alignment", archetype: "B", mb: "Buyer access", label: "archetype B + Buyer access (engineer lacks hospital network)" },
      { case: "founder_fit", mb: "Buyer access", label: "if Stage 2c reads procurement-tools-experience as domain match" },
      { case: "founder_fit", mb: "Trust/credibility", label: "if Stage 2c drops founder_fit, idea-intrinsic Trust" },
    ],
  },

  {
    id: "MAT3-partial",
    repeats: 3, // bumped from 2 — most ambiguous MAT3 case (borderline domain match)
    pipeline: "PRO",
    idea: MAT3_IDEA,
    profile: { coding: "Intermediate", ai: "Regular AI user", education: "Former consultant at hospital purchasing group (3 years), now building SaaS" },
    purpose: "MAT3-partial — partial domain credibility (3yr consultant). Either Founder-fit or Alignment plausible.",
    validOutcomes: [
      { case: "founder_fit", mb: "Trust/credibility", label: "Stage 2c reads consultant background as domain match, idea-intrinsic Trust" },
      { case: "founder_fit", mb: "Buyer access", label: "alternative idea-intrinsic reading" },
      { case: "alignment", archetype: "B", mb: "Buyer access", label: "Stage 2c flags consultant network as insufficient, archetype B fires" },
      { case: "alignment", archetype: "C", mb: "Trust/credibility", label: "Stage 2c flags partial credibility, archetype C fires" },
    ],
  },

  {
    id: "T-TRUST",
    repeats: 3, // bumped from 2 — only archetype-C samples in the suite
    pipeline: "PRO",
    idea: TRUST_CLINICAL_IDEA,
    profile: { coding: "Advanced", ai: "Advanced AI user", education: "Senior software engineer (10 years) at healthtech startup, no clinical credentials" },
    purpose: "Clinical decision support + non-credentialed engineer. Alignment expected (archetype C for credibility gap).",
    validOutcomes: [
      { case: "alignment", archetype: "C", mb: "Trust/credibility", label: "archetype C + Trust/credibility (no clinical credentials)" },
      { case: "alignment", archetype: "B", mb: "Buyer access", label: "if Stage 2c reads as buyer access gap rather than credibility" },
      { case: "layered", mb: "Compliance", label: "if model elevates regulatory framing over trust" },
    ],
  },

  {
    id: "T-COMPLIANCE",
    repeats: 2, // bumped from 1 — Founder-fit Compliance validation
    pipeline: "PRO",
    idea: COMPLIANCE_MEDDEVICE_IDEA,
    profile: { coding: "Advanced", ai: "Advanced AI user (fine-tuning LLMs)", education: "Senior ML engineer at medical-imaging AI company (6 years), some clinical research collaboration experience" },
    purpose: "FDA-gated medical device + medical-imaging ML engineer. Founder-fit (domain match), MB Compliance (idea-intrinsic).",
    validOutcomes: [
      { case: "founder_fit", mb: "Compliance", label: "idea-intrinsic Compliance (FDA 510k binary gate)" },
      { case: "layered", archetype: "C", mb: "Compliance", label: "if Stage 2c flags partial clinical credibility, Compliance still wins per priority rule" },
    ],
  },

  {
    id: "T-DIST",
    repeats: 1,
    pipeline: "PRO",
    idea: DISTRIBUTION_CONSUMER_IDEA,
    profile: { coding: "Advanced", ai: "Regular AI user", education: "Senior mobile engineer (10 years), shipped multiple consumer apps with 100K+ users each" },
    purpose: "Consumer fitness app + senior mobile engineer with consumer apps experience. Founder-fit, MB Distribution.",
    validOutcomes: [
      { case: "founder_fit", mb: "Distribution", label: "idea-intrinsic Distribution (organic growth + network density)" },
      { case: "founder_fit", mb: "Category maturation", label: "alternative reading" },
    ],
  },

  {
    id: "T-DATA",
    repeats: 1,
    pipeline: "PRO",
    idea: DATA_ACQUISITION_IDEA,
    profile: { coding: "Advanced", ai: "Some AI experience", education: "Senior data engineer (7 years) at compensation data company" },
    purpose: "Salary benchmarking + comp-data engineer. Founder-fit, MB Data acquisition.",
    validOutcomes: [
      { case: "founder_fit", mb: "Data acquisition", label: "idea-intrinsic Data acquisition" },
      { case: "founder_fit", mb: "Distribution", label: "alternative chicken-and-egg reading" },
    ],
  },

  {
    id: "T-CATEGORY",
    repeats: 1,
    pipeline: "PRO",
    idea: CATEGORY_MATURATION_IDEA,
    profile: { coding: "Advanced", ai: "Advanced AI user (builds production agent systems)", education: "Senior ML engineer (8 years), specialized in agent orchestration" },
    purpose: "Bleeding-edge AI research agent + senior ML engineer. Founder-fit, MB Category maturation or Trust/credibility.",
    validOutcomes: [
      { case: "founder_fit", mb: "Category maturation", label: "idea-intrinsic Category maturation" },
      { case: "founder_fit", mb: "Trust/credibility", label: "alternative (academic trust in AI outputs)" },
    ],
  },

  {
    id: "T-SPEC",
    repeats: 3, // bumped from 2 — sparse handling structural confidence
    pipeline: "PRO",
    idea: SP1_IDEA,
    profile: { coding: "Beginner", ai: "No AI experience", education: "Dentist" },
    purpose: "Sparse input. Specification rule fires; founder_fit drops per sparse rule.",
    expectSparse: true,
    validOutcomes: [
      { case: "founder_fit", mb: "Specification", label: "sparse-input Specification with sparse duration/difficulty" },
    ],
  },

  {
    id: "MAT1-beginner",
    repeats: 2, // bumped from 1 — alignment-A case variance
    pipeline: "PRO",
    idea: MAT1_IDEA,
    profile: { coding: "No coding experience", ai: "Some AI experience", education: "Paralegal (6 years), Airtable builder" },
    purpose: "Legal doc automation + paralegal with no coding. Alignment (archetype A — Technical execution gap).",
    validOutcomes: [
      { case: "alignment", archetype: "A", mb: "Technical build", label: "archetype A + Technical build (no coding capability)" },
      { case: "founder_fit", mb: "Trust/credibility", label: "if Stage 2c treats paralegal experience as full domain match" },
    ],
  },

  {
    id: "MAT1-intermediate",
    repeats: 2, // bumped from 1 — founder-fit case variance
    pipeline: "PRO",
    idea: MAT1_IDEA,
    profile: { coding: "Intermediate", ai: "Regular AI user", education: "Paralegal (6 years), bootcamp grad, shipped personal project" },
    purpose: "Legal doc automation + paralegal-bootcamp. DEEP DOMAIN MATCH per TC rubric. Founder-fit case.",
    validOutcomes: [
      { case: "founder_fit", mb: "Trust/credibility", label: "idea-intrinsic Trust (attorney sign-off)" },
      { case: "founder_fit", mb: "Technical build", label: "alternative if model weights TC as binding" },
      { case: "founder_fit", mb: "Buyer access", label: "alternative if model weights small-firm reach" },
    ],
  },

  {
    id: "MAT1-senior",
    repeats: 2, // bumped from 1 — alignment-B case variance
    pipeline: "PRO",
    idea: MAT1_IDEA,
    profile: { coding: "Advanced", ai: "Advanced AI user (fine-tuning LLMs)", education: "Staff engineer at LegalTech company (5 years, doc automation features)" },
    purpose: "Legal doc automation + LegalTech engineer. Stage 2c judgment: domain match or buyer access gap?",
    validOutcomes: [
      { case: "alignment", archetype: "B", mb: "Buyer access", label: "archetype B + Buyer access" },
      { case: "founder_fit", mb: "Trust/credibility", label: "if Stage 2c reads LegalTech as domain match" },
      { case: "founder_fit", mb: "Buyer access", label: "if domain match but idea-intrinsic still Buyer access" },
    ],
  },

  {
    id: "ANTI-TC",
    repeats: 5, // bumped from 2 — variance characterization on borderline Stage 2c domain match
    pipeline: "PRO",
    idea: TRUST_CLINICAL_IDEA,
    profile: { coding: "Advanced", ai: "Advanced AI user (fine-tuning LLMs, deployed production systems)", education: "Staff ML engineer at top-tier AI company (12 years)" },
    purpose: "Anti-collapse + Stage 2c borderline domain match (top AI co. → clinical: match or no match?). Both relational cases valid.",
    expectAntiCollapse: true,
    validOutcomes: [
      { case: "founder_fit", mb: "Trust/credibility", label: "Stage 2c drops founder_fit (top AI co. = adequate domain alignment), idea-intrinsic Trust" },
      { case: "alignment", archetype: "B", mb: "Buyer access", label: "Stage 2c fires archetype B (no clinical relationships specifically), Alignment" },
      { case: "alignment", archetype: "C", mb: "Trust/credibility", label: "alternative if Stage 2c reads as credibility-gap rather than buyer-access" },
    ],
  },

  {
    id: "E-LAYERED",
    repeats: 4, // bumped from 1 — Layered case is the under-tested relational case, deserves heaviest sampling
    pipeline: "PRO",
    idea: COMPLIANCE_MEDDEVICE_IDEA,
    profile: { coding: "Advanced", ai: "Advanced AI user (production ML systems)", education: "Senior ML engineer at consumer tech company (Twitter/Meta-scale, 10 years), zero medical industry network or clinical context" },
    purpose: "FDA medical device + non-medical engineer. Layered case expected (idea-intrinsic Compliance, founder gap is buyer/credibility).",
    validOutcomes: [
      { case: "layered", archetype: "C", mb: "Compliance", label: "Layered: archetype C + idea-intrinsic Compliance" },
      { case: "layered", archetype: "B", mb: "Compliance", label: "Layered: archetype B + idea-intrinsic Compliance" },
    ],
  },

  {
    id: "E-PRIORITY-COMPLIANCE",
    repeats: 3, // bumped from 1 — priority rule + Layered case validation
    pipeline: "PRO",
    idea: FINANCIAL_ADVISOR_IDEA,
    profile: { coding: "Advanced", ai: "Some AI experience", education: "Senior fintech engineer (8 years) at regulated trading firm, no broker/dealer license" },
    purpose: "Financial advisor + fintech engineer. Both Compliance and Trust apply — priority rule says Compliance wins.",
    validOutcomes: [
      { case: "layered", archetype: "B", mb: "Compliance", label: "Layered: archetype B + Compliance (priority wins)" },
      { case: "layered", archetype: "C", mb: "Compliance", label: "alternative archetype + Compliance" },
      { case: "founder_fit", mb: "Compliance", label: "if Stage 2c reads fintech as full domain match, idea-intrinsic Compliance" },
    ],
  },

  {
    id: "E-MARKETPLACE",
    repeats: 2, // bumped from 1 — Distribution typology validation
    pipeline: "PRO",
    idea: MARKETPLACE_IDEA,
    profile: { coding: "Advanced", ai: "Regular AI user", education: "Senior product engineer (10 years) with consumer marketplace experience (worked at Etsy-like platform)" },
    purpose: "Marketplace cold-start + marketplace engineer. Founder-fit, MB Distribution.",
    validOutcomes: [
      { case: "founder_fit", mb: "Distribution", label: "idea-intrinsic Distribution (two-sided liquidity)" },
      { case: "founder_fit", mb: "Buyer access", label: "alternative reading" },
    ],
  },

  {
    id: "E-FREE-TIER-SPEC",
    repeats: 2, // bumped from 1 — Free pipeline confidence
    pipeline: "FREE",
    idea: SP1_IDEA,
    profile: { coding: "Beginner", ai: "No AI experience", education: "Dentist" },
    purpose: "Free tier sparse — validates prompt.js B3 changes.",
    expectSparse: true,
    validOutcomes: [
      { case: "founder_fit", mb: "Specification", label: "Free tier sparse handling" },
    ],
  },
];

// ============================================
// SSE RUNNER
// ============================================

async function runEval(test) {
  const ep = test.pipeline === "PRO" ? "/api/analyze-pro" : "/api/analyze";
  const res = await fetch(BASE_URL + ep, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea: test.idea, profile: test.profile }),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const text = await res.text();

  let result = null, error = null;
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const d = JSON.parse(line.slice(6));
      if (d.step === "complete" && d.data) result = d.data;
      else if (d.step === "error") error = d.message;
    } catch (e) { /* skip malformed */ }
  }
  if (error) throw new Error(error);
  if (!result) throw new Error("No result");
  return result;
}

// ============================================
// HELPERS
// ============================================

function parseDurationMonths(s) {
  if (!s || typeof s !== "string") return null;
  const lower = s.toLowerCase();
  if (lower.includes("cannot estimate") || lower.includes("n/a")) return null;
  const yearsMatch = lower.match(/(\d+)\s*(?:-|to|–)\s*(\d+)\s*year/);
  if (yearsMatch) return parseInt(yearsMatch[2], 10) * 12;
  const yearMatch = lower.match(/(\d+)\s*year/);
  if (yearMatch) return parseInt(yearMatch[1], 10) * 12;
  const monthsMatch = lower.match(/(\d+)\s*(?:-|to|–)\s*(\d+)\s*month/);
  if (monthsMatch) return parseInt(monthsMatch[2], 10);
  const monthMatch = lower.match(/(\d+)\s*month/);
  if (monthMatch) return parseInt(monthMatch[1], 10);
  return null;
}

const SECTION_NAME_REFS = [
  /\brisk\s*3\b/i, /\bfailure_risks\b/i, /\bfounder_fit\s+slot\b/i,
  /\bthe\s+founder.fit\s+entry\b/i, /\bas\s+the\s+failure_risks\b/i,
  /\bper\s+the\s+founder.fit\b/i, /\bas\s+risk\s+(?:3|three)\b/i,
];

function checkSectionNameRefs(text) {
  if (!text) return null;
  for (const re of SECTION_NAME_REFS) if (re.test(text)) return re.toString();
  return null;
}

const TC_FIRST_OPENING = /^the\s+technical\s+complexity\s+score\s+of\s+\d+(?:\.\d+)?\s+combined\s+with/i;

function isTcFirstOpening(explanation) {
  if (!explanation) return false;
  return TC_FIRST_OPENING.test(explanation.substring(0, 140).trim());
}

// ============================================
// CASE DETECTION
// ============================================

function detectCase(result) {
  const ev = result.evaluation || {};
  const risks = ev.failure_risks || [];
  const ff = risks.find(r => r.slot === "founder_fit");
  const mb = result.estimates?.main_bottleneck || null;

  if (!ff) return { case: "founder_fit", archetype: null, mb, ffText: null };
  const archetype = ff.archetype || null;
  const aligned = archetype ? (ARCHETYPE_TO_ALIGNED_ENUM[archetype] || []) : [];
  if (aligned.includes(mb)) return { case: "alignment", archetype, mb, ffText: ff.text || null };
  return { case: "layered", archetype, mb, ffText: ff.text || null };
}

function matchValidOutcome(detected, validOutcomes) {
  for (const vo of validOutcomes) {
    if (vo.case !== detected.case) continue;
    if (vo.mb !== detected.mb) continue;
    if (vo.case === "alignment" && vo.archetype && vo.archetype !== detected.archetype) continue;
    if (vo.case === "layered" && vo.archetype && vo.archetype !== detected.archetype) continue;
    return vo;
  }
  return null;
}

// ============================================
// EVALUATE
// ============================================

function evaluate(test, result) {
  const verdicts = [];
  const estimates = result.estimates || {};
  const mb = estimates.main_bottleneck;
  const mbExplanation = estimates.main_bottleneck_explanation || "";
  const explanation = estimates.explanation || "";

  if (!mb) verdicts.push({ label: "main_bottleneck present", pass: false, detail: "field missing" });
  else if (!VALID_ENUM.has(mb)) verdicts.push({ label: "main_bottleneck valid enum", pass: false, detail: `got "${mb}"` });
  else verdicts.push({ label: "main_bottleneck valid enum", pass: true, detail: `"${mb}"` });

  if (mbExplanation.trim().length === 0) verdicts.push({ label: "main_bottleneck_explanation non-empty", pass: false, detail: "empty" });
  else verdicts.push({ label: "main_bottleneck_explanation non-empty", pass: true, detail: `${mbExplanation.length} chars` });

  if (explanation.trim().length === 0) verdicts.push({ label: "estimates.explanation non-empty", pass: false, detail: "empty" });
  else verdicts.push({ label: "estimates.explanation non-empty", pass: true, detail: `${explanation.length} chars` });

  const detected = detectCase(result);
  const matched = matchValidOutcome(detected, test.validOutcomes);
  const caseLabel = detected.archetype ? `${detected.case} (archetype ${detected.archetype})` : detected.case;
  if (matched) {
    verdicts.push({ label: "case-aware classification matches design", pass: true, detail: `${caseLabel} + "${detected.mb}" — ${matched.label}` });
  } else {
    verdicts.push({
      label: "case-aware classification matches design",
      pass: false,
      detail: `${caseLabel} + "${detected.mb}" — no validOutcome matches; expected one of: ${test.validOutcomes.map(v => `[${v.case}${v.archetype ? "/" + v.archetype : ""} + "${v.mb}"]`).join(", ")}`,
    });
  }

  const refMb = checkSectionNameRefs(mbExplanation);
  const refEx = checkSectionNameRefs(explanation);
  if (refMb || refEx) verdicts.push({ label: "no section-name references", pass: false, detail: `matched ${refMb || refEx}` });
  else verdicts.push({ label: "no section-name references", pass: true });

  const tcFirst = isTcFirstOpening(explanation);
  if (tcFirst && mb !== "Technical build") verdicts.push({ label: "opening variety", pass: false, detail: `TC-first opening with "${mb}"` });
  else if (tcFirst && mb === "Technical build") verdicts.push({ label: "opening variety", pass: true, detail: "TC-first allowed" });
  else verdicts.push({ label: "opening variety", pass: true, detail: "non-TC-first opening" });

  if (test.expectSparse) {
    const dur = estimates.duration || "";
    const diff = estimates.difficulty || "";
    if (!/cannot\s+estimate/i.test(dur)) verdicts.push({ label: "sparse: duration is 'Cannot estimate...'", pass: false, detail: `got "${dur}"` });
    else verdicts.push({ label: "sparse: duration is 'Cannot estimate...'", pass: true });
    if (diff !== "N/A") verdicts.push({ label: "sparse: difficulty is 'N/A'", pass: false, detail: `got "${diff}"` });
    else verdicts.push({ label: "sparse: difficulty is 'N/A'", pass: true });
  }

  if (test.expectAntiCollapse) {
    const months = parseDurationMonths(estimates.duration);
    if (months !== null && months < 8) verdicts.push({ label: "anti-collapse-to-TC: duration NOT compressed below 8 months", pass: false, detail: `got "${estimates.duration}" (~${months}mo upper)` });
    else if (months === null) verdicts.push({ label: "anti-collapse-to-TC: duration NOT compressed", pass: true, detail: "duration not numeric" });
    else verdicts.push({ label: "anti-collapse-to-TC: duration NOT compressed", pass: true, detail: `${months}mo upper bound` });
  }

  return { verdicts, detectedCase: detected, matchedOutcome: matched };
}

// ============================================
// MODES
// ============================================

async function preflight() {
  process.stdout.write("Preflight: pinging server… ");
  try {
    const res = await fetch(BASE_URL + "/api/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: "ping", profile: { coding: "Beginner", ai: "Some AI experience", education: "Test" } }),
    });
    if (res.ok || res.status === 400 || res.status === 500) { console.log("server reachable."); return true; }
    console.log(`unexpected status ${res.status}.`); return false;
  } catch (e) { console.log(`UNREACHABLE — ${e.message}`); return false; }
}

async function freshRun() {
  const RUNS = [];
  for (const test of TESTS) {
    const repeats = test.repeats || 1;
    for (let r = 1; r <= repeats; r++) {
      const tag = repeats > 1 ? `${test.id} r${r}` : test.id;
      RUNS.push({ test, tag, baseId: test.id, runIndex: r });
    }
  }

  console.log("=".repeat(80));
  console.log("V4S28 BUNDLE B3 — MAIN BOTTLENECK VERIFIER (v2 — case-aware)");
  console.log(`${TESTS.length} test cases / ${RUNS.length} runs`);
  console.log("=".repeat(80) + "\n");

  if (!(await preflight())) process.exit(1);

  const startTime = Date.now();
  const allResults = [];

  for (let i = 0; i < RUNS.length; i++) {
    const run = RUNS[i];
    const t0 = Date.now();
    process.stdout.write(`[${(i + 1).toString().padStart(2)}/${RUNS.length}] ${run.tag.padEnd(22)} `);
    try {
      const result = await runEval(run.test);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const { verdicts, detectedCase, matchedOutcome } = evaluate(run.test, result);
      const allPass = verdicts.every(v => v.pass);
      const got = result.estimates?.main_bottleneck || "?";
      const archStr = detectedCase.archetype ? `/${detectedCase.archetype}` : "";
      console.log(`${elapsed.padStart(5)}s  ${allPass ? "PASS" : "FAIL"}  → ${detectedCase.case}${archStr} + "${got}"`);
      allResults.push({ ...run, result, verdicts, detectedCase, matchedOutcome, elapsed, allPass });
    } catch (e) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`ERROR (${elapsed}s) — ${e.message}`);
      allResults.push({ ...run, error: e.message, elapsed });
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  return { allResults, totalElapsed };
}

function reevalRun(jsonPath) {
  console.log("=".repeat(80));
  console.log("V4S28 BUNDLE B3 — RE-EVALUATING EXISTING DATA WITH v2 CASE-AWARE LOGIC");
  console.log(`Source: ${jsonPath}`);
  console.log("=".repeat(80) + "\n");

  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const oldRuns = raw.allResults || [];

  const allResults = [];
  for (const oldRun of oldRuns) {
    const tag = oldRun.tag || oldRun.test?.id;
    const baseId = oldRun.baseId || oldRun.test?.id;
    const test = TESTS.find(t => t.id === baseId);
    if (!test) {
      console.log(`[${tag}] SKIP — no v2 test definition for baseId "${baseId}"`);
      continue;
    }
    if (oldRun.error || !oldRun.result) {
      console.log(`[${tag}] SKIP — no result in source data`);
      allResults.push({ ...oldRun, test, allPass: false });
      continue;
    }
    const { verdicts, detectedCase, matchedOutcome } = evaluate(test, oldRun.result);
    const allPass = verdicts.every(v => v.pass);
    const got = oldRun.result.estimates?.main_bottleneck || "?";
    const archStr = detectedCase.archetype ? `/${detectedCase.archetype}` : "";
    console.log(`[${tag.padEnd(22)}] ${allPass ? "PASS" : "FAIL"} → ${detectedCase.case}${archStr} + "${got}"`);
    allResults.push({ ...oldRun, test, verdicts, detectedCase, matchedOutcome, allPass });
  }

  return { allResults, totalElapsed: "0.0 (re-eval)" };
}

function reportSummary(allResults, totalElapsed) {
  console.log("\n" + "=".repeat(80));
  console.log("CROSS-CASE CHECKS");
  console.log("=".repeat(80));

  const crossChecks = [];

  // F2 closure
  const f2Ids = ["T-TECH", "T-BUYER", "MAT3-partial"];
  const f2FirstRuns = f2Ids.map(id => allResults.find(r => (r.baseId || r.test?.id) === id && (r.runIndex === 1 || r.runIndex === undefined)));
  const f2Bottlenecks = f2FirstRuns.map(r => r?.result?.estimates?.main_bottleneck).filter(Boolean);
  const f2Distinct = new Set(f2Bottlenecks).size;
  if (f2Bottlenecks.length === 3 && f2Distinct >= 2) {
    crossChecks.push({ label: "F2 closure (audit's headline-equivalence): MAT3 trio produces distinct chips", pass: true, detail: `${f2Distinct}/3 distinct — [${f2Bottlenecks.join(", ")}]` });
  } else {
    crossChecks.push({ label: "F2 closure", pass: false, detail: f2Bottlenecks.length < 3 ? `only ${f2Bottlenecks.length}/3 cases` : `only ${f2Distinct} distinct from [${f2Bottlenecks.join(", ")}]` });
  }

  // MAT1 duration ordering
  const mat1Ids = ["MAT1-beginner", "MAT1-intermediate", "MAT1-senior"];
  const mat1Runs = mat1Ids.map(id => allResults.find(r => (r.baseId || r.test?.id) === id));
  const mat1Durations = mat1Runs.map(r => parseDurationMonths(r?.result?.estimates?.duration));
  const [begM, intM, senM] = mat1Durations;
  if (begM !== null && intM !== null && senM !== null) {
    if (senM <= intM && intM <= begM && (senM < begM)) {
      crossChecks.push({ label: "MAT1 duration ordering: senior ≤ intermediate ≤ beginner (and senior < beginner)", pass: true, detail: `${begM}mo / ${intM}mo / ${senM}mo (beg/int/sen)` });
    } else {
      crossChecks.push({ label: "MAT1 duration ordering", pass: false, detail: `${begM}mo / ${intM}mo / ${senM}mo` });
    }
  } else {
    crossChecks.push({ label: "MAT1 duration ordering", pass: false, detail: `could not parse: [${mat1Durations.join(", ")}]` });
  }

  // Variance grouping
  console.log("\n  Variance grouping (repeated cases — case + MB distribution):");
  const variancePassFail = [];
  for (const test of TESTS) {
    if ((test.repeats || 1) <= 1) continue;
    const runs = allResults.filter(r => (r.baseId || r.test?.id) === test.id && r.detectedCase);
    if (runs.length === 0) {
      console.log(`    [${test.id} × ${test.repeats}] no successful runs`);
      continue;
    }
    const cases = runs.map(r => r.detectedCase.case);
    const bottlenecks = runs.map(r => r.detectedCase.mb);
    const allDesignFaithful = runs.every(r => r.matchedOutcome !== null);
    const mbDistinct = new Set(bottlenecks).size;
    const caseDistinct = new Set(cases).size;
    const mbConsistent = mbDistinct === 1;
    const caseConsistent = caseDistinct === 1;

    let label;
    let pass = allDesignFaithful;
    if (mbConsistent && caseConsistent) label = `consistent — ${runs.length}/${runs.length} same case+MB`;
    else if (allDesignFaithful) label = `varied but all design-faithful (${caseDistinct} case(s) × ${mbDistinct} MB(s))`;
    else label = `inconsistent — at least one run not design-faithful`;

    const display = runs.map(r => `${r.detectedCase.case}${r.detectedCase.archetype ? "/" + r.detectedCase.archetype : ""}+"${r.detectedCase.mb}"`).join(", ");
    console.log(`    [${test.id} × ${test.repeats}] ${pass ? "✓" : "✗"} ${label}`);
    console.log(`      ${display}`);
    variancePassFail.push({ id: test.id, pass, runs: runs.length, allDesignFaithful, mbDistinct, caseDistinct });
  }

  console.log("");
  for (const c of crossChecks) console.log(`  ${c.pass ? "✓" : "✗"} ${c.label}${c.detail ? ` — ${c.detail}` : ""}`);

  // Detailed per-run
  console.log("\n" + "=".repeat(80));
  console.log("DETAILED PER-RUN RESULTS");
  console.log("=".repeat(80));

  for (const r of allResults) {
    const tag = r.tag || r.test?.id || "?";
    console.log(`\n[${tag}] ${r.test?.purpose || ""}`);
    if (r.error) { console.log(`  Error: ${r.error}`); continue; }
    const mb = r.result?.estimates?.main_bottleneck || "?";
    const dur = r.result?.estimates?.duration || "?";
    const diff = r.result?.estimates?.difficulty || "?";
    console.log(`  Output: ${mb}  |  ${dur}  |  ${diff}`);
    if (r.detectedCase) {
      const archStr = r.detectedCase.archetype ? `/${r.detectedCase.archetype}` : "";
      console.log(`  Case: ${r.detectedCase.case}${archStr}${r.detectedCase.ffText ? ` ("${r.detectedCase.ffText.substring(0, 80)}…")` : ""}`);
      if (r.matchedOutcome) console.log(`  Match: ${r.matchedOutcome.label}`);
    }
    for (const v of (r.verdicts || [])) console.log(`    ${v.pass ? "✓" : "✗"} ${v.label}${v.detail ? ` — ${v.detail}` : ""}`);
    const mbEx = r.result?.estimates?.main_bottleneck_explanation || "";
    if (mbEx) console.log(`    [mb_explanation] ${mbEx.substring(0, 200).replace(/\n/g, " ")}${mbEx.length > 200 ? "…" : ""}`);
    const ex = r.result?.estimates?.explanation || "";
    if (ex) console.log(`    [explanation:200] ${ex.substring(0, 200).replace(/\n/g, " ")}${ex.length > 200 ? "…" : ""}`);
  }

  // Save
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 16);
  const outPath = path.join(OUTPUT_DIR, `b3-v2-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ allResults, crossChecks, variance: variancePassFail }, null, 2));

  const passCount = allResults.filter(r => r.allPass).length;
  const totalRuns = allResults.length;
  const crossPassCount = crossChecks.filter(c => c.pass).length;
  const variancePassCount = variancePassFail.filter(v => v.pass).length;

  console.log("\n" + "=".repeat(80));
  if (passCount === totalRuns && crossPassCount === crossChecks.length && variancePassCount === variancePassFail.length) {
    console.log(`B3 VERIFICATION PASSED — ${passCount}/${totalRuns} per-run + ${crossPassCount}/${crossChecks.length} cross-case + ${variancePassCount}/${variancePassFail.length} variance groups all clean.`);
    console.log("Bundle B3 closes per case-aware design verification.");
  } else {
    console.log(`B3 VERIFICATION RESULT — ${passCount}/${totalRuns} per-run, ${crossPassCount}/${crossChecks.length} cross-case, ${variancePassCount}/${variancePassFail.length} variance.`);
  }
  console.log(`Total wall time: ${totalElapsed} minutes`);
  console.log(`Full output: ${outPath}`);
  console.log("=".repeat(80));
}

async function main() {
  const args = process.argv.slice(2);
  const reevalIdx = args.indexOf("--reeval");
  if (reevalIdx >= 0 && args[reevalIdx + 1]) {
    const { allResults, totalElapsed } = reevalRun(args[reevalIdx + 1]);
    reportSummary(allResults, totalElapsed);
  } else {
    const { allResults, totalElapsed } = await freshRun();
    reportSummary(allResults, totalElapsed);
  }
}

main().catch(err => {
  console.error("\nFATAL:", err.message);
  console.error(err.stack);
  process.exit(1);
});
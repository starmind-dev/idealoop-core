// src/lib/services/ideaParts.js
//
// THE PART / ANCHOR MAP — one source of truth for "what an idea is made of" and
// "where a change shows up." Pure data + tiny helpers, no I/O, no React.
//
// TWO MAPS, ONE FILE, because they're two views of the same anatomy:
//
//   PARTS   — the load-bearing pieces of the IDEA the founder reshapes on the
//             Evolve screen. Each is locked to the engine's REAL anatomy (the
//             field the deep pipeline actually commits), not an invented six.
//             Each carries the metric it drives and the lineage branch label
//             editing it produces. Consumed by the Evolve X-ray + changed_fields.
//
//   ANCHORS — the sections of the RESULT screen that can carry a "!" marker.
//             Each names the metric it belongs to, its identity colour (the
//             shipped DeepResultParts palette), whether its change reads as a
//             number / a word / pure arithmetic, the score + _internal fields the
//             diff compares, the evidence lane it draws from, and which PARTS map
//             onto it (so changeDiff can light "input" when a touched part lands
//             here directly).
//
// The link between them is the whole engine of attribution: a touched PART →
// its metric → that metric's ANCHOR is the "direct" path; a touched part whose
// retrieval shifted ANOTHER metric's evidence is the "by-path." changeDiff reads
// THIS file to know which is which. Keep both maps honest to the pipeline and the
// attribution can't drift.
//
// DISPLAY/LOGIC-ONLY. Touches no score, mutates nothing. Engine byte-locked.

// ── identity colours — VERBATIM from DeepResultParts.METRIC_COLORS (dark) ──────
export const METRIC_COLOR = {
  market_demand: "#3fc09a",
  monetization: "#6f8ff5",
  originality: "#b57ce0",
  technical_complexity: "#d9a85e",
};
export const OVERALL_COLOR = "#b1a89c"; // neutral ring
export const VERDICT_COLOR = "#8b8fe0";
export const COMPARE_COLOR = "#6b9cf0";
export const RISK_COLOR = "#ef6f6c";
export const MB_COLOR = "#8b93b5";

// ── OPEN CONFIRM (Stage 1) ─────────────────────────────────────────────────────
// The defensibility/moat part's lineage branch label. positioning_shift is an
// already-declared lineage edge label; defensibility_shift is the literal name.
// Flagged, defaulted, non-blocking for the diff (the label is display/lineage,
// the comparator never keys off it). Change this ONE constant when locked.
export const DEFENSIBILITY_BRANCH = "positioning_shift";

// ============================================================================
// PARTS — the idea's anatomy (Evolve X-ray + changed_fields vocabulary)
// ============================================================================
// metric          which scored axis the part drives
// internalField   the committed _internal enum the X-ray quotes for this part
// proseField      the per-metric prose field the X-ray quotes as "last judgment"
// branch          the lineage edge label editing this part auto-applies
export const PARTS = {
  target_user: {
    key: "target_user", label: "Target user", metric: "market_demand",
    internalField: "demand_archetype", proseField: "diagnosis", branch: "target_shift",
  },
  use_case: {
    key: "use_case", label: "Use case", metric: "market_demand",
    internalField: "demand_archetype", proseField: "binding_friction_explanation", branch: "use_case_shift",
  },
  mechanism: {
    key: "mechanism", label: "Mechanism / differentiation", metric: "originality",
    internalField: null, proseField: "differentiation_basis_diagnosis", branch: "mechanism_shift",
  },
  defensibility: {
    key: "defensibility", label: "Defensibility / moat", metric: "originality",
    internalField: "binding_constraint.primary_subtype", proseField: "defensibility_diagnosis",
    branch: DEFENSIBILITY_BRANCH,
  },
  payment_shape: {
    key: "payment_shape", label: "Payment shape", metric: "monetization",
    internalField: "monetization_archetype", proseField: "diagnosis", branch: "payment_shift",
  },
  build_profile: {
    key: "build_profile", label: "Build profile", metric: "technical_complexity",
    internalField: null, proseField: "base_score_explanation", branch: "build_shift",
  },
};

// The Evolve input may emit either these part keys OR the older branch-dimension
// keys (target_user / problem / wedge / monetization / gtm / core_concept). This
// folds the legacy vocabulary onto parts so changed_fields from either screen
// resolves. Unknown keys resolve to null (no direct lane lit — safe degrade).
const LEGACY_FIELD_TO_PART = {
  target_user: "target_user",
  problem: "use_case",
  wedge: "mechanism",
  monetization: "payment_shape",
  core_concept: "mechanism",
  core_idea: "mechanism",
  // gtm has no scored home (distribution is out of scope) → null, intentionally.
  gtm: null,
};

export function partOfField(field) {
  if (!field) return null;
  if (PARTS[field]) return PARTS[field];
  const mapped = LEGACY_FIELD_TO_PART[field];
  return mapped ? PARTS[mapped] : null;
}

// Set of metric keys a changed_fields list touches DIRECTLY (a part → its metric).
export function metricsTouched(changedFields = []) {
  const out = new Set();
  for (const f of changedFields || []) {
    const p = partOfField(f);
    if (p && p.metric) out.add(p.metric);
  }
  return out;
}

// ============================================================================
// ANCHORS — the result-screen markers
// ============================================================================
// kind       "numeric"   → from→to number in the popup header (md/mo/or/overall)
//            "qualitative"→ before→after words   (verdict/compare/risks/mb/time)
//            "arithmetic" → contribution breakdown, no causal diagram (overall)
// metric     the axis this anchor belongs to (null for cross-cutting)
// evidenceLane which evidence packet(s) feed it (for the evidence set-diff)
// parts      part keys whose direct edit moves THIS anchor (the "input·direct" set)
// lazy       generated later, not in the post-assembly one-shot (execution brief)
export const ANCHORS = {
  verdict: {
    key: "verdict", label: "The verdict", metric: null, color: VERDICT_COLOR,
    kind: "qualitative", textFields: ["verdict_headline", "verdict_lead", "summary"],
    evidenceLane: ["market_demand", "monetization", "originality"],
    parts: [], crossCutting: true,
  },
  overall: {
    key: "overall", label: "Overall score", metric: null, color: OVERALL_COLOR,
    kind: "arithmetic", scoreField: "overall_score",
    contributors: [
      { metric: "market_demand", weight: 0.375 },
      { metric: "monetization", weight: 0.3125 },
      { metric: "originality", weight: 0.3125 },
    ],
    parts: [],
  },
  market_demand: {
    key: "market_demand", label: "Market Demand", metric: "market_demand", color: METRIC_COLOR.market_demand,
    kind: "numeric", scoreField: "score", internalFields: ["demand_archetype"],
    evidenceLane: ["market_demand"], parts: ["target_user", "use_case"],
  },
  monetization: {
    key: "monetization", label: "Monetization", metric: "monetization", color: METRIC_COLOR.monetization,
    kind: "numeric", scoreField: "score", displayField: "display_score",
    internalFields: ["monetization_archetype", "sub_position", "override_applied"],
    evidenceLane: ["monetization"], parts: ["payment_shape"],
  },
  originality: {
    key: "originality", label: "Originality", metric: "originality", color: METRIC_COLOR.originality,
    kind: "numeric", scoreField: "score",
    internalFields: ["binding_constraint.primary_subtype"],
    evidenceLane: ["originality"], parts: ["mechanism", "defensibility"],
  },
  technical_complexity: {
    key: "technical_complexity", label: "Technical Complexity", metric: "technical_complexity",
    color: METRIC_COLOR.technical_complexity, kind: "numeric", scoreField: "score",
    band: true, // movement within the word-ladder band still counts as a read
    evidenceLane: [], parts: ["build_profile"],
  },
  compare: {
    key: "compare", label: "How your idea compares", metric: "originality", color: COMPARE_COLOR,
    kind: "qualitative", textFields: ["competitive_position.headline", "competitive_position.you_win", "competitive_position.overlap", "competitive_position.exposed"],
    evidenceLane: ["originality"], parts: ["mechanism", "defensibility"], source: "competition",
  },
  risks: {
    key: "risks", label: "Key risks", metric: null, color: RISK_COLOR,
    kind: "qualitative", perItem: "failure_risks", itemKey: "slot",
    // each risk slot inherits a lane; changeDiff diffs slot-by-slot
    slotLane: { market_category: "originality", trust_adoption: "monetization", founder_fit: "technical_complexity" },
    evidenceLane: ["market_demand", "monetization", "originality"], parts: [],
  },
  mb: {
    key: "mb", label: "The binding constraint", metric: null, color: MB_COLOR,
    kind: "qualitative", source: "estimates",
    valueField: "main_bottleneck", textFields: ["constraint_diagnosis"],
    evidenceLane: [], parts: ["build_profile"],
  },
  commitment: {
    key: "commitment", label: "Time & commitment", metric: null, color: MB_COLOR,
    kind: "qualitative", source: "estimates",
    valueField: "duration", extraValueField: "difficulty",
    evidenceLane: [], parts: ["build_profile"],
  },
  execution_brief: {
    key: "execution_brief", label: "Execution brief", metric: null, color: VERDICT_COLOR,
    kind: "qualitative", lazy: true, source: "execution_brief",
    evidenceLane: [], parts: [],
  },
};

// Anchors generated in the post-assembly one-shot (everything except the lazy brief).
export const ONESHOT_ANCHORS = Object.values(ANCHORS).filter((a) => !a.lazy).map((a) => a.key);

export function anchorsForMetric(metric) {
  return Object.values(ANCHORS).filter((a) => a.metric === metric).map((a) => a.key);
}
// ============================================
// SCORE ENGINE
// ============================================
// Deterministic weighted score calculation.
// Runs in JS, not in the LLM — ensures consistency.
//
// V4S28 B8 (α formula change, April 30 2026):
// Technical Complexity REMOVED from the Overall composite.
// TC remains a first-class metric in the evaluation but is now framed
// as "execution context" rather than a contributor to Overall.
//
// New weights (re-normalized to sum to 1.0):
//   Market Demand:    37.5%   (was 30%)
//   Monetization:     31.25%  (was 25%)
//   Originality:      31.25%  (was 25%)
//   Technical Complexity:  not in Overall
//
// Rationale: TC measures something different in kind (build difficulty
// against the founder's profile) from MD/MO/OR (idea quality against
// the market). Bundling it into the Overall produced score compression
// (most ideas TC ~6-8 → constant -1.2 to -1.6 drag on Overall) without
// adding explanatory power. TC is now displayed alongside the Overall
// as "execution context · not in the overall" — preserves the signal,
// removes the silent drag.
//
// UI displays: 37.5% / 31.25% / 31.25% on the contributor metrics;
// TC has no percentage chip, just the "build difficulty" label.

export function calculateOverallScore(evaluation) {
  const overall =
    evaluation.market_demand.score * 0.375 +
    evaluation.monetization.score * 0.3125 +
    evaluation.originality.score * 0.3125;

  return Math.round(overall * 10) / 10;
}

// ============================================
// V5.10 — MONETIZATION FINE DISPLAY SCORE (code-side, frontend-only)
// ============================================
// Computes a finer USER-FACING monetization score from the MO scorer's
// committed sub-position evidence, WITHOUT touching mo.score.
//
// Doctrine (P29 — model judges, code scores): the model commits judgment
// (archetype + SP levels, which it does reliably); code does the arithmetic
// (sum + bucket + lookup), which it does exactly. The earlier in-prompt MO
// fine table FAILED — the model can't reliably index a dense table + sum its
// own components (~46% of cases scored off-table), AND its sub_position_sum
// arithmetic errors (G_ARITH_SUM) translated straight into wrong scores. The
// resolution itself is real and single-axis (it lives in sub_position_sum,
// which the model commits reliably); only the clerical execution belonged in
// code. So the number is derived here.
//
// DECOUPLE (the safety property): mo.score stays the coarse 3-anchor value.
// calculateOverallScore (above), Stage 2c (overall_score band gates), and
// Stage 3 (the "low MD or MO < 5.0" modifier) all read mo.score — untouched.
// display_score is set at final assembly in route.js, AFTER overall_score +
// Stage 2c + Stage 3 have run, and is read ONLY by the frontend. It cannot
// ripple into any reasoning stage, by construction.
//
// CONSISTENCY GUARD: display_score diverges from the coarse anchor ONLY on
// clean, internally-consistent cases — code's recomputed sum/bucket must match
// the model's committed sub_position (the bucket the `direction` prose already
// describes), and no bucket override fired. On any disagreement (a G_ARITH_SUM
// case where the model miscounted across a bucket boundary), on an override,
// or on missing/malformed _internal, it falls back to mo.score. So the finer
// number appears only when it is BOTH arithmetically trustworthy AND
// guaranteed to match the bucket position the prose states.
//
// SCOPE: MONETIZATION ONLY. MD (genuinely multi-axis — a finer scalar would
// manufacture false ordering) and OR (honest-equivalence floor) are
// intentionally NOT fine-scored. This is an evidence-gated, metric-specific
// rollout, not a general scoring move.

// MO archetype enum (_internal.monetization_archetype) → band index 1..6
const MO_ARCHETYPE_INDEX = {
  insufficient_evidence: 1,
  founder_articulated: 2,
  category_grounded: 3,
  partial_segment_grounded: 4,
  direct_precedent_grounded: 5,
  sustained_adoption_evidenced: 6,
};

// Per-archetype decimal anchors — transcribed VERBATIM from prompt-stage-mo.js
// "DECIMAL LOOKUP PER ARCHETYPE". lo / mid / hi = lower / middle / upper.
const MO_BANDS = {
  1: { lo: 1.0, mid: 1.9, hi: 2.8 },
  2: { lo: 2.8, mid: 3.6, hi: 4.3 },
  3: { lo: 4.3, mid: 4.9, hi: 5.4 },
  4: { lo: 5.4, mid: 6.0, hi: 6.5 },
  5: { lo: 6.5, mid: 7.0, hi: 7.5 },
  6: { lo: 7.5, mid: 8.0, hi: 8.5 },
};

// sub_position_sum theoretical range (SP-A 0..3 + SP-B -2..1 + SP-C 0..2)
const MO_SUM_MIN = -2;
const MO_SUM_MAX = 6;
const MO_CEILING = 8.5;

// Bucket boundaries — verbatim from prompt: [-2,+1] lower / [+2,+4] middle / [+5,+6] upper
function moBucketFromSum(sum) {
  if (sum <= 1) return "lower";
  if (sum <= 4) return "middle";
  return "upper";
}

function isFiniteInt(v) {
  return typeof v === "number" && Number.isFinite(v) && Number.isInteger(v);
}

function moAnchorForBucket(band, bucket) {
  if (bucket === "lower") return band.lo;
  if (bucket === "upper") return band.hi;
  return band.mid;
}

// Does crossing from `a` to `b` flip the score across the 5.0 line that
// Stage 3's "low MD or MO < 5.0" modifier keys off? (Per-metric MO band line.)
function crosses5(a, b) {
  return (a < 5.0 && b >= 5.0) || (a >= 5.0 && b < 5.0);
}

// ── OVERRIDE TRACE (12b) — single source of truth for MO's bucket overrides ──
// The MO prompt has exactly two bucket-changing overrides (verbatim, prompt
// lines 597-601). This function is the ONE place they are encoded; the
// diagnostic below consumes it, and route.js writes its result into
// `_internal.override_applied` at assembly so the override is EXPLICIT and
// TRACEABLE rather than a silent score move the validator reads as off-lookup.
//
// It is computed purely from the committed SP values + primary mechanism — it
// does NOT read the model's declared sub_position, so it stays correct even
// when the model failed to reconcile sub_position to the override (the 12b
// defect). We never rewrite sub_position; we record the override instead, so
// downstream reads effective_bucket = override?.final_bucket ?? sub_position.
//
// Returns null when no override fired, or when _internal/SP is absent/malformed
// (graceful — there is nothing to trace).
export function computeMoOverrideTrace(mo) {
  const internal = mo?._internal;
  const sp = internal?.predicate_commitments?.sub_position_predicates;
  if (!internal || !sp) return null;

  const spA = sp.spA_positive_evidence_directness?.value;
  const spB = sp.spB_payment_capture_confidence?.value;
  const spC = sp.spC_score_relevant_corroboration?.value;
  if (!isFiniteInt(spA) || !isFiniteInt(spB) || !isFiniteInt(spC)) return null;

  const arithmeticBucket = moBucketFromSum(spA + spB + spC);
  const mechanism = internal.binding_payment_constraint?.primary_mechanism;

  // PRIORITY-BASED PULL: SP-B = critical_unresolved (-2) AND arithmetic middle → lower.
  if (spB === -2 && arithmeticBucket === "middle") {
    return {
      rule: "PRIORITY_PULL",
      arithmetic_bucket: "middle",
      final_bucket: "lower",
      trigger: "spB_critical_unresolved",
    };
  }
  // GLOBAL SP RULE: none_or_minimal mechanism AND SP-A weak/concrete (<=1) AND
  // arithmetic upper → cannot reach upper; cap at middle.
  if (mechanism === "none_or_minimal" && spA <= 1 && arithmeticBucket === "upper") {
    return {
      rule: "GLOBAL_SP_CAP",
      arithmetic_bucket: "upper",
      final_bucket: "middle",
      trigger: "none_or_minimal_mechanism_weak_spA",
    };
  }
  return null;
}

// ── DIAGNOSTIC CORE ──────────────────────────────────────────────────────
// Single source of truth for the MO fine score. Returns the full breakdown so
// the production wrapper (computeMoDisplayScore) and the migration-decision
// instrument (the local runner) read identical logic — they cannot drift.
//
// Returns:
//   coarse_score   the model's emitted mo.score (canonical / downstream)
//   display_score  the user-facing fine value (= coarse on any fallback)
//   delta          display_score − coarse_score (0 on fallback / on-anchor)
//   status         "fine" | "fallback"
//   reason         "clean_interpolation" | "override_anchor"
//                  | "no_score" | "missing_internal" | "malformed_sp"
//                  | "unknown_archetype" | "guard_mismatch"
//   crosses_5      would promoting display to canonical flip the Stage-3 5.0 line
//
// MIGRATION READ (aggregate over a run): a high fallback rate means the full
// migration would have had nothing to compute from on those cases (fix MO
// _internal emission first). A large delta distribution, or frequent crosses_5,
// means promoting code's score to canonical would move downstream behavior —
// stay at the display-only pilot. Low fallback + small bounded delta + ~zero
// crosses_5 is the green light to make code's score canonical.
export function computeMoScoreDiagnostic(mo) {
  const coarse = typeof mo?.score === "number" ? mo.score : null;
  const fb = (reason) => ({
    coarse_score: coarse,
    display_score: coarse,
    delta: 0,
    status: "fallback",
    reason,
    crosses_5: false,
  });

  if (coarse === null) {
    // No usable coarse score at all (score-guard upstream normally prevents this).
    return { coarse_score: null, display_score: null, delta: 0, status: "fallback", reason: "no_score", crosses_5: false };
  }

  const internal = mo._internal;
  const sp = internal?.predicate_commitments?.sub_position_predicates;
  if (!internal || !sp) return fb("missing_internal");

  const spA = sp.spA_positive_evidence_directness?.value;
  const spB = sp.spB_payment_capture_confidence?.value;
  const spC = sp.spC_score_relevant_corroboration?.value;
  if (!isFiniteInt(spA) || !isFiniteInt(spB) || !isFiniteInt(spC)) return fb("malformed_sp");

  const archIdx = MO_ARCHETYPE_INDEX[internal.monetization_archetype];
  const band = MO_BANDS[archIdx];
  if (!band) return fb("unknown_archetype");

  // G_ARITH_SUM fix: recompute the sum from committed components — never trust
  // the model's declared sub_position_sum.
  const sum = spA + spB + spC;

  // Raw bucket, then apply the bucket-changing overrides via the SHARED trace
  // function (single source of truth — see computeMoOverrideTrace). This is the
  // same override the explicit _internal.override_applied field records, so the
  // display score and the traced override can never disagree.
  // (ANTI-DOUBLE-PENALTY is a no-op at bucket level: the SP-B bounds matrix is
  // already baked into the committed spB value.)
  let bucket = moBucketFromSum(sum);
  const overrideTrace = computeMoOverrideTrace(mo);
  const overrideFired = overrideTrace !== null;
  if (overrideFired) bucket = overrideTrace.final_bucket;

  // CONSISTENCY GUARD: the `direction` prose describes the model's committed
  // sub_position. If code's recomputed bucket disagrees, the model miscounted
  // across a bucket boundary — show coarse rather than a fine number that would
  // contradict the prose the user reads. (This is the G_ARITH_SUM bucket-crossing
  // case; logging it as guard_mismatch is exactly the migration-risk signal.)
  if (bucket !== internal.sub_position) return fb("guard_mismatch");

  let display;
  let reason;
  if (overrideFired) {
    // OVERRIDE → no fine resolution; an override is a discrete pull to a bucket
    // edge. Return the anchor (= mo.score when the model applied the same override).
    display = moAnchorForBucket(band, bucket);
    reason = "override_anchor";
  } else {
    // CLEAN CASE → band-anchored linear interpolation across the full sum range
    // (Rule A): sum = MO_SUM_MIN → band floor, sum = MO_SUM_MAX → band ceiling.
    // Each bucket's sum range maps monotonically into that bucket's region, so
    // the fine value is always consistent with the committed bucket / prose.
    const fine =
      band.lo + ((sum - MO_SUM_MIN) / (MO_SUM_MAX - MO_SUM_MIN)) * (band.hi - band.lo);
    const rounded = Math.round(fine * 10) / 10;
    display = Math.min(Math.max(rounded, band.lo), Math.min(band.hi, MO_CEILING));
    reason = "clean_interpolation";
  }

  return {
    coarse_score: coarse,
    display_score: display,
    delta: Math.round((display - coarse) * 10) / 10,
    status: "fine",
    reason,
    crosses_5: crosses5(coarse, display),
  };
}

// ── PRODUCTION WRAPPER ───────────────────────────────────────────────────
// What route.js calls. Returns only the user-facing number; falls back to the
// coarse score (never null in practice — the score-guard guarantees mo.score
// is numeric before assembly).
export function computeMoDisplayScore(mo) {
  return computeMoScoreDiagnostic(mo).display_score;
}
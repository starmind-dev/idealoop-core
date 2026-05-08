// ============================================================================
// runners/f1-diagnostic-thresholds.js
// ============================================================================
// F1 diagnostic locked thresholds + automated verdict logic.
//
// Per Methodology Principle 6: thresholds locked BEFORE runner runs. If a
// threshold needs adjustment after seeing results, that signals the design
// lock was wrong (re-discuss design), NOT relax the threshold.
//
// Source of truth for verdict semantics: V4S29 execution-plan-v5.2.md F1 lock
// (lines 187-209 in v5.2). Verdict logic copied verbatim from the lock and
// operationalized below.
// ============================================================================

// ============================================================================
// PHASE A — Stage 2a stability
// ============================================================================
// "Pass criterion: median Jaccard ≥ 0.7 across all 5 cases"
// "FAIL outcome: Stage 2a is itself nondeterministic; upstream architectural
//  conversation needed before Phase B"

const JACCARD_PASS_THRESHOLD = 0.7;

function evaluatePhaseA(stats) {
  const om = stats.overallMedian;
  if (om == null) {
    return { result: "INCONCLUSIVE", note: "no successful runs to evaluate" };
  }
  if (om >= JACCARD_PASS_THRESHOLD) {
    return {
      result: "PASS",
      note: `overall median Jaccard ${om.toFixed(3)} ≥ ${JACCARD_PASS_THRESHOLD}`,
    };
  }
  return {
    result: "FAIL",
    note: `overall median Jaccard ${om.toFixed(3)} < ${JACCARD_PASS_THRESHOLD} — Stage 2a itself nondeterministic`,
  };
}

// ============================================================================
// PHASE B — Stage 2b independence
// ============================================================================
//
// Per F1 lock verdict logic:
//
//   FULL_SPLIT (verdict 1B): ARC-D2 shows OR-only stddev ≥0.6 with MD/MO ≤0.25;
//   L2 shows MO-only pattern (MO stddev > MD stddev > OR); median Spearman
//   ≤0.25 across the bank
//
//   OR_ONLY (verdict 1A): H4/M3 sustain all-together pattern; ARC-D2 MD/MO
//   stddev ≥50% of OR's; median Spearman ≥0.5
//
//   AMBIGUOUS: neither verdict signature clearly fires → escalate to Tier-2
//   (10 reruns/case via --tier-2 flag)
//
// Operationalization decisions:
//   - "MO-only pattern (MO stddev > MD stddev > OR)" → strict inequality chain
//   - "H4/M3 sustain all-together pattern" → per-case median Spearman ≥ 0.5
//     (rationale: all-together = MD/MO/OR move in same rank-direction across
//     reruns, captured by median of three pair-Spearmans being ≥ 0.5)
//   - "median Spearman across the bank" → median across 8 case medians, where
//     each case median = median of {ρ(MD,MO), ρ(MD,OR), ρ(MO,OR)} for that case
// ============================================================================

const PHASE_B_THRESHOLDS = {
  // 1B (FULL_SPLIT) signature
  V1B_ARCD2_OR_STDDEV_MIN: 0.6,
  V1B_ARCD2_MD_STDDEV_MAX: 0.25,
  V1B_ARCD2_MO_STDDEV_MAX: 0.25,
  V1B_BANK_SPEARMAN_MAX: 0.25,
  // 1A (OR_ONLY) signature
  V1A_ARCD2_MDMO_FRACTION_OF_OR_MIN: 0.5,
  V1A_H4_M3_CASE_SPEARMAN_MIN: 0.5,
  V1A_BANK_SPEARMAN_MIN: 0.5,
};

function evaluatePhaseB(stats) {
  const t = PHASE_B_THRESHOLDS;
  const arcd2 = stats.cases["ARC-D2"];
  const l2 = stats.cases["AUDIT-L2"];
  const h4 = stats.cases["AUDIT-H4"];
  const m3 = stats.cases["AUDIT-M3"];
  const bankSpearman = stats.bankMedianSpearman;

  if (!arcd2 || !l2 || !h4 || !m3 || bankSpearman == null) {
    return {
      result: "INCONCLUSIVE",
      note: "missing required cases (ARC-D2, AUDIT-L2, AUDIT-H4, AUDIT-M3) or bank Spearman",
      conditions: {
        haveARC_D2: !!arcd2,
        haveL2: !!l2,
        haveH4: !!h4,
        haveM3: !!m3,
        bankSpearman,
      },
    };
  }

  // --- 1B (FULL_SPLIT) conditions ---
  const v1b_arcd2_oronly =
    arcd2.stddev.or >= t.V1B_ARCD2_OR_STDDEV_MIN
    && arcd2.stddev.md <= t.V1B_ARCD2_MD_STDDEV_MAX
    && arcd2.stddev.mo <= t.V1B_ARCD2_MO_STDDEV_MAX;
  const v1b_l2_moonly =
    l2.stddev.mo > l2.stddev.md && l2.stddev.md > l2.stddev.or;
  const v1b_bankspearman = bankSpearman <= t.V1B_BANK_SPEARMAN_MAX;
  const v1b = v1b_arcd2_oronly && v1b_l2_moonly && v1b_bankspearman;

  // --- 1A (OR_ONLY) conditions ---
  // ARC-D2: MD/MO each ≥ 0.5 × OR stddev (i.e. MD/MO move appreciably with OR)
  const arcd2_or = arcd2.stddev.or;
  const v1a_arcd2_md = arcd2.stddev.md >= t.V1A_ARCD2_MDMO_FRACTION_OF_OR_MIN * arcd2_or;
  const v1a_arcd2_mo = arcd2.stddev.mo >= t.V1A_ARCD2_MDMO_FRACTION_OF_OR_MIN * arcd2_or;
  const v1a_arcd2 = v1a_arcd2_md && v1a_arcd2_mo;
  // H4 + M3: case-level median Spearman ≥ 0.5 (all-together pattern)
  const v1a_h4 = h4.medianSpearman >= t.V1A_H4_M3_CASE_SPEARMAN_MIN;
  const v1a_m3 = m3.medianSpearman >= t.V1A_H4_M3_CASE_SPEARMAN_MIN;
  // Bank-wide median Spearman ≥ 0.5
  const v1a_bankspearman = bankSpearman >= t.V1A_BANK_SPEARMAN_MIN;
  const v1a = v1a_arcd2 && v1a_h4 && v1a_m3 && v1a_bankspearman;

  const conditions = {
    v1b: { v1b_arcd2_oronly, v1b_l2_moonly, v1b_bankspearman, fired: v1b },
    v1a: { v1a_arcd2, v1a_h4, v1a_m3, v1a_bankspearman, fired: v1a },
    bankSpearman,
    arcd2_stddev: arcd2.stddev,
    l2_stddev: l2.stddev,
    h4_medianSpearman: h4.medianSpearman,
    m3_medianSpearman: m3.medianSpearman,
  };

  if (v1b && !v1a) {
    return { result: "1B", note: "FULL_SPLIT signature fired", conditions };
  }
  if (v1a && !v1b) {
    return { result: "1A", note: "OR_ONLY signature fired", conditions };
  }
  if (v1a && v1b) {
    // Theoretically impossible — 1A requires bank ρ ≥0.5; 1B requires ≤0.25.
    // Defensive return rather than asserting.
    return {
      result: "AMBIGUOUS",
      note: "both signatures fired (impossible — re-check stats)",
      conditions,
    };
  }
  return {
    result: "AMBIGUOUS",
    note: "neither signature fully fired — escalate via --tier-2 (10 reruns/case)",
    conditions,
  };
}

module.exports = {
  JACCARD_PASS_THRESHOLD,
  PHASE_B_THRESHOLDS,
  evaluatePhaseA,
  evaluatePhaseB,
};

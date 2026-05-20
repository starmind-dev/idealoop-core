// ============================================================================
// stage2b-qc-triggers.js — V4S32 Layer
// ============================================================================
//
// Pure synchronous trigger evaluation. Decides whether the prosecutor should
// be called for a given Stage 2b metric output, and what risk patterns were
// detected (active vs log-only).
//
// No API calls. No I/O. No side effects. Just structural rules.
//
// Trigger philosophy:
//   - Active triggers fire the prosecutor. False positives cost an API call,
//     not a wrong user-facing output.
//   - Log-only triggers are detected but DO NOT fire the prosecutor in v1.
//     Used to gather data on mid-band patterns before deciding whether to
//     promote them to active.
//
// At launch (V4S32):
//   Active:    high_score, overridden, empty_rules_with_high_score
//   Log-only:  mid_band_anchor_risk
//
// Skip cases (never prosecuted, no QC overhead):
//   - score < 6.0 (no overconfidence to catch)
//   - applicable_rules.length > 0 AND resolution === "binds" AND score landed
//     at the cap floor (textbook clean cap landing)
//
// Expected production rates (per B10a + V4S31 probe):
//   - ~30-40% of metrics get prosecuted
//   - ~10% of prosecuted metrics return FAIL
// ============================================================================

/**
 * Score thresholds and rule sets, exposed for tests + observability.
 */
export const TRIGGER_CONFIG = {
  HIGH_SCORE_THRESHOLD: 7.0,
  EMPTY_RULES_HIGH_SCORE_THRESHOLD: 6.5,
  MID_BAND_ANCHOR_LOWER: 6.0,
  MID_BAND_ANCHOR_UPPER: 6.5,
  SKIP_BELOW_SCORE: 6.0,
};

/**
 * Known invalid-anchor pattern signatures. Used for the mid_band_anchor_risk
 * log-only trigger. Conservative — pattern detection here is structural-grep,
 * not semantic. False positives logged as data, never prosecuted.
 *
 * NOTE: These are intentionally minimal. The point is to capture a sample of
 * cases for later review, not to be a parallel prosecutor.
 */
const INVALID_ANCHOR_KEYWORDS = {
  md: [
    /incumbent/i,
    /\bproven\s+(?:patient|user|buyer|customer)\s+acquisition\b/i,
    /established\s+platform/i,
    /track\s+record/i,
  ],
  mo: [
    /\bROI\b/,
    /aligns\s+(?:payment|incentives|with)/i,
    /success[-\s]fee/i,
    /demonstrates\s+(?:willingness|payment)/i,
  ],
  or: [
    /would\s+need\s+to\s+restructure/i,
    /vertical\s+positioning/i,
    /workflow\s+as\s+(?:moat|barrier)/i,
    /structural\s+wedge/i,
  ],
};

/**
 * Evaluate trigger logic for one metric.
 *
 * @param {object} args
 * @param {'md'|'mo'|'or'} args.metric
 * @param {number} args.score
 * @param {object|null} args.adjudication  Stage 2b score_adjudication[metric]
 * @param {string} args.explanation        Stage 2b ev[metric].explanation
 * @returns {{
 *   shouldProsecute: boolean,
 *   triggers_fired: string[],
 *   mid_band_anchor_risk_detected: boolean,
 *   skip_reason: string | null,
 * }}
 */
export function evaluateTriggers({ metric, score, adjudication, explanation }) {
  const result = {
    shouldProsecute: false,
    triggers_fired: [],
    mid_band_anchor_risk_detected: false,
    skip_reason: null,
  };

  // Defensive — if score missing, skip entirely (caller should not have invoked us)
  if (typeof score !== "number" || !isFinite(score)) {
    result.skip_reason = "missing_or_invalid_score";
    return result;
  }

  // Skip case 1: Score too low — no overconfidence risk worth checking
  if (score < TRIGGER_CONFIG.SKIP_BELOW_SCORE) {
    result.skip_reason = "score_below_threshold";
    // Still check mid_band_anchor_risk pattern? No — only fires in 6.0-6.5 band
    return result;
  }

  const adj = adjudication || {};
  const applicableRules = Array.isArray(adj.applicable_rules) ? adj.applicable_rules : [];
  const resolution = adj.resolution || null;
  const scoreBasis = adj.score_basis || "";

  // Skip case 2: Textbook clean cap landing
  // applicable_rules non-empty AND resolution='binds' AND score landed at cap floor
  // We detect "landed at cap floor" by score_basis containing "cap_floor"
  if (
    applicableRules.length > 0 &&
    resolution === "binds" &&
    /cap_floor/i.test(scoreBasis)
  ) {
    result.skip_reason = "clean_cap_landing";
    return result;
  }

  // ==========================================================================
  // ACTIVE TRIGGERS (fire prosecutor)
  // ==========================================================================

  // Trigger 1: high_score
  if (score >= TRIGGER_CONFIG.HIGH_SCORE_THRESHOLD) {
    result.triggers_fired.push("high_score");
  }

  // Trigger 2: overridden (resolution flagged a cap was overridden — high-risk path)
  if (resolution === "overridden") {
    result.triggers_fired.push("overridden");
  }

  // Trigger 3: empty rules with elevated score (walk-all-skip indicator)
  if (
    applicableRules.length === 0 &&
    score >= TRIGGER_CONFIG.EMPTY_RULES_HIGH_SCORE_THRESHOLD
  ) {
    result.triggers_fired.push("empty_rules_with_high_score");
  }

  result.shouldProsecute = result.triggers_fired.length > 0;

  // ==========================================================================
  // LOG-ONLY TRIGGERS (detected, never fire prosecutor in v1)
  // ==========================================================================

  // mid_band_anchor_risk: score in 6.0-6.5 band AND positive_basis OR explanation
  // matches a known invalid-anchor keyword pattern
  if (
    score >= TRIGGER_CONFIG.MID_BAND_ANCHOR_LOWER &&
    score <= TRIGGER_CONFIG.MID_BAND_ANCHOR_UPPER &&
    !result.shouldProsecute  // only relevant if not already firing active trigger
  ) {
    const basisText =
      (adj.positive_basis && adj.positive_basis.packet_fact_cited) || "";
    const combined = `${basisText}\n${explanation || ""}`;
    const patterns = INVALID_ANCHOR_KEYWORDS[metric] || [];
    if (patterns.some((re) => re.test(combined))) {
      result.mid_band_anchor_risk_detected = true;
    }
  }

  return result;
}

/**
 * Convenience: evaluate triggers for all 3 metrics at once.
 *
 * @param {object} ev  Stage 2b output (ev.market_demand, ev.monetization, ev.originality)
 * @returns {{
 *   md: ReturnType<typeof evaluateTriggers>,
 *   mo: ReturnType<typeof evaluateTriggers>,
 *   or: ReturnType<typeof evaluateTriggers>,
 * }}
 */
export function evaluateAllTriggers(ev) {
  const keyMap = { md: "market_demand", mo: "monetization", or: "originality" };
  const out = {};
  for (const m of ["md", "mo", "or"]) {
    const metricKey = keyMap[m];
    const metricObj = ev[metricKey] || {};
    out[m] = evaluateTriggers({
      metric: m,
      score: metricObj.score,
      adjudication: metricObj.score_adjudication,
      explanation: metricObj.explanation,
    });
  }
  return out;
}

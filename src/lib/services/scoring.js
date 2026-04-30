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
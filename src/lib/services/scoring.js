// ============================================
// SCORE ENGINE
// ============================================
// Deterministic weighted score calculation.
// Runs in JS, not in the LLM — ensures consistency.
//
// Weights: Market Demand 30%, Monetization 25%, Originality 25%, 
// Technical Complexity 20% (inverted: lower TC = higher contribution)

export function calculateOverallScore(evaluation) {
  const overall =
    evaluation.market_demand.score * 0.3 +
    evaluation.monetization.score * 0.25 +
    evaluation.originality.score * 0.25 +
    (10 - evaluation.technical_complexity.score) * 0.2;

  return Math.round(overall * 10) / 10;
}
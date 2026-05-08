// ============================================================================
// runners/prompts/stage2b-md-loosened.js
// ============================================================================
// Counterfactual prompt for F1 Phase 2B (MD loosening test).
//
// Constructs a Stage 2b system prompt that differs from production in TWO
// surgical ways aimed at making MD's scoring structure match MO's looseness:
//
//   1. MD's anti-inflation cap-clauses (ENTERPRISE / CONSUMER / REGULATED /
//      RESEARCH / MARKETPLACE / OS-PLATFORM) are REMOVED. MO has no such
//      structured caps.
//   2. MD's score-band descriptors are FUZZIFIED to MO's level (single
//      adjective per band, no enumerable boundary conditions).
//
// HARD GUARDRAIL: substitution strings pinned; throws on drift.
// ============================================================================

const PRODUCTION_MD_RUBRIC = `METRIC 1: MARKET DEMAND (Weight: 30%)
This metric evaluates CAPTURABLE demand — not whether people want something in this category, but whether a new entrant could realistically acquire and retain paying users.

Using the evidence in the market_demand packet, answer these questions:
1. Who is the specific buyer (the person who pays, not just the user)?
2. What triggers them to actively seek a solution right now?
3. What friction stands between awareness and adoption (trust, procurement, behavior change, onboarding, switching costs)?
4. Given the competition evidence in this packet, what demand remains capturable by a NEW entrant?

Score based on the demand that SURVIVES friction AND competition, not the demand that exists before either.

Anti-inflation rules — apply before assigning any score above 6.0:
- ENTERPRISE: If the buyer is an organization, account for procurement cycles, committee decisions, security review, and incumbent preference. "Large enterprise need" without clear buyer urgency and accessible entry point caps at 6.0.
- CONSUMER: Score behavioral demand, not aspirational demand. "People would love this" is not demand. Demand means repeated, habitual usage. If the product requires significant onboarding, score based on post-onboarding retention. If natural usage frequency is low (a few times per year), cap at 5.0-6.0. For social/community/matching products, evaluate required concurrent user density.
- REGULATED: Trust and liability are demand filters. Disease prevalence is NOT market demand. Legal pain is NOT market demand. The demand is only what converts after trust is established.
- RESEARCH/ACADEMIC: Research value and intellectual impressiveness are NOT commercial demand. If no clear commercial path, cap at 4.0-5.0.
- MARKETPLACE: Score based on likelihood of achieving initial liquidity. If the market operates on personal relationships, displacing those intermediaries is the hardest barrier.
- OS/PLATFORM/LAYER FRAMING: Identify the ONE narrow sticky behavior first. Score demand for that, not the vision. If no narrow sticky behavior is identified, cap at 5.0-6.0.

Score levels:
1-2: No capturable demand. Need real but fully served or friction eliminates it.
3-4: Niche, small. Problem real but low urgency or high friction.
5-6: Clear target audience with demonstrated need. Gaps remain. Friction manageable.
7-8: Large addressable market with active demand that SURVIVES friction analysis. Growing trend with evidence.
9-10: Massive proven market with urgent unmet need. Extremely rare.

After scoring, cross-check: If you described major barriers, verify your score reflects them.`;

const LOOSENED_MD_RUBRIC = `METRIC 1: MARKET DEMAND (Weight: 30%)
This metric evaluates demand for the product.

Using the evidence in the market_demand packet, score the demand visible in the evidence.

Score levels:
1-2: No demand.
3-4: Niche, weak demand.
5-6: Moderate, evident demand.
7-8: Strong, growing demand.
9-10: Massive demand. Extremely rare.

After scoring, cross-check: If you described concerns, verify your score reflects them.`;

async function buildMdLoosenedPrompt() {
  const stage2bMod = await import("../../src/lib/services/prompt-stage2b.js");
  const original = stage2bMod.STAGE2B_SYSTEM_PROMPT;

  if (!original.includes(PRODUCTION_MD_RUBRIC)) {
    throw new Error(
      "Could not locate production MD rubric in prompt-stage2b.js — " +
      "the prompt has drifted from the version this counterfactual was authored against. " +
      "Re-pin PRODUCTION_MD_RUBRIC in stage2b-md-loosened.js before running this test."
    );
  }

  return original.replace(PRODUCTION_MD_RUBRIC, LOOSENED_MD_RUBRIC);
}

module.exports = { buildMdLoosenedPrompt, PRODUCTION_MD_RUBRIC, LOOSENED_MD_RUBRIC };
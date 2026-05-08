// ============================================================================
// runners/prompts/stage2b-mo-tightened.js
// ============================================================================
// Counterfactual prompt for F1 Phase 2A (MO tightening test).
//
// Constructs a Stage 2b system prompt that differs from production in EXACTLY
// ONE WAY: the COMMERCIAL score-band descriptors for MO are rewritten with
// enumerable anchors that mirror OR's structure (named, decidable conditions).
//
// Everything else — anti-inflation rules, dual scale (commercial + social
// impact), cross-checks, evidence strength rules, JSON schema — is preserved
// byte-identical from production.
//
// HARD GUARDRAIL: the substitution string is pinned. If the production prompt
// drifts, buildMoTightenedPrompt throws.
// ============================================================================

const PRODUCTION_MO_BANDS = `For COMMERCIAL ideas:
1-2: No viable revenue path. Substitutes are free and nearly equivalent.
3-4: One weak revenue stream. Low pricing power. Strong free substitutes.
5-6: Proven revenue model with identifiable willingness to pay. Moderate pricing power.
7-8: Clear, strong revenue path. Pricing power supported by lock-in or unique value.
9-10: Exceptional revenue mechanics. Extremely rare.`;

const TIGHTENED_MO_BANDS = `For COMMERCIAL ideas (each band requires the conditions of the bands below it, plus its own):
1-2: No viable revenue path. Free substitutes cover the same workflow with no friction delta.
3-4: Revenue path exists but is structurally pressured. AT LEAST TWO of: (a) free or near-free LLM-based substitutes cover 80%+ of the workflow, (b) usage frequency too episodic for subscription, (c) buyer is unspecified or scattered (no concentrated procurement path).
5-6: Identifiable buyer named in packet, AND named comparable revenue mechanism (subscription / per-usage / transaction), AND at least one willingness-to-pay signal (named competitor with pricing in packet, OR domain flag indicating buyers pay for similar workflows). No durable pricing power yet.
7-8: All of 5-6, PLUS at least ONE of: (a) named lock-in mechanism in the packet (data, integration, switching cost), (b) usage frequency that supports subscription naturally (daily/weekly explicitly evidenced), (c) explicit pricing signal from competitor objects (named competitor charges $X), (d) regulatory or compliance gate creating structural willingness to pay.
9-10: All of 7-8, PLUS demonstrated pricing power exceeding category norms (named buyer paying premium with retention evidence in packet). Extremely rare.`;

async function buildMoTightenedPrompt() {
  const stage2bMod = await import("../../src/lib/services/prompt-stage2b.js");
  const original = stage2bMod.STAGE2B_SYSTEM_PROMPT;

  if (!original.includes(PRODUCTION_MO_BANDS)) {
    throw new Error(
      "Could not locate production MO band descriptors in prompt-stage2b.js — " +
      "the prompt has drifted from the version this counterfactual was authored against. " +
      "Re-pin PRODUCTION_MO_BANDS in stage2b-mo-tightened.js before running this test."
    );
  }

  return original.replace(PRODUCTION_MO_BANDS, TIGHTENED_MO_BANDS);
}

module.exports = { buildMoTightenedPrompt, PRODUCTION_MO_BANDS, TIGHTENED_MO_BANDS };
// ============================================================================
// runners/prompts/stage2b-dominant-signal.js
// ============================================================================
// Counterfactual prompt for F1 Test 5 (dominant-signal-selection test).
//
// Constructs a Stage 2b system prompt that differs from production in EXACTLY
// TWO WAYS:
//   1. A "DOMINANT SIGNAL SELECTION" instruction block is injected immediately
//      before the MO COMMERCIAL score bands.
//   2. An equivalent "DOMINANT SIGNAL SELECTION" instruction block is injected
//      immediately before the OR score-levels block.
//
// Both injections are surgical — pinned against exact production strings.
// MO bands themselves are NOT rewritten (distinct from stage2b-mo-tightened.js).
// All else byte-identical to production.
//
// Mechanism targeted: Phase 1's frame-selection finding — when positive AND
// negative signals coexist for a metric, force the model to identify which
// dominates rather than stochastically balance them per run.
//
// Symmetric across MO and OR (both injected) to avoid asymmetric-prompt
// cross-metric coupling we saw in Phase 2A (L2 MD downshift under MO-only edits).
//
// HARD GUARDRAIL: substitution strings are pinned. If the production prompt
// drifts, buildDominantSignalPrompt throws.
// ============================================================================

// Pinned production anchor for MO band block.
// Identical to PRODUCTION_MO_BANDS in stage2b-mo-tightened.js — same source of truth.
const PRODUCTION_MO_BANDS = `For COMMERCIAL ideas:
1-2: No viable revenue path. Substitutes are free and nearly equivalent.
3-4: One weak revenue stream. Low pricing power. Strong free substitutes.
5-6: Proven revenue model with identifiable willingness to pay. Moderate pricing power.
7-8: Clear, strong revenue path. Pricing power supported by lock-in or unique value.
9-10: Exceptional revenue mechanics. Extremely rare.`;

// Pinned production anchor for OR band block.
// "Score levels:" alone is not unique (also appears under MD), so we pin against
// the full OR-specific score-levels block.
const PRODUCTION_OR_BANDS = `Score levels:
1-2: Direct copy. Exists exactly as described.
3-4: Minor twist. Competitors replicate trivially. Narrative originality only.
5-6: Real differentiation but not defensible. Competitors could match with moderate effort.
7-8: Structural advantage competitors cannot easily replicate. Requires proprietary data, novel technical approach, or deep integration that would force competitor product redesign.
9-10: Paradigm shift. Extremely rare.`;

// Block injected immediately BEFORE the MO bands.
const MO_DOMINANT_BLOCK = `**DOMINANT SIGNAL SELECTION (mandatory step before assigning Monetization score):**
The monetization packet often contains both positive and negative monetization signals simultaneously. Examples:
- Positive: named comparable revenue mechanism (subscription/transaction/take-rate), identifiable buyer with willingness-to-pay evidence, named lock-in mechanism, named competitor pricing.
- Negative: free substitutes (LLM/manual/incumbent-bundled), low-frequency usage, weak buyer budget, structural pricing pressure.

When both are present, you MUST:
1. Explicitly name the strongest positive signal AND the strongest negative signal in your explanation.
2. Identify which signal most directly determines whether the buyer pays repeatedly at the proposed price.
3. Begin the Monetization explanation with: "Dominant signal: [positive | negative] — [signal name]."
4. The score must follow from the dominant signal alone. Do NOT split the difference between competing signals; commit to one.

`;

// Block injected immediately BEFORE the OR score-levels block.
const OR_DOMINANT_BLOCK = `**DOMINANT SIGNAL SELECTION (mandatory step before assigning Originality score):**
The originality packet often contains both differentiation and replication-path signals simultaneously. Examples:
- Differentiation: specific positioning gap not served by named competitors, supply-side moat (proprietary data, exclusive partnerships), regulatory or compliance gate, structural barrier from data accumulation.
- Replication-path: incumbent could expand with moderate product effort, similar feature additions trivial, no architectural redesign required to match.

When both are present, you MUST:
1. Explicitly name the strongest differentiation signal AND the strongest replication-path signal in your explanation.
2. Identify which signal most directly determines whether competitors can replicate the offering at scale within 3-6 months.
3. Begin the Originality explanation with: "Dominant signal: [differentiation | replication] — [signal name]."
4. The score must follow from the dominant signal alone. Do NOT split the difference between competing signals; commit to one.

`;

async function buildDominantSignalPrompt() {
  const stage2bMod = await import("../../src/lib/services/prompt-stage2b.js");
  const original = stage2bMod.STAGE2B_SYSTEM_PROMPT;

  // Verify both anchors exist exactly once
  const moOccurrences = original.split(PRODUCTION_MO_BANDS).length - 1;
  const orOccurrences = original.split(PRODUCTION_OR_BANDS).length - 1;

  if (moOccurrences !== 1) {
    throw new Error(
      `MO band anchor found ${moOccurrences} times in production prompt-stage2b.js (expected 1). ` +
      `Production prompt has drifted. Re-pin PRODUCTION_MO_BANDS in stage2b-dominant-signal.js.`
    );
  }
  if (orOccurrences !== 1) {
    throw new Error(
      `OR band anchor found ${orOccurrences} times in production prompt-stage2b.js (expected 1). ` +
      `Production prompt has drifted. Re-pin PRODUCTION_OR_BANDS in stage2b-dominant-signal.js.`
    );
  }

  // Inject blocks BEFORE the band anchors (instruction read just before band lookup).
  let modified = original;
  modified = modified.replace(PRODUCTION_MO_BANDS, MO_DOMINANT_BLOCK + PRODUCTION_MO_BANDS);
  modified = modified.replace(PRODUCTION_OR_BANDS, OR_DOMINANT_BLOCK + PRODUCTION_OR_BANDS);

  // Sanity verification
  if (!modified.includes("DOMINANT SIGNAL SELECTION (mandatory step before assigning Monetization score)")) {
    throw new Error("MO dominant-signal block was not injected — surgery failed.");
  }
  if (!modified.includes("DOMINANT SIGNAL SELECTION (mandatory step before assigning Originality score)")) {
    throw new Error("OR dominant-signal block was not injected — surgery failed.");
  }

  return modified;
}

module.exports = {
  buildDominantSignalPrompt,
  PRODUCTION_MO_BANDS,
  PRODUCTION_OR_BANDS,
  MO_DOMINANT_BLOCK,
  OR_DOMINANT_BLOCK,
};
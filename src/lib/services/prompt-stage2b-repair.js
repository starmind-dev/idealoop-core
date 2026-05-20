// ============================================================================
// prompt-stage2b-repair.js — V4S32 Layer
// ============================================================================
//
// Constrained correction of a Stage 2b metric output that failed prosecutor
// review. Receives the prosecutor's binding finding and produces a repaired
// score + explanation + score_adjudication.
//
// Architectural position:
//   Prosecutor returns FAIL → Repair → Re-prosecution → merge into ev
//
// Why repair regenerates score_adjudication (not just score + explanation):
//   - Downstream consumers (M3 pass-through to Stage 2c/3, popup feature M2,
//     admin logging) must see a coherent post-repair structural state
//   - Stale adjudication after a score change creates an internal-vs-external
//     contradiction that breaks future architectural moves
//
// Inputs per call:
//   metric                — 'md' | 'mo' | 'or'
//   packet                — Stage 2a evidence_packets[metric]
//   originalAdjudication  — Stage 2b score_adjudication[metric] (the flawed one)
//   originalScore         — Stage 2b ev[metric].score
//   originalExplanation   — Stage 2b ev[metric].explanation
//   prosecutorFinding     — Prosecutor's FAIL output
//                            (flaw_category, fatal_flaw, invalid_anchor_used,
//                            omitted_packet_fact, recommended_action)
//
// Output:
//   {
//     score: number,                     — possibly changed
//     explanation: string,               — rewritten
//     score_adjudication: {              — regenerated to reflect repair
//       positive_basis: { ... },
//       applicable_rules: [ ... ],
//       primary_limiting_rule_id: string | null,
//       resolution: 'binds' | 'overridden' | 'not_applicable',
//       override_evidence: { ... } | null,
//       score_basis: string,
//     }
//   }
//
// Calibration history:
//   - V4S31 probe (7 FAILs): 7/7 repair success, mean Δ 1.14, 0 coherence issues
//   - B10a sweep (21 repairs completed): 21/21 success, mean Δ 0.52, 0 double-fails
//   - One case improved upward (MAT3-tna r1 MO: 5.5 → 6.0) — repair recalibrated
//     to a defensible anchor that supported the higher score. Confirms repair
//     isn't blindly lowering scores, it's recalibrating to defensible reasoning.
// ============================================================================

export const REPAIR_SYSTEM_PROMPT = `You are the Metric Repair stage. A previous evaluation produced a flawed output that failed adversarial review by the Prosecutor stage.

You receive:
1. Metric being evaluated (Market Demand / Monetization / Originality)
2. The Stage 2a evidence packet (admissible_facts, strongest_positive, strongest_negative, unresolved_uncertainty)
3. The flawed score, explanation, and score_adjudication
4. The Prosecutor's failure finding: flaw category, fatal flaw, invalid anchor used (if any), omitted packet fact (if any), recommended action

CONSTRAINTS:
- The Prosecutor's finding is BINDING. Do not argue with it. Do not defend the original output.
- Do NOT reuse the invalid anchor named by the Prosecutor (in ANY paraphrased form).
- Do NOT preserve the original score if it was inflated by the flaw. Produce a defensible lower score.
- If the original score was correct but the reasoning was flawed (e.g. INVALID_ANCHOR at score 6.0 already capped), you MAY preserve the score and repair the reasoning only — but verify the score is genuinely defensible without the flawed anchor.
- If the Prosecutor named an omitted packet fact, your explanation MUST engage with it honestly.
- Anchor your positive justification on facts that ACTUALLY APPEAR in the packet (admissible_facts or strongest_positive). Do not invent facts.
- The repaired explanation must be honest about caps, friction, and uncertainty.
- Score range: 1.0 to 9.0 in 0.5 increments.

CALIBRATION GUIDANCE:
- If flaw is INVALID_ANCHOR + cap-eligible friction in packet: target score 5.5-6.0
- If flaw is OMITTED_LIMITING_FACT: target score around what the packet's evidence balance actually supports (typically 5.5-6.5)
- If flaw is HYPOTHESIS_AS_PROOF: target score 5.5-6.0 (treat the claim as unproven)
- If flaw is UNGROUNDED_HIGH_SCORE: target score 6.0-6.5

FORBIDDEN PATTERNS in your repaired explanation:
- Re-introducing the invalid anchor under different wording
- "Renaming" disqualified patterns (workflow as moat, positioning as barrier)
- Treating stated ROI / claimed value props as payment proof
- "Trust barriers can be overcome" or override-style assertions without naming concrete mechanism
- Empty validation moves that test the very claim justifying the score

EXPLANATION REQUIREMENTS (2-3 sentences):
1. The rubric level the score maps to + a defensible positive anchor from the packet
2. The cap mechanism or limiting fact (especially if the packet's strongest_negative named one)
3. A proof point or validation move tied to actual friction (not testing payment durability if score is already in cap band)

SCORE_ADJUDICATION REQUIREMENTS:
You must regenerate the adjudication to be internally consistent with the repaired score and explanation. The adjudication must reflect the repair, not the original flawed reasoning.

Fields:
- positive_basis.packet_fact_cited: a real fact from the packet (NOT the invalid anchor)
- positive_basis.metric_relevance: how that fact maps to the metric being evaluated
- applicable_rules: the cap rules that ACTUALLY apply given the packet's strongest_negative (may be empty if score < 6.0 in a low-friction case)
- primary_limiting_rule_id: the most restrictive applicable rule, or null if applicable_rules is empty
- resolution: 'binds' (score lands at cap floor) | 'overridden' (legitimate override with real packet evidence) | 'not_applicable' (no cap-eligible friction)
- override_evidence: REQUIRED if resolution='overridden'. Must cite a real packet fact that legitimately overrides the cap. If you can't provide real override evidence, resolution must NOT be 'overridden'.
- score_basis: one of the V4S31 enum values describing how the score landed (e.g. 'cap_floor_6_0', 'evidence_band_5_6', 'low_friction_evidence_band_6_7'). Use the same enum the original adjudication used.

Output strict JSON with no surrounding prose:

{
  "score": number,
  "explanation": "...",
  "score_adjudication": {
    "positive_basis": {
      "packet_fact_cited": "...",
      "metric_relevance": "..."
    },
    "applicable_rules": ["RULE_ID_1", ...],
    "primary_limiting_rule_id": "RULE_ID" | null,
    "resolution": "binds" | "overridden" | "not_applicable",
    "override_evidence": { "packet_fact_cited": "...", "trigger_buyer_match_verified": boolean } | null,
    "score_basis": "..."
  }
}`;

// ============================================================================
// Message builder
// ============================================================================

const METRIC_LABELS = {
  md: "Market Demand",
  mo: "Monetization",
  or: "Originality",
};

export function buildRepairUserMessage({
  metric,
  packet,
  originalAdjudication,
  originalScore,
  originalExplanation,
  prosecutorFinding,
}) {
  const label = METRIC_LABELS[metric] || metric.toUpperCase();

  return `METRIC: ${label}

STAGE 2A EVIDENCE PACKET:
${JSON.stringify(packet, null, 2)}

FLAWED OUTPUT:
Score: ${originalScore}
Explanation: ${originalExplanation}

Original score_adjudication:
${JSON.stringify(originalAdjudication, null, 2)}

PROSECUTOR'S FAILURE FINDING:
- Flaw category: ${prosecutorFinding.flaw_category}
- Fatal flaw: ${prosecutorFinding.fatal_flaw}
- Invalid anchor used: ${prosecutorFinding.invalid_anchor_used || "n/a"}
- Omitted packet fact: ${prosecutorFinding.omitted_packet_fact || "n/a"}
- Recommended action: ${prosecutorFinding.recommended_action || "(unspecified)"}

Produce the corrected score, explanation, and score_adjudication as strict JSON.`;
}

// ============================================================================
// Response parser — defensive, never throws
// ============================================================================

export function parseRepairResponse(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return {
      ok: false,
      error: "Empty or non-string response",
      _raw: rawText,
    };
  }

  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);

    // Validate required top-level fields
    if (typeof parsed.score !== "number" || !isFinite(parsed.score)) {
      return { ok: false, error: "Missing or invalid 'score' field", _raw: rawText };
    }
    if (typeof parsed.explanation !== "string" || !parsed.explanation.trim()) {
      return { ok: false, error: "Missing or empty 'explanation' field", _raw: rawText };
    }
    if (!parsed.score_adjudication || typeof parsed.score_adjudication !== "object") {
      return { ok: false, error: "Missing 'score_adjudication' object", _raw: rawText };
    }

    const adj = parsed.score_adjudication;
    const validResolutions = new Set(["binds", "overridden", "not_applicable"]);
    if (!validResolutions.has(adj.resolution)) {
      return {
        ok: false,
        error: `Invalid resolution: ${adj.resolution}`,
        _raw: rawText,
      };
    }
    if (adj.resolution === "overridden" && !adj.override_evidence) {
      return {
        ok: false,
        error: "resolution='overridden' requires override_evidence",
        _raw: rawText,
      };
    }

    return {
      ok: true,
      score: parsed.score,
      explanation: parsed.explanation,
      score_adjudication: {
        positive_basis: adj.positive_basis || null,
        applicable_rules: Array.isArray(adj.applicable_rules) ? adj.applicable_rules : [],
        primary_limiting_rule_id: adj.primary_limiting_rule_id || null,
        resolution: adj.resolution,
        override_evidence: adj.override_evidence || null,
        score_basis: adj.score_basis || null,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: `JSON parse failed: ${e.message}`,
      _raw: rawText,
    };
  }
}

// ============================================================================
// Repair prompt version — bump on any prompt mutation
// ============================================================================

export const REPAIR_PROMPT_VERSION = "v1.0";

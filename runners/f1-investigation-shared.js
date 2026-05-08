// ============================================================================
// runners/f1-investigation-shared.js
// ============================================================================
// Extension module for the F1 deep investigation runners (Phase 1, 2A, 2B, 2C).
//
// The base f1-diagnostic-shared.js handles fixtures, stats, checkpoints, and
// case loading. This module adds the ability to run Stage 2b with:
//   - A CUSTOM system prompt (for prompt-counterfactual tests 2A and 2B)
//   - A CUSTOM sampler config (for sampler-hardening test 2C)
//   - FULL output capture (for observational deep capture in Phase 1)
//
// Pure-additive — does not modify f1-diagnostic-shared.js. Inherits its
// fixture cache, so all variant runners operate on identical Stage 2a packets
// for clean apples-to-apples comparison.
// ============================================================================

const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const shared = require("./f1-diagnostic-shared.js");

// ============================================================================
// LOCAL HELPERS (small duplication of internals from diagnostic-shared)
// ============================================================================

let _client = null;
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY env var required");
  _client = new Anthropic({ apiKey });
  return _client;
}

function cleanJsonResponse(text) {
  if (!text || typeof text !== "string") return text;
  const trimmed = text.trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return trimmed;
  return trimmed.slice(firstBrace, lastBrace + 1);
}

// ============================================================================
// STAGE 2b WITH OPTIONS
// ============================================================================
// Wraps the Stage 2b call to accept a custom prompt and sampler. Fixture
// loading + JSON cleaning + parsing identical to production.
//
// options.systemPrompt — optional string. Defaults to production STAGE2B_SYSTEM_PROMPT.
// options.sampler      — optional object. Defaults to { temperature: 0 }
//                         (production state). Pass { temperature: 0, top_k: 1, top_p: 0.1 }
//                         for sampler hardening test.
//
// Returns the parsed Stage 2b output (full object, not just scores).

async function runStage2bWithOptions(caseDef, stage2aResult, options = {}) {
  const client = getClient();
  let systemPrompt = options.systemPrompt;
  if (!systemPrompt) {
    // Lazy-load production prompt only if no override
    const stage2bMod = await import("../src/lib/services/prompt-stage2b.js");
    systemPrompt = stage2bMod.STAGE2B_SYSTEM_PROMPT;
  }
  const sampler = options.sampler || shared.STAGE2_SAMPLER;

  const userMessage = `USER'S AI PRODUCT IDEA:
${caseDef.idea}

=== EVIDENCE PACKETS FROM STAGE 2a ===
${JSON.stringify(stage2aResult)}`;

  const response = await client.messages.create({
    model: shared.MODEL_ID,
    max_tokens: shared.MAX_TOKENS.stage2b,
    ...sampler,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content[0].text;
  return JSON.parse(cleanJsonResponse(text));
}

// ============================================================================
// FULL-OUTPUT EXTRACTION (for Phase 1 deep capture)
// ============================================================================

function extractFullStage2bRecord(result) {
  const ev = result?.evaluation;
  if (!ev) return { error: "missing evaluation block" };
  return {
    scores: {
      md: ev.market_demand?.score,
      mo: ev.monetization?.score,
      or: ev.originality?.score,
    },
    explanations: {
      md: ev.market_demand?.explanation,
      mo: ev.monetization?.explanation,
      or: ev.originality?.explanation,
    },
    evidence_strength: {
      level: ev.evidence_strength?.level,
      reason: ev.evidence_strength?.reason,
      thin_dimensions: ev.evidence_strength?.thin_dimensions,
    },
    extras: {
      geographic_note: ev.market_demand?.geographic_note,
      trajectory_note: ev.market_demand?.trajectory_note,
      monetization_label: ev.monetization?.label,
      marketplace_note: ev.marketplace_note,
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  runStage2bWithOptions,
  extractFullStage2bRecord,
  // Re-export from base for convenience
  ...shared,
};
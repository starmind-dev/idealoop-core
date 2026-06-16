import { NextResponse } from "next/server";
import client from "../../../lib/services/anthropic-client";
import { STAGE_TC_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage-tc";

// ============================================
// STAGE TC ISOLATED ENDPOINT — V4S29 VERIFICATION HARNESS
// ============================================
// Takes { idea, profile } and returns Stage TC output directly without
// running the full pipeline. Used by run-v4s29-stage-tc-verification-http.js
// for cost-efficient verification (~$0.03/call vs ~$0.55/call for full
// pipeline).
//
// This endpoint runs ONLY the Stage TC Sonnet call. No Stage 1, no Stage 2a,
// no Stage 2b, no Stage 2c, no Stage 3. Per V4S10 quarantine principle,
// Stage TC takes only idea + profile and is structurally isolated.
//
// Schema per V4S29 structural session (May 17, 2026):
//   {
//     technical_complexity: {
//       base_score, base_score_explanation,
//       adjustment_value, adjustment_explanation,
//       score, incremental_note
//     }
//   }
//
// Sampler hardening preserved from V4S28 Bundle 2: temperature 0, top_p 0.1
// (Bundle 2 stabilized within-rerun numeric values but not arithmetic
// consistency; V4S29 prompt rewrite addresses arithmetic at the prompt
// structure layer).

export async function POST(request) {
  try {
    const { idea, profile } = await request.json();

    if (!idea || !idea.trim()) {
      return NextResponse.json(
        { error: "No idea provided" },
        { status: 400 }
      );
    }
    if (!profile || typeof profile !== "object") {
      return NextResponse.json(
        { error: "No profile provided" },
        { status: 400 }
      );
    }

    // Helper to clean LLM JSON responses — same shape as in analyze-pro/route.js
    // V4S28 B9 Stage TC parse hardening: locate first { and last } to handle
    // bare JSON, fenced JSON, prose preamble + JSON, and JSON + trailing prose
    // uniformly. Inlined per existing codebase pattern (each route defines
    // its own copy rather than importing from a shared module).
    function cleanJsonResponse(text) {
      if (!text || typeof text !== "string") {
        return text;
      }
      const trimmed = text.trim();
      const firstBrace = trimmed.indexOf("{");
      const lastBrace = trimmed.lastIndexOf("}");
      if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
        return trimmed;
      }
      return trimmed.slice(firstBrace, lastBrace + 1);
    }

    // Build user message — mirrors the shape Stage TC receives in the full pipeline
    const userMessage = `Idea:
${idea}

Founder profile:
- Coding: ${profile.coding || "(unspecified)"}
- AI experience: ${profile.ai || "(unspecified)"}
- Education/background: ${profile.education || "(unspecified)"}

Score Technical Complexity per the instructions. Return only the JSON object.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      temperature: 0,
      system: STAGE_TC_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = response.content?.[0]?.text || "";
    const cleaned = cleanJsonResponse(raw);

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      return NextResponse.json(
        {
          error: "Stage TC returned unparseable JSON",
          raw_preview: raw.slice(0, 500),
          parse_error: err.message,
        },
        { status: 500 }
      );
    }

    // Stage TC prompt instructs the model to wrap output in technical_complexity.
    // Tolerate both wrapped and unwrapped shapes — runner's extractTC() handles both.
    const tc = parsed.technical_complexity || parsed;

    return NextResponse.json({ technical_complexity: tc });
  } catch (err) {
    console.error("Stage TC endpoint error:", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
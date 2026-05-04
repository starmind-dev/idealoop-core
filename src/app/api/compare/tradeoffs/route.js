import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { TRADEOFFS_SYSTEM_PROMPT } from "../../prompts/prompt-tradeoffs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// V4S28 B9 thin_dimensions hygiene (per Narrative Contract V7 §3.9a):
// thin_dimensions is UI-only metadata. It MUST NOT propagate to any LLM call
// beyond the Stage 2b call that emits it. The frontend-built comparisonData
// payload may carry thin_dimensions on either idea's evidence_strength
// (because the persisted evaluation correctly carries it). This route is
// where the LLM boundary is enforced — strip thin_dimensions from both
// ideas' evidence_strength before JSON.stringify into the Sonnet message.
//
// Non-mutating destructure-rest pattern: returns a new comparisonData object
// without mutating the client-provided one. Defensive: handles missing
// idea_a / idea_b / evidence_strength shapes gracefully.
function sanitizeComparisonData(comparisonData) {
  if (!comparisonData) return comparisonData;

  const stripFromIdea = (idea) => {
    if (!idea || !idea.evidence_strength) return idea;
    const { thin_dimensions, ...cleanEvidenceStrength } = idea.evidence_strength;
    return { ...idea, evidence_strength: cleanEvidenceStrength };
  };

  return {
    ...comparisonData,
    idea_a: stripFromIdea(comparisonData.idea_a),
    idea_b: stripFromIdea(comparisonData.idea_b),
  };
}

export async function POST(request) {
  try {
    // Auth check
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { comparisonData } = body;

    if (!comparisonData || !comparisonData.idea_a || !comparisonData.idea_b) {
      return NextResponse.json(
        { error: "Missing comparison data" },
        { status: 400 }
      );
    }

    // V4S28 B9: strip thin_dimensions from both ideas' evidence_strength
    // before passing the payload to Sonnet. UI-only metadata invariant.
    const sanitizedData = sanitizeComparisonData(comparisonData);

    // Call Sonnet with the tradeoffs prompt
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      temperature: 0,
      system: TRADEOFFS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze the following comparison data and produce a tradeoff synthesis:\n\n${JSON.stringify(sanitizedData, null, 2)}`,
        },
      ],
    });

    const rawText =
      response.content?.[0]?.text || response.content?.[0]?.value || "";

    // Parse JSON from response
    let tradeoffsResult;
    try {
      const cleaned = rawText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      tradeoffsResult = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("Tradeoffs JSON parse error:", parseError);
      console.error("Raw response:", rawText);
      return NextResponse.json(
        { error: "Failed to parse tradeoffs response" },
        { status: 500 }
      );
    }

    // Validate structure
    if (!tradeoffsResult.decision_summary || !tradeoffsResult.tradeoffs) {
      return NextResponse.json(
        { error: "Invalid tradeoffs response structure" },
        { status: 500 }
      );
    }

    return NextResponse.json({ tradeoffs: tradeoffsResult });
  } catch (err) {
    console.error("Tradeoffs API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
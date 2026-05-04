import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { DELTA_SYSTEM_PROMPT } from "../../../prompts/prompt-delta.js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function authenticate(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Helper: clean JSON from Sonnet response
function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

// Helper: extract score from evaluation scoring_json
function extractScores(evaluation) {
  return {
    market_demand: evaluation.market_demand_score || 0,
    monetization: evaluation.monetization_score || 0,
    originality: evaluation.originality_score || 0,
    technical_complexity: evaluation.technical_complexity_score || 0,
    overall: evaluation.weighted_overall_score || 0,
  };
}

// Helper: extract failure risks from scoring_json
function extractRisks(evaluation) {
  const sj = evaluation.scoring_json || {};
  return sj.failure_risks || [];
}

// Helper: extract evidence_strength from scoring_json.
//
// V4S28 B9 thin_dimensions hygiene (per Narrative Contract V7 §3.9a):
// thin_dimensions is UI-only metadata. It MUST NOT propagate to any LLM call
// beyond the Stage 2b call that emits it. This Delta route is a post-pipeline
// LLM call that reads the persisted evaluation, which (correctly) carries
// thin_dimensions. Strip it here before the value enters the deltaInput
// payload sent to Sonnet. Non-mutating destructure-rest pattern preserves
// the persisted source object.
function extractEvidenceStrength(evaluation) {
  const sj = evaluation.scoring_json || {};
  const es = sj.evidence_strength;
  if (!es) return null;
  // Strip thin_dimensions before returning. If absent (HIGH/MEDIUM), the rest
  // pattern produces an identical-shape object minus the property.
  const { thin_dimensions, ...cleanEvidenceStrength } = es;
  return cleanEvidenceStrength;
}

// Helper: extract competitor names
function extractCompetitorNames(evaluation) {
  const competitors = evaluation.competitors_json || [];
  return competitors.map(c => ({
    name: c.name || "Unknown",
    type: c.type || c.classification || "unknown",
  }));
}

// Helper: compute evidence deltas between parent and child
function computeEvidenceDeltas(parentEval, childEval) {
  const parentCompNames = (parentEval.competitors_json || []).map(c => c.name).filter(Boolean);
  const childCompNames = (childEval.competitors_json || []).map(c => c.name).filter(Boolean);

  const competitorsAdded = childCompNames.filter(n => !parentCompNames.includes(n));
  const competitorsRemoved = parentCompNames.filter(n => !childCompNames.includes(n));

  const parentRisks = extractRisks(parentEval).map(r => typeof r === "string" ? r : r.risk || r.description || JSON.stringify(r));
  const childRisks = extractRisks(childEval).map(r => typeof r === "string" ? r : r.risk || r.description || JSON.stringify(r));

  // Simple text-based diff for risks (not exact match, but good enough)
  const risksAdded = childRisks.filter(r => !parentRisks.some(pr => pr.toLowerCase().includes(r.substring(0, 30).toLowerCase())));
  const risksRemoved = parentRisks.filter(r => !childRisks.some(cr => cr.toLowerCase().includes(r.substring(0, 30).toLowerCase())));

  const parentEstimates = parentEval.estimates_json || {};
  const childEstimates = childEval.estimates_json || {};

  return {
    competitors_added: competitorsAdded,
    competitors_removed: competitorsRemoved,
    risks_added: risksAdded,
    risks_removed: risksRemoved,
    duration_change: parentEstimates.duration && childEstimates.duration && parentEstimates.duration !== childEstimates.duration
      ? `${parentEstimates.duration} → ${childEstimates.duration}`
      : null,
    difficulty_change: parentEstimates.difficulty && childEstimates.difficulty && parentEstimates.difficulty !== childEstimates.difficulty
      ? `${parentEstimates.difficulty} → ${childEstimates.difficulty}`
      : null,
  };
}

// ============================================
// POST /api/ideas/[id]/delta
// Compute or return cached delta explanation for a branch idea.
// ============================================
export async function POST(request, { params }) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { id: ideaId } = await params;
    if (!ideaId) {
      return NextResponse.json({ error: "Missing idea ID." }, { status: 400 });
    }

    // Load the branch idea
    const { data: childIdea, error: childIdeaError } = await supabaseAdmin
      .from("ideas")
      .select("id, user_id, parent_idea_id, branch_reason, changed_dimensions, title")
      .eq("id", ideaId)
      .eq("user_id", user.id)
      .single();

    if (childIdeaError || !childIdea) {
      return NextResponse.json({ error: "Idea not found." }, { status: 404 });
    }

    if (!childIdea.parent_idea_id) {
      return NextResponse.json({ error: "This idea is not a branch — delta explanation is only available for branches." }, { status: 400 });
    }

    // Load child's latest evaluation
    const { data: childEval, error: childEvalError } = await supabaseAdmin
      .from("evaluations")
      .select("*")
      .eq("idea_id", ideaId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (childEvalError || !childEval) {
      return NextResponse.json({ error: "No evaluation found for this branch." }, { status: 404 });
    }

    // Check for cached delta result
    const existingMeta = childEval.meta_json || {};
    if (existingMeta.delta_result) {
      return NextResponse.json({ delta: existingMeta.delta_result, cached: true });
    }

    // Load parent's latest evaluation
    const { data: parentEval, error: parentEvalError } = await supabaseAdmin
      .from("evaluations")
      .select("*")
      .eq("idea_id", childIdea.parent_idea_id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (parentEvalError || !parentEval) {
      return NextResponse.json({ error: "Parent evaluation not found." }, { status: 404 });
    }

    // Load parent idea for title
    const { data: parentIdea } = await supabaseAdmin
      .from("ideas")
      .select("title")
      .eq("id", childIdea.parent_idea_id)
      .single();

    // Extract structured data
    const parentScores = extractScores(parentEval);
    const childScores = extractScores(childEval);

    const scoreDeltas = {
      market_demand: +(childScores.market_demand - parentScores.market_demand).toFixed(1),
      monetization: +(childScores.monetization - parentScores.monetization).toFixed(1),
      originality: +(childScores.originality - parentScores.originality).toFixed(1),
      technical_complexity: +(childScores.technical_complexity - parentScores.technical_complexity).toFixed(1),
      overall: +(childScores.overall - parentScores.overall).toFixed(1),
    };

    const evidenceDeltas = computeEvidenceDeltas(parentEval, childEval);

    // Extract changed_fields from child evaluation's meta_json
    const childMeta = childEval.meta_json || {};
    const changedFields = childMeta.changed_fields || null;

    // Build the structured input for Sonnet
    // Note: extractEvidenceStrength() strips thin_dimensions per V4S28 B9 hygiene.
    const deltaInput = {
      parent_evaluation: {
        title: parentIdea?.title || "Parent idea",
        scores: parentScores,
        failure_risks: extractRisks(parentEval),
        evidence_strength: extractEvidenceStrength(parentEval),
        competitors: extractCompetitorNames(parentEval),
        competitor_count: (parentEval.competitors_json || []).length,
        competition_summary: parentEval.competition_summary || "",
        roadmap_phase_count: (parentEval.roadmap_json || []).length,
        duration: (parentEval.estimates_json || {}).duration || "unknown",
        difficulty: (parentEval.estimates_json || {}).difficulty || "unknown",
      },
      child_evaluation: {
        title: childIdea.title || "Branch idea",
        scores: childScores,
        failure_risks: extractRisks(childEval),
        evidence_strength: extractEvidenceStrength(childEval),
        competitors: extractCompetitorNames(childEval),
        competitor_count: (childEval.competitors_json || []).length,
        competition_summary: childEval.competition_summary || "",
        roadmap_phase_count: (childEval.roadmap_json || []).length,
        duration: (childEval.estimates_json || {}).duration || "unknown",
        difficulty: (childEval.estimates_json || {}).difficulty || "unknown",
      },
      changed_fields: changedFields,
      branch_reason: childIdea.branch_reason || null,
      changed_dimensions: childIdea.changed_dimensions || [],
      score_deltas: scoreDeltas,
      evidence_deltas: evidenceDeltas,
    };

    // Call Sonnet
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0,
      system: DELTA_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze the following delta between a parent idea and its branch:\n\n${JSON.stringify(deltaInput, null, 2)}`,
        },
      ],
    });

    const rawText = response.content[0]?.text || "";
    let deltaResult;

    try {
      deltaResult = JSON.parse(cleanJsonResponse(rawText));
    } catch (parseErr) {
      console.error("Delta JSON parse error:", parseErr);
      console.error("Raw response:", rawText.substring(0, 500));
      return NextResponse.json({ error: "Failed to parse delta analysis." }, { status: 500 });
    }

    // Attach score_deltas to the result for the frontend score movement bar
    deltaResult.score_deltas = scoreDeltas;

    // Cache the result in the evaluation's meta_json
    const updatedMeta = {
      ...existingMeta,
      delta_result: deltaResult,
    };

    await supabaseAdmin
      .from("evaluations")
      .update({ meta_json: updatedMeta })
      .eq("id", childEval.id)
      .eq("user_id", user.id);

    return NextResponse.json({ delta: deltaResult, cached: false });
  } catch (err) {
    console.error("Delta error:", err);
    return NextResponse.json({ error: "Something went wrong computing delta." }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function authenticate(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ============================================
// POST /api/ideas/[id]/branch
// Creates a NEW idea row linked to the parent idea,
// plus a new evaluation row under the new idea.
// This is the core branching operation.
// ============================================
export async function POST(request, { params }) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { id: parentIdeaId } = await params;
    if (!parentIdeaId) {
      return NextResponse.json({ error: "Missing parent idea ID." }, { status: 400 });
    }

    // Verify parent idea exists and belongs to user
    const { data: parentIdea, error: parentError } = await supabaseAdmin
      .from("ideas")
      .select("id, user_id, title")
      .eq("id", parentIdeaId)
      .eq("user_id", user.id)
      .single();

    if (parentError || !parentIdea) {
      return NextResponse.json({ error: "Parent idea not found." }, { status: 404 });
    }

    const body = await request.json();
    const {
      title,
      raw_idea_text,
      branch_reason,
      changed_dimensions,
      analysis,
      profile,
      changed_fields,
    } = body;

    // Validate required fields
    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Branch name is required." }, { status: 400 });
    }
    if (!branch_reason || !branch_reason.trim()) {
      return NextResponse.json({ error: "Branch reason is required." }, { status: 400 });
    }
    if (!changed_dimensions || !Array.isArray(changed_dimensions) || changed_dimensions.length === 0) {
      return NextResponse.json({ error: "At least one changed dimension is required." }, { status: 400 });
    }
    if (!analysis) {
      return NextResponse.json({ error: "Missing analysis data." }, { status: 400 });
    }

    // 1. Create the new idea row (branch)
    const { data: newIdea, error: ideaError } = await supabaseAdmin
      .from("ideas")
      .insert({
        user_id: user.id,
        title: title.trim(),
        raw_idea_text: raw_idea_text || "",
        profile_context_json: profile || null,
        status: "active",
        parent_idea_id: parentIdeaId,
        branch_reason: branch_reason.trim(),
        changed_dimensions: changed_dimensions,
        is_main_version: false,
      })
      .select("id")
      .single();

    if (ideaError) {
      console.error("Branch idea insert error:", ideaError);
      return NextResponse.json(
        { error: "Failed to create branch: " + ideaError.message },
        { status: 500 }
      );
    }

    // 2. Create evaluation row under the new idea
    const scoringJson = {
      market_demand: analysis.evaluation?.market_demand || null,
      monetization: analysis.evaluation?.monetization || null,
      originality: analysis.evaluation?.originality || null,
      technical_complexity: analysis.evaluation?.technical_complexity || null,
      marketplace_note: analysis.evaluation?.marketplace_note || null,
      failure_risks: analysis.evaluation?.failure_risks || [],
      confidence_level: analysis.evaluation?.confidence_level || null,
    };

    const metaJson = {
      ...(analysis._meta || {}),
      changed_fields: changed_fields || null,
      branch_of: parentIdeaId,
    };

    const { data: evalData, error: evalError } = await supabaseAdmin
      .from("evaluations")
      .insert({
        idea_id: newIdea.id,
        user_id: user.id,
        evaluation_mode: analysis._meta?.evaluation_mode || "free_single",
        prompt_version: analysis._meta?.prompt_version || null,
        search_strategy_version: analysis._meta?.search_strategy_version || null,
        score_formula_version: analysis._meta?.score_formula_version || null,
        keywords_used: analysis._meta?.keywords_used || null,
        evidence_json: analysis._meta?.evidence || null,
        meta_json: metaJson,
        competitors_json: analysis.competition?.competitors || [],
        competition_summary: analysis.competition?.differentiation || "",
        data_source: analysis.competition?.data_source || "llm_generated",
        classification: analysis.classification || "commercial",
        scope_warning: analysis.scope_warning || false,
        scoring_json: scoringJson,
        roadmap_json: analysis.phases || [],
        tools_json: analysis.tools || [],
        estimates_json: analysis.estimates || {},
        market_demand_score: analysis.evaluation?.market_demand?.score || 0,
        monetization_score: analysis.evaluation?.monetization?.score || 0,
        originality_score: analysis.evaluation?.originality?.score || 0,
        technical_complexity_score: analysis.evaluation?.technical_complexity?.score || 0,
        weighted_overall_score: analysis.evaluation?.overall_score || 0,
        summary_text: analysis.evaluation?.summary || "",
      })
      .select("id")
      .single();

    if (evalError) {
      console.error("Branch evaluation insert error:", evalError);
      // Clean up the idea row if evaluation insert failed
      await supabaseAdmin.from("ideas").delete().eq("id", newIdea.id);
      return NextResponse.json(
        { error: "Failed to save evaluation: " + evalError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      idea_id: newIdea.id,
      evaluation_id: evalData.id,
    });
  } catch (err) {
    console.error("Branch error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
// src/app/api/ideas/[id]/route.js
// CHANGE vs current: maps evaluation.execution_brief_json onto the returned
// `analysis` object (one line in the GET handler's analysis assembly). The
// evaluation is already fetched with select("*"), so the column rides back
// automatically once it exists — no select change needed. This is what lets the
// frontend decide, on a hub-loaded idea, whether to show "Continue to Execution
// Brief" (brief present) or "Generate Execution Brief" (brief null).

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

// Collect an idea + every descendant branch (walk DOWN the parent_idea_id tree).
// Used so deleting a root/parent archives its whole lineage, not just the one row.
async function collectSubtreeIds(rootId, userId) {
  const ids = [rootId];
  let frontier = [rootId];
  const seen = new Set([rootId]); // safety against cycles

  while (frontier.length > 0) {
    const { data: children, error } = await supabaseAdmin
      .from("ideas")
      .select("id")
      .eq("user_id", userId)
      .in("parent_idea_id", frontier);

    if (error || !children || children.length === 0) break;

    const next = [];
    for (const c of children) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        ids.push(c.id);
        next.push(c.id);
      }
    }
    frontier = next;
  }

  return ids;
}

export async function GET(request, { params }) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { id: ideaId } = await params;
    if (!ideaId) {
      return NextResponse.json({ error: "Missing idea ID." }, { status: 400 });
    }

    const { data: idea, error: ideaError } = await supabaseAdmin
      .from("ideas")
      .select("id, title, raw_idea_text, profile_context_json, status, created_at")
      .eq("id", ideaId)
      .eq("user_id", user.id)
      .single();

    if (ideaError || !idea) {
      return NextResponse.json({ error: "Idea not found." }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const requestedEvalId = searchParams.get("evaluation_id");

    let evaluation;

    if (requestedEvalId) {
      const { data: evalData, error: evalError } = await supabaseAdmin
        .from("evaluations")
        .select("*")
        .eq("id", requestedEvalId)
        .eq("idea_id", ideaId)
        .eq("user_id", user.id)
        .single();

      if (evalError || !evalData) {
        return NextResponse.json({ error: "Evaluation not found." }, { status: 404 });
      }
      evaluation = evalData;
    } else {
      const { data: evalData, error: evalError } = await supabaseAdmin
        .from("evaluations")
        .select("*")
        .eq("idea_id", ideaId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (evalError || !evalData) {
        return NextResponse.json({ error: "Evaluation not found." }, { status: 404 });
      }
      evaluation = evalData;
    }

    const analysis = {
      evaluation: {
        overall_score: evaluation.weighted_overall_score,
        market_demand: evaluation.scoring_json?.market_demand || {
          score: evaluation.market_demand_score,
          explanation: "",
        },
        monetization: evaluation.scoring_json?.monetization || {
          score: evaluation.monetization_score,
          explanation: "",
        },
        originality: evaluation.scoring_json?.originality || {
          score: evaluation.originality_score,
          explanation: "",
        },
        technical_complexity: evaluation.scoring_json?.technical_complexity || {
          score: evaluation.technical_complexity_score,
          explanation: "",
        },
        marketplace_note: evaluation.scoring_json?.marketplace_note || null,
        failure_risks: evaluation.scoring_json?.failure_risks || [],
        evidence_strength: evaluation.scoring_json?.evidence_strength || null,
        summary: evaluation.summary_text || "",
      },
      competition: {
        competitors: evaluation.competitors_json || [],
        differentiation: evaluation.competition_summary || "",
        data_source: evaluation.data_source || "llm_generated",
      },
      estimates: evaluation.estimates_json || {},
      classification: evaluation.classification || "commercial",
      scope_warning: evaluation.scope_warning || false,
      _meta: evaluation.meta_json || {},
      // NEW: the persisted execution brief (null when none generated yet). The
      // frontend reads this to choose "Continue to Execution Brief" vs "Generate".
      execution_brief: evaluation.execution_brief_json || null,
    };

    return NextResponse.json({
      idea,
      analysis,
      evaluation_id: evaluation.id,
      profile: idea.profile_context_json || {},
    });
  } catch (err) {
    console.error("Get idea error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { id: ideaId } = await params;
    if (!ideaId) {
      return NextResponse.json({ error: "Missing idea ID." }, { status: 400 });
    }

    // Verify the idea exists and belongs to the user before touching anything.
    const { data: target, error: targetError } = await supabaseAdmin
      .from("ideas")
      .select("id")
      .eq("id", ideaId)
      .eq("user_id", user.id)
      .single();

    if (targetError || !target) {
      return NextResponse.json({ error: "Idea not found." }, { status: 404 });
    }

    // Archive the idea AND all of its descendant branches in one update,
    // so deleting a root/parent clears its whole lineage instead of leaving
    // orphaned branches still active in the hub.
    const subtreeIds = await collectSubtreeIds(ideaId, user.id);

    const { error: archiveError } = await supabaseAdmin
      .from("ideas")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .in("id", subtreeIds);

    if (archiveError) {
      return NextResponse.json(
        { error: "Failed to archive: " + archiveError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      archived_ids: subtreeIds,
      archived_count: subtreeIds.length,
    });
  } catch (err) {
    console.error("Archive idea error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { id: ideaId } = await params;
    if (!ideaId) {
      return NextResponse.json({ error: "Missing idea ID." }, { status: 400 });
    }

    const body = await request.json();
    const updates = {};

    // Validate status_label if provided
    if (body.status_label !== undefined) {
      const allowed = ["exploring", "lead", "parked", "killed"];
      if (!allowed.includes(body.status_label)) {
        return NextResponse.json(
          { error: `Invalid status_label. Must be one of: ${allowed.join(", ")}` },
          { status: 400 }
        );
      }
      updates.status_label = body.status_label;
    }

    // Validate title if provided
    if (body.title !== undefined) {
      const trimmed = (body.title || "").trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
      }
      updates.title = trimmed;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("ideas")
      .update(updates)
      .eq("id", ideaId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("PATCH /api/ideas/[id] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ idea: data });
  } catch (err) {
    console.error("PATCH /api/ideas/[id] unexpected error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
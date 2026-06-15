// src/app/api/ideas/[id]/route.js
//
// CUTOVER STEP 1 — CARD ROOMS. The GET routes through the ideas service's single
// source of truth (getIdea + resolveState) and returns a STATE-tagged payload so
// the hub can open the right room:
//   rough   -> { state:'rough',   analysis:null, explore:null }   (idea text + two doors)
//   explore -> { state:'explore', analysis:null, explore:<envelope> }  (ExploreView, dormant)
//   deep    -> { state:'deep',    analysis:<…>,  explore:null }   (the 3-screen flow)
// Eval-less ideas (rough / explore) NO LONGER 404 — the old GET .single()'d the
// evaluations row and 404'd on any idea without one, which is why rough cards
// would not open. The DEEP `analysis` object is byte-identical to the prior route,
// so the deep-open path (applyLoadedIdea -> results1) is untouched. `?evaluation_id=`
// selection is preserved; state is then derived from the SELECTED eval.
// DELETE and PATCH are UNCHANGED.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getIdea, resolveState } from "@/lib/services/ideas";

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

// Build the DEEP `analysis` object from an evaluation row. BYTE-IDENTICAL to the
// prior route's assembly so the deep-open path (applyLoadedIdea) is unaffected.
function buildDeepAnalysis(evaluation) {
  return {
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
    // The persisted execution brief (null when none generated yet). The frontend
    // reads this to choose "Continue to Execution Brief" vs "Generate".
    execution_brief: evaluation.execution_brief_json || null,
  };
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

    // Single source of truth: the service fetches the idea + all evals (sorted
    // latest-first), derives state, and TOLERATES eval-less ideas (rough/explore).
    const idea = await getIdea(user.id, ideaId);
    if (!idea || idea.status === "archived") {
      return NextResponse.json({ error: "Idea not found." }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const requestedEvalId = searchParams.get("evaluation_id");
    const evals = idea.evaluations || [];

    // Pick the target eval: a specifically-requested one (branch / alternatives
    // load) else the latest. A requested-but-missing eval is a real 404. A rough
    // idea simply has none — that is no longer an error.
    let evaluation = null;
    if (requestedEvalId) {
      evaluation = evals.find((e) => e.id === requestedEvalId) || null;
      if (!evaluation) {
        return NextResponse.json({ error: "Evaluation not found." }, { status: 404 });
      }
    } else {
      evaluation = evals[0] || null;
    }

    // Derive state from the SELECTED eval via the service's single resolver.
    const { mode } = evaluation
      ? resolveState({ evaluations: [evaluation] })
      : { mode: "rough" };

    const ideaOut = {
      id: idea.id,
      title: idea.title,
      raw_idea_text: idea.raw_idea_text,
      profile_context_json: idea.profile_context_json,
      status: idea.status,
      created_at: idea.created_at,
    };

    const base = {
      idea: ideaOut,
      state: mode, // 'rough' | 'explore' | 'deep'
      evaluation_id: evaluation ? evaluation.id : null,
      profile: idea.profile_context_json || {},
      analysis: null,
      explore: null,
    };

    if (mode === "deep") {
      base.analysis = buildDeepAnalysis(evaluation);
    } else if (mode === "explore") {
      // The ll2_explore_v1 envelope. getIdea's lean eval select OMITS explore_json
      // (it's large and the hub/list never needs it), so fetch it directly by eval
      // id here — only when actually opening an explored idea.
      const { data: exRow } = await supabaseAdmin
        .from("evaluations")
        .select("explore_json")
        .eq("id", evaluation.id)
        .eq("user_id", user.id)
        .single();
      base.explore = exRow?.explore_json || null;
    }
    // rough: idea text only — the two-door room reads idea.raw_idea_text.

    return NextResponse.json(base);
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
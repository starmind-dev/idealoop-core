// src/app/api/ideas/route.js  (hub list)
// CHANGES:
//   - Removed roadmap_json from the evaluations select (column dropped) — this
//     was the hard-throw: PostgREST errors on selecting a non-existent column.
//   - Retired the phase-progress feature (option 1): the progress table query
//     and all total_phases / completed-phase math are gone. Phases came from the
//     old roadmap concept the Execution Brief replaces; there are no phases now.
//   - Added execution_brief_json to the select and surface a per-eval `has_brief`
//     boolean (+ an idea-level `has_brief`) so the hub can show a brief indicator
//     and the card can route to "Continue to Execution Brief" vs "Generate".
//
// FRONTEND FOLLOW-UP (no longer emitted by this route):
//   The old `progress: { completed, total_phases, has_progress, completed_phases }`
//   object on each idea/eval is GONE. Any hub-card UI reading idea.progress.* or
//   ev.progress.* must be removed/updated, or it will read undefined. Replace any
//   phase-progress chip with the `has_brief` signal (or nothing).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    // ------------------------------------------------
    // 1. Authenticate
    // ------------------------------------------------
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    // ------------------------------------------------
    // 2. Fetch ideas with their evaluation scores
    //    (roadmap_json removed; execution_brief_json added)
    // ------------------------------------------------
    const { data: ideas, error: fetchError } = await supabaseAdmin
      .from("ideas")
      .select(`
        id,
        title,
        raw_idea_text,
        profile_context_json,
        status,
        created_at,
        updated_at,
        parent_idea_id,
        branch_reason,
        changed_dimensions,
        is_main_version,
        status_label,
        evaluations (
          id,
          weighted_overall_score,
          market_demand_score,
          monetization_score,
          originality_score,
          technical_complexity_score,
          classification,
          data_source,
          summary_text,
          execution_brief_json,
          created_at
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Fetch ideas failed:", fetchError);
      return NextResponse.json(
        { error: `Failed to load ideas: ${fetchError.message}` },
        { status: 500 }
      );
    }

    // ------------------------------------------------
    // 3. Shape each idea: sort evals, surface has_brief, drop phase-progress
    // ------------------------------------------------
    const ideasWithMeta = (ideas || []).map((idea) => {
      // latest eval first
      const sortedEvals = (idea.evaluations || []).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      // per-eval: replace heavy execution_brief_json with a light boolean so the
      // hub payload stays small (the full brief loads via /api/ideas/[id]).
      const evals = sortedEvals.map((ev) => {
        const { execution_brief_json, ...rest } = ev;
        return { ...rest, has_brief: execution_brief_json != null };
      });

      // idea-level has_brief = does the LATEST evaluation have a brief? (the hub
      // card represents the current state of the idea)
      const latest = evals[0] || null;

      return {
        ...idea,
        evaluations: evals,
        evaluation_count: evals.length,
        has_brief: latest ? latest.has_brief : false,
      };
    });

    return NextResponse.json({
      ideas: ideasWithMeta,
      count: ideasWithMeta.length,
    });
  } catch (err) {
    console.error("List ideas error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
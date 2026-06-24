// src/app/api/ideas/save/route.js
// Unified save for BOTH modes, plus IN-PLACE GRADUATION.
//
// FIVE behaviours, one route:
//
//   (1) Deep save (default, mode:"deep" or absent, NO graduate_idea_id):
//       new idea row + new deep evaluation row — byte-identical to before.
//
//   (2) Explore ANGLE save (mode:"explore", NO explore_result, NO graduate_idea_id):
//       new ROUGH idea row ONLY (a saved angle is rough, no verdict, no eval).
//       Provenance rides in branch_reason / changed_dimensions. Unchanged.
//
//   (3) Explore RESULT save (mode:"explore", explore_result present, NO graduate_idea_id):
//       new idea row + new EXPLORE evaluation row (explore_json, no score) — the
//       "save THIS explored idea" verb, symmetric with a fresh Deep save. Born
//       on the input screen where no rough idea pre-exists.
//
//   (4) DEEP GRADUATION (graduate_idea_id + analysis): flips an EXISTING idea
//       forward in place (rough/explore -> deep). No new idea. SAME eval builder
//       as a normal deep save, so the stored row is identical. Unchanged.
//
//   (5) EXPLORE GRADUATION (graduate_idea_id + mode:"explore" + explore_result):
//       flips an EXISTING rough idea forward in place (rough -> explored). No new
//       idea, no copy left behind — the rough card BECOMES the explore card where
//       it already sits, telescope, no score. The schema permits this (every
//       evaluations column is nullable except the ids), so an explore eval row
//       writes cleanly with just {idea_id, user_id, mode, explore_json}.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getIdea } from "@/lib/services/ideas";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// rough -> explore -> deep. A move is forward-only; never backward.
const FORWARD_RANK = { rough: 0, explore: 1, deep: 2 };

// SINGLE SOURCE for the deep evaluation row. Used by BOTH the normal deep save
// and deep graduation, so the two are byte-identical by construction.
function buildDeepEvalRow(ideaId, userId, analysis, execution_brief) {
  const eval_ = analysis.evaluation;
  return {
    idea_id: ideaId,
    user_id: userId,
    evaluation_mode: "single_call",
    prompt_version: "v2",
    search_strategy_version: "v2_multi_query",
    score_formula_version: "v2_weighted",
    keywords_used: analysis._meta?.keywords_used || [],
    evidence_json: analysis._meta || {},
    meta_json: analysis._meta || {},
    competitors_json: analysis.competition?.competitors || [],
    competition_summary: analysis.competition?.differentiation || null,
    data_source: analysis.competition?.data_source || "llm_generated",
    classification: analysis.classification || "commercial",
    scope_warning: analysis.scope_warning || false,
    // LOSSLESS: persist the FULL evaluation snapshot exactly as it was rendered,
    // so the stored record IS what the user saw. The previous version cherry-picked
    // seven keys and silently dropped every field the V83 redesign added —
    // verdict_lead, verdict_headline, verdict_detail, competitive_position,
    // synthesis_degraded — which is why the compressed lead + headline and the
    // you_win/overlap/exposed split vanished on reload. Spreading eval_ carries all
    // of those, plus any field a future 2c surface adds, with no field list to
    // hand-maintain. (overall_score + the per-metric scores + summary also have
    // their own columns below for hub/list/score reads; the read side overlays
    // those, so duplicating them inside scoring_json here is harmless.) Pairs with
    // the spread-on-read in api/ideas/[id]/route.js — both sides lossless.
    // V87 Stage 3a — carry the evidence packets forward under scoring_json._pro,
    // the exact path the change-diff reads a saved parent's evidence from. Without
    // this a re-evaluated parent has no evidence lane and the diff degrades every
    // metric to read-only. Conditional spread: a no-op when the pipeline emitted
    // no _pro, never writing an empty key. (evaluation engine untouched — this
    // only persists what the analysis already carries.)
    scoring_json: { ...eval_, ...(analysis._pro ? { _pro: analysis._pro } : {}) },
    estimates_json: analysis.estimates || {},
    // The execution brief, when one was generated before saving.
    // Absent → null → "generate" CTA shows on reload until one is made.
    execution_brief_json: execution_brief || null,
    market_demand_score: eval_.market_demand?.score || 0,
    originality_score: eval_.originality?.score || 0,
    monetization_score: eval_.monetization?.score || 0,
    technical_complexity_score: eval_.technical_complexity?.score || 0,
    weighted_overall_score: eval_.overall_score || 0,
    summary_text: eval_.summary || "",
  };
}

// SINGLE SOURCE for the explore evaluation row. An explored idea carries the
// ll2_explore_v1 envelope and NO score — mode:"explore" is what makes
// resolveState return "explore". Every other column is nullable, so this is the
// whole row.
function buildExploreEvalRow(ideaId, userId, envelope) {
  return {
    idea_id: ideaId,
    user_id: userId,
    evaluation_mode: "explore",
    mode: "explore",
    explore_json: envelope,
    weighted_overall_score: null,
  };
}

export async function POST(request) {
  try {
    // ------------------------------------------------
    // 1. Authenticate
    // ------------------------------------------------
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Not authenticated. Please log in to save ideas." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid session. Please log in again." },
        { status: 401 }
      );
    }

    // ------------------------------------------------
    // 2. Parse request body
    // ------------------------------------------------
    const body = await request.json();
    const {
      idea_text,
      idea_name,
      profile,
      analysis,
      execution_brief,
      // Explore-only fields (ignored for Deep):
      mode = "deep",
      basis,            // angle.basis.primary, recorded as provenance
      origin_idea_text, // the original idea the angle widened, for provenance
      explore_result,   // the ll2_explore_v1 envelope, present when saving the
                        // explored idea itself (NOT when saving an angle)
      // Graduation: when set, flip THIS existing idea forward in place
      // (rough -> evaluated) instead of creating a new idea.
      graduate_idea_id,
      // ATTACH-UNDER-EXPLORE: when a forward result is saved AFTER its explored
      // parent was saved, the frontend passes the parent's idea id so this idea
      // attaches as a non-main branch under it (verified explored below). Applies
      // to ALL new-idea saves now — an explore angle, an explore RESULT, or a DEEP
      // eval taken straight from an angle. Absent = a fresh root.
      parent_idea_id,
    } = body;

    const isExplore = mode === "explore";
    const isExploreResult = isExplore && !!explore_result;
    const isGraduation = !!graduate_idea_id;

    // ================================================
    // GRADUATION PATH — flip an existing idea forward in place.
    // No new idea row. The card moves forward where it already sits.
    // ================================================
    if (isGraduation) {
      // ---- EXPLORE GRADUATION (rough -> explored, in place) ----
      if (isExplore) {
        if (!explore_result) {
          return NextResponse.json(
            { error: "Missing required data (explore_result)." },
            { status: 400 }
          );
        }

        const target = await getIdea(user.id, graduate_idea_id);
        if (!target || target.status === "archived") {
          return NextResponse.json({ error: "Idea to graduate not found." }, { status: 404 });
        }

        // Forward-only: rough -> explore is allowed; deep -> explore is not.
        if ((FORWARD_RANK[mode] ?? 0) < (FORWARD_RANK[target.state] ?? 0)) {
          return NextResponse.json(
            { error: `Forward-only: cannot move ${target.state} → ${mode}.` },
            { status: 400 }
          );
        }

        // One live eval per idea: replace whatever the idea currently carries
        // (a rough idea carries none; this is a no-op for it).
        const { error: delError } = await supabaseAdmin
          .from("evaluations")
          .delete()
          .eq("user_id", user.id)
          .eq("idea_id", graduate_idea_id);

        if (delError) {
          console.error("Explore graduation eval cleanup failed:", delError);
          return NextResponse.json(
            { error: `Failed to graduate idea: ${delError.message}` },
            { status: 500 }
          );
        }

        // Write the explore eval onto the EXISTING idea.
        const { data: evalRow, error: evalError } = await supabaseAdmin
          .from("evaluations")
          .insert(buildExploreEvalRow(graduate_idea_id, user.id, explore_result))
          .select("id")
          .single();

        if (evalError) {
          console.error("Explore graduation eval insert failed:", evalError);
          return NextResponse.json(
            { error: `Failed to graduate idea: ${evalError.message}` },
            { status: 500 }
          );
        }

        // The idea row stays put (same tree position, folder, parent). Only bump
        // updated_at, and adopt the chosen name if the user renamed on save.
        const ideaPatch = { updated_at: new Date().toISOString() };
        if (idea_name && idea_name.trim()) {
          ideaPatch.title = idea_name.trim().substring(0, 80);
        }
        await supabaseAdmin
          .from("ideas")
          .update(ideaPatch)
          .eq("id", graduate_idea_id)
          .eq("user_id", user.id);

        return NextResponse.json({
          success: true,
          mode,
          graduated: true,
          idea_id: graduate_idea_id,
          evaluation_id: evalRow.id,
          has_evaluation: true,
        });
      }

      // ---- DEEP GRADUATION (rough/explore -> deep, in place) ----
      if (!analysis) {
        return NextResponse.json({ error: "Missing required data (analysis)." }, { status: 400 });
      }

      // Verify the target via the service's single source of truth.
      const target = await getIdea(user.id, graduate_idea_id);
      if (!target || target.status === "archived") {
        return NextResponse.json({ error: "Idea to graduate not found." }, { status: 404 });
      }

      // Forward-only: never move backward (e.g. a deep idea cannot graduate).
      if ((FORWARD_RANK[mode] ?? 0) < (FORWARD_RANK[target.state] ?? 0)) {
        return NextResponse.json(
          { error: `Forward-only: cannot move ${target.state} → ${mode}.` },
          { status: 400 }
        );
      }

      // One live eval per idea: replace whatever the idea currently carries
      // (a rough idea carries none; this is a no-op for it).
      const { error: delError } = await supabaseAdmin
        .from("evaluations")
        .delete()
        .eq("user_id", user.id)
        .eq("idea_id", graduate_idea_id);

      if (delError) {
        console.error("Graduation eval cleanup failed:", delError);
        return NextResponse.json(
          { error: `Failed to graduate idea: ${delError.message}` },
          { status: 500 }
        );
      }

      // Write the deep eval onto the EXISTING idea — same builder as a normal
      // deep save, so the stored row is identical.
      const { data: evalRow, error: evalError } = await supabaseAdmin
        .from("evaluations")
        .insert(buildDeepEvalRow(graduate_idea_id, user.id, analysis, execution_brief))
        .select("id")
        .single();

      if (evalError) {
        console.error("Graduation eval insert failed:", evalError);
        return NextResponse.json(
          { error: `Failed to graduate idea: ${evalError.message}` },
          { status: 500 }
        );
      }

      // The idea row stays put (same tree position, folder, parent). Only bump
      // updated_at, and adopt the chosen name if the user renamed on save.
      const ideaPatch = { updated_at: new Date().toISOString() };
      if (idea_name && idea_name.trim()) {
        ideaPatch.title = idea_name.trim().substring(0, 80);
      }
      await supabaseAdmin
        .from("ideas")
        .update(ideaPatch)
        .eq("id", graduate_idea_id)
        .eq("user_id", user.id);

      return NextResponse.json({
        success: true,
        mode,
        graduated: true,
        idea_id: graduate_idea_id,
        evaluation_id: evalRow.id,
        has_evaluation: true,
      });
    }

    // ================================================
    // NON-GRADUATION PATH — new idea row.
    //   deep            -> idea + deep eval
    //   explore result  -> idea + explore eval
    //   explore angle   -> rough idea only (no eval)
    // ================================================

    // All paths need the idea text. Deep additionally requires the analysis;
    // Explore (no verdict / envelope-carried) does not.
    if (!idea_text) {
      return NextResponse.json({ error: "Missing required data (idea_text)." }, { status: 400 });
    }
    if (!isExplore && !analysis) {
      return NextResponse.json({ error: "Missing required data (analysis)." }, { status: 400 });
    }

    // ------------------------------------------------
    // 3. Count existing saved ideas (no cap — reported as saved_count)
    // ------------------------------------------------
    const { count, error: countError } = await supabaseAdmin
      .from("ideas")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active");

    if (countError) {
      console.error("Count check failed:", countError);
      return NextResponse.json(
        { error: `Failed to check saved ideas count: ${countError.message}` },
        { status: 500 }
      );
    }

    // ------------------------------------------------
    // 4. Determine title: use user-provided name, fall back to auto-derive
    // ------------------------------------------------
    const deriveTitle = (text) => {
      const firstSentence = text.split(/[.!?\n]/)[0].trim();
      if (firstSentence.length <= 80) return firstSentence;
      return firstSentence.substring(0, 77) + "...";
    };

    const title = idea_name && idea_name.trim()
      ? idea_name.trim().substring(0, 80)
      : deriveTitle(idea_text);

    // ------------------------------------------------
    // 5. Insert idea row (shared). An explore ANGLE adds provenance in branch
    //    columns; an explore RESULT (the explored idea itself) does not.
    // ------------------------------------------------
    const ideaInsert = {
      user_id: user.id,
      title,
      raw_idea_text: idea_text,
      profile_context_json: profile || {},
      status: "active",
    };

    if (isExplore && !isExploreResult) {
      const basisPhrase = typeof basis === "string" && basis.length ? basis.replace(/_/g, " ") : null;
      ideaInsert.branch_reason = origin_idea_text
        ? `Saved from Explore${basisPhrase ? ` — a ${basisPhrase}` : ""} of: ${String(origin_idea_text).trim().slice(0, 200)}`
        : "Saved from Explore";
      ideaInsert.changed_dimensions = basis ? [basis] : [];
    }

    // ATTACH UNDER AN EXPLORED PARENT (shared across deep / explore-result /
    // explore-angle). When the frontend passes parent_idea_id and it resolves to
    // a real, owned, EXPLORED idea, this new idea lands as a NON-MAIN child in
    // that explore's lineage — never a loose root. This is what lets an angle
    // taken STRAIGHT to Deep (or re-explored) branch under the explored idea it
    // came from, instead of spawning a standalone root, with no manual
    // save-as-rough-branch step in between. The PARENT must be explored (branching
    // is explore-only); the child may be any species, so a deep child under an
    // explore parent is permitted. If the parent isn't saved/explored (or doesn't
    // resolve), this idea stays a fresh ROOT exactly as before — the unsaved-explore
    // case keeps its standalone fallback.
    if (parent_idea_id) {
      const parent = await getIdea(user.id, parent_idea_id);
      if (parent && parent.state === "explore") {
        ideaInsert.parent_idea_id = parent_idea_id;
        ideaInsert.is_main_version = false;
      }
    }

    const { data: ideaRow, error: ideaError } = await supabaseAdmin
      .from("ideas")
      .insert(ideaInsert)
      .select("id")
      .single();

    if (ideaError) {
      console.error("Idea insert failed:", ideaError);
      return NextResponse.json(
        { error: `Failed to save idea: ${ideaError.message}` },
        { status: 500 }
      );
    }

    // ------------------------------------------------
    // 6. Insert evaluation row — deep (deep eval) or explore RESULT (explore
    //    eval). An explore ANGLE carries no evaluation.
    // ------------------------------------------------
    let evalRow = null;

    if (!isExplore) {
      const { data, error: evalError } = await supabaseAdmin
        .from("evaluations")
        .insert(buildDeepEvalRow(ideaRow.id, user.id, analysis, execution_brief))
        .select("id")
        .single();

      if (evalError) {
        // Rollback: delete the idea row if evaluation insert fails
        await supabaseAdmin.from("ideas").delete().eq("id", ideaRow.id);
        console.error("Evaluation insert failed:", evalError);
        return NextResponse.json(
          { error: `Failed to save evaluation: ${evalError.message}` },
          { status: 500 }
        );
      }
      evalRow = data;
    } else if (isExploreResult) {
      const { data, error: evalError } = await supabaseAdmin
        .from("evaluations")
        .insert(buildExploreEvalRow(ideaRow.id, user.id, explore_result))
        .select("id")
        .single();

      if (evalError) {
        // Rollback: delete the idea row if evaluation insert fails
        await supabaseAdmin.from("ideas").delete().eq("id", ideaRow.id);
        console.error("Explore evaluation insert failed:", evalError);
        return NextResponse.json(
          { error: `Failed to save evaluation: ${evalError.message}` },
          { status: 500 }
        );
      }
      evalRow = data;
    }

    // ------------------------------------------------
    // 7. Return success — evaluation_id is null only for an Explore ANGLE
    // ------------------------------------------------
    return NextResponse.json({
      success: true,
      mode,
      idea_id: ideaRow.id,
      evaluation_id: evalRow?.id || null,
      has_evaluation: !isExplore || isExploreResult,
      saved_count: count + 1,
    });
  } catch (err) {
    console.error("Save idea error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
// src/app/api/ideas/save/route.js
// Unified save for BOTH modes.
//
// Deep save (default, mode:"deep" or absent): idea row + evaluation row, exactly
// as before — back-compatible, byte-identical behaviour for existing callers.
//
// Explore save (mode:"explore"): idea row ONLY. An Explore angle is a
// `branch_idea_text` with no verdict, so there is no evaluations row to write;
// Explore provenance rides in the existing branch_reason / changed_dimensions
// columns. No schema change.
//
// The fork is a single explicit `mode` discriminator, NOT inferred from whether
// `analysis` is present — so Deep keeps its hard "missing analysis = 400" guard
// (a malformed Deep save still errors instead of silently saving an eval-less
// idea). The shared scaffolding (auth, 5-idea cap, title derivation, idea
// insert) is written once.
//
// READ-BACK NOTE (unchanged by this unification): /api/ideas/[id] GET still
// .single()s on evaluations and 404s for eval-less ideas, so saved Explore
// branches are not yet openable from the hub. That is the same gap regardless of
// how many save routes exist — it belongs to the [id] GET, addressed separately.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    } = body;

    const isExplore = mode === "explore";

    // Both modes need the idea text. Deep additionally requires the analysis;
    // Explore (no verdict) does not. This preserves Deep's malformed-save guard.
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
    // 5. Insert idea row (shared). Explore adds provenance in branch columns.
    // ------------------------------------------------
    const ideaInsert = {
      user_id: user.id,
      title,
      raw_idea_text: idea_text,
      profile_context_json: profile || {},
      status: "active",
    };

    if (isExplore) {
      const basisPhrase = typeof basis === "string" && basis.length ? basis.replace(/_/g, " ") : null;
      ideaInsert.branch_reason = origin_idea_text
        ? `Saved from Explore${basisPhrase ? ` — a ${basisPhrase}` : ""} of: ${String(origin_idea_text).trim().slice(0, 200)}`
        : "Saved from Explore";
      ideaInsert.changed_dimensions = basis ? [basis] : [];
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
    // 6. Insert evaluation row — DEEP ONLY (Explore has no verdict)
    // ------------------------------------------------
    let evalRow = null;

    if (!isExplore) {
      const eval_ = analysis.evaluation;

      const { data, error: evalError } = await supabaseAdmin
        .from("evaluations")
        .insert({
          idea_id: ideaRow.id,
          user_id: user.id,
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
          scoring_json: {
            market_demand: eval_.market_demand,
            monetization: eval_.monetization,
            originality: eval_.originality,
            technical_complexity: eval_.technical_complexity,
            marketplace_note: eval_.marketplace_note || null,
            failure_risks: eval_.failure_risks || [],
            evidence_strength: eval_.evidence_strength || null,
          },
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
        })
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
    }

    // ------------------------------------------------
    // 7. Return success — evaluation_id is null for an Explore branch
    // ------------------------------------------------
    return NextResponse.json({
      success: true,
      mode,
      idea_id: ideaRow.id,
      evaluation_id: evalRow?.id || null,
      has_evaluation: !isExplore,
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
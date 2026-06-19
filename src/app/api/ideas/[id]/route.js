// src/app/api/ideas/[id]/route.js
//
// CUTOVER — this route now delegates ALL THREE verbs to the ideas orchestrator
// (the single source of truth), finishing the half-migration the prior version
// left behind (GET was on the service; PATCH + DELETE hand-rolled their logic).
//
// GET    — CARD ROOMS (unchanged). Routes through getIdea + resolveState and
//          returns a STATE-tagged payload so the hub can open the right room:
//            rough   -> { state:'rough',   analysis:null, explore:null }   (idea text + two doors)
//            explore -> { state:'explore', analysis:null, explore:<envelope> }  (ExploreView, dormant)
//            deep    -> { state:'deep',    analysis:<…>,  explore:null }   (the 3-screen flow)
//          Eval-less ideas (rough / explore) do NOT 404. The DEEP `analysis`
//          object is byte-identical to the prior route, so applyLoadedIdea ->
//          results1 is untouched. `?evaluation_id=` selection preserved.
//
// PATCH  — delegates to updateIdea(userId, ideaId, { title, folder_id, branch_reason }).
//          NEW: accepts `folder_id` (move-to-folder) with an ownership guard, and
//          accepts `branch_reason` (edit branch note). `status_label` is RETIRED —
//          the label model is gone; its only writers were the removed lineage
//          status dropdown and this route, so it is no longer validated or written.
//          (The column DROP itself is a later cutover step — the flat list route
//          still SELECTs it.) Returns { ok: true }; the page.js consumer reads the
//          body only on error and applies its optimistic update from what it sent.
//
// DELETE — delegates to deleteIdea(userId, ideaId). Same soft-archive of the idea
//          + its descendant branches, same { archived_ids, archived_count } the hub
//          consumer prunes from. GAINS the one-main-per-family invariant the inline
//          version silently skipped: deleting the main promotes the family root to
//          main. (`collectSubtreeIds` is gone — the service owns the subtree walk.)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getIdea, resolveState, updateIdea, deleteIdea } from "@/lib/services/ideas";

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

// Build the DEEP `analysis` object from an evaluation row.
//
// LOSSLESS by construction: `scoring_json` holds the full evaluation snapshot as
// it was rendered at eval time, so we SPREAD it first — that carries every field
// the result view reads off `analysis.evaluation` (verdict_lead, verdict_headline,
// verdict_detail, competitive_position, synthesis_degraded, and any field a future
// 2c surface adds) through the save round-trip with no per-field hand-copying. The
// explicit fields below then OVERLAY the spread, so the column-authoritative values
// (overall_score, summary) win and the per-metric fallbacks for older rows (whose
// scoring_json may predate a metric object) still apply. The previous version
// hand-copied a fixed list and silently dropped anything new — which is why the
// compressed lead + headline and the you_win/overlap/exposed split disappeared on
// reload. (Requires the save path to persist the full evaluation into scoring_json;
// see note in the save route.)
function buildDeepAnalysis(evaluation) {
  const sj = evaluation.scoring_json || {};
  return {
    evaluation: {
      ...sj,
      overall_score: evaluation.weighted_overall_score,
      market_demand: sj.market_demand || {
        score: evaluation.market_demand_score,
        explanation: "",
      },
      monetization: sj.monetization || {
        score: evaluation.monetization_score,
        explanation: "",
      },
      originality: sj.originality || {
        score: evaluation.originality_score,
        explanation: "",
      },
      technical_complexity: sj.technical_complexity || {
        score: evaluation.technical_complexity_score,
        explanation: "",
      },
      marketplace_note: sj.marketplace_note || null,
      failure_risks: sj.failure_risks || [],
      evidence_strength: sj.evidence_strength || null,
      summary: evaluation.summary_text || sj.summary || "",
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

    const body = await request.json().catch(() => ({}));

    // Build the patch against the service's whitelist (title / folder_id /
    // branch_reason). status_label is intentionally NOT accepted — see header.
    const patch = {};

    if (body.title !== undefined) {
      const trimmed = (body.title || "").trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
      }
      patch.title = trimmed;
    }

    if ("branch_reason" in body) {
      patch.branch_reason = body.branch_reason || null;
    }

    if ("folder_id" in body) {
      const fid = body.folder_id || null;
      // Folder-ownership guard: a move into a folder requires that folder to be
      // the caller's own. null (un-file) is always allowed. Without this the
      // service would set whatever folder_id it's handed — the server stays the
      // authority over what a move can target, not the client.
      if (fid !== null) {
        const { data: folder, error: folderErr } = await supabaseAdmin
          .from("folders")
          .select("id")
          .eq("id", fid)
          .eq("user_id", user.id)
          .maybeSingle();
        if (folderErr) {
          console.error("PATCH /api/ideas/[id] folder check error:", folderErr);
          return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
        }
        if (!folder) {
          return NextResponse.json({ error: "Folder not found." }, { status: 400 });
        }
      }
      patch.folder_id = fid;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    // Delegate the write to the orchestrator (it owns the field whitelist + user
    // scoping). The consumer reads the body only on error, so { ok: true } is
    // sufficient on success.
    await updateIdea(user.id, ideaId, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/ideas/[id] unexpected error:", err);
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

    // Delegate to the orchestrator: soft-archives the idea AND its descendant
    // branches, and — unlike the prior inline archive — promotes the family root
    // to main when the deleted node was the main, preserving one-main-per-family.
    // Returns { ok, archived_ids, archived_count, new_main? }; the hub consumer
    // reads archived_ids + archived_count to prune the lineage locally.
    const result = await deleteIdea(user.id, ideaId);
    return NextResponse.json(result);
  } catch (err) {
    // The service throws "Idea not found." when the (active) lineage can't be
    // resolved — surface it as a 404, matching the prior route's not-found path.
    if (err && err.message === "Idea not found.") {
      return NextResponse.json({ error: "Idea not found." }, { status: 404 });
    }
    console.error("Archive idea error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
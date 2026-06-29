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
// PATCH  — delegates to updateIdea(userId, ideaId, { title, raw_idea_text, folder_id, branch_reason }).
//          NEW: accepts `raw_idea_text` (rough-idea room body edit, non-empty) and
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
import { getIdea, resolveState, updateIdea, deleteIdea, buildDeepAnalysis } from "@/lib/services/ideas";

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

// buildDeepAnalysis (the eval-row → render `analysis` mapper) now lives in
// the ideas service and is imported above, so the idea-open route and the
// read-history route share ONE mapper — a previous read renders identically
// to the current one, with no field list to keep in sync across two files.

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
    // branch_reason / is_favorite / disposition / is_main). status_label is
    // intentionally NOT accepted — see header.
    const patch = {};

    if (body.title !== undefined) {
      const trimmed = (body.title || "").trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
      }
      patch.title = trimmed;
    }

    // Editable idea body (rough-idea room). Non-empty when present; stored trimmed
    // (internal newlines preserved). The service whitelists raw_idea_text too.
    if (body.raw_idea_text !== undefined) {
      const txt = (body.raw_idea_text || "").trim();
      if (!txt) {
        return NextResponse.json({ error: "Idea text cannot be empty." }, { status: 400 });
      }
      patch.raw_idea_text = txt;
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

    // Lineage: explore's "favorite" (boolean), lifecycle disposition (null |
    // 'parked' | 'killed'), and Lead promotion. is_main only accepts `true` —
    // you don't un-set a lead, you set a different node; updateIdea delegates the
    // family-wide flag move to setMain.
    if ("is_favorite" in body) {
      patch.is_favorite = !!body.is_favorite;
    }

    if ("disposition" in body) {
      const d = body.disposition;
      patch.disposition = d === "parked" || d === "killed" ? d : null;
    }

    if (body.is_main === true) {
      patch.is_main = true;
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
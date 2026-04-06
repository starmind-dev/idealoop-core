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

// Walk parent_idea_id chain to find the root ancestor
async function findRootAncestor(ideaId, userId) {
  let currentId = ideaId;
  const visited = new Set();

  while (currentId) {
    if (visited.has(currentId)) break; // safety: prevent infinite loops
    visited.add(currentId);

    const { data, error } = await supabaseAdmin
      .from("ideas")
      .select("id, parent_idea_id")
      .eq("id", currentId)
      .eq("user_id", userId)
      .single();

    if (error || !data) break;
    if (!data.parent_idea_id) return data.id; // this is the root
    currentId = data.parent_idea_id;
  }

  return currentId;
}

// Collect all idea IDs in a lineage (root + all descendants)
async function collectLineageIds(rootId, userId) {
  const ids = [rootId];
  let frontier = [rootId];

  while (frontier.length > 0) {
    const { data: children, error } = await supabaseAdmin
      .from("ideas")
      .select("id")
      .eq("user_id", userId)
      .in("parent_idea_id", frontier);

    if (error || !children || children.length === 0) break;
    const childIds = children.map((c) => c.id);
    ids.push(...childIds);
    frontier = childIds;
  }

  return ids;
}

// ============================================
// PATCH /api/ideas/[id]/set-main
// Sets is_main_version=true on the target idea,
// false on all other ideas in the same lineage.
// ============================================
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

    // Verify idea exists and belongs to user
    const { data: idea, error: ideaError } = await supabaseAdmin
      .from("ideas")
      .select("id, user_id, parent_idea_id")
      .eq("id", ideaId)
      .eq("user_id", user.id)
      .single();

    if (ideaError || !idea) {
      return NextResponse.json({ error: "Idea not found." }, { status: 404 });
    }

    // Find root ancestor
    const rootId = await findRootAncestor(ideaId, user.id);

    // Collect all ideas in this lineage
    const lineageIds = await collectLineageIds(rootId, user.id);

    // Clear is_main_version on all ideas in lineage
    await supabaseAdmin
      .from("ideas")
      .update({ is_main_version: false })
      .eq("user_id", user.id)
      .in("id", lineageIds);

    // Set is_main_version on target
    await supabaseAdmin
      .from("ideas")
      .update({ is_main_version: true })
      .eq("id", ideaId)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Set-main error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
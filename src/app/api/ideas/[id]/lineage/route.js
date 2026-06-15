// src/app/api/ideas/[id]/lineage/route.js
// One family's tree for the genealogy canvas. Thin: authenticate, delegate.
//
//   GET /api/ideas/[id]/lineage -> getLineageByIdea
//        -> { root_id, target_id, nodes: [{ id, parent_id, title, mode, score,
//             is_root, is_main, branch_reason, folder_id, source, has_brief }] }
//
// `mode` is the derived species (rough | explore | deep); `score` is non-null
// only on deep nodes. The client builds the layout from this flat node list.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";
import { getLineageByIdea } from "../../../../../lib/services/ideas";

async function authUser(request) {
  const h = request.headers.get("authorization");
  if (!h || !h.startsWith("Bearer ")) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(h.replace("Bearer ", ""));
  return error ? null : user;
}

export async function GET(request, { params }) {
  try {
    const user = await authUser(request);
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing idea ID." }, { status: 400 });
    const lineage = await getLineageByIdea(user.id, id);
    if (!lineage) return NextResponse.json({ error: "Idea not found." }, { status: 404 });
    return NextResponse.json(lineage);
  } catch (err) {
    console.error("GET /api/ideas/[id]/lineage error:", err);
    return NextResponse.json({ error: err.message || "Something went wrong." }, { status: 500 });
  }
}
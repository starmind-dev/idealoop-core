// src/app/api/ideas/[id]/history/route.js
//
// READ HISTORY — GET /api/ideas/[id]/history
//   Returns every superseded read of this idea, newest-supersede first. A
//   superseded read is a prior evaluation that an evidence re-read replaced in
//   place: the idea TEXT never changed, only the evidence did, so this is NOT
//   lineage — a previous read lives ON the idea, never in the version tree.
//
//   Each item carries a compact summary (superseded_at / score / verdict
//   headline / reason) for the "Previous reads" list AND the full render-ready
//   `analysis` (mapped through the SAME buildDeepAnalysis the idea-open route
//   uses) so the read-only viewer renders the real read with no second request.
//
// Auth: bearer token, same pattern as the sibling idea routes. listReadHistory
// scopes the query by userId, so a caller only ever sees their own history.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { listReadHistory } from "@/lib/services/ideas";

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

    const reads = await listReadHistory(user.id, ideaId);
    return NextResponse.json({ reads });
  } catch (err) {
    console.error("Read history error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
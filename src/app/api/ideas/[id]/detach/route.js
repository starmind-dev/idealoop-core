// POST /api/ideas/[id]/detach
// Detach an idea (and its branch) from its lineage — clears parent_idea_id so the
// node becomes its own root and surfaces in the hub as an independent card. The
// service (detachIdea) owns the subtree walk + the one-main invariant on both
// sides; this route is a thin auth wrapper, mirroring the sibling branch/delete
// routes. Mode-agnostic: works for explore and deep nodes alike.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { detachIdea } from "@/lib/services/ideas";

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

export async function POST(request, { params }) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing idea ID." }, { status: 400 });
    }

    const result = await detachIdea(user.id, id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to detach idea." },
      { status: 500 }
    );
  }
}
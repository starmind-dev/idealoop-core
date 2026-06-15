// src/app/api/folders/[id]/route.js
// Thin: authenticate, delegate. Deleting a folder un-files its cards
// (ideas.folder_id ON DELETE SET NULL) — it never deletes ideas.
//
//   PATCH  /api/folders/[id] -> { folder }   body: { name?, sort_order? }
//   DELETE /api/folders/[id] -> { ok: true }

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { updateFolder, deleteFolder } from "../../../../lib/services/ideas";

async function authUser(request) {
  const h = request.headers.get("authorization");
  if (!h || !h.startsWith("Bearer ")) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(h.replace("Bearer ", ""));
  return error ? null : user;
}

export async function PATCH(request, { params }) {
  try {
    const user = await authUser(request);
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing folder ID." }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    const folder = await updateFolder(user.id, id, {
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      sort_order: typeof body.sort_order === "number" ? body.sort_order : undefined,
    });
    return NextResponse.json({ folder });
  } catch (err) {
    console.error("PATCH /api/folders/[id] error:", err);
    return NextResponse.json({ error: err.message || "Something went wrong." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await authUser(request);
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing folder ID." }, { status: 400 });
    await deleteFolder(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/folders/[id] error:", err);
    return NextResponse.json({ error: err.message || "Something went wrong." }, { status: 500 });
  }
}
// src/app/api/folders/route.js
// Folders are pure organization (founder-named, sortable, live in either shelf).
// Thin: authenticate, delegate to the ideas service.
//
//   GET  /api/folders -> { folders: [{ id, name, sort_order }] }
//   POST /api/folders -> { folder }   body: { name, sort_order? }

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { listFolders, createFolder } from "../../../lib/services/ideas";

async function authUser(request) {
  const h = request.headers.get("authorization");
  if (!h || !h.startsWith("Bearer ")) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(h.replace("Bearer ", ""));
  return error ? null : user;
}

export async function GET(request) {
  try {
    const user = await authUser(request);
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    return NextResponse.json({ folders: await listFolders(user.id) });
  } catch (err) {
    console.error("GET /api/folders error:", err);
    return NextResponse.json({ error: err.message || "Something went wrong." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await authUser(request);
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json({ error: "Folder name is required." }, { status: 400 });
    }
    const folder = await createFolder(user.id, {
      name: String(body.name).trim(),
      sort_order: typeof body.sort_order === "number" ? body.sort_order : 0,
    });
    return NextResponse.json({ folder }, { status: 201 });
  } catch (err) {
    console.error("POST /api/folders error:", err);
    return NextResponse.json({ error: err.message || "Something went wrong." }, { status: 500 });
  }
}
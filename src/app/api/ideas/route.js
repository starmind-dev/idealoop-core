// src/app/api/ideas/route.js
// Collection root for the rebuilt hub model. Thin: authenticate, then delegate to
// the ideas service. Coexists with the legacy /api/ideas/list and /api/ideas/save
// (which Layer 3 retires once the frontend moves onto these).
//
//   GET  /api/ideas  -> listHub  -> { folders, rough, ideas }   (two-shelf hub)
//   POST /api/ideas  -> createIdea -> { idea_id }               (a ROUGH idea)

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { listHub, createIdea } from "../../../lib/services/ideas";

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
    return NextResponse.json(await listHub(user.id));
  } catch (err) {
    console.error("GET /api/ideas error:", err);
    return NextResponse.json({ error: err.message || "Something went wrong." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await authUser(request);
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const { id } = await createIdea(user.id, {
      title: body.title,
      raw_idea_text: body.raw_idea_text,
      source: body.source || "manual",
      parent_idea_id: body.parent_idea_id || null,
      branch_reason: body.branch_reason || null,
      folder_id: body.folder_id || null,
      profile: body.profile || {},
    });
    return NextResponse.json({ idea_id: id }, { status: 201 });
  } catch (err) {
    // createIdea throws the explore-only-branch guard as a user error -> 400.
    console.error("POST /api/ideas error:", err);
    return NextResponse.json({ error: err.message || "Something went wrong." }, { status: 400 });
  }
}
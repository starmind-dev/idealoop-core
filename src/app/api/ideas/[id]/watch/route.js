// src/app/api/ideas/[id]/watch/route.js
//
// SET A PER-IDEA EVIDENCE-WATCH CADENCE — PATCH /api/ideas/[id]/watch
//   body: { cadence: "off" | "weekly" | "biweekly" | "monthly" | "quarterly" | "semiannual" | "annual" }
//
// The cadence dial writes here. updateIdea owns the enum whitelist (an unknown
// value falls back to "off"), so this route just authenticates, validates shape,
// and delegates. "off" turns a watch off without deleting anything. Setting cadence
// never touches last_scanned_at — the scan clock only advances on a real replay.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { updateIdea } from "@/lib/services/ideas";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CADENCES = ["off", "weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual"];

async function authenticate(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
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
    const cadence = body.cadence;
    if (!CADENCES.includes(cadence)) {
      return NextResponse.json(
        { error: `cadence must be one of: ${CADENCES.join(", ")}.` },
        { status: 400 }
      );
    }

    await updateIdea(user.id, ideaId, { watch_cadence: cadence });
    return NextResponse.json({ ok: true, watch_cadence: cadence });
  } catch (err) {
    console.error("Set watch cadence error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
// src/app/api/signals/[id]/resolve/route.js
//
// RESOLVE AN EVIDENCE SIGNAL — POST /api/signals/[id]/resolve
//   body: { status: "dismissed" | "acted" }
//
// "dismissed" = the user judged it noise (the calibration feedback that matters).
// "acted"     = a re-judge was kicked off from the signal (the loop closed).
// Either way the signal leaves the open set and stops showing on the Overview card.
//
// Auth: bearer token, same pattern as the sibling ideas routes. resolveSignal scopes
// the update by userId, so a caller can only resolve their own signals.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveSignal } from "@/lib/services/evidence-scan";

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

    const { id: signalId } = await params;
    if (!signalId) {
      return NextResponse.json({ error: "Missing signal ID." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const status = body.status;
    if (status !== "dismissed" && status !== "acted") {
      return NextResponse.json(
        { error: "status must be 'dismissed' or 'acted'." },
        { status: 400 }
      );
    }

    await resolveSignal(user.id, signalId, status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Resolve signal error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
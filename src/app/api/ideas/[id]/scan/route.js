// src/app/api/ideas/[id]/scan/route.js
//
// MANUAL EVIDENCE-SCAN TRIGGER — POST /api/ideas/[id]/scan
//
// Runs scanEvidence for one of the caller's deep ideas on demand. This is the
// spine's test/seam surface: it lets a scan be fired against a real stored idea
// (and a signal observed landing) BEFORE any cron exists. The cron in P3 will call
// the same scanEvidence over a user's watched ideas on a cadence — this route is the
// single-idea, user-initiated version of that, and also doubles as a "scan now"
// button later.
//
// Auth: bearer token (same pattern as the sibling [id] route). The scan is bounded
// to the authenticated user (scanEvidence scopes every read/write by userId), so a
// caller can only scan their own ideas.
//
// The deep scoring engine is untouched — scanEvidence reads stored evals, runs its
// own retrieval + a separate Haiku classifier, and writes a signals row; it never
// re-scores the idea.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scanEvidence } from "@/lib/services/evidence-scan";

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

    const { id: ideaId } = await params;
    if (!ideaId) {
      return NextResponse.json({ error: "Missing idea ID." }, { status: 400 });
    }

    const result = await scanEvidence(user.id, ideaId);
    return NextResponse.json(result);
  } catch (err) {
    if (err && err.message === "Idea not found.") {
      return NextResponse.json({ error: "Idea not found." }, { status: 404 });
    }
    console.error("Evidence scan error:", err);
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}
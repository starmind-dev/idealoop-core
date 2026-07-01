// src/app/api/feedback/route.js
// The Get Help "Send feedback" channel. Writes one row to public.feedback via the
// service role — the table is RLS-on with no policies, so this route is the only
// way in, and you read submissions in the Supabase dashboard. No published support
// address: the submitter optionally leaves an email only if they want a reply.
//
// Optional auth: attaches user_id when signed in, null for anonymous visitors —
// feedback is welcome from anyone trying the beta. Nothing is required but a
// non-empty message; category and reply_email are optional and validated lightly.

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

const CATEGORIES = ["bug", "question", "idea"];

export async function POST(request) {
  try {
    const user = await authenticate(request); // optional — null for anonymous
    const body = await request.json().catch(() => ({}));

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ error: "A message is required." }, { status: 400 });
    if (message.length > 5000) return NextResponse.json({ error: "That message is a bit long — trim it down." }, { status: 400 });

    const category = CATEGORIES.includes(body.category) ? body.category : null;

    // reply_email is optional; keep it only if it looks like an address.
    const rawEmail = typeof body.reply_email === "string" ? body.reply_email.trim() : "";
    if (rawEmail && (rawEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail))) {
      return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("feedback").insert({
      user_id: user?.id || null,
      category,
      message,
      reply_email: rawEmail || null,
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Feedback POST error:", err);
    return NextResponse.json({ error: "Couldn't send your feedback just now." }, { status: 500 });
  }
}
// src/lib/services/activity.js
//
// THE ACTIVITY LEDGER — append-only event log behind the Overview's
// "Recent activity · The Ledger" section. One row per meaningful moment in an
// idea's life: captured / explored / judged / rejudged / compared / parked /
// killed. SERVER ONLY (service-role client; RLS is bypassed on write).
//
// DESIGN RULES
//   • logActivity NEVER throws and NEVER blocks the real operation. A failed log
//     is swallowed (warned) — losing a ledger row must never fail a save, a
//     park, or a compare. Callers `await` it (so the insert flushes before a
//     serverless function freezes) but can do so without any try/catch of their
//     own; the safety lives here.
//   • This module imports nothing from ideas.js — no import cycle. ideas.js may
//     freely import from here.
//
// Requires migration `activity_ledger_v1` (public.activity).

import { supabaseAdmin } from "../supabase-admin";

const VALID_KINDS = new Set([
  "captured", "explored", "judged", "rejudged", "compared", "parked", "killed", "briefed",
]);

// Fire a ledger event. Safe by construction: bad input or a DB error is logged
// and swallowed — the caller's operation is never affected.
//   userId  — owner
//   kind    — one of VALID_KINDS
//   idea_id — the subject idea (nullable; compare passes null + ids in meta)
//   summary — the one-line the ledger renders
//   meta    — optional jsonb (score, prev_score, partner title, etc.)
export async function logActivity(userId, { kind, idea_id = null, summary, meta = null } = {}) {
  try {
    if (!userId || !VALID_KINDS.has(kind) || !summary) return;
    const row = {
      user_id: userId,
      idea_id: idea_id || null,
      kind,
      summary: String(summary).slice(0, 240),
      meta_json: meta || null,
    };
    const { error } = await supabaseAdmin.from("activity").insert(row);
    if (error) console.warn("[activity] log failed:", error.message);
  } catch (e) {
    console.warn("[activity] log threw:", e && e.message);
  }
}

// Recent events for the ledger, newest first. Safe: returns [] on any error so a
// ledger hiccup never breaks the hub payload.
export async function listActivity(userId, limit = 12) {
  try {
    const { data, error } = await supabaseAdmin
      .from("activity")
      .select("id, idea_id, kind, summary, meta_json, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) { console.warn("[activity] list failed:", error.message); return []; }
    return data || [];
  } catch (e) {
    console.warn("[activity] list threw:", e && e.message);
    return [];
  }
}
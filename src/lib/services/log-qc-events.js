// ============================================================================
// log-qc-events.js — V4S32 Layer
// ============================================================================
//
// Fire-and-forget logger for stage2b_qc_events rows. Never throws into the
// calling pipeline — all errors are swallowed with console.error so the
// quality-control layer's logging path can never block or fail an evaluation.
//
// Uses the Supabase service-role key for server-side writes (RLS bypassed).
// If env vars are missing, logs a warning and returns silently.
//
// Note: If your codebase has a centralized Supabase admin client in
// src/lib/supabase-admin.js or similar, replace the createClient() call
// below with an import from that module. The pattern stays the same.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

// Lazy initialization — Supabase client created once on first call
let _supabaseAdminClient = null;

function getSupabaseClient() {
  if (_supabaseAdminClient) return _supabaseAdminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.warn(
      "[V4S32] Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL or " +
      "SUPABASE_SERVICE_ROLE_KEY); QC events will not be logged."
    );
    return null;
  }

  _supabaseAdminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabaseAdminClient;
}

/**
 * Log an array of QC events to Supabase. Fire-and-forget — caller does not
 * await the result for production behavior, but this function returns a
 * promise so tests can await it if needed.
 *
 * @param {Array<object>} events
 * @returns {Promise<void>}
 */
export async function logQcEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return;

  const supabase = getSupabaseClient();
  if (!supabase) return; // already warned in getter

  try {
    const { error } = await supabase
      .from("stage2b_qc_events")
      .insert(events);

    if (error) {
      console.error("[V4S32] supabase.insert(stage2b_qc_events) error:", error);
    }
  } catch (err) {
    console.error("[V4S32] Unexpected error logging QC events:", err);
  }
}

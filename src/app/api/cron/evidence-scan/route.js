// src/app/api/cron/evidence-scan/route.js
//
// THE EVIDENCE WATCH CRON — GET /api/cron/evidence-scan
//
// This is the piece that turns the loop by itself. On its schedule (see vercel.json)
// it runs scanDueIdeas: every watched idea whose cadence interval has elapsed gets a
// fresh replay + diff + (conditional) classify, and a material change writes an OPEN
// signal that surfaces on the Overview "Needs Your Move" card. The cron runs daily;
// each idea's own cadence (weekly … annual) gates whether it's due — so the schedule
// is the heartbeat, the cadence is the rhythm.
//
// GATED by CRON_SECRET: Vercel cron invocations carry `Authorization: Bearer
// <CRON_SECRET>`. Set CRON_SECRET in the Vercel env. If it is unset (e.g. local), the
// gate is skipped so the route can be exercised by hand. `limit` bounds work per run
// to keep the function inside its time budget; a backlog drains over subsequent runs.

import { NextResponse } from "next/server";
import { scanDueIdeas } from "@/lib/services/evidence-scan";

// Give the sequential scans room (each is a search round-trip + a possible Haiku call).
export const maxDuration = 60;
// Always run fresh; never cache a cron response.
export const dynamic = "force-dynamic";

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Forbidden" }, { status: 401 });
    }
  }

  try {
    const result = await scanDueIdeas({ limit: 10 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Evidence-scan cron error:", err);
    return NextResponse.json({ ok: false, error: "Cron failed." }, { status: 500 });
  }
}
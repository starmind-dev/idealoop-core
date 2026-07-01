// src/app/api/eval-usage/route.js
// Reads and records metered usage through the entitlements service. The lifetime-3
// counter is gone: allowance is now a rolling weekly window (see src/lib/plans.js),
// with a global spend guard riding along — when the whole app crosses the weekly
// budget, GET reports remaining:0 so the EXISTING client gate refuses new runs with
// no client change.
//
//   GET  -> the entitlement snapshot (My Plan + the client gate read this)
//   POST -> record one metered run: body { action: 'explore' | 'deep' | 'reeval' }
//           (compare records itself in /api/compare/comparison — it's free)
//
// Server-side enforcement (assertCanRun inside the analyze routes) lands next; until
// then the gate is client-side off `remaining`, which is fine for an invited beta.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getEntitlement, getUserPlan, recordRun } from "@/lib/services/entitlements";

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

// Map the entitlement snapshot to the response. Keeps the legacy fields the client
// already reads (remaining, dev, next_reset_time, limit, used) and adds the new ones
// My Plan renders. remaining collapses to 0 when the global budget guard trips, so
// the existing "remaining <= 0" gate enforces the cap with no client change.
function shape(e) {
  const remaining = e.unlimited ? 9999 : (e.capacityOk ? e.runsLeft : 0);
  return {
    // legacy — page.js reads these today
    remaining,
    dev: e.unlimited,
    next_reset_time: e.nextRunFreesAt,
    limit: e.unlimited ? 9999 : e.runsPerWeek,
    used: e.runsUsed,
    lifetime: false,
    // new — My Plan
    plan: e.plan,
    unlimited: e.unlimited,
    runsUsed: e.runsUsed,
    runsLeft: e.runsLeft,
    runsPerWeek: e.runsPerWeek,
    weeklyLoops: e.weeklyLoops,
    windowDays: e.windowDays,
    capacityOk: e.capacityOk,
    nextRunFreesAt: e.nextRunFreesAt,
  };
}

export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const e = await getEntitlement(user.id);
    return NextResponse.json(shape(e));
  } catch (err) {
    console.error("Eval usage GET error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const action = body.action || null; // 'explore' | 'deep' | 'reeval'

    // dev is never recorded — kept out of both the allowance and the global budget.
    const plan = await getUserPlan(user.id);
    if (plan.unlimited) {
      const e = await getEntitlement(user.id);
      return NextResponse.json({ success: true, ...shape(e) });
    }

    if (action) await recordRun(user.id, action, body.idea_id || null);

    const e = await getEntitlement(user.id);
    return NextResponse.json({ success: true, ...shape(e) });
  } catch (err) {
    console.error("Eval usage POST error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
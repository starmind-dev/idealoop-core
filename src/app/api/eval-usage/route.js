import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Free allotment is a LIFETIME cap (no rolling window) until the credit system lands.
// plan_type drives access:
//   "dev"  -> unlimited (never recorded, never blocked)
//   "free" -> EVAL_LIMIT evaluations, lifetime
// Future credit model (not built yet): deep = 4 credits, explore = 1-2, sold in packs.
// A future "credits" plan would check/decrement a balance here instead of counting rows.
const EVAL_LIMIT = 3;

// Helper: authenticate request
async function authenticate(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) return null;
  return user;
}

// Helper: read the caller's plan_type ("free" when absent)
async function getPlan(userId) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plan_type")
    .eq("id", userId)
    .single();
  return data?.plan_type || "free";
}

// Response shape for dev (unlimited) accounts.
const UNLIMITED = { used: 0, remaining: 9999, limit: 9999, lifetime: true, dev: true, next_reset_time: null };

// ============================================
// GET /api/eval-usage
// Returns how many evaluations the user has remaining (lifetime).
// ============================================
export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    if ((await getPlan(user.id)) === "dev") {
      return NextResponse.json(UNLIMITED);
    }

    const { count, error: countError } = await supabaseAdmin
      .from("eval_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      console.error("Eval usage count failed:", countError);
      return NextResponse.json(
        { error: `Failed to check eval usage: ${countError.message}` },
        { status: 500 }
      );
    }

    const used = count || 0;
    const remaining = Math.max(0, EVAL_LIMIT - used);

    return NextResponse.json({
      used,
      remaining,
      limit: EVAL_LIMIT,
      lifetime: true,
      next_reset_time: null, // lifetime cap — no rolling reset
    });
  } catch (err) {
    console.error("Eval usage error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

// ============================================
// POST /api/eval-usage
// Record that the user used one evaluation. Dev accounts are not recorded
// (unlimited). Returns updated remaining count.
// ============================================
export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    if ((await getPlan(user.id)) === "dev") {
      return NextResponse.json({ success: true, ...UNLIMITED });
    }

    // Lifetime count before recording
    const { count: currentCount, error: countError } = await supabaseAdmin
      .from("eval_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      console.error("Eval usage pre-check failed:", countError);
      // Don't block the eval - just log and continue
    }

    // Insert the new usage record
    const { error: insertError } = await supabaseAdmin
      .from("eval_usage")
      .insert({
        user_id: user.id,
        evaluated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Eval usage insert failed:", insertError);
      return NextResponse.json(
        { error: `Failed to record eval usage: ${insertError.message}` },
        { status: 500 }
      );
    }

    const used = (currentCount || 0) + 1;
    const remaining = Math.max(0, EVAL_LIMIT - used);

    return NextResponse.json({
      success: true,
      used,
      remaining,
      limit: EVAL_LIMIT,
      lifetime: true,
    });
  } catch (err) {
    console.error("Record eval usage error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
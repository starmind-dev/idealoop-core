// src/lib/plans.js
// Single source of truth for plans, allowances, metering weights, and the global
// budget guard. Everything money- or allowance-shaped reads from here — the
// entitlements service, the eval-usage route, My Plan, and (later) the landing
// pricing + the Polar webhook. Keeping it in one config is what stops the landing
// numbers and the real entitlement model from drifting apart (the pricing-
// reconciliation trust-blocker): reconcile here, once, and everything else reads it.

// A "loop" is the unit users think in (Explore -> Deep -> Re-evaluate -> Compare).
// The meter counts "runs": the three evaluation actions. Compare is always free —
// it's cheap and it's the payoff of the loop, so it never costs a user a run.
export const METERED_ACTIONS = ["explore", "deep", "reeval"];
export const RUNS_PER_LOOP = METERED_ACTIONS.length; // 3

// Estimated cost per action (USD). Measured 2026-07-01 on 3–4k-word inputs — the
// heavy end of the curve; a normal short idea runs cheaper. Used ONLY for the
// global budget guard, never shown to users. Re-measure and tune as inputs vary.
export const ACTION_COST_USD = { explore: 0.25, deep: 0.75, reeval: 0.85, compare: 0.06 };

// The hard money guarantee. If estimated spend across ALL users in any trailing
// 7-day window crosses this, new runs are refused until it falls back under. Set
// below the real ceiling (≈€250) to leave headroom for estimate error and the
// check-then-act gap. Tune to whatever you're willing to eat per week.
export const GLOBAL_WEEKLY_BUDGET_USD = 260; // ≈ €240 at ~1.08

// Rolling window — NOT a calendar week. Each run ages out 7 days after it ran, so
// allowances refill smoothly instead of every user refreshing at once (which would
// stampede the global guard every Monday morning).
export const USAGE_WINDOW_DAYS = 7;

// Evaluating never requires an account — it's the hook; SAVING an idea requires
// sign-up. Anonymous runs are capped per IP in the rolling window so the open
// pipeline can't be flooded, and (like every run) they count against the global
// budget above. Tunable: raise for a more generous trial, lower to spend less on
// people who never sign up.
export const ANON_RUNS_PER_WINDOW = 1;

// profiles.plan_type maps to one of these. 'free' is the beta default (already the
// column default). 'dev' bypasses every cap. Paid plans slot in here at the
// beta->paid step; the Polar webhook just sets profiles.plan_type to one of these
// ids — nothing else changes. Prices stay null until reconciled: no invented
// numbers ship from this file.
export const PLANS = {
  free: { id: "free", label: "Beta",      weeklyLoops: 1,    price: null, unlimited: false },
  dev:  { id: "dev",  label: "Developer", weeklyLoops: null, price: null, unlimited: true  },
  // paid: { id: "paid", label: "...", weeklyLoops: N, price: <reconciled>, unlimited: false },
};

export function getPlan(planType) {
  return PLANS[planType] || PLANS.free;
}

// Metered runs allowed per rolling window for a plan. Infinity for unlimited plans.
export function runsPerWeek(plan) {
  if (!plan || plan.unlimited) return Infinity;
  return (plan.weeklyLoops || 0) * RUNS_PER_LOOP;
}
// ============================================================================
// /api/diag/fixture-mode
// ============================================================================
//
// Read-only diagnostic endpoint: reports whether the server is running with
// IDEALOOP_USE_FIXTURES=1 active. Used by verification runners (run-b10a,
// run-bundle3-f3-verification, future Bundle 4.1+ runners) to validate the
// Bundle 3.75 fixture-mode protocol pre-launch per post-Bundle-3.75 #4 closure.
//
// Without this probe, a runner can proceed against a non-fixtured server,
// reading Layer E (upstream search-result drift) into its measurements and
// invalidating verification per the locked protocol.
//
// Returns { enabled: boolean, timestamp: ISO8601 }. Pure GET, no side effects.
// Reports environment state only; exposes no secrets. Production-safe — the
// boolean reveals nothing actionable to an external caller.
// ============================================================================

export async function GET() {
  return Response.json({
    enabled: process.env.IDEALOOP_USE_FIXTURES === "1",
    timestamp: new Date().toISOString(),
  });
}
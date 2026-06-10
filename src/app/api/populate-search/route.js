// ============================================================================
// /api/populate-search  — search-fixture populate (verification-only)
// ============================================================================
// PLACE AT: src/app/api/populate-search/route.js
// (sibling of analyze-pro, so the ../../../lib/services import depth matches
//  route.js exactly — if you move it deeper, e.g. under /api/diag/, add one
//  more ../ to each import.)
//
// Captures the GitHub + Serper + Tavily + Exa search queries for a batch of
// cases WITHOUT running the expensive pipeline (no Stage 1 LLM, no Stage 2a,
// no scorers).
//
// Why this exists: freezing search for verification requires the search
// fixtures to already exist on disk. Populating them by running the full
// /api/analyze-pro costs a full Sonnet pass per case. This endpoint runs ONLY
// the keyword-extraction + search step — byte-identical to route.js lines
// 306-313 — so the queries it writes are exactly the queries the real
// pipeline will later look up. Parity is guaranteed because it reuses
// extractKeywords / searchGitHub / searchSerper / searchTavily / searchExa
// VERBATIM; nothing is reimplemented. Each search module owns its own fixture
// cache keyed by source ("github"/"serper"/"tavily"/"exa"), so the populate
// job label and the real pipeline read/write the same key by construction.
//
// Precondition: the server MUST run with IDEALOOP_USE_FIXTURES=1. Without it,
// searchGitHub/searchSerper hit live APIs and writeFixture is a no-op — the
// populate would silently do nothing. This endpoint refuses (400) when
// fixtures are off, so a runner can't proceed against a non-fixtured server.
//
// POST body: { cases: [ { id, idea }, ... ] }
// Returns:   { enabled, totals, cases:[...] } with per-query hit/wrote status.
//   hit   = fixture already existed (readFixture non-null pre-call)
//   wrote = fixture written on this call (miss -> live search -> write)
//
// Re-run protocol: run once to populate, run AGAIN — second-pass totals.wrote
// MUST be 0. Zero proves every query is captured AND keyword generation is
// deterministic. Nonzero identifies cases with non-deterministic query
// generation (Haiku drift), which cannot be cleanly frozen at the search layer.
//
// Mirrors the gate short-circuit: if extractKeywords returns
// specificity_insufficient, the real pipeline issues NO searches (route.js
// line 221), so neither does this — the case is recorded as gated and skipped.
// ============================================================================

import { extractKeywords } from "../../../lib/services/keywords";
import { searchGitHub } from "../../../lib/services/github";
import { searchSerper } from "../../../lib/services/serper";
import { searchTavily } from "../../../lib/services/tavily";
import { searchExa } from "../../../lib/services/exa";
import { readFixture, isFixtureMode } from "../../../lib/services/fixture-store";

// fixture-store uses fs/path/crypto — force the Node runtime, never edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!isFixtureMode()) {
    return Response.json(
      {
        enabled: false,
        error: "fixtures_disabled",
        message:
          "Server is not in fixture mode. Start with IDEALOOP_USE_FIXTURES=1 so search results are cached to disk. Refusing to populate against live APIs (writeFixture would no-op).",
      },
      { status: 400 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "Body must be JSON: { cases: [{ id, idea }] }" },
      { status: 400 }
    );
  }

  const cases = Array.isArray(body?.cases) ? body.cases : null;
  if (!cases) {
    return Response.json(
      { error: "bad_request", message: "Missing cases array: { cases: [{ id, idea }] }" },
      { status: 400 }
    );
  }

  const report = [];
  const totals = {
    cases: cases.length,
    passed: 0,
    gated: 0,
    wrote: 0,
    hit: 0,
    queries: 0,
    errors: 0,
  };

  for (const c of cases) {
    const id = c?.id ?? "(unnamed)";
    const idea = typeof c?.idea === "string" ? c.idea : "";

    if (!idea) {
      report.push({ id, error: "missing_idea" });
      totals.errors++;
      continue;
    }

    // Same keyword extraction the real pipeline uses — this is what builds the
    // four query strings, so reusing it is what guarantees query parity.
    let kw;
    try {
      kw = await extractKeywords(idea);
    } catch (err) {
      report.push({ id, error: "keyword_extraction_failed", message: String(err?.message || err) });
      totals.errors++;
      continue;
    }

    // Gate short-circuit — mirrors route.js line 221. Gated inputs issue no
    // searches in the real pipeline, so we cache nothing for them.
    if (kw?.specificity_insufficient) {
      report.push({ id, gated: true, missing: kw.missing_elements || [] });
      totals.gated++;
      continue;
    }

    const { githubQuery1, githubQuery2, serperQuery1, serperQuery2 } = kw;

    // Same eight searches, same order as route.js 306-313. Run SEQUENTIALLY
    // (not Promise.all) so the pre-call readFixture hit/wrote determination is
    // unambiguous — latency is irrelevant for a one-off populate, and parallel
    // execution would mis-count duplicate queries as two writes.
    // Tavily + Exa fire on serperQuery1/serperQuery2 (the web queries), exactly
    // as route.js does — github keeps its own two queries. The source label in
    // column 1 IS the fixture key: it MUST match the key each service writes
    // under (serper.js→"serper", tavily.js→"tavily", exa.js→"exa") or the real
    // pipeline reads a cache that was never written and silently runs live.
    const jobs = [
      ["github", githubQuery1, searchGitHub],
      ["github", githubQuery2, searchGitHub],
      ["serper", serperQuery1, searchSerper],
      ["serper", serperQuery2, searchSerper],
      ["tavily", serperQuery1, searchTavily],
      ["tavily", serperQuery2, searchTavily],
      ["exa", serperQuery1, searchExa],
      ["exa", serperQuery2, searchExa],
    ];

    const queries = [];
    for (const [source, query, fn] of jobs) {
      const preHit = readFixture(source, query) !== null; // existing fixture-store export
      let count = null;
      let error = null;
      try {
        const results = await fn(query); // writes the fixture on a miss
        count = Array.isArray(results) ? results.length : null;
      } catch (err) {
        error = String(err?.message || err);
      }
      const status = error ? "error" : preHit ? "hit" : "wrote";
      if (status === "hit") totals.hit++;
      else if (status === "wrote") totals.wrote++;
      else totals.errors++;
      totals.queries++;
      queries.push({ source, query, status, results: count, ...(error ? { error } : {}) });
    }

    report.push({ id, gated: false, queries });
    totals.passed++;
  }

  return Response.json({ enabled: true, totals, cases: report });
}
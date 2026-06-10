// ============================================
// EXA API
// ============================================
// Neural / semantic web search via Exa. Unlike keyword search, Exa
// matches on meaning — it surfaces products conceptually similar to the
// idea even when they share no keywords. This is the originality-axis
// source: it catches the competitor who built the same thing under a
// different name, which keyword search structurally misses.
//
// Uses /search with type "auto" (balanced neural search) and highlights
// (query-relevant excerpts, token-efficient). Returns the SAME shape as
// the other web sources so it is treated uniformly downstream:
//   { title, url, snippet, source }
//
// Fixture parity (mirrors serper.js): when IDEALOOP_USE_FIXTURES=1 is set
// on the running server, returns cached results from runners/fixtures/data/
// instead of hitting Exa, and writes the fixture on a miss. Production
// (Vercel, env var unset) behaves identically to pre-fixture: real users
// always get fresh results. The cache key is "exa" — it MUST match the
// populate-search job label so the real pipeline reads what populate wrote.

import { readFixture, writeFixture, isFixtureMode } from "./fixture-store.js";

export async function searchExa(query) {
  try {
    if (isFixtureMode()) {
      const cached = readFixture("exa", query);
      if (cached) return cached;
    }

    if (!process.env.EXA_API_KEY) {
      console.error("No Exa API key configured");
      return [];
    }

    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "x-api-key": process.env.EXA_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        type: "auto",
        numResults: 5,
        contents: { highlights: true },
      }),
    });

    if (!response.ok) {
      console.error("Exa API error:", response.status);
      return [];
    }

    const data = await response.json();

    const results = (data.results || []).slice(0, 5).map((result) => ({
      title: result.title,
      url: result.url,
      snippet: Array.isArray(result.highlights)
        ? result.highlights.join(" ")
        : result.text || "",
      source: "exa",
    }));

    if (isFixtureMode()) {
      writeFixture("exa", query, results);
    }

    return results;
  } catch (error) {
    console.error("Exa search failed:", error);
    return [];
  }
}
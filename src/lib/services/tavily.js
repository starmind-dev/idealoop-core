// ============================================
// TAVILY API
// ============================================
// AI-native web search via Tavily. Built for LLM/RAG retrieval: returns
// ranked, structured results with a title, URL, and a content snippet
// already trimmed for context windows — richer than raw SERP snippets.
//
// Primary web-search source. Serper is retained alongside it as a
// fallback / baseline source (see route.js). Returns the SAME shape as
// serper.js so every web-search source is treated uniformly downstream:
//   { title, url, snippet, source }
//
// search_depth "basic" is the 1-credit tier; "advanced" doubles the cost
// for deeper results — kept basic to stay cheap per evaluation.
// include_answer is off: we want raw ranked results to feed Stage 1, not
// Tavily's synthesized answer.
//
// Fixture parity (mirrors serper.js): when IDEALOOP_USE_FIXTURES=1 is set
// on the running server, returns cached results from runners/fixtures/data/
// instead of hitting Tavily, and writes the fixture on a miss. Production
// (Vercel, env var unset) behaves identically to pre-fixture: real users
// always get fresh results. The cache key is "tavily" — it MUST match the
// populate-search job label so the real pipeline reads what populate wrote.

import { readFixture, writeFixture, isFixtureMode } from "./fixture-store.js";

export async function searchTavily(query) {
  try {
    if (isFixtureMode()) {
      const cached = readFixture("tavily", query);
      if (cached) return cached;
    }

    if (!process.env.TAVILY_API_KEY) {
      console.error("No Tavily API key configured");
      return [];
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        max_results: 5,
        search_depth: "basic",
        topic: "general",
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
      console.error("Tavily API error:", response.status);
      return [];
    }

    const data = await response.json();

    const results = (data.results || []).slice(0, 5).map((result) => ({
      title: result.title,
      url: result.url,
      snippet: result.content || "",
      source: "tavily",
    }));

    if (isFixtureMode()) {
      writeFixture("tavily", query, results);
    }

    return results;
  } catch (error) {
    console.error("Tavily search failed:", error);
    return [];
  }
}
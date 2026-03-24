import client from "./anthropic-client";

// ============================================
// KEYWORD EXTRACTION (Claude Haiku)
// ============================================
// Uses a fast, cheap Claude Haiku call to extract searchable keywords.
// Handles any input length — 50 words or 5000 words.
// Returns two search queries: one for GitHub, one for Google.
// Cost: ~$0.001 per call. Latency: ~1 second.

export async function extractKeywords(ideaText) {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      temperature: 0,
      system: `You are a keyword extraction tool for product/startup idea search. 
Extract exactly 5 searchable keywords or short phrases from the user's idea description.

Rules:
- Keep compound concepts together: "machine learning" not "machine" and "learning"
- Keep compound concepts together: "real estate" not "real" and "estate"
- Focus on NOUNS and DOMAIN TERMS: what the product does, who it serves, what technology it uses
- Remove generic words: app, platform, tool, system, build, create, help, users
- Return ONLY a comma-separated list, nothing else
- Example input: "An AI app that analyzes food photos and gives personalized nutrition advice"
- Example output: food photo analysis, nutrition advice, personalized diet, meal tracking, calorie estimation`,
      messages: [
        {
          role: "user",
          content: ideaText,
        },
      ],
    });

    const rawKeywords = response.content[0].text.trim();
    const keywords = rawKeywords
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0)
      .slice(0, 5);

    // Build multiple query variations for broader coverage:
    // Each API gets 2 searches with different keyword combos.
    // All 4 run simultaneously — no extra time cost.
    const githubQuery1 = keywords.slice(0, 3).join(" ");
    const githubQuery2 = keywords.slice(2, 5).join(" ");
    const serperQuery1 = keywords.slice(0, 3).join(" ") + " app OR startup";
    const serperQuery2 = keywords.slice(1, 4).join(" ") + " software OR product";

    return {
      keywords,
      githubQuery1,
      githubQuery2,
      serperQuery1,
      serperQuery2,
    };
  } catch (error) {
    console.error("Keyword extraction failed:", error);
    // Fallback: grab first 100 chars, split on spaces, take longest words
    const fallbackWords = ideaText
      .substring(0, 200)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(" ")
      .filter((w) => w.length > 4)
      .slice(0, 5);

    const searchQuery = fallbackWords.slice(0, 3).join(" ");
    return {
      keywords: fallbackWords,
      githubQuery1: searchQuery,
      githubQuery2: fallbackWords.slice(2, 5).join(" ") || searchQuery,
      serperQuery1: searchQuery,
      serperQuery2: searchQuery,
    };
  }
}
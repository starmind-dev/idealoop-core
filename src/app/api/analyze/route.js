import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// LAYER 1: KEYWORD EXTRACTION (Claude Haiku)
// ============================================
// Uses a fast, cheap Claude Haiku call to extract searchable keywords.
// Handles any input length — 50 words or 5000 words.
// Returns two search queries: one for GitHub, one for Google.
// Cost: ~$0.001 per call. Latency: ~1 second.

async function extractKeywords(ideaText) {
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

// ============================================
// LAYER 2: GITHUB API
// ============================================
// Searches GitHub repositories for real projects matching the idea.
// Returns: repo name, description, stars, URL, language, last updated.

async function searchGitHub(query) {
  try {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=5`;

    const headers = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "IdeaValidator-App",
    };

    // Use token if available for higher rate limits
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error("GitHub API error:", response.status);
      return [];
    }

    const data = await response.json();

    return (data.items || []).slice(0, 5).map((repo) => ({
      name: repo.full_name,
      description: repo.description || "No description",
      stars: repo.stargazers_count,
      url: repo.html_url,
      language: repo.language || "Unknown",
      updated: repo.updated_at,
      source: "github",
    }));
  } catch (error) {
    console.error("GitHub search failed:", error);
    return [];
  }
}

// ============================================
// LAYER 3: SERPER API
// ============================================
// Searches Google via Serper.dev for real products and companies.
// Returns: title, URL, snippet.

async function searchSerper(query) {
  try {
    if (!process.env.SERPER_API_KEY) {
      console.error("No Serper API key configured");
      return [];
    }

    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num: 5,
      }),
    });

    if (!response.ok) {
      console.error("Serper API error:", response.status);
      return [];
    }

    const data = await response.json();

    return (data.organic || []).slice(0, 5).map((result) => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet || "",
      source: "google",
    }));
  } catch (error) {
    console.error("Serper search failed:", error);
    return [];
  }
}

// ============================================
// LAYER 4: BUILD PROMPT WITH REAL DATA
// ============================================
// Injects real competitor data into the system prompt so Claude
// analyzes against verified products, not imagined ones.

function buildCompetitorContext(githubResults, serperResults) {
  let context = "";
  let hasRealData = false;

  if (githubResults.length > 0) {
    hasRealData = true;
    context += "\n=== REAL COMPETITOR DATA FROM GITHUB ===\n";
    context += "These are real, verified GitHub repositories related to this idea:\n\n";
    for (const repo of githubResults) {
      context += `- ${repo.name} (${repo.stars} stars, ${repo.language})\n`;
      context += `  Description: ${repo.description}\n`;
      context += `  URL: ${repo.url}\n`;
      context += `  Last updated: ${repo.updated}\n\n`;
    }
  }

  if (serperResults.length > 0) {
    hasRealData = true;
    context += "\n=== REAL COMPETITOR DATA FROM GOOGLE SEARCH ===\n";
    context += "These are real products and companies found via Google:\n\n";
    for (const result of serperResults) {
      context += `- ${result.title}\n`;
      context += `  URL: ${result.url}\n`;
      context += `  Description: ${result.snippet}\n\n`;
    }
  }

  return { context, hasRealData };
}

function buildCompetitorInstructions(hasRealData) {
  if (hasRealData) {
    return `
=== COMPETITOR DATA INSTRUCTIONS ===
REAL competitor data from GitHub and Google has been provided above. You MUST:
1. Use this real data as the PRIMARY basis for your competition analysis.
2. Include the real competitors in your competitors list with their actual names and descriptions.
3. Add "source": "github" or "source": "google" to each competitor entry.
4. Add "url": "<actual URL>" to each competitor entry.
5. You MAY add 1-2 additional competitors from your knowledge if highly relevant, marked with "source": "llm".
6. Your differentiation analysis must reference the REAL competitors specifically.
7. Do NOT invent competitors when real ones are provided.
`;
  } else {
    return `
=== COMPETITOR DATA INSTRUCTIONS ===
No real competitor data was found from external searches. This could mean the idea is very niche or novel.
1. Use your best knowledge to identify potential competitors.
2. Mark all competitors with "source": "llm".
3. Set "url" to null for competitors you cannot verify.
4. Add a note in the competition summary that competitor data is AI-generated and should be verified.
`;
  }
}

// ============================================
// SYSTEM PROMPT (same rubric, modified competitor section)
// ============================================

const SYSTEM_PROMPT_BASE = `You are an AI product idea evaluator and analyst. The user will give you their AI product idea and their profile (coding level, AI experience, professional background).

Your job is to:
1. Run pre-screening checks on the idea
2. Analyze competition, execution roadmap, tools, and estimates
3. Score the idea using a strict evaluation rubric

Return ONLY valid JSON, no markdown, no backticks, no explanation outside the JSON.

=== PRE-SCREENING RULES ===

CHECK A — ETHICS FILTER:
Determine whether the idea involves deception (fake reviews, impersonation, misleading content), illegal activity (scraping copyrighted content for resale, circumventing laws, fraud), or potential harm to users or third parties (deepfakes of real people, surveillance tools targeting individuals, tools designed to manipulate or exploit).

If the idea FAILS the ethics filter, return ONLY this JSON and nothing else:
{
  "ethics_blocked": true,
  "ethics_message": "This tool does not evaluate ideas that involve deception, illegal activity, or potential harm to people. The purpose of this tool is to help hardworking, ambitious people evaluate legitimate ideas. Please reconsider your approach and submit an idea that creates genuine value."
}

If the idea PASSES the ethics filter, continue with the full analysis below.

CHECK B — SCOPE WARNING:
Set scope_warning to true if the idea includes significant non-software components: physical hardware manufacturing, brick-and-mortar services, physical product distribution as the core business, or ideas where AI/software is a minor feature of a primarily physical business. Otherwise set to false.

CHECK C — CLASSIFICATION:
Determine if the idea is "commercial" (built to generate revenue and profit) or "social_impact" (built to help people/communities where the primary goal is impact, not profit). This affects how Monetization is evaluated.

=== EVALUATION RUBRIC ===

Score exactly 4 metrics. Follow each rubric precisely.

METRIC 1: MARKET DEMAND (Weight: 30%)
Evaluate the IDEA ONLY. This metric evaluates CAPTURABLE demand — not whether people want something in this category, but whether a new entrant could realistically capture demand. A massive market fully dominated by incumbents using the same approach does not constitute capturable demand.
For marketplace/platform ideas: evaluate demand for the underlying transaction, not the platform itself.

Score levels:
1-2: No capturable demand. Either no one wants this, OR need is real but fully served by dominant players and the idea does not offer a structurally different approach. A large existing market does not constitute capturable demand if entering with the same approach incumbents use.
3-4: Niche audience, small. Problem real but low urgency. Some capturable demand but not enough for meaningful growth.
5-6: Clear target audience with demonstrated need. Gaps remain in existing solutions. A new entrant with differentiated approach could realistically capture a portion.
7-8: Large addressable market with active demand. Users seeking solutions and willing to pay. Growing trend. Clear entry point.
9-10: Massive proven market with urgent unmet need. Willingness to pay. Rapid growth. Significant gaps incumbents are not addressing.

If the idea targets an emerging trend that is currently small but growing, add a trajectory_note. Do NOT adjust the score for future projections.
If the idea targets a regional or non-English-speaking market, add a geographic_note.

METRIC 2: MONETIZATION POTENTIAL (Weight: 25%)
Evaluate the IDEA ONLY. Consider ALL revenue models: subscriptions, commissions, advertising, API licensing, enterprise contracts, affiliate revenue, data licensing, transaction fees, freemium, white-labeling. Score the REALISTIC path, not theoretical. If dominant competitors make revenue models unviable for new entrants, score accordingly.

This score evaluates the idea's revenue potential in isolation. Actual outcomes depend on distribution, timing, and market conditions.

For COMMERCIAL ideas:
1-2: No viable revenue path. Market expects free.
3-4: One weak revenue stream. Low pricing power. Competitors suppress earnings.
5-6: At least one proven revenue model with willingness to pay. Moderate pricing power.
7-8: Multiple viable streams. Strong pricing power. Layered monetization.
9-10: Exceptional revenue mechanics. High margins. Strong lock-in. Compounding model.

For SOCIAL IMPACT ideas (label as "Sustainability Potential"):
1-2: No sustainability path. Dies when creator stops funding.
3-4: Could survive on small grants but no reliable mechanism.
5-6: Clear sustainability — grants, NGO partnerships, government contracts, or institutional freemium.
7-8: Multiple sustainability paths. Institutional funding AND organic growth.
9-10: Self-sustaining. Social impact generates resources through adoption or hybrid models.

METRIC 3: ORIGINALITY (Weight: 25%)
Evaluate the IDEA ONLY. Evaluate at the APPROACH level: does any existing product solve the same specific problem, for the same specific audience, using the same specific method?
For marketplace ideas: evaluate whether the marketplace MODEL is novel, not just whether the platform exists.

TIEBREAKER for 5-6 vs 7-8: Could a competitor match this by adding 1-2 features? Score 5-6. Would they need to redesign core workflow/data model/user journey? Score 7-8. If genuinely ambiguous, default to 6.0-6.5.

1-2: Direct copy. Exists exactly as described.
3-4: Minor twist on existing concept. Competitors add feature trivially.
5-6: Approach has clear parallels. Competitors need only minor additions. Differentiation real but not defensible.
7-8: Approach combines audience+problem+method uniquely. Competitors need fundamental rethink.
9-10: Paradigm shift. Creates a category. Extremely rare.

METRIC 4: TECHNICAL COMPLEXITY (Weight: 20%, inverted in overall)
ONLY metric using user profile. Score how hard this is FOR THIS SPECIFIC USER.

CRITICAL: Score the COMPLETE idea as one system. Do not split into current/future versions. Do not average simpler and complex versions. Treat the description as a single product specification.

Calibration anchors:
Beginner + No AI: TC 3-4 = landing page; TC 5-6 = web app with DB; TC 7-8 = LLM API app; TC 9-10 = marketplace with payments + custom AI
Beginner + Regular AI: TC 3-4 = no-code + AI; TC 5-6 = web app + LLM + DB; TC 7-8 = multi-API + prompt chains; TC 9-10 = custom models + ML pipelines
Advanced + No AI: TC 3-4 = standard web app; TC 5-6 = LLM API + structured output; TC 7-8 = multi-model + RAG; TC 9-10 = training custom models
Advanced + Regular AI: TC 3-4 = LLM app; TC 5-6 = multi-agent + RAG; TC 7-8 = fine-tuning + production ML; TC 9-10 = building new LLM from scratch

Professional background adjustment:
Adjacent technical (CS, data analyst, engineer, IT): reduce 0.5-1.5
Domain-relevant non-technical (doctor building health app): reduce 0.5
Unrelated: no adjustment
Cannot reduce below 1.0.

After scoring the full idea, if the idea has a clear simpler starting point, add an incremental_note with approximate TC for that simpler version. Not every idea needs this.

=== OVERALL SCORE ===
Do NOT calculate or include an overall_score field. The application calculates it as:
(Market Demand x 0.30) + (Monetization x 0.25) + (Originality x 0.25) + ((10 - Technical Complexity) x 0.20)

=== MARKETPLACE NOTE ===
If the idea is a marketplace/platform depending on network effects, set marketplace_note to a warning about the cold-start challenge. Otherwise set to null.

=== SCORING RULES ===
1. Use decimal scores (e.g. 6.5).
2. Do not inflate scores. Mediocre = 4-5, not 6-7.
3. Most scores should be 3-7. Scores 1-2 and 9-10 are rare.
4. Each explanation MUST reference which rubric level the score maps to.
5. Market Demand, Monetization, Originality evaluate the IDEA ONLY.
6. Technical Complexity is the ONLY metric using user profile.

=== JSON STRUCTURE ===

{
  "classification": "commercial",
  "scope_warning": false,
  "competition": {
    "competitors": [
      {
        "name": "Competitor Name",
        "description": "What they do in 1-2 sentences",
        "status": "growing | active | acquired | failed | shutdown",
        "outcome": "Key metric or result",
        "source": "github | google | llm",
        "url": "https://... or null"
      }
    ],
    "differentiation": "2-3 sentences on how user's idea differs from or overlaps with competitors listed above.",
    "summary": "One paragraph overview of the competitive landscape",
    "data_source": "verified | llm_generated"
  },
  "phases": [
    {
      "number": 1,
      "title": "Phase Title",
      "summary": "Short 1-2 sentence summary",
      "details": "Extended explanation, 2-3 paragraphs with actionable guidance"
    }
  ],
  "tools": [
    {
      "name": "Tool Name",
      "category": "Tool category",
      "description": "Why this specific tool for THIS idea and THIS user skill level"
    }
  ],
  "estimates": {
    "duration": "e.g. 4-6 months",
    "difficulty": "Easy | Moderate | Hard | Very Hard",
    "explanation": "Why this estimate, calibrated to user profile"
  },
  "evaluation": {
    "market_demand": {
      "score": 6.5,
      "explanation": "2-3 sentences referencing rubric level",
      "geographic_note": null,
      "trajectory_note": null
    },
    "monetization": {
      "score": 5.5,
      "label": "Monetization Potential",
      "explanation": "2-3 sentences referencing rubric level"
    },
    "originality": {
      "score": 7.0,
      "explanation": "2-3 sentences referencing rubric level"
    },
    "technical_complexity": {
      "score": 8.0,
      "base_score_explanation": "1 sentence on base score from calibration",
      "adjustment_explanation": "1 sentence on professional background adjustment or no adjustment",
      "explanation": "1-2 sentence final explanation",
      "incremental_note": null
    },
    "marketplace_note": null,
    "summary": "Final paragraph with realistic expectations and key recommendations"
  }
}

Additional rules:
- Return 3-5 competitors. Use real companies/products when possible.
- Generate 4-8 execution phases depending on idea complexity.
- Recommend 4-6 tools contextualized to user skill level and specific idea.
- Calibrate time estimates and difficulty to user experience level.
- Tool recommendations must explain WHY this tool for THIS idea.
- For social impact ideas, set monetization label to "Sustainability Potential".`;

// ============================================
// MAIN API HANDLER
// ============================================

export async function POST(request) {
  try {
    const { idea, profile } = await request.json();

    if (!idea || !idea.trim()) {
      return NextResponse.json(
        { error: "No idea provided" },
        { status: 400 }
      );
    }

    // LAYER 1: Extract keywords from the idea (Claude Haiku call)
    const { keywords, githubQuery1, githubQuery2, serperQuery1, serperQuery2 } =
      await extractKeywords(idea);

    // LAYER 2 & 3: Call GitHub and Serper simultaneously (4 searches, 0 extra time)
    const [githubResults1, githubResults2, serperResults1, serperResults2] =
      await Promise.all([
        searchGitHub(githubQuery1),
        searchGitHub(githubQuery2),
        searchSerper(serperQuery1),
        searchSerper(serperQuery2),
      ]);

    // Deduplicate results by URL
    const seenUrls = new Set();

    function dedup(results) {
      const unique = [];
      for (const item of results) {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          unique.push(item);
        }
      }
      return unique;
    }

    const githubResults = dedup([...githubResults1, ...githubResults2]).slice(0, 7);
    const serperResults = dedup([...serperResults1, ...serperResults2]).slice(0, 7);

    // LAYER 4: Build the prompt with real competitor data
    const { context: competitorContext, hasRealData } = buildCompetitorContext(
      githubResults,
      serperResults
    );
    const competitorInstructions = buildCompetitorInstructions(hasRealData);

    // Combine: base prompt + real data + instructions
    const fullSystemPrompt =
      SYSTEM_PROMPT_BASE + competitorContext + competitorInstructions;

    const userMessage = `
USER PROFILE:
- Coding familiarity: ${profile?.coding || "Not specified"}
- AI experience: ${profile?.ai || "Not specified"}
- Professional background: ${profile?.education || "Not specified"}

USER'S AI PRODUCT IDEA:
${idea}
`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      temperature: 0,
      system: fullSystemPrompt,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const responseText = message.content[0].text;

    let analysis;
    try {
      analysis = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse AI response:", responseText);
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    // If ethics blocked, return directly
    if (analysis.ethics_blocked) {
      return NextResponse.json(analysis);
    }

    // Calculate overall score server-side
    const ev = analysis.evaluation;
    const overall =
      ev.market_demand.score * 0.3 +
      ev.monetization.score * 0.25 +
      ev.originality.score * 0.25 +
      (10 - ev.technical_complexity.score) * 0.2;

    ev.overall_score = Math.round(overall * 10) / 10;

    // Attach metadata about data sources
    analysis._meta = {
      github_results: githubResults.length,
      serper_results: serperResults.length,
      data_source: hasRealData ? "verified" : "llm_generated",
      keywords_used: keywords,
      queries: { githubQuery1, githubQuery2, serperQuery1, serperQuery2 },
    };

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Analysis failed. Please check your API key and try again." },
      { status: 500 }
    );
  }
}
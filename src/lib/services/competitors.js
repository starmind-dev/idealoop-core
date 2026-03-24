// ============================================
// BUILD COMPETITOR CONTEXT
// ============================================
// Injects real competitor data into the system prompt so Claude
// analyzes against verified products, not imagined ones.

export function buildCompetitorContext(githubResults, serperResults) {
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

export function buildCompetitorInstructions(hasRealData) {
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

=== COMPETITOR CLASSIFICATION ===
Classify EVERY competitor with a competitor_type field:
- "direct": Products solving the same problem for the same audience in roughly the same way.
- "adjacent": Products in the same space but solving a different problem, or the same problem for a different audience. Could pivot to compete.
- "substitute": Non-product alternatives that users currently use instead: manual workflows, spreadsheets, existing habits, WhatsApp/Discord groups, personal relationships, informal networks, hiring a person, or professional services (lawyers, consultants, accountants, brokers, agencies). These are often the REAL competition.
- "internal_build": When the target buyer could build this internally with their existing engineering team, an LLM API, and a few weeks of work. Especially relevant for developer tools and enterprise AI features.

IMPORTANT RULES:
- For LLM-wrapper or AI-tool ideas: Always include at least one substitute entry for general-purpose LLMs (ChatGPT, Claude, Gemini) if a user could get 60%+ of the value through direct prompting. This is the most common missed competitor.
- For B2B ideas: Always consider whether the buyer's internal team could build a "good enough" version. If yes, include an internal_build entry.
- For ideas targeting markets that run on personal relationships (trade, sourcing, real estate, recruiting): Include the human intermediary (broker, agent, recruiter, sourcing contact) as a substitute competitor. Displacing trusted human relationships is often the hardest adoption barrier.
- For regulated domains (health, finance, legal): Include the relevant professional service (doctor, lawyer, financial advisor, compliance officer) as a substitute competitor.
- Include at least one substitute competitor for every evaluation. If you cannot identify any substitute, explain why in the summary.
- WEAK RETRIEVAL DOES NOT MEAN OPEN MARKET. If few competitors are found in search results, this may mean the market is too niche, the keywords are wrong, or adoption barriers are so high that few have tried. Do NOT interpret sparse results as "blue ocean." Default to skepticism and note the uncertainty.
`;
  } else {
    return `
=== COMPETITOR DATA INSTRUCTIONS ===
No real competitor data was found from external searches. This could mean the idea is very niche or novel — but WEAK RETRIEVAL DOES NOT MEAN OPEN MARKET. Sparse results may indicate the market is too niche, keywords are wrong, or adoption barriers are so high that few have tried. Default to skepticism and note the uncertainty.
1. Use your best knowledge to identify potential competitors.
2. Mark all competitors with "source": "llm".
3. Set "url" to null for competitors you cannot verify.
4. Add a note in the competition summary that competitor data is AI-generated and should be verified.

=== COMPETITOR CLASSIFICATION ===
Classify EVERY competitor with a competitor_type field:
- "direct": Products solving the same problem for the same audience in roughly the same way.
- "adjacent": Products in the same space but solving a different problem, or the same problem for a different audience.
- "substitute": Non-product alternatives users currently use instead: manual workflows, spreadsheets, existing habits, personal relationships, hiring a person, or professional services.
- "internal_build": When the target buyer could build this internally with their existing engineering team and an LLM API.

IMPORTANT RULES:
- For LLM-wrapper or AI-tool ideas: Always include at least one substitute entry for general-purpose LLMs (ChatGPT, Claude, Gemini) if a user could get 60%+ of the value through direct prompting.
- For B2B ideas: Consider whether the buyer's internal team could build a "good enough" version. If yes, include an internal_build entry.
- For ideas targeting markets that run on personal relationships: Include the human intermediary as a substitute competitor.
- For regulated domains (health, finance, legal): Include the relevant professional service as a substitute competitor.
- Include at least one substitute competitor for every evaluation.
`;
  }
}
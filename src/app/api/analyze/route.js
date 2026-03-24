import { NextResponse } from "next/server";
import client from "../../../lib/services/anthropic-client";
import { extractKeywords } from "../../../lib/services/keywords";
import { searchGitHub } from "../../../lib/services/github";
import { searchSerper } from "../../../lib/services/serper";
import { buildCompetitorContext, buildCompetitorInstructions } from "../../../lib/services/competitors";
import { SYSTEM_PROMPT_BASE } from "../../../lib/services/prompt";
import { calculateOverallScore } from "../../../lib/services/scoring";

// ============================================
// MAIN API HANDLER — FREE TIER SINGLE-CALL PIPELINE
// ============================================
// Orchestrates: Keywords → Search → Evidence → Sonnet Evaluation → Score
// Streams progress via Server-Sent Events (SSE)

export async function POST(request) {
  try {
    const { idea, profile } = await request.json();

    if (!idea || !idea.trim()) {
      return NextResponse.json(
        { error: "No idea provided" },
        { status: 400 }
      );
    }

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Helper to send SSE events
        function sendEvent(data) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        }

        try {
          // STAGE 1: Extract keywords
          sendEvent({ step: "keywords_start", message: "Extracting keywords..." });

          const { keywords, githubQuery1, githubQuery2, serperQuery1, serperQuery2 } =
            await extractKeywords(idea);

          sendEvent({
            step: "keywords_done",
            message: `Keywords: ${keywords.join(", ")}`,
            data: { keywords },
          });

          // STAGE 2: Search GitHub and Serper simultaneously
          sendEvent({ step: "search_start", message: "Searching for competitors..." });

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

          // Send individual search results
          sendEvent({
            step: "github_done",
            message: githubResults.length > 0
              ? `GitHub: found ${githubResults.length} repositories`
              : "GitHub: no matching repositories found",
            data: { count: githubResults.length },
          });

          sendEvent({
            step: "serper_done",
            message: serperResults.length > 0
              ? `Google: found ${serperResults.length} results`
              : "Google: no matching results found",
            data: { count: serperResults.length },
          });

          // STAGE 3: Build the prompt with real competitor data
          const { context: competitorContext, hasRealData } = buildCompetitorContext(
            githubResults,
            serperResults
          );
          const competitorInstructions = buildCompetitorInstructions(hasRealData);

          const dataSourceMsg = hasRealData
            ? "Real competitor data injected into evaluation"
            : "No verified data found — using AI knowledge base";

          sendEvent({
            step: "evidence_ready",
            message: dataSourceMsg,
            data: { hasRealData, github: githubResults.length, serper: serperResults.length },
          });

          // STAGE 4: Run Sonnet evaluation
          sendEvent({ step: "evaluating", message: "Running evaluation with Claude Sonnet..." });

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
            sendEvent({ step: "error", message: "Failed to parse AI response. Please try again." });
            controller.close();
            return;
          }

          // If ethics blocked, send directly and close
          if (analysis.ethics_blocked) {
            sendEvent({ step: "complete", data: analysis });
            controller.close();
            return;
          }

          // STAGE 5: Calculate deterministic score
          sendEvent({ step: "scoring", message: "Calculating scores..." });

          const ev = analysis.evaluation;
          ev.overall_score = calculateOverallScore(ev);

          // Attach metadata about data sources
          analysis._meta = {
            github_results: githubResults.length,
            serper_results: serperResults.length,
            data_source: hasRealData ? "verified" : "llm_generated",
            keywords_used: keywords,
            queries: { githubQuery1, githubQuery2, serperQuery1, serperQuery2 },
          };

          sendEvent({ step: "complete", message: "Evaluation complete", data: analysis });
          controller.close();
        } catch (error) {
          console.error("SSE Pipeline Error:", error);
          sendEvent({ step: "error", message: "Analysis failed. Please try again." });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Analysis failed. Please check your API key and try again." },
      { status: 500 }
    );
  }
}
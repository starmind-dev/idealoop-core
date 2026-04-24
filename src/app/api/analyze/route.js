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

          // V4S28 P0.5 Stage 1 Fix #1: sort retrieved items by URL before injection
          // Eliminates retrieval ordering as a source of Stage 1 synthesis non-determinism.
          // Phase 0 observed Serper Jaccard 0.40-0.75 across reruns — Google's ranking
          // fluctuates on identical queries. Sorting gives Stage 1 a stable input order
          // so observed competitor-list drift is attributable to synthesis, not input.
          githubResults.sort((a, b) => (a.url || "").localeCompare(b.url || ""));
          serperResults.sort((a, b) => (a.url || "").localeCompare(b.url || ""));

          // Send individual search results
          // V4S28 P0: emit raw `results` arrays alongside `count` so variance
          // diagnostic can localize cascade source (retrieval vs Stage 1 synthesis).
          sendEvent({
            step: "github_done",
            message: githubResults.length > 0
              ? `GitHub: found ${githubResults.length} repositories`
              : "GitHub: no matching repositories found",
            data: { count: githubResults.length, results: githubResults },
          });

          // Small delays between rapid-fire events to force Vercel stream buffer flush
          await new Promise(r => setTimeout(r, 80));

          sendEvent({
            step: "serper_done",
            message: serperResults.length > 0
              ? `Google: found ${serperResults.length} results`
              : "Google: no matching results found",
            data: { count: serperResults.length, results: serperResults },
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

          await new Promise(r => setTimeout(r, 80));

          sendEvent({
            step: "evidence_ready",
            message: dataSourceMsg,
            data: { hasRealData, github: githubResults.length, serper: serperResults.length },
          });

          // STAGE 4: Run Sonnet evaluation
          await new Promise(r => setTimeout(r, 80));

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

          // V4S28 P0.5 Task 2 (2026-04-24) — IMPORTANT DESIGN NOTE:
          //
          // Sampler hardening (top_k=1, top_p=0.1) was tested here and reverted.
          // Rationale: the parallel change worked on Pro's isolated Stage 1 call
          // (commit 12f7a49), but on Standard's single-merged call it destabilized
          // TC scoring — MAT2 TC spread 2.0pt, MAT3 spread 1.0pt — exceeding the
          // 1.0pt ship-blocker gate in run-stage1-stability.js.
          //
          // Standard had no evidence of synthesis instability before the change
          // (Phase 0 never variance-tested Standard). Copy-paste from Pro's
          // architecturally-different chained pipeline created a problem rather
          // than solving one. Standard remains at temp=0 alone on this call —
          // its pre-V4S28 state, which we have no evidence is broken.
          //
          // Canonical naming rules (Fix #4 in prompt-stage1.js on Pro) were also
          // tested in prompt.js and reverted in the same rollback. They appeared
          // to contribute to the TC drift, possibly via context-length shift in
          // the single merged call.
          //
          // CONDITIONAL REVISIT: If user-visible competitor-label drift on
          // Standard becomes a real concern, consider porting Fix #4 (naming
          // conventions only, NOT Fix #3 sampler hardening) to prompt.js as a
          // separate validated workstream. Required: fresh harness run with
          // that change alone, confirming it doesn't perturb scoring. Don't
          // bundle with sampler changes; don't copy-paste from Pro.
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
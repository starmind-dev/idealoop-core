import { NextResponse } from "next/server";
import client from "../../../lib/services/anthropic-client";
import { extractKeywords } from "../../../lib/services/keywords";
import { searchGitHub } from "../../../lib/services/github";
import { searchSerper } from "../../../lib/services/serper";
import { buildCompetitorContext, buildCompetitorInstructions } from "../../../lib/services/competitors";
import { STAGE1_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage1";
import { STAGE2_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage2";
import { STAGE3_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage3";
import { calculateOverallScore } from "../../../lib/services/scoring";

// ============================================
// MAIN API HANDLER — PAID TIER CHAINED PIPELINE
// ============================================
// Orchestrates: Keywords → Search → Stage 1 (Discover) → Stage 2 (Judge) → Stage 3 (Act) → Score
// Three sequential Sonnet calls. Each stage's output feeds into the next.
// Streams progress via Server-Sent Events (SSE)
//
// Output schema is identical to the free tier route — the frontend renders both the same way.
// The difference is HOW the output is produced: grounded, chained reasoning vs single-call.

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
          // ============================
          // PHASE 1: EVIDENCE GATHERING
          // (Same as free tier — keywords + search)
          // ============================

          sendEvent({ step: "keywords_start", message: "Extracting keywords..." });

          const { keywords, githubQuery1, githubQuery2, serperQuery1, serperQuery2 } =
            await extractKeywords(idea);

          sendEvent({
            step: "keywords_done",
            message: `Keywords: ${keywords.join(", ")}`,
            data: { keywords },
          });

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

          // Build competitor context for injection
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

          const userProfile = `
USER PROFILE:
- Coding familiarity: ${profile?.coding || "Not specified"}
- AI experience: ${profile?.ai || "Not specified"}
- Professional background: ${profile?.education || "Not specified"}`;

          // ============================
          // STAGE 1: DISCOVER
          // Competition analysis + domain risk detection
          // ============================

          sendEvent({ step: "stage1_start", message: "Stage 1: Analyzing competitive landscape..." });

          const stage1SystemPrompt = STAGE1_SYSTEM_PROMPT + competitorContext + competitorInstructions;

          const stage1UserMessage = `${userProfile}

USER'S AI PRODUCT IDEA:
${idea}`;

          const stage1Response = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 3000,
            temperature: 0,
            system: stage1SystemPrompt,
            messages: [{ role: "user", content: stage1UserMessage }],
          });

          const stage1Text = stage1Response.content[0].text;

          let stage1Result;
          try {
            stage1Result = JSON.parse(stage1Text);
          } catch (parseError) {
            console.error("Stage 1 parse failed:", stage1Text);
            sendEvent({ step: "error", message: "Stage 1 failed to parse. Please try again." });
            controller.close();
            return;
          }

          // If ethics blocked at Stage 1, stop immediately
          if (stage1Result.ethics_blocked) {
            sendEvent({ step: "complete", data: stage1Result });
            controller.close();
            return;
          }

          const competitorCount = stage1Result.competition?.competitors?.length || 0;
          sendEvent({
            step: "stage1_done",
            message: `Stage 1 complete: ${competitorCount} competitors analyzed`,
            data: { competitorCount },
          });

          // ============================
          // STAGE 2: JUDGE
          // Score the idea against Stage 1 context
          // ============================

          sendEvent({ step: "stage2_start", message: "Stage 2: Scoring idea against competition..." });

          const stage2UserMessage = `${userProfile}

USER'S AI PRODUCT IDEA:
${idea}

=== STAGE 1 RESULTS: COMPETITION ANALYSIS ===
${JSON.stringify(stage1Result)}`;

          const stage2Response = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            temperature: 0,
            system: STAGE2_SYSTEM_PROMPT,
            messages: [{ role: "user", content: stage2UserMessage }],
          });

          const stage2Text = stage2Response.content[0].text;

          let stage2Result;
          try {
            stage2Result = JSON.parse(stage2Text);
          } catch (parseError) {
            console.error("Stage 2 parse failed:", stage2Text);
            sendEvent({ step: "error", message: "Stage 2 failed to parse. Please try again." });
            controller.close();
            return;
          }

          sendEvent({
            step: "stage2_done",
            message: "Stage 2 complete: Scores calculated",
          });

          // ============================
          // STAGE 3: ACT
          // Generate roadmap informed by Stage 1 + Stage 2
          // ============================

          sendEvent({ step: "stage3_start", message: "Stage 3: Building adaptive roadmap..." });

          const stage3UserMessage = `${userProfile}

USER'S AI PRODUCT IDEA:
${idea}

=== STAGE 1 RESULTS: COMPETITION ANALYSIS ===
${JSON.stringify(stage1Result)}

=== STAGE 2 RESULTS: SCORING ===
${JSON.stringify(stage2Result)}`;

          const stage3Response = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            temperature: 0,
            system: STAGE3_SYSTEM_PROMPT,
            messages: [{ role: "user", content: stage3UserMessage }],
          });

          const stage3Text = stage3Response.content[0].text;

          let stage3Result;
          try {
            stage3Result = JSON.parse(stage3Text);
          } catch (parseError) {
            console.error("Stage 3 parse failed:", stage3Text);
            sendEvent({ step: "error", message: "Stage 3 failed to parse. Please try again." });
            controller.close();
            return;
          }

          sendEvent({
            step: "stage3_done",
            message: "Stage 3 complete: Roadmap generated",
          });

          // ============================
          // ASSEMBLY: Combine all stages into unified output
          // Must match the same JSON schema as free tier
          // ============================

          sendEvent({ step: "scoring", message: "Calculating final scores..." });

          const ev = stage2Result.evaluation;
          ev.overall_score = calculateOverallScore(ev);

          // SANITY CHECK: Flag score-explanation contradictions
          // Catches outlier runs where Stage 2 scores don't match rubric level language
          const sanityWarnings = [];
          const metrics = [
            { name: "market_demand", score: ev.market_demand?.score, explanation: ev.market_demand?.explanation },
            { name: "monetization", score: ev.monetization?.score, explanation: ev.monetization?.explanation },
            { name: "originality", score: ev.originality?.score, explanation: ev.originality?.explanation },
          ];

          const positiveSignals = ["clear", "proven", "demonstrated", "strong", "growing", "established", "active demand", "willingness to pay"];
          const negativeSignals = ["severely limited", "no viable", "no capturable", "structurally weak", "no clear", "eliminates", "impossible", "doomed"];

          for (const m of metrics) {
            if (!m.score || !m.explanation) continue;
            const expLower = m.explanation.toLowerCase();
            const hasPositive = positiveSignals.some(s => expLower.includes(s));
            const hasNegative = negativeSignals.some(s => expLower.includes(s));

            if (m.score <= 4.0 && hasPositive && !hasNegative) {
              sanityWarnings.push(`${m.name}: score ${m.score} but explanation uses positive language`);
            }
            if (m.score >= 6.5 && hasNegative && !hasPositive) {
              sanityWarnings.push(`${m.name}: score ${m.score} but explanation uses negative language`);
            }
          }

          if (sanityWarnings.length > 0) {
            console.warn("SANITY CHECK WARNINGS:", sanityWarnings);
          }

          // Assemble final analysis in the same schema as free tier
          const analysis = {
            classification: stage1Result.classification,
            scope_warning: stage1Result.scope_warning,
            competition: stage1Result.competition,
            phases: stage3Result.phases,
            tools: stage3Result.tools,
            estimates: stage3Result.estimates,
            evaluation: ev,
            // Pro-tier exclusive fields
            _pro: {
              evaluation_mode: "paid_chained",
              domain_risk_flags: stage1Result.domain_risk_flags,
              stage1_competitor_count: competitorCount,
            },
            _meta: {
              github_results: githubResults.length,
              serper_results: serperResults.length,
              data_source: hasRealData ? "verified" : "llm_generated",
              keywords_used: keywords,
              queries: { githubQuery1, githubQuery2, serperQuery1, serperQuery2 },
              evaluation_mode: "paid_chained",
            },
          };

          sendEvent({ step: "complete", message: "Pro evaluation complete", data: analysis });
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
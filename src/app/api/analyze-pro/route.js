import { NextResponse } from "next/server";
import client from "../../../lib/services/anthropic-client";
import { extractKeywords } from "../../../lib/services/keywords";
import { searchGitHub } from "../../../lib/services/github";
import { searchSerper } from "../../../lib/services/serper";
import { buildCompetitorContext, buildCompetitorInstructions } from "../../../lib/services/competitors";
import { STAGE1_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage1";
import { STAGE2A_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage2a";
import { STAGE2B_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage2b";
import { STAGE_TC_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage-tc";
import { STAGE3_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage3";
import { calculateOverallScore } from "../../../lib/services/scoring";

// ============================================
// MAIN API HANDLER — PAID TIER CHAINED PIPELINE
// ============================================
// Orchestrates: Keywords → Search → Stage 1 (Discover) → [Stage 2a + Stage TC in parallel] → Stage 2b (Score MD/MO/OR) → Stage 3 (Act) → Assembly
//
// Stage TC runs in PARALLEL with Stage 2a — it receives ONLY idea + profile,
// never sees Stage 1 output. This physically prevents TC from correlating with
// competition-informed metrics (OR, MD, MO).
//
// Stage 2a extracts 3 evidence packets (MD, MO, OR) — no TC packet.
// Stage 2b scores 3 metrics from those packets.
// TC score is merged in during assembly.
//
// Output schema is identical to the free tier route — the frontend renders both the same way.

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
          // Helper to clean markdown fences from LLM JSON responses
          function cleanJsonResponse(text) {
            let cleaned = text.trim();
            if (cleaned.startsWith("```json")) {
              cleaned = cleaned.slice(7);
            } else if (cleaned.startsWith("```")) {
              cleaned = cleaned.slice(3);
            }
            if (cleaned.endsWith("```")) {
              cleaned = cleaned.slice(0, -3);
            }
            return cleaned.trim();
          }

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

          // V4S28 P0: emit raw `results` arrays alongside `count` so variance
          // diagnostic can localize cascade source (retrieval vs Stage 1 synthesis).
          sendEvent({
            step: "github_done",
            message: githubResults.length > 0
              ? `GitHub: found ${githubResults.length} repositories`
              : "GitHub: no matching repositories found",
            data: { count: githubResults.length, results: githubResults },
          });

          sendEvent({
            step: "serper_done",
            message: serperResults.length > 0
              ? `Google: found ${serperResults.length} results`
              : "Google: no matching results found",
            data: { count: serperResults.length, results: serperResults },
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
            stage1Result = JSON.parse(cleanJsonResponse(stage1Text));
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
          // STAGE 2a + STAGE TC: RUN IN PARALLEL
          // Stage 2a: Extract MD/MO/OR evidence packets from Stage 1
          // Stage TC: Score TC from idea + profile ONLY (no Stage 1 data)
          // ============================

          sendEvent({ step: "stage2a_start", message: "Stage 2a: Extracting evidence + scoring technical complexity..." });

          const stage2aUserMessage = `${userProfile}

USER'S AI PRODUCT IDEA:
${idea}

=== STAGE 1 RESULTS: COMPETITION ANALYSIS ===
${JSON.stringify(stage1Result)}`;

          const stageTcUserMessage = `${userProfile}

USER'S AI PRODUCT IDEA:
${idea}`;

          // Run Stage 2a and Stage TC in parallel
          const [stage2aResponse, stageTcResponse] = await Promise.all([
            client.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 2000,
              temperature: 0,
              system: STAGE2A_SYSTEM_PROMPT,
              messages: [{ role: "user", content: stage2aUserMessage }],
            }),
            client.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1000,
              temperature: 0,
              system: STAGE_TC_SYSTEM_PROMPT,
              messages: [{ role: "user", content: stageTcUserMessage }],
            }),
          ]);

          const stage2aText = stage2aResponse.content[0].text;
          const stageTcText = stageTcResponse.content[0].text;

          let stage2aResult;
          try {
            stage2aResult = JSON.parse(cleanJsonResponse(stage2aText));
          } catch (parseError) {
            console.error("Stage 2a parse failed:", stage2aText);
            sendEvent({ step: "error", message: "Stage 2a failed to parse. Please try again." });
            controller.close();
            return;
          }

          let stageTcResult;
          try {
            stageTcResult = JSON.parse(cleanJsonResponse(stageTcText));
          } catch (parseError) {
            console.error("Stage TC parse failed:", stageTcText);
            sendEvent({ step: "error", message: "Stage TC failed to parse. Please try again." });
            controller.close();
            return;
          }

          sendEvent({
            step: "stage2a_done",
            message: `Stage 2a complete: Evidence packets extracted | TC: ${stageTcResult.technical_complexity?.score || "?"}`,
          });

          // ============================
          // STAGE 2b: SCORE MD/MO/OR
          // Score from evidence packets ONLY — no raw Stage 1, no TC
          // ============================

          sendEvent({ step: "stage2b_start", message: "Stage 2b: Scoring idea from evidence..." });

          // CRITICAL: Stage 2b receives idea + evidence packets ONLY.
          // No raw Stage 1 output. No TC data. No user profile (not needed for MD/MO/OR).
          const stage2bUserMessage = `${userProfile}

USER'S AI PRODUCT IDEA:
${idea}

=== EVIDENCE PACKETS FROM STAGE 2a ===
${JSON.stringify(stage2aResult)}`;

          const stage2bResponse = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            temperature: 0,
            system: STAGE2B_SYSTEM_PROMPT,
            messages: [{ role: "user", content: stage2bUserMessage }],
          });

          const stage2bText = stage2bResponse.content[0].text;

          let stage2bResult;
          try {
            stage2bResult = JSON.parse(cleanJsonResponse(stage2bText));
          } catch (parseError) {
            console.error("Stage 2b parse failed:", stage2bText);
            sendEvent({ step: "error", message: "Stage 2b failed to parse. Please try again." });
            controller.close();
            return;
          }

          sendEvent({
            step: "stage2b_done",
            message: "Stage 2b complete: Scores calculated",
          });

          // ============================
          // MERGE TC INTO EVALUATION
          // Stage 2b has MD/MO/OR. Stage TC has TC. Combine them.
          // ============================

          const ev = stage2bResult.evaluation;
          ev.technical_complexity = stageTcResult.technical_complexity;

          // ============================
          // STAGE 3: ACT
          // Generate roadmap informed by Stage 1 + combined scores
          // ============================

          sendEvent({ step: "stage3_start", message: "Stage 3: Building adaptive roadmap..." });

          const stage3UserMessage = `${userProfile}

USER'S AI PRODUCT IDEA:
${idea}

=== STAGE 1 RESULTS: COMPETITION ANALYSIS ===
${JSON.stringify(stage1Result)}

=== STAGE 2 RESULTS: SCORING ===
${JSON.stringify(stage2bResult)}`;

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
            stage3Result = JSON.parse(cleanJsonResponse(stage3Text));
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

          ev.overall_score = calculateOverallScore(ev);

          // SANITY CHECK: Flag score-explanation contradictions
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
              evidence_packets: stage2aResult.evidence_packets,
              tc_isolated: true,
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
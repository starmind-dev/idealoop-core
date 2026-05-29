import { NextResponse } from "next/server";
import client from "../../../lib/services/anthropic-client";
import { extractKeywords } from "../../../lib/services/keywords";
import { searchGitHub } from "../../../lib/services/github";
import { searchSerper } from "../../../lib/services/serper";
import { buildCompetitorContext, buildCompetitorInstructions } from "../../../lib/services/competitors";
import { STAGE1_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage1";
import { STAGE2A_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage2a";
// V5.0 NEW PIPELINE — three separate metric scorers replace the former
// two-call Stage 2b (adjudicate + score) plus the prosecutor/repair QC layer.
// Each scorer reads ONLY its own packet from Stage 2a (clean quarantine).
import { STAGE_MD_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage-md";
import { STAGE_MO_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage-mo";
import { STAGE_OR_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage-or";
import { STAGE2C_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage2c";
import { STAGE_TC_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage-tc";
import { STAGE3_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage3";
import { calculateOverallScore } from "../../../lib/services/scoring";

// ============================================
// MAIN API HANDLER — PAID TIER CHAINED PIPELINE
// ============================================
// Orchestrates: Keywords → Search → Stage 1 (Discover) → [Stage 2a + Stage TC in parallel] → Stage 2b-Adj → Stage 2b-Score → [V4S32 PROSECUTOR+REPAIR] → Stage 2c (Synthesis) → Stage 3 (Act) → Assembly
//
// V4S32 PROSECUTOR + REPAIR LAYER (May 19-20, 2026):
// New quality-control layer inserted between Stage 2b-Score and Stage 2c.
// Audits whether each metric's explanation+adjudication survives adversarial
// review by a packet-grounded prosecutor; if FAIL, runs a constrained repair
// stage that regenerates score + explanation + score_adjudication; if the
// repair re-prosecutes PASS, the repaired output replaces the original in ev.
//
// Validated across two probes (V4S31 + B10a): prosecutor 5/6 spike recall +
// 23/231 (10%) clean B10a rate; repair 7/7 + 21/21 success, 0 double-fails.
// See orchestrator file header + prompt-stage2b-prosecutor.js / -repair.js
// for full calibration history.
//
// Architecture:
//   - Sequential before Stage 2c (Stage 2c sees post-repair scores, not pre)
//   - Per-metric parallelization within the layer (MD/MO/OR independent)
//   - Repair regenerates score_adjudication too (not just prose) so the
//     post-QC adjudication restored to the frontend payload reflects the
//     corrected reasoning chain (not the flawed pre-repair one)
//   - QC layer failures NEVER block the pipeline (safety-layer principle)
//   - Feature-flagged via STAGE2B_QC_MODE = off | log_only | repair
//     (defaults to 'repair' per locked architecture decision)
//
// Stage 2c boundary discipline (mirrors V4S31 score_adjudication strip):
//   - Stage 2c NEVER sees quality_control metadata
//   - Stage 2c eventually may see repaired score_adjudication (deferred
//     to M3 — same Option 2 staging as V4S31)
//   - quality_control restored at final assembly for frontend payload
//
// Supabase logging: every prosecutor invocation that produces a real verdict
// (PASS / FAIL_REPAIRED / BORDERLINE / DOUBLE_FAIL / QC_UNAVAILABLE) is
// logged fire-and-forget to public.stage2b_qc_events. Skipped metrics are
// not logged. See migration file + log-qc-events.js for table schema.
//
// V4S31 TWO-CALL STAGE 2b (May 19, 2026):
// Stage 2b is now physically separated into two sequential calls:
//   Call 1 (Stage 2b-Adj): produces score_adjudication + evidence_strength.
//     No score, no explanation. The model has no downstream score commitment
//     to protect — adjudication is made honestly on packet evidence.
//   Call 2 (Stage 2b-Score): receives Call 1's adjudication as locked
//     structured input (mirrors Stage 2a → Stage 2b pattern). Produces
//     score (constrained to score_basis range; code-side clamping enforces)
//     and explanation (must reflect locked adjudication).
//
// Rationale: V4S30 externalized score_adjudication into Stage 2b's output
// schema, achieving 100% structural compliance but only 1/4 watch zones
// closed. Empirical analysis identified the failure mode: single-call
// adjudication still allows the model to rationalize resolution=overridden
// with actor-mismatched override evidence (the trigger_buyer_match_verified
// disease on A3-class cases). Physical separation removes the score-anchoring
// pressure that drives the rationalization.
//
// score_adjudication is preserved across the two calls and restored to the
// final payload for the frontend (future popup feature). Stage 2c and
// Stage 3 do NOT receive score_adjudication in V4S31 (Option 2 staging:
// downstream pass-through is a follow-on session with separate verification).
//
// V4S28 S1+S2+S3 (Bundle B1):
// Stage 2c (NEW) sits between Stage 2b and Stage 3, sequential. It synthesizes
// summary + failure_risks from idea + profile + Stage 1 output + Stage 2a
// packets + Stage 2b scores + evidence_strength. Stage 2b no longer outputs
// summary or failure_risks — those moved to Stage 2c. Stage 3 reads
// failure_risks from the merged evaluation object (mutated in-place after
// Stage 2c completes), preserving Stage 3's risk-mitigation behavior.
//
// Sequencing rationale: 2c||3 parallel was rejected because Stage 3 reads
// failure_risks as input — under parallel design Stage 3 would lose this input.
// Sequential 2c → 3 protects Stage 3 quality at a cost of ~5-8s latency.
// See execution-plan.md S3.
//
// Graceful degradation: if Stage 2c parse fails, summary + failure_risks are
// set empty, Stage 3 proceeds without failure_risks input. Evaluation still
// produces scores.
//
// Stage TC runs in PARALLEL with Stage 2a — it receives ONLY idea + profile,
// never sees Stage 1 output. This physically prevents TC from correlating with
// competition-informed metrics (OR, MD, MO).
//
// Stage 2a extracts 3 evidence packets (MD, MO, OR) — no TC packet.
// Stage 2b adjudicates + scores 3 metrics from those packets (two calls).
// Stage 2c synthesizes interpretive output (summary + failure_risks).
// TC score is merged in during assembly.
//
// Output schema is identical to the free tier route — the frontend renders both the same way.

// ============================================
// V4S31 — SCORE-BASIS RANGE DERIVATION HELPER
// ============================================
// Mechanical mapping from Call 1's score_basis enum to the score range Call 2
// must land in. Used by code-side score clamping after Call 2: if Call 2 emits
// a score outside the derived range, the score is clamped to the range and a
// warning is logged. This is the structural enforcement of score-adjudication
// consistency — Call 1's locked score_basis defines the score range; Call 2's
// score must respect it.
//
// Returns { min, max } or null if score_basis is unrecognized (clamping skipped).
export async function POST(request) {
  try {
    const { idea, profile } = await request.json();

    if (!idea || !idea.trim()) {
      return NextResponse.json(
        { error: "No idea provided" },
        { status: 400 }
      );
    }

    // V4S32 — Generate evaluation correlation ID. Used as the join key for
    // QC event logging (public.stage2b_qc_events.evaluation_id) and surfaced
    // in the response so the frontend can use the same ID when persisting
    // the evaluation to its own table. crypto.randomUUID is available in
    // Node 14.17+ / all Next.js runtimes.
    const evaluationId = crypto.randomUUID();

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
          // Helper to clean LLM JSON responses, handling:
          //   - Bare JSON: { ... }
          //   - Markdown-fenced JSON: ```json\n{ ... }\n```
          //   - JSON preceded by prose preamble: "Looking at this... 1. **HARDEST...** ```json\n{ ... }\n```"
          //   - JSON followed by trailing prose or fences
          //
          // V4S28 B9 Stage TC parse hardening (May 4, 2026):
          // Original implementation only stripped ```json fences when they
          // appeared at startsWith()/endsWith() positions. On long structured
          // inputs (e.g. "Sherpa" devex monitoring pitch — ~3.2k chars / 450
          // words with formal IDE-plugin / tutorial-vs-real-engineering
          // framing), Stage TC leaked its internal reasoning headers
          // (HARDEST TECHNICAL PROBLEM / SIMPLEST WORKING VERSION /
          // BEYOND-TUTORIAL GAP) as visible output preamble before the
          // ```json fence — breaking the startsWith() check and causing
          // JSON.parse() to fail on prose. Two consecutive Pro-pipeline runs
          // both failed identically; Standard pipeline (unified prompt) on
          // same input succeeded — confirming bug is in Stage TC's isolated
          // parser path, not the input or the model.
          //
          // This helper is shared across Stage 1, Stage 2a, Stage 2b,
          // Stage 2c, Stage 3, AND Stage TC (every parse in this route).
          // Stage TC was the first to surface the bug because its isolated-
          // call attention budget makes it more prone to preamble leak.
          // Other stages were vulnerable to the same bug; this fix covers
          // all six call sites with one helper change. Pure additive
          // upgrade — every input the old parser handled correctly still
          // parses identically; only previously-failing inputs (prose
          // preamble) now succeed.
          //
          // Stage TC reasoning logic + prompt are NOT changed by this fix
          // (off-limits per active TC monitoring directive — anchor-fixing
          // bug from B6 surfaced; TC scoring math + reasoning are locked
          // until dedicated TC fix session). Output format hardening at
          // prompt level deferred to that session.
          function cleanJsonResponse(text) {
            if (!text || typeof text !== "string") {
              return text;
            }
            const trimmed = text.trim();
            // Locate the first { and the last } — covers all wrapping cases:
            //   - bare JSON: first { at 0, last } at end-1
            //   - fenced JSON: first { after ```json, last } before ```
            //   - prose preamble + fenced JSON: first { after preamble + ```json
            //   - prose preamble + bare JSON: first { after preamble
            //   - JSON + trailing prose: first { at start, last } before trailing
            const firstBrace = trimmed.indexOf("{");
            const lastBrace = trimmed.lastIndexOf("}");
            if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
              // No JSON object found — return trimmed input so the JSON.parse
              // call below produces the same failure shape it always did.
              // Defensive: do not mask non-JSON responses; let them surface
              // as parse errors so the existing error handling fires.
              return trimmed;
            }
            return trimmed.slice(firstBrace, lastBrace + 1);
          }

          // ============================
          // PHASE 1: EVIDENCE GATHERING
          // (Same as free tier — keywords + search)
          // ============================

          sendEvent({ step: "keywords_start", message: "Extracting keywords..." });

          const keywordsResult = await extractKeywords(idea);

          // V4S28 B7 — Specificity gate. If Haiku determines input is
          // underspecified, halt the pipeline upstream of search/Stage 1/etc.
          // No credit charged (frontend returns early before usage recording,
          // mirroring ethics-blocked treatment). Section 13 / Item 7 lock.
          if (keywordsResult.specificity_insufficient) {
            sendEvent({
              step: "complete",
              data: {
                specificity_insufficient: true,
                missing_elements: keywordsResult.missing_elements || [],
                message: keywordsResult.message || "",
              },
            });
            controller.close();
            return;
          }

          const { keywords, githubQuery1, githubQuery2, serperQuery1, serperQuery2 } = keywordsResult;

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

          // V4S28 P0.5 Stage 1 Fix #1: sort retrieved items by URL before injection
          // Eliminates retrieval ordering as a source of Stage 1 synthesis non-determinism.
          // Phase 0 observed Serper Jaccard 0.40-0.75 across reruns — Google's ranking
          // fluctuates on identical queries. Sorting gives Stage 1 a stable input order
          // so observed competitor-list drift is attributable to synthesis, not input.
          githubResults.sort((a, b) => (a.url || "").localeCompare(b.url || ""));
          serperResults.sort((a, b) => (a.url || "").localeCompare(b.url || ""));

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

          // V4S28 B6 P12-S1: Stage 1 is profile-blind. Profile is NOT injected
          // into Stage 1 input. Profile-aware judgments live downstream in TC,
          // Stage 2c synthesis, and Stage 3. See prompt-stage1.js
          // PROFILE-BLINDNESS section for prompt-level contract.
          const stage1UserMessage = `USER'S AI PRODUCT IDEA:
${idea}`;

          const stage1Response = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 3000,
            temperature: 0,
            // V4S28 P0.5 Stage 1 Fix #3: sampler-level hardening.
            // Phase 0.5 Fix #1 (sort items) confirmed Stage 1 non-determinism
            // is NOT input-ordering sensitive — MAT3-insider with Serper URL
            // Jaccard 1.00 still produced competitor-list Jaccard 0.38 across
            // reruns. Anthropic docs acknowledge temp=0 alone is not fully
            // deterministic. top_k=1 forces greedy single-token selection at
            // each step; top_p=0.1 constrains nucleus to top 10% probability
            // mass as belt-and-suspenders against distribution flattening.
            // Sonnet 4 (claude-sonnet-4-20250514) accepts both alongside
            // temperature (the either/or restriction is Sonnet 4.5+ only).
            top_k: 1,
            top_p: 0.1,
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

          // V4S28 B6 (Path A — found during route audit): Stage 2a is profile-blind
          // per V4S9 architectural quarantine and NarrativeContract V3 §3.10.
          // Profile is NOT injected. Sparse-input discipline operates from idea
          // text + Stage 1 evidence only.
          const stage2aUserMessage = `USER'S AI PRODUCT IDEA:
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
              // V4S29 Bundle 2 — F1 partial cure (May 8, 2026): sampler hardening
              // on Stage 2a / 2b / TC to suppress Layer A sampler-driven near-tie
              // collapse. Mechanism + rationale identical to Stage 1's V4S28 P0.5
              // block above; applies symmetrically to all scoring/extraction calls.
              //
              // Investigation: counterfactual prompt-test sequence on 8-case bank
              // (Phase A/B → Phase 2C sampler → Phase 2A MO-tighten → Phase 2B
              // MD-loosen → Test 3 combined → Test 4 MAT2 → Test 5 dominant-signal).
              // Sampler hardening cleanly cures sampler-driven cases:
              // ARC-D2 σ(MO) 0.63→0, M3 σ(MO) 0.21→0. Two prompt-level interventions
              // tested and rejected: asymmetric MO band tightening introduced
              // cross-metric coupling (L2 MD downshift); symmetric dominant-signal
              // instruction regressed previously-cured ARC-D2 (σ 0→0.73).
              // Residuals (L2 frame-selection, MAT2-beginner cross-metric swap)
              // are interpretive-frame phenomena resistant to sampler/prompt fixes
              // at Stage 2b — scoped for future Stage 2a packeting bundle.
              // See B10a-findings.md F1 closure + Methodology Principle 7
              // (counterfactual prompt tests precede architectural change).
              //
              // Stage 2c and Stage 3 deliberately NOT hardened: they are narrative
              // synthesis stages (summary, failure_risks), not
              // scoring stages, and their stability concerns are tracked as
              // separate B10a findings outside F1 scope.
              top_k: 1,
              top_p: 0.1,
              system: STAGE2A_SYSTEM_PROMPT,
              messages: [{ role: "user", content: stage2aUserMessage }],
            }),
            client.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1000,
              temperature: 0,
              // V4S29 Bundle 2 — F1 sampler hardening (see Stage 2a comment above
              // for full rationale). Stage TC scores TC in isolation; same Layer A
              // suppression logic applies.
              top_k: 1,
              top_p: 0.1,
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
          // STAGE MD / MO / OR: THREE SEPARATE METRIC SCORERS (V5.0)
          // Replaces the former two-call Stage 2b (adjudicate + score) and the
          // prosecutor/repair QC layer. Each scorer is an isolated evaluator that
          // reads ONLY its own packet from Stage 2a — clean per-metric quarantine,
          // stricter than the old monolith which dumped the whole stage2aResult
          // into one call.
          //
          // Each scorer receives: idea + its own evidence packet (which already
          // embeds that metric's binding/component emission) + domain_flags +
          // sparse_input_triggered (context the scorers reference). No raw Stage 1,
          // no TC, no profile (MD/MO/OR are profile-blind per V4S9 quarantine).
          //
          // Each scorer emits its metric object under its own top-level key
          // (market_demand / monetization / originality) with: score (decimal from
          // lookup), prose fields (diagnosis + binding-explanation + direction;
          // OR has four prose fields), and a nested _internal audit block. The
          // score is computed mechanically from predicate commitments + the
          // archetype/sub-position lookup — no free-chosen score, no rationalization
          // surface (the disease the old two-call separation was built to fight,
          // now structurally prevented by score-then-prose ordering inside each
          // scorer).
          // ============================

          sendEvent({ step: "stage2b_start", message: "Scoring Market Demand, Monetization, and Originality..." });

          const sharedPacketContext = {
            domain_flags: stage2aResult.domain_flags,
            sparse_input_triggered: stage2aResult.sparse_input_triggered,
          };

          const stageMdUserMessage = `USER'S AI PRODUCT IDEA:
${idea}

=== STAGE 2a MARKET DEMAND EVIDENCE PACKET ===
${JSON.stringify({
            ...sharedPacketContext,
            evidence_packet: stage2aResult.evidence_packets?.market_demand,
          })}`;

          const stageMoUserMessage = `USER'S AI PRODUCT IDEA:
${idea}

=== STAGE 2a MONETIZATION EVIDENCE PACKET ===
${JSON.stringify({
            ...sharedPacketContext,
            evidence_packet: stage2aResult.evidence_packets?.monetization,
          })}`;

          const stageOrUserMessage = `USER'S AI PRODUCT IDEA:
${idea}

=== STAGE 2a ORIGINALITY EVIDENCE PACKET ===
${JSON.stringify({
            ...sharedPacketContext,
            evidence_packet: stage2aResult.evidence_packets?.originality,
          })}`;

          // Same sampler config as all scoring calls (temp 0 / top_k 1 / top_p 0.1)
          // for determinism. max_tokens 4096 — each scorer emits prose + a full
          // nested _internal predicate-commitment block.
          const scorerCallConfig = {
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            temperature: 0,
            top_k: 1,
            top_p: 0.1,
          };

          const [stageMdResponse, stageMoResponse, stageOrResponse] = await Promise.all([
            client.messages.create({
              ...scorerCallConfig,
              system: STAGE_MD_SYSTEM_PROMPT,
              messages: [{ role: "user", content: stageMdUserMessage }],
            }),
            client.messages.create({
              ...scorerCallConfig,
              system: STAGE_MO_SYSTEM_PROMPT,
              messages: [{ role: "user", content: stageMoUserMessage }],
            }),
            client.messages.create({
              ...scorerCallConfig,
              system: STAGE_OR_SYSTEM_PROMPT,
              messages: [{ role: "user", content: stageOrUserMessage }],
            }),
          ]);

          let stageMdResult, stageMoResult, stageOrResult;
          try {
            stageMdResult = JSON.parse(cleanJsonResponse(stageMdResponse.content[0].text));
          } catch (parseError) {
            console.error("Stage MD parse failed:", stageMdResponse.content[0].text);
            sendEvent({ step: "error", message: "Market Demand scoring failed to parse. Please try again." });
            controller.close();
            return;
          }
          try {
            stageMoResult = JSON.parse(cleanJsonResponse(stageMoResponse.content[0].text));
          } catch (parseError) {
            console.error("Stage MO parse failed:", stageMoResponse.content[0].text);
            sendEvent({ step: "error", message: "Monetization scoring failed to parse. Please try again." });
            controller.close();
            return;
          }
          try {
            stageOrResult = JSON.parse(cleanJsonResponse(stageOrResponse.content[0].text));
          } catch (parseError) {
            console.error("Stage OR parse failed:", stageOrResponse.content[0].text);
            sendEvent({ step: "error", message: "Originality scoring failed to parse. Please try again." });
            controller.close();
            return;
          }

          // ---- Synthesize a single .explanation per metric for the frontend ----
          // The frontend renders one explanation block per metric
          // (renderProseSection reads ev.{metric}.explanation). The V5.0 scorers
          // emit multiple prose fields instead of a single explanation. Concatenate
          // each metric's prose fields (in narrative order: situation → binding
          // limit → direction) into .explanation so none of the scorer's reasoning
          // is lost in the current single-block UI. The raw prose fields are
          // retained on the metric object too, so a future multi-field UI (esp.
          // OR's four-question layout) can render them without a pipeline change.
          const joinProse = (...parts) => parts.filter(Boolean).map((s) => String(s).trim()).filter(Boolean).join(" ");

          const md = stageMdResult.market_demand || {};
          const mo = stageMoResult.monetization || {};
          const or = stageOrResult.originality || {};

          // ---- Score-shape guard ----
          // Each scorer's JSON parsed successfully, but a malformed shape (metric
          // not nested under its key, or score emitted as a non-number) would
          // surface downstream as ev.{metric}.score === undefined and crash the
          // frontend at score.toFixed(1). Fail cleanly here with a clear SSE
          // error (mirrors the parse-failure handling above) so a bad scorer
          // output produces a retry-able message, never a white-screen render
          // crash. calculateOverallScore + Stage 2c low-band logic also depend on
          // numeric scores.
          const scoreGuard = [
            ["market_demand", md],
            ["monetization", mo],
            ["originality", or],
          ];
          for (const [metricKey, metricObj] of scoreGuard) {
            if (typeof metricObj.score !== "number" || Number.isNaN(metricObj.score)) {
              console.error(
                `${metricKey} scorer returned a non-numeric score:`,
                JSON.stringify(metricObj).slice(0, 500)
              );
              sendEvent({
                step: "error",
                message: `${metricKey} scoring returned an invalid score. Please try again.`,
              });
              controller.close();
              return;
            }
          }

          md.explanation = joinProse(md.diagnosis, md.binding_friction_explanation, md.direction);
          mo.explanation = joinProse(mo.diagnosis, mo.binding_payment_constraint_explanation, mo.direction);
          or.explanation = joinProse(
            or.differentiation_basis_diagnosis,
            or.defensibility_diagnosis,
            or.binding_constraint_explanation,
            or.direction
          );

          // ---- Assemble the evaluation object ----
          // evidence_strength now comes from Stage 2a (V5.0 Option A) — the old
          // producer (Stage 2b-Adj) is removed. marketplace_note has no producer
          // in the new pipeline; emit null (frontend renders it conditionally, so
          // null simply does not render).
          const ev = {
            evidence_strength: stage2aResult.evidence_strength,
            market_demand: md,
            monetization: mo,
            originality: or,
            marketplace_note: null,
          };

          sendEvent({
            step: "stage2b_done",
            message: "Scores calculated: Market Demand, Monetization, Originality",
          });

          // ============================
          // MERGE TC INTO EVALUATION
          // The three scorers produced MD/MO/OR (assembled into ev above).
          // Stage TC scored TC in isolation. Attach it.
          // ============================

          ev.technical_complexity = stageTcResult.technical_complexity;

          // ============================
          // V4S28 B8 — THIN_DIMENSIONS DOWNSTREAM FILTER
          // Extract thin_dimensions (UI-only metadata, generated when LOW)
          // and strip it from ev.evidence_strength BEFORE Stage 2c and
          // Stage 3 see it. They receive only { level, reason }.
          //
          // Stage 2c and Stage 3 already have locked LOW-handling behavior
          // (sparse summary + Specification cascade) driven by .level alone.
          // thin_dimensions is purely a frontend-rendering signal for the
          // partnered EARLY READ callout — must not influence downstream
          // synthesis.
          //
          // Restored to ev.evidence_strength at final assembly time below
          // so the frontend payload includes the array.
          // ============================

          let preservedThinDimensions = null;
          if (
            ev.evidence_strength &&
            ev.evidence_strength.level === "LOW" &&
            Array.isArray(ev.evidence_strength.thin_dimensions)
          ) {
            const validEnum = ["target_user", "use_case", "mechanism"];
            preservedThinDimensions = ev.evidence_strength.thin_dimensions.filter(
              (d) => typeof d === "string" && validEnum.includes(d)
            );
            // Defensive: if model returned the field on HIGH/MEDIUM, also strip
            delete ev.evidence_strength.thin_dimensions;
          } else if (
            ev.evidence_strength &&
            ev.evidence_strength.thin_dimensions !== undefined
          ) {
            // Model returned thin_dimensions on a non-LOW level — strip silently
            delete ev.evidence_strength.thin_dimensions;
          }

          // ============================
          // V5.0 — _INTERNAL DOWNSTREAM FILTER (mirrors thin_dimensions B8 pattern)
          //
          // Each V5.0 scorer emits a large nested _internal audit block
          // (predicate commitments, archetype, sub-position arithmetic, binding
          // constraint). Stage 2c and Stage 3 read ONLY .score from each metric
          // (plus evidence_strength + packets) — they never consume _internal.
          // Strip _internal per metric BEFORE Stage 2c/3 to keep their input
          // context lean and prevent any accidental leakage of scorer-internal
          // enum vocabulary into the synthesis/diagnosis stages.
          //
          // Restored to each metric at final assembly time below so the payload
          // retains _internal for logging, debugging, and the verification runner
          // (the frontend ignores it; grep-confirmed zero reads).
          // ============================

          const preservedInternal = {
            market_demand: null,
            monetization: null,
            originality: null,
          };
          for (const metricKey of ["market_demand", "monetization", "originality"]) {
            if (ev[metricKey] && ev[metricKey]._internal !== undefined) {
              preservedInternal[metricKey] = ev[metricKey]._internal;
              delete ev[metricKey]._internal;
            }
          }

          // ============================
          // STAGE 2c: SYNTHESIS
          // Generate summary + failure_risks from idea + profile + Stage 1 +
          // Stage 2a packets + Stage 2b scores + evidence_strength.
          //
          // V4S28 S1+S2+S3 architectural change: summary + failure_risks moved
          // out of Stage 2b to prevent profile-aware Risk 3 contaminating the
          // profile-blind MD/MO/OR scoring (V4S7-S11 pattern). Stage 2c is
          // post-scoring interpretive — it does not change scores.
          // ============================

          sendEvent({ step: "stage2c_start", message: "Stage 2c: Synthesizing summary and failure risks..." });

          // Bundle 3 / F3: compute overall_score early so Stage 2c's HARD RULE
          // for low-band Summary openers can reference it. calculateOverallScore
          // is a pure deterministic function on the metric scores; the same
          // value is recomputed at assembly below (ev.overall_score = ...) —
          // no risk of drift, and the duplicate cost is sub-millisecond.
          // See prompt-stage2c.js HARD RULE — LOW-BAND OPENING SENTENCE block.
          const overallScoreForStage2c = calculateOverallScore(ev);

          const stage2cUserMessage = `${userProfile}

USER'S AI PRODUCT IDEA:
${idea}

=== STAGE 1 RESULTS: COMPETITION ANALYSIS ===
${JSON.stringify(stage1Result)}

=== STAGE 2a EVIDENCE PACKETS ===
${JSON.stringify(stage2aResult)}

=== STAGE 2b SCORES + EVIDENCE STRENGTH ===
${JSON.stringify({
            market_demand: ev.market_demand,
            monetization: ev.monetization,
            originality: ev.originality,
            technical_complexity: ev.technical_complexity,
            evidence_strength: ev.evidence_strength,
            marketplace_note: ev.marketplace_note,
            overall_score: overallScoreForStage2c,
          })}`;

          const stage2cResponse = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            temperature: 0,
            system: STAGE2C_SYSTEM_PROMPT,
            messages: [{ role: "user", content: stage2cUserMessage }],
          });

          const stage2cText = stage2cResponse.content[0].text;

          // Graceful degradation per S3 lock: if Stage 2c parse fails, set
          // summary + failure_risks empty and proceed to Stage 3 with empty
          // failure_risks input. Evaluation still produces scores.
          try {
            const stage2cResult = JSON.parse(cleanJsonResponse(stage2cText));
            ev.summary = stage2cResult.summary || "";
            ev.failure_risks = Array.isArray(stage2cResult.failure_risks)
              ? stage2cResult.failure_risks
              : [];
            sendEvent({
              step: "stage2c_done",
              message: "Stage 2c complete: Summary and failure risks generated",
            });
          } catch (parseError) {
            console.error("Stage 2c parse failed (graceful degradation engaged):", stage2cText);
            ev.summary = "";
            ev.failure_risks = [];
            sendEvent({
              step: "stage2c_done",
              message: "Stage 2c synthesis incomplete; proceeding with scores only",
            });
          }

          // ============================
          // STAGE 3: ACT
          // ============================

          sendEvent({ step: "stage3_start", message: "Stage 3: Building..." });

          // Stage 3 reads the evaluation object (now mutated to include TC,
          // summary, and failure_risks from Stage 2c). The Stage 3 prompt expects
          // failure_risks under evaluation.failure_risks — satisfied by the
          // in-place mutation of ev above. _internal is stripped at this point
          // (restored at assembly), so Stage 3 sees clean metric objects.
          const stage3UserMessage = `${userProfile}

USER'S AI PRODUCT IDEA:
${idea}

=== STAGE 1 RESULTS: COMPETITION ANALYSIS ===
${JSON.stringify(stage1Result)}

=== STAGE 2 RESULTS: SCORING ===
${JSON.stringify({ evaluation: ev })}`;

          const stage3Response = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            // V4S28 B8 hotfix (May 1, 2026): bumped from 4096 → 8192. Stage 3
            // generates estimates. Elaborate inputs (~5000 char idea text) consistently
            // produced 5500-6500 tokens of output, hitting the old ceiling and
            // causing mid-string JSON truncation in estimates.explanation.
            max_tokens: 8192,
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
            message: "Stage 3 complete",
          });

          // ============================
          // ASSEMBLY: Combine all stages into unified output
          // Must match the same JSON schema as free tier
          // ============================

          sendEvent({ step: "scoring", message: "Calculating final scores..." });

          ev.overall_score = calculateOverallScore(ev);

          // V4S28 B8 — restore thin_dimensions for frontend rendering
          // (was stripped before Stage 2c/3 to prevent downstream contamination;
          // now safe to attach back since all Sonnet calls are complete).
          if (preservedThinDimensions !== null) {
            ev.evidence_strength.thin_dimensions = preservedThinDimensions;
          }

          // V5.0 — restore _internal per metric for the payload (stripped before
          // Stage 2c/3 to keep their context lean; now safe to reattach since all
          // Sonnet calls are complete). Frontend ignores it; retained for logging,
          // debugging, and the verification runner.
          for (const metricKey of ["market_demand", "monetization", "originality"]) {
            if (preservedInternal[metricKey] && ev[metricKey]) {
              ev[metricKey]._internal = preservedInternal[metricKey];
            }
          }

          // SANITY CHECK REMOVED (V5.0): the old heuristic flagged
          // score/explanation contradictions by keyword-matching the explanation
          // prose against the score band. The V5.0 scorers compute score
          // mechanically from predicate commitments and generate prose AFTER the
          // score is locked, so the score-vs-prose contradiction the heuristic
          // guarded against is structurally prevented. The keyword heuristic would
          // also misfire on the new synthesized .explanation (which concatenates
          // diagnosis + binding-limit + direction). Each scorer's own internal
          // self-check enforces score/prose coherence.

          // Assemble final analysis in the same schema as free tier
          const analysis = {
            classification: stage1Result.classification,
            scope_warning: stage1Result.scope_warning,
            competition: stage1Result.competition,
            estimates: stage3Result.estimates,
            evaluation: ev,
            // Pro-tier exclusive fields
            _pro: {
              evaluation_mode: "paid_chained",
              evaluation_id: evaluationId,
              domain_risk_flags: stage1Result.domain_risk_flags,
              stage1_competitor_count: competitorCount,
              evidence_packets: stage2aResult.evidence_packets,
              // Derived signals from Stage 2a, exposed for the verification runner
              // and downstream visibility. The three metric scorers consume these
              // via their per-packet user messages; this _pro exposure is purely
              // for runner/debugging visibility.
              sparse_input_triggered: stage2aResult.sparse_input_triggered,
              domain_flags: stage2aResult.domain_flags,
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
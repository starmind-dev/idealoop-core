import { NextResponse } from "next/server";
import client from "../../../lib/services/anthropic-client";
import { extractKeywords } from "../../../lib/services/keywords";
import { searchGitHub } from "../../../lib/services/github";
import { searchSerper } from "../../../lib/services/serper";
import { buildCompetitorContext, buildCompetitorInstructions } from "../../../lib/services/competitors";
import { STAGE1_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage1";
import { STAGE2A_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage2a";
import { STAGE2B_ADJ_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage2b-adj";
import { STAGE2B_SCORE_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage2b-score";
import { STAGE2C_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage2c";
import { STAGE_TC_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage-tc";
import { STAGE3_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage3";
import { calculateOverallScore } from "../../../lib/services/scoring";
// V4S32 — Prosecutor + Repair quality-control layer
import { runStage2bQualityControl } from "../../../lib/services/stage2b-qc-orchestrator";
import { logQcEvents } from "../../../lib/services/log-qc-events";

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
function deriveExpectedScoreRange(adjudication) {
  if (!adjudication || typeof adjudication.score_basis !== "string") return null;
  const basis = adjudication.score_basis;

  // cap_floor_X_X → score = X.X exactly
  const capFloorMatch = basis.match(/^cap_floor_(\d+)_(\d+)$/);
  if (capFloorMatch) {
    const val = parseFloat(`${capFloorMatch[1]}.${capFloorMatch[2]}`);
    return { min: val, max: val };
  }

  // cap_range_X_X_Y_Y → X.X ≤ score ≤ Y.Y
  const capRangeMatch = basis.match(/^cap_range_(\d+)_(\d+)_(\d+)_(\d+)$/);
  if (capRangeMatch) {
    const lo = parseFloat(`${capRangeMatch[1]}.${capRangeMatch[2]}`);
    const hi = parseFloat(`${capRangeMatch[3]}.${capRangeMatch[4]}`);
    return { min: lo, max: hi };
  }

  // evidence_band_X_Y and post_override_evidence_band_X_Y → [X.0, Y.5]
  const bandMatch = basis.match(/^(?:post_override_)?evidence_band_(\d+)_(\d+)$/);
  if (bandMatch) {
    const lo = parseFloat(`${bandMatch[1]}.0`);
    const hi = parseFloat(`${bandMatch[2]}.5`);
    // Evidence band ceiling is intentionally Y.5 (e.g. evidence_band_5_6 → [5.0, 6.5])
    // matching V4S29 decimal scoring convention.
    return { min: lo, max: hi };
  }

  return null; // Unrecognized basis — skip clamping
}

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

          // V4S32 — Sonnet caller for the prosecutor + repair layer.
          // Thin wrapper around the existing anthropic-client that exposes
          // the (systemPrompt, userMessage) → rawText shape the QC
          // orchestrator expects. Same sampler config as all other scoring
          // calls (temp 0 / top_k 1 / top_p 0.1) so QC verdicts are as
          // deterministic as the pipeline they audit.
          async function callSonnetForQc(systemPrompt, userMessage) {
            const response = await client.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1024,
              temperature: 0,
              top_k: 1,
              top_p: 0.1,
              system: systemPrompt,
              messages: [{ role: "user", content: userMessage }],
            });
            return response.content[0].text;
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
          // STAGE 2b: SCORE MD/MO/OR (TWO-CALL — V4S31)
          // V4S31 PHYSICAL SEPARATION: adjudication (Call 1) is produced with
          // no downstream score commitment. Scoring + explanation (Call 2)
          // receives Call 1's adjudication as locked input. This closes the
          // override-rationalization disease observed in V4S30 (single-call
          // adjudication where score-anchoring pressure flowed back into
          // resolution selection and override_evidence content).
          //
          // Score from evidence packets ONLY — no raw Stage 1, no TC.
          // Call 2 also receives Call 1's adjudication as fixed structured
          // input, mirroring the Stage 2a → Stage 2b structural-input pattern.
          // ============================

          sendEvent({ step: "stage2b_start", message: "Stage 2b: Adjudicating cap-discipline from evidence..." });

          // CRITICAL: Stage 2b receives idea + evidence packets ONLY.
          // No raw Stage 1 output. No TC data. No user profile (not needed for MD/MO/OR).
          // V4S28 B6 (B4 Change 4 fold-in): profile injection removed — code now
          // matches comment + B5 NarrativeContract V3 §3.9 (Evidence Strength
          // is profile-blind) + V4S9 quarantine principle.

          // ---- Call 1: Adjudication ----
          const stage2bAdjUserMessage = `USER'S AI PRODUCT IDEA:
${idea}

=== EVIDENCE PACKETS FROM STAGE 2a ===
${JSON.stringify(stage2aResult)}`;

          const stage2bAdjResponse = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            temperature: 0,
            // V4S29 Bundle 2 — F1 sampler hardening (see Stage 2a comment for
            // full rationale).
            top_k: 1,
            top_p: 0.1,
            system: STAGE2B_ADJ_SYSTEM_PROMPT,
            messages: [{ role: "user", content: stage2bAdjUserMessage }],
          });

          const stage2bAdjText = stage2bAdjResponse.content[0].text;

          let stage2bAdjResult;
          try {
            stage2bAdjResult = JSON.parse(cleanJsonResponse(stage2bAdjText));
          } catch (parseError) {
            console.error("Stage 2b-Adj parse failed:", stage2bAdjText);
            sendEvent({ step: "error", message: "Stage 2b-Adj failed to parse. Please try again." });
            controller.close();
            return;
          }

          sendEvent({
            step: "stage2b_adj_done",
            message: "Stage 2b-Adj complete: Adjudication produced",
          });

          // ---- Call 2: Scoring + Explanation from locked adjudication ----
          sendEvent({ step: "stage2b_score_start", message: "Stage 2b-Score: Producing scores and explanations from locked adjudication..." });

          const stage2bScoreUserMessage = `USER'S AI PRODUCT IDEA:
${idea}

=== EVIDENCE PACKETS FROM STAGE 2a ===
${JSON.stringify(stage2aResult)}

=== LOCKED ADJUDICATION FROM STAGE 2b-ADJ ===
${JSON.stringify(stage2bAdjResult)}`;

          const stage2bScoreResponse = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            temperature: 0,
            top_k: 1,
            top_p: 0.1,
            system: STAGE2B_SCORE_SYSTEM_PROMPT,
            messages: [{ role: "user", content: stage2bScoreUserMessage }],
          });

          const stage2bScoreText = stage2bScoreResponse.content[0].text;

          let stage2bScoreResult;
          try {
            stage2bScoreResult = JSON.parse(cleanJsonResponse(stage2bScoreText));
          } catch (parseError) {
            console.error("Stage 2b-Score parse failed:", stage2bScoreText);
            sendEvent({ step: "error", message: "Stage 2b-Score failed to parse. Please try again." });
            controller.close();
            return;
          }

          // ---- Merge: combine Call 1's adjudication + evidence_strength with Call 2's scores + explanations ----
          // Final stage2bResult shape mirrors V4S30 monolith output (downstream consumers expect this shape).
          const stage2bResult = {
            evaluation: {
              evidence_strength: stage2bAdjResult.evaluation?.evidence_strength,
              market_demand: {
                ...stage2bScoreResult.evaluation?.market_demand,
                score_adjudication: stage2bAdjResult.evaluation?.market_demand?.score_adjudication,
              },
              monetization: {
                ...stage2bScoreResult.evaluation?.monetization,
                score_adjudication: stage2bAdjResult.evaluation?.monetization?.score_adjudication,
              },
              originality: {
                ...stage2bScoreResult.evaluation?.originality,
                score_adjudication: stage2bAdjResult.evaluation?.originality?.score_adjudication,
              },
              marketplace_note: stage2bScoreResult.evaluation?.marketplace_note ?? null,
            },
          };

          // ---- Code-side score-basis consistency check (clamp with warning) ----
          // For each metric, derive the expected score range from Call 1's
          // score_basis and verify Call 2's score lands in it. Clamp with
          // warning rather than hard-fail to avoid brittleness on borderline
          // drift. Track clamping rate as a verification metric.
          for (const metricKey of ["market_demand", "monetization", "originality"]) {
            const metric = stage2bResult.evaluation[metricKey];
            const adj = metric?.score_adjudication;
            const range = deriveExpectedScoreRange(adj);
            if (range && typeof metric.score === "number") {
              if (metric.score < range.min || metric.score > range.max) {
                const clamped = Math.max(range.min, Math.min(range.max, metric.score));
                console.warn(
                  `[V4S31] Score-basis drift on ${metricKey}: Call 2 emitted ${metric.score}, ` +
                  `Call 1 score_basis="${adj.score_basis}" implies [${range.min}, ${range.max}]. ` +
                  `Clamping to ${clamped}.`
                );
                metric.score = clamped;
              }
            }
          }

          sendEvent({
            step: "stage2b_done",
            message: "Stage 2b complete: Scores calculated",
          });

          // ============================
          // V4S32 — PROSECUTOR + REPAIR QUALITY-CONTROL LAYER
          // Adversarial audit of Stage 2b output. Catches reasoning flaws
          // (INVALID_ANCHOR / OMITTED_LIMITING_FACT / HYPOTHESIS_AS_PROOF /
          // UNGROUNDED_HIGH_SCORE) and runs a constrained repair stage that
          // regenerates score + explanation + score_adjudication for FAIL
          // metrics. Repaired output replaces original in ev only if it
          // re-prosecutes PASS or BORDERLINE; DOUBLE_FAILs keep original and
          // are marked for review.
          //
          // Insertion point: AFTER Stage 2b clamping, BEFORE TC merge.
          // Reason: prosecutor needs both score_adjudication (still on ev here)
          // and packet (from stage2aResult). Running before TC merge keeps ev
          // surface small (just MD/MO/OR) — TC is execution-side, not part of
          // the reasoning chain prosecutor audits.
          //
          // Per locked architecture decisions:
          //   - Sequential before Stage 2c (Stage 2c sees post-repair scores)
          //   - Per-metric parallelization within the layer
          //   - Repair regenerates score_adjudication so downstream sees clean state
          //   - QC failures NEVER block the pipeline (try/catch around the call)
          //
          // Feature-flagged via STAGE2B_QC_MODE = off | log_only | repair
          // (defaults to 'repair' per V4S32 launch decision; no real users yet,
          // shadow run not earning its place in solo-testing context).
          // ============================

          let qcResult;
          try {
            qcResult = await runStage2bQualityControl({
              ev: stage2bResult.evaluation,
              evidencePackets: stage2aResult.evidence_packets,
              callSonnet: callSonnetForQc,
              evaluationId,
              // qcMode omitted — falls back to env STAGE2B_QC_MODE or 'repair'
            });
            // Reassign post-QC ev back onto stage2bResult so downstream code
            // (TC merge, strip blocks, Stage 2c/3 input construction, final
            // assembly) operates on the corrected version.
            stage2bResult.evaluation = qcResult.ev;
          } catch (qcError) {
            // Defensive: orchestrator catches internally per metric, but a
            // catastrophic orchestration error (e.g. import resolution
            // failure, env config issue) should NEVER block the evaluation.
            // Log and continue with the pre-QC ev unchanged.
            console.error("[V4S32] QC layer failed catastrophically:", qcError);
            qcResult = {
              ev: stage2bResult.evaluation,
              qc_events: [],
              quality_control_summary: {
                qc_layer_version: "v1.0",
                qc_mode: "error",
                qc_layer_error: qcError.message || String(qcError),
                checked_metrics: 0,
                repaired_metrics: 0,
                borderline_metrics: 0,
                double_fail_metrics: 0,
                qc_unavailable_metrics: 0,
                total_qc_latency_ms: 0,
                quality_failure: false,
              },
            };
          }

          // Fire-and-forget Supabase logging — never block the response.
          // Skipped metrics are not logged; only PASS / BORDERLINE /
          // FAIL_REPAIRED / DOUBLE_FAIL / QC_UNAVAILABLE produce events.
          if (qcResult.qc_events.length > 0) {
            logQcEvents(qcResult.qc_events).catch((err) => {
              console.error("[V4S32] Failed to log qc_events to Supabase:", err);
            });
          }

          // ============================
          // MERGE TC INTO EVALUATION
          // Stage 2b has MD/MO/OR. Stage TC has TC. Combine them.
          // ============================

          const ev = stage2bResult.evaluation;
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
          // V4S31 — SCORE_ADJUDICATION DOWNSTREAM FILTER (mirrors thin_dimensions B8 pattern)
          // V4S32 EXTENSION — also strip quality_control per metric (same boundary discipline)
          //
          // Extract score_adjudication and quality_control per metric and
          // strip them from ev BEFORE Stage 2c and Stage 3 see them. They
          // receive only { score, explanation, evidence_strength,
          // marketplace_note } — same contract as V4S29.
          //
          // OPTION 2 (V4S31 ship discipline): downstream pass-through of
          // adjudication is deferred to a follow-on session. Stage 2c and
          // Stage 3 prompts are NOT modified in V4S31. Their input contract
          // stays unchanged, so they cannot leak rule_id labels (REGULATED,
          // ENTERPRISE, etc.) or shortcut their own selection procedures
          // based on adjudication content they were not designed to consume.
          //
          // V4S32: quality_control follows the same boundary rule — Stage 2c
          // and Stage 3 never see prosecutor verdicts, flaw categories, or
          // close_call_framing. Those are frontend-only metadata.
          //
          // Both fields are restored to each metric at final assembly time
          // below so the frontend payload includes them (adjudication for
          // future popup feature; quality_control for the V4S32 "Internal
          // Quality Check" UI surfacing).
          // ============================

          const preservedAdjudications = {
            market_demand: null,
            monetization: null,
            originality: null,
          };
          const preservedQualityControl = {
            market_demand: null,
            monetization: null,
            originality: null,
          };
          for (const metricKey of ["market_demand", "monetization", "originality"]) {
            if (ev[metricKey]) {
              if (ev[metricKey].score_adjudication) {
                preservedAdjudications[metricKey] = ev[metricKey].score_adjudication;
                delete ev[metricKey].score_adjudication;
              }
              if (ev[metricKey].quality_control) {
                preservedQualityControl[metricKey] = ev[metricKey].quality_control;
                delete ev[metricKey].quality_control;
              }
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
          //
          // V4S32 NOTE: this computation now uses post-prosecutor scores
          // (FAIL_REPAIRED metrics already replaced before this point). Stage
          // 2c's low-band opener logic sees the corrected overall_score, not
          // the pre-repair inflated one — which is exactly what we want.
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

          // Stage 3 reads stage2bResult (now mutated to include TC, summary,
          // and failure_risks from Stage 2c). The Stage 3 prompt expects
          // failure_risks to be present in the Stage 2 results — this is
          // satisfied by the in-place mutation above.
          const stage3UserMessage = `${userProfile}

USER'S AI PRODUCT IDEA:
${idea}

=== STAGE 1 RESULTS: COMPETITION ANALYSIS ===
${JSON.stringify(stage1Result)}

=== STAGE 2 RESULTS: SCORING ===
${JSON.stringify(stage2bResult)}`;

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

          // V4S31 — restore score_adjudication per metric for frontend payload
          // (stripped before Stage 2c/3 per Option 2 to prevent downstream
          // contamination; now safe to attach back since all Sonnet calls are
          // complete). Frontend currently ignores this field; reserved for
          // future popup feature exposing the structural adjudication chain.
          //
          // V4S32 — also restore quality_control per metric (same pattern).
          // Frontend uses these for the "Internal Quality Check" surfacing
          // (close_call_framing on BORDERLINE, "verified" badge on PASS,
          // optional "metric repaired" indicator on FAIL_REPAIRED). Stripped
          // before Stage 2c/3 since they are post-scoring metadata, not
          // inputs to downstream reasoning.
          for (const metricKey of ["market_demand", "monetization", "originality"]) {
            if (preservedAdjudications[metricKey] && ev[metricKey]) {
              ev[metricKey].score_adjudication = preservedAdjudications[metricKey];
            }
            if (preservedQualityControl[metricKey] && ev[metricKey]) {
              ev[metricKey].quality_control = preservedQualityControl[metricKey];
            }
          }

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
            estimates: stage3Result.estimates,
            evaluation: ev,
            // V4S32 — payload-level QC summary (aggregate over MD/MO/OR).
            // Includes quality_failure boolean (true when 2+ metrics double-failed
            // per locked decision) that the frontend can use to trigger credit
            // return or manual review surfacing.
            quality_control_summary: qcResult.quality_control_summary,
            // Pro-tier exclusive fields
            _pro: {
              evaluation_mode: "paid_chained",
              evaluation_id: evaluationId,
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
// ============================================================================
// src/app/api/execution-brief/route.js — Execution Brief streaming route
// ============================================================================
//
// One Sonnet call over the SETTLED diagnosis, streamed to the founder section by
// section. No search, no chaining, no re-scoring. The route:
//   1. authenticates,
//   2. guards (refuses Specification / degraded-synthesis cases — defense in
//      depth behind the frontend's trigger suppression),
//   3. curates the diagnosis into the brief's Block 1 input contract (the
//      forward-only slice: prose + binding-constraint shape + archetype names +
//      estimates fields; NO numeric scores, NO full _internal),
//   4. opens a streaming Sonnet call,
//   5. parses the six fixed-order <<SEC:id>> ... <</SEC:id>> blocks as each one
//      CLOSES, emitting an SSE `section` event per block,
//   6. decrements credit exactly once, at the first section (the commit point),
//   7. persists the assembled brief to evaluations.execution_brief_json on
//      complete (for saved ideas), and rides it back on the `complete` event.
//
// INPUT (POST body): { analysis, evaluation_id?, idea_id?, profile?, devMode? }
//   `analysis` is the LIVE-shaped analysis object (analysis.evaluation.*,
//   analysis.estimates.*) WITH _internal present on each metric. This shape is
//   identical whether the brief is triggered live (fresh from the pipeline) or
//   from a saved idea (the /api/ideas/[id] GET route already rehydrates _internal
//   whole), so the route has ONE input contract and never reads the DB for the
//   evaluation. evaluation_id, when present, is the persist target.
//
// OUTPUT (SSE, text/event-stream): newline-delimited `data: {json}\n\n` events,
//   each keyed on `step`, matching the frontend's existing analyzeWithStream
//   consumer:
//     { step: "start" }
//     { step: "section", id, data }          // one per block, in fixed order
//     { step: "retry", attempt }             // only before the first section
//     { step: "error", message }
//     { step: "complete", brief }            // the assembled six-block object
//
// Output schema is canonical in prompt-execution-brief.js, Block 5. This route's
// parser and the frontend render components read field names / nullability from
// there — do not re-derive them.
// ============================================================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
// Adjust this path to wherever the prompt module lives in the tree
// (the stage prompts sit alongside it).
import { EXECUTION_BRIEF_SYSTEM_PROMPT } from "@/lib/services/prompt-execution-brief";
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ---- Anthropic call config -------------------------------------------------
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-20250514"; // same Sonnet the pipeline uses
const MAX_TOKENS = 4096; // six short JSON blocks of prose — ample
// Lower than the evaluation pipeline on purpose: the locked "variance is a
// feature" position is about SCORE variance, not FORMAT variance. This is a
// sentinel-strict, fixed-order structured call — content variance (the bet
// finding its own angle) survives fine at 0.5, while format adherence improves.
// The fixture pass should confirm the fences hold at this setting.
const TEMPERATURE = 0.5;

// Abort the upstream stream if it stalls. INACTIVITY = max gap between deltas
// (catches a mid-stream stall, which a fixed overall ceiling can miss on a
// slow-but-progressing stream); OVERALL = hard ceiling for the whole call. A
// stall would otherwise hang forever — the reader loop never throws on silence,
// so retry/error never fires. An abort throws, which the existing path handles.
const STREAM_INACTIVITY_MS = 30000;
const STREAM_OVERALL_MS = 90000;

// The six blocks, in the fixed order the prompt emits and the parser expects.
const BLOCK_ORDER = ["bet", "prove_next", "order", "wont_count", "gates", "handoff"];

// Retry only ever applies to opening/streaming BEFORE the first section emits.
// Once a section is forwarded, there is no whole-call retry (it would duplicate
// already-streamed content) — that is exactly why firstSectionEmitted is the
// boundary, and why it is also the credit-decrement moment.
const MAX_STREAM_OPEN_RETRIES = 2;

// ---- auth (same pattern as the other ideas routes) -------------------------
async function authenticate(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ---- credit hooks (STUBBED — no ledger in code yet) ------------------------
// These are the two seams the M5/Paddle work wires into. Until then they are
// no-ops so the feature is fully functional in dev. Keep the contract:
//   - assertCreditsOrThrow: cheap pre-check BEFORE streaming. Throw to refuse.
//   - commitBriefCredit: the actual decrement, fired ONCE at the first section
//     (the commit point). Real impl decides the failure policy; the stub never
//     blocks the stream.
async function assertCreditsOrThrow(/* user, { devMode } */) {
  // TODO(M5): check the user's brief/credit balance; throw a 402-style error to
  // refuse before any streaming or billing happens.
  return true;
}
async function commitBriefCredit(/* user, { devMode } */) {
  // TODO(M5): decrement one credit, server-side, idempotent per brief request.
  // No ledger yet → no-op. Must not throw for the stub (would abort a free brief).
  return true;
}

// ---- diagnosis curation: build the brief's Block 1 input contract ----------
// Forward-only slice. Deliberately omits: numeric scores (the brief is
// bottleneck-relative, never score-relative), the full scorer _internal blocks
// (only the curated binding-constraint shape goes through), and the raw idea
// text (the diagnosis prose already carries the case; sending raw text invites
// re-evaluation). Every field is optional-chained: a degraded synthesis may be
// missing pieces, and the prompt is built to work from what is present.
function buildBriefDiagnosis(analysis) {
  const e = analysis?.evaluation || {};
  const est = analysis?.estimates || {};
  const md = e.market_demand || {};
  const mo = e.monetization || {};
  const or = e.originality || {};
  const tc = e.technical_complexity || {};

  return {
    // anchor + wall reasoning
    main_bottleneck: est.main_bottleneck ?? null,
    main_bottleneck_explanation: est.main_bottleneck_explanation ?? est.constraint_diagnosis ?? null,
    constraint_diagnosis: est.constraint_diagnosis ?? null,
    commitment_explanation: est.commitment_explanation ?? null,
    profile_calibration: est.profile_calibration ?? null,

    // commitment-shape facts (read-only context; the brief never re-times them)
    position_basis: est.position_basis ?? null,
    duration: est.duration ?? null,
    difficulty: est.difficulty ?? null,

    // close-call material (bends the order's first step when is_close_call)
    mb_ambiguity: est.mb_ambiguity ?? null,

    // named idea-threats: founder_fit archetype routes the resource clause;
    // the full set is the boundary for what_won't_count
    failure_risks: e.failure_risks ?? [],

    // per-metric: prose (already translated) + curated binding-constraint SHAPE
    // (reasoning substrate for prove_next's bar) + archetype NAME. NO scores.
    market_demand: {
      diagnosis: md.diagnosis ?? null,
      binding_friction_explanation: md.binding_friction_explanation ?? null,
      direction: md.direction ?? null,
      binding_friction: md._internal?.binding_friction ?? null,
      archetype: md._internal?.demand_archetype ?? null,
    },
    monetization: {
      diagnosis: mo.diagnosis ?? null,
      binding_payment_constraint_explanation: mo.binding_payment_constraint_explanation ?? null,
      direction: mo.direction ?? null,
      binding_payment_constraint: mo._internal?.binding_payment_constraint ?? null,
      archetype: mo._internal?.monetization_archetype ?? null,
    },
    originality: {
      differentiation_basis_diagnosis: or.differentiation_basis_diagnosis ?? null,
      defensibility_diagnosis: or.defensibility_diagnosis ?? null,
      binding_constraint_explanation: or.binding_constraint_explanation ?? null,
      direction: or.direction ?? null,
      binding_constraint: or._internal?.binding_constraint ?? null,
      archetype: or._internal?.originality_archetype ?? null,
    },

    // simpler-build starting point (honored when the wall is Technical build)
    technical_complexity: {
      incremental_note: tc.incremental_note ?? null,
    },

    // whole-case orientation (the bet stays consistent with it; never re-summarized)
    summary: e.summary ?? null,
    evidence_strength: e.evidence_strength ?? null,

    // case context, referenceable only when the wall is of that class
    classification: analysis?.classification ?? null,
    competition: analysis?.competition
      ? {
          differentiation: analysis.competition.differentiation ?? null,
          competitor_count: Array.isArray(analysis.competition.competitors)
            ? analysis.competition.competitors.length
            : null,
        }
      : null,
    // _pro.domain_flags is present on the live path, absent on reload (not
    // persisted) — context only, the prompt handles its absence gracefully.
    domain_flags: analysis?._pro?.domain_flags ?? null,
  };
}

// ---- sentinel parser -------------------------------------------------------
// Drains every block that is now COMPLETE in `buffer`, in fixed order, calling
// onBlock(id, parsedJson) for each. Never parses a partial block: a block is
// extracted only once its closing sentinel has arrived. A complete-but-invalid
// block throws (the caller decides retry-vs-error based on firstSectionEmitted).
// state = { cursor, nextIdx } and is mutated as blocks are consumed.
async function drainBlocks(buffer, state, onBlock) {
  while (state.nextIdx < BLOCK_ORDER.length) {
    const id = BLOCK_ORDER[state.nextIdx];
    const open = `<<SEC:${id}>>`;
    const close = `<</SEC:${id}>>`;

    const openPos = buffer.indexOf(open, state.cursor);
    if (openPos === -1) break; // opening sentinel not here yet

    const contentStart = openPos + open.length;
    const closePos = buffer.indexOf(close, contentStart);
    if (closePos === -1) break; // block not finished streaming yet

    const raw = buffer.slice(contentStart, closePos).trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Failed to parse section "${id}": ${err.message}`);
    }

    await onBlock(id, parsed);
    state.cursor = closePos + close.length;
    state.nextIdx++;
  }
}

// ---- POST ------------------------------------------------------------------
export async function POST(request) {
  // auth
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { analysis, evaluation_id: evaluationId, devMode } = body || {};
  if (!analysis || !analysis.evaluation) {
    return NextResponse.json({ error: "Missing analysis." }, { status: 400 });
  }

  // guard: the brief does not exist for under-specified or degraded cases.
  // Mirrors the frontend trigger suppression; prevents billing a brief that
  // shouldn't be produced. (The prompt also degrades gracefully, but we refuse
  // here so no credit is spent.)
  const mb = analysis?.estimates?.main_bottleneck;
  const degraded = analysis?.evaluation?.synthesis_degraded === true;
  if (mb === "Specification" || degraded) {
    return NextResponse.json(
      {
        error: "Execution Brief is unavailable for under-specified or degraded analyses.",
        reason: mb === "Specification" ? "specification" : "synthesis_degraded",
      },
      { status: 422 }
    );
  }

  // cheap credit pre-check (stub) before any streaming/billing
  try {
    await assertCreditsOrThrow(user, { devMode: !!devMode });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Insufficient credits.", reason: "no_credits" },
      { status: 402 }
    );
  }

  const diagnosis = buildBriefDiagnosis(analysis);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // shared across attempts: once a section is forwarded, no retry, and the
      // credit is committed. assembled accumulates the six blocks.
      let firstSectionEmitted = false;
      const assembled = {};
      let closed = false;

      const send = (obj) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      // forward one parsed block; commit credit on the first one
      const handleBlock = async (id, parsed) => {
        if (!firstSectionEmitted) {
          // decrement BEFORE forwarding the first section (the commit point).
          // Stub never throws; real impl's failure policy lives in the hook.
          try {
            await commitBriefCredit(user, { devMode: !!devMode });
          } catch (err) {
            console.error("Brief credit commit failed:", err?.message);
          }
          firstSectionEmitted = true;
        }
        assembled[id] = parsed;
        send({ step: "section", id, data: parsed });
      };

      // one full upstream attempt; resets its own buffer/cursor so a retry
      // (only possible while firstSectionEmitted is false) starts clean.
      const runUpstreamOnce = async () => {
        const state = { cursor: 0, nextIdx: 0 };
        let buffer = "";

        // Abort on stall: an overall ceiling AND an inactivity timer reset on
        // each read. Without this a silent upstream stall hangs forever, because
        // reader.read() never resolves and never throws on silence.
        const controllerAbort = new AbortController();
        let stalled = false;
        const overall = setTimeout(() => {
          stalled = true;
          controllerAbort.abort();
        }, STREAM_OVERALL_MS);
        let inactivity = setTimeout(() => {
          stalled = true;
          controllerAbort.abort();
        }, STREAM_INACTIVITY_MS);
        const bumpInactivity = () => {
          clearTimeout(inactivity);
          inactivity = setTimeout(() => {
            stalled = true;
            controllerAbort.abort();
          }, STREAM_INACTIVITY_MS);
        };
        const clearTimers = () => {
          clearTimeout(overall);
          clearTimeout(inactivity);
        };

        let res;
        try {
          res = await fetch(ANTHROPIC_URL, {
            method: "POST",
            signal: controllerAbort.signal,
            headers: {
              "content-type": "application/json",
              "x-api-key": process.env.ANTHROPIC_API_KEY,
              "anthropic-version": ANTHROPIC_VERSION,
            },
            body: JSON.stringify({
              model: MODEL,
              max_tokens: MAX_TOKENS,
              temperature: TEMPERATURE,
              system: EXECUTION_BRIEF_SYSTEM_PROMPT,
              stream: true,
              messages: [{ role: "user", content: JSON.stringify(diagnosis) }],
            }),
          });
        } catch (err) {
          clearTimers();
          if (stalled) throw new Error("Upstream timed out before responding.");
          throw err;
        }

        if (!res.ok || !res.body) {
          clearTimers();
          const detail = await res.text().catch(() => "");
          throw new Error(`Upstream ${res.status}: ${detail.slice(0, 200)}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sse = "";

        try {
          while (true) {
            let chunk;
            try {
              chunk = await reader.read();
            } catch (err) {
              if (stalled) throw new Error("Upstream stream stalled — aborted.");
              throw err;
            }
            const { done, value } = chunk;
            if (done) break;
            bumpInactivity(); // progress — reset the stall timer

            sse += decoder.decode(value, { stream: true });
            const lines = sse.split("\n");
            sse = lines.pop() || ""; // keep the incomplete trailing line

            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;

              let evt;
              try {
                evt = JSON.parse(payload);
              } catch {
                continue; // ignore non-JSON keepalives
              }

              if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                buffer += evt.delta.text;
                await drainBlocks(buffer, state, handleBlock);
              } else if (evt.type === "error") {
                throw new Error(evt.error?.message || "Upstream stream error.");
              }
              // message_stop / other events: handled by the loop ending
            }
          }
        } finally {
          clearTimers();
        }

        // stream ended — drain any final complete block(s)
        await drainBlocks(buffer, state, handleBlock);

        if (state.nextIdx < BLOCK_ORDER.length) {
          throw new Error(
            `Incomplete brief: ${state.nextIdx}/${BLOCK_ORDER.length} sections emitted.`
          );
        }
      };

      try {
        send({ step: "start" });

        // retry loop — only retries while NO section has been forwarded
        let attempt = 0;
        while (true) {
          try {
            await runUpstreamOnce();
            break; // completed all six blocks
          } catch (err) {
            if (firstSectionEmitted) {
              // past the commit point — a mid/late failure is surfaced, not retried
              send({ step: "error", message: err?.message || "Brief generation failed." });
              closed = true;
              controller.close();
              return;
            }
            attempt += 1;
            if (attempt > MAX_STREAM_OPEN_RETRIES) {
              send({ step: "error", message: err?.message || "Could not start the brief." });
              closed = true;
              controller.close();
              return;
            }
            send({ step: "retry", attempt });
            // loop: open a fresh upstream attempt
          }
        }

        // persist the assembled brief for a saved idea (best-effort; awaited so
        // it runs before the serverless function can freeze on stream close).
        // Unsaved ideas carry the brief back on `complete` and persist on save.
        const brief = { ...assembled };
        if (evaluationId) {
          const { error: persistError } = await supabaseAdmin
            .from("evaluations")
            .update({ execution_brief_json: brief })
            .eq("id", evaluationId)
            .eq("user_id", user.id);
          if (persistError) {
            console.error("Brief persist failed:", persistError.message);
          }
        }

        send({ step: "complete", brief });
        closed = true;
        controller.close();
      } catch (err) {
        // last-resort guard — should be unreachable (inner handlers close out)
        if (!closed) {
          send({ step: "error", message: err?.message || "Something went wrong." });
          closed = true;
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

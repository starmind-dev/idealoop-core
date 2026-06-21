// src/app/api/ideas/[id]/re-evaluate-walkthrough/route.js
//
// THE NARRATE HALF — one Sonnet pass after a re-eval, turning the computed diff
// into the plain-English explanations the "!" markers open.
//
// FLOW: code first (changeDiff decides the marker set + the proven shape per
// anchor), model second (Sonnet narrates ONLY the lit paths). The number is
// fixed and the markers are deterministic before Sonnet is ever called; if
// Sonnet fails, the markers + their structural bundles still stand and only the
// prose is absent — the popup degrades to its diagram + the lock-line. Non-fatal
// by construction: a missing walkthrough never breaks the result screen.
//
// STATELESS, body-driven — same shape as the Explore route (streams/returns, no
// persistence, no DB read). The re-eval flow holds BOTH analyses client-side at
// result time (the V4 just produced + the full prior V_prev kept in the re-eval
// snapshot), so they arrive in the POST body. changeDiff.toEvalView normalizes a
// live `analysis` or a stored eval row, so either side may be either shape.
// Persistence is a save-time concern: when the evolved version is saved, the
// returned walkthroughs ride along in the save payload (the Execution-Brief
// pattern) — this route generates, it does not store.
//
// DEPENDENCY (Stage 3 plumbing): page.js must send the FULL prior analysis as
// prevAnalysis (the current re-eval snapshot keeps scores only — too thin for the
// evidence/prose slices). Until it does, by-path / evidence-only degrade to
// read-only (changeDiff's honest fallback) and prose slices come back sparse.
//
// Sonnet (claude-sonnet-4-6), temp 0. Engine byte-locked — this reads results,
// scores nothing.

import { NextResponse } from "next/server";
import client from "../../../../../lib/services/anthropic-client";
import { REEVAL_WALKTHROUGH_SYSTEM_PROMPT } from "../../../../../lib/services/prompt-reeval-walkthrough";
import { diff } from "../../../../../lib/services/changeDiff";

const WALKTHROUGH_MODEL = "claude-sonnet-4-6";

// Same JSON cleaner as the Deep / Explore routes: slice first { to last } so
// bare / fenced / preamble-wrapped JSON all parse; non-JSON returns trimmed so
// JSON.parse fails with the same shape it always did.
function cleanJsonResponse(text) {
  if (!text || typeof text !== "string") return text;
  const trimmed = text.trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return trimmed;
  return trimmed.slice(first, last + 1);
}

const pick = (obj, path) =>
  obj == null ? undefined : String(path).split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

// Pull the small prose slices the narrator reads for a given anchor, from the
// normalized eval view. Per-metric prose lives on the raw eval (`_ev`); verdict,
// competition, and estimates are normalized top-level. Only short, already-1-2-
// sentence fields — the substance the model grounds on. Raw internal labels are
// deliberately NOT passed (leak-proof; the prompt forbids naming them anyway).
function proseFor(key, view) {
  const ev = view._ev || {};
  const out = {};
  const add = (label, val) => { if (typeof val === "string" && val.trim()) out[label] = val.trim(); };
  switch (key) {
    case "market_demand":
      add("diagnosis", pick(ev, "market_demand.diagnosis"));
      add("binding_friction", pick(ev, "market_demand.binding_friction_explanation"));
      add("direction", pick(ev, "market_demand.direction"));
      break;
    case "monetization":
      add("diagnosis", pick(ev, "monetization.diagnosis"));
      add("direction", pick(ev, "monetization.direction"));
      break;
    case "originality":
      add("differentiation", pick(ev, "originality.differentiation_basis_diagnosis"));
      add("defensibility", pick(ev, "originality.defensibility_diagnosis"));
      add("direction", pick(ev, "originality.direction"));
      break;
    case "technical_complexity":
      add("difficulty_basis", pick(ev, "technical_complexity.base_score_explanation"));
      break;
    case "verdict":
      add("headline", view.verdict && view.verdict.verdict_headline);
      add("lead", view.verdict && view.verdict.verdict_lead);
      add("summary", view.verdict && view.verdict.summary);
      break;
    case "compare":
      add("headline", pick(view.competitive_position, "headline"));
      add("you_win", pick(view.competitive_position, "you_win"));
      add("overlap", pick(view.competitive_position, "overlap"));
      add("exposed", pick(view.competitive_position, "exposed"));
      break;
    case "mb":
      add("binding_constraint", pick(view.estimates, "main_bottleneck"));
      add("constraint_diagnosis", pick(view.estimates, "constraint_diagnosis"));
      break;
    case "commitment":
      add("duration", pick(view.estimates, "duration"));
      add("difficulty", pick(view.estimates, "difficulty"));
      break;
    default:
      break; // overall (arithmetic) + risks (carry their own before/after) need no extra prose
  }
  return out;
}

// Shape the per-anchor object the narrator consumes. Structural facts (shape,
// paths, deltas) from the computed bundle; prose slices from both views; evidence
// reduced to bare counts (never urls — no source leaks to the model).
function buildAnchorInput(bundle, prev, next) {
  const a = {
    key: bundle.anchor,
    label: bundle.label,
    kind: bundle.kind,
    shape: bundle.shape,
    paths: bundle.paths || null,
    changed_parts: bundle.changedParts || [],
  };
  if (bundle.kind === "numeric") { a.from = bundle.from; a.to = bundle.to; }
  if (bundle.kind === "arithmetic") { a.from = bundle.from; a.to = bundle.to; a.contributions = bundle.contributions; }
  if (bundle.kind === "qualitative") {
    if (bundle.before !== undefined) a.before = bundle.before;
    if (bundle.after !== undefined) a.after = bundle.after;
    if (bundle.changedSlots) a.changed_slots = bundle.changedSlots.map((s) => ({ slot: s.slot, before: s.before, after: s.after }));
  }
  if (bundle.evidence) {
    a.evidence = {
      added: Array.isArray(bundle.evidence.added) ? bundle.evidence.added.length : 0,
      removed: Array.isArray(bundle.evidence.removed) ? bundle.evidence.removed.length : 0,
    };
  }
  a.prose = { prev: proseFor(bundle.anchor, prev), next: proseFor(bundle.anchor, next) };
  return a;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { prevAnalysis, nextAnalysis, changedFields = [] } = body || {};

    if (!prevAnalysis || !nextAnalysis) {
      return NextResponse.json(
        { ok: false, error: "prevAnalysis and nextAnalysis are required", markers: [], anchors: {}, walkthroughs: {} },
        { status: 400 }
      );
    }

    // 1) CODE computes the diff — the marker set + the proven shape per anchor.
    const d = diff(prevAnalysis, nextAnalysis, { changedFields });
    if (!d.meta.ok) {
      return NextResponse.json({ ok: false, reason: d.meta.reason, markers: [], anchors: {}, walkthroughs: {} });
    }

    // Nothing visible moved — a clean re-run with no marker. Return empty, fast.
    if (!d.meta.markers.length) {
      return NextResponse.json({ ok: true, markers: [], anchors: {}, walkthroughs: {} });
    }

    // 2) Attach the prose/evidence slices the narrator needs for each lit anchor.
    const modelAnchors = d.meta.markers.map((key) => buildAnchorInput(d.anchors[key], d.prev, d.next));

    // 3) ONE Sonnet pass — narrates ONLY the lit paths; cannot invent a cause the
    //    diff didn't light. NON-FATAL: failure leaves the bundles intact, prose null.
    let walkthroughs = {};
    try {
      const resp = await client.messages.create({
        model: WALKTHROUGH_MODEL,
        max_tokens: 4000,
        temperature: 0,
        system: REEVAL_WALKTHROUGH_SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify({ anchors: modelAnchors }) }],
      });
      const text = resp && resp.content && resp.content[0] && resp.content[0].text;
      const parsed = JSON.parse(cleanJsonResponse(text));
      if (parsed && parsed.walkthroughs && typeof parsed.walkthroughs === "object") {
        walkthroughs = parsed.walkthroughs;
      }
    } catch (err) {
      console.error("re-eval walkthrough generation failed (non-fatal):", err && err.message ? err.message : err);
      walkthroughs = {};
    }

    // 4) Merge narration onto the code-computed bundles. The frontend renders the
    //    diagram / chips / paths from the bundle; narration is the only generative
    //    field, and it degrades to null cleanly when Sonnet didn't produce it.
    const anchors = {};
    for (const key of d.meta.markers) {
      const n = walkthroughs[key];
      anchors[key] = { ...d.anchors[key], narration: typeof n === "string" && n.trim() ? n.trim() : null };
    }

    return NextResponse.json({
      ok: true,
      markers: d.meta.markers,
      anchors,
      meta: { evidenceUnknown: d.meta.evidenceUnknown, changedParts: d.meta.changedParts, inputAny: d.meta.inputAny },
    });
  } catch (err) {
    console.error("re-evaluate-walkthrough route error:", err && err.message ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "walkthrough failed", markers: [], anchors: {}, walkthroughs: {} },
      { status: 500 }
    );
  }
}
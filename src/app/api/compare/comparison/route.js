// src/app/api/compare/comparison/route.js   (NEW — replaces /api/compare/tradeoffs at cutover)
//
// One Sonnet call. Receives two full Deep analyses + the founder profile, flattens
// each to the comparison prompt's per-section contract, calls COMPARISON_SYSTEM_PROMPT,
// returns { comparison: { sections, closure } }.
//
// WHY THE FLATTEN LIVES HERE (not the frontend): the prompt needs the committed
// archetype / mechanism / exposure enums (the upstream of what the user saw), which
// live in evaluation[metric]._internal — engine machinery the frontend should never
// reach into. The flatten lifts exactly those fields into clean per-section names, on
// the backend, in one place. It is a WHITELIST: only the fields the prompt reads are
// passed, so UI-only metadata (thin_dimensions, _pro, _meta, raw _internal) never
// crosses the LLM boundary by construction — no separate sanitize pass needed.
//
// Graceful degrade (non-fatal): on parse/shape failure the route returns
// { comparison: null } with 200, and the compare view renders the plain side-by-side
// with no connectors. Same degrade discipline as the Deep pipeline's Stage 2c.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { COMPARISON_SYSTEM_PROMPT } from "../../prompts/prompt-comparison";
import { logActivity } from "@/lib/services/activity";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SECTION_KEYS = [
  "market_demand",
  "monetization",
  "originality",
  "technical_complexity",
  "competition",
  "risks",
  "execution_reality",
];

// ── FLATTEN — one analysis → the prompt's per-section compare-idea contract ──────
// Whitelist: only fields the prompt reads. Lifts the committed _internal enums
// (demand_archetype, monetization_archetype, primary_exposure, the payment
// mechanism) into clean names. Everything degrades to null — a sparse or older
// analysis yields a thinner idea object, never a throw.
function buildCompareIdea(title, analysis) {
  const ev = (analysis && analysis.evaluation) || {};
  const md = ev.market_demand || {};
  const mo = ev.monetization || {};
  const or = ev.originality || {};
  const tc = ev.technical_complexity || {};
  const est = (analysis && analysis.estimates) || {};
  const mdInt = md._internal || {};
  const moInt = mo._internal || {};
  const orInt = or._internal || {};

  return {
    title: title || "Untitled",
    verdict_headline: ev.verdict_headline ?? null,
    verdict_lead: ev.verdict_lead ?? null,
    overall_score: ev.overall_score ?? null,

    market_demand: {
      score: md.score ?? null,
      diagnosis: md.diagnosis ?? null,
      binding_friction_explanation: md.binding_friction_explanation ?? null,
      direction: md.direction ?? null,
      demand_archetype: mdInt.demand_archetype ?? null,
    },
    monetization: {
      score: mo.score ?? null,
      display_score: mo.display_score ?? mo.score ?? null,
      diagnosis: mo.diagnosis ?? null,
      binding_payment_constraint_explanation:
        mo.binding_payment_constraint_explanation ?? null,
      direction: mo.direction ?? null,
      monetization_archetype: moInt.monetization_archetype ?? null,
      binding_payment_constraint:
        (moInt.binding_payment_constraint &&
          moInt.binding_payment_constraint.primary_mechanism) ?? null,
    },
    originality: {
      score: or.score ?? null,
      differentiation_basis_diagnosis: or.differentiation_basis_diagnosis ?? null,
      defensibility_diagnosis: or.defensibility_diagnosis ?? null,
      binding_constraint_explanation: or.binding_constraint_explanation ?? null,
      direction: or.direction ?? null,
      primary_exposure:
        (orInt.binding_constraint && orInt.binding_constraint.primary_subtype) ??
        null,
    },
    technical_complexity: {
      score: tc.score ?? null,
      base_score: tc.base_score ?? null,
      adjustment_value: tc.adjustment_value ?? null,
      base_score_explanation: tc.base_score_explanation ?? null,
      adjustment_explanation: tc.adjustment_explanation ?? null,
      incremental_note: tc.incremental_note ?? null,
    },

    // competitive_position is the section's real content; the competitor names are
    // light context. competition may be null (open field) — passed through as null.
    competition: ev.competitive_position ?? null,
    competitors: (((analysis && analysis.competition) || {}).competitors || [])
      .map((c) => c && c.name)
      .filter(Boolean),

    // founder_fit risk is present ONLY when it fires — its presence/absence per idea
    // is the founder-asymmetry signal. Drop the internal archetype letter.
    failure_risks: (ev.failure_risks || [])
      .filter((r) => r && r.slot && r.text)
      .map((r) => ({ slot: r.slot, text: r.text })),

    execution_reality: {
      main_bottleneck: est.main_bottleneck ?? null,
      mb_ambiguity: est.mb_ambiguity ?? null,
      duration: est.duration ?? null,
      difficulty: est.difficulty ?? null,
      constraint_diagnosis: est.constraint_diagnosis ?? null,
      commitment_explanation: est.commitment_explanation ?? null,
      profile_calibration: est.profile_calibration ?? null,
      position_basis: est.position_basis ?? null,
    },
  };
}

// Shape guard: a usable comparison has a sections object with all seven keys and a
// closure object. Anything else → degrade to the plain side-by-side.
function isValidComparison(r) {
  if (!r || typeof r !== "object") return false;
  if (!r.sections || typeof r.sections !== "object") return false;
  if (!r.closure || typeof r.closure !== "object") return false;
  return SECTION_KEYS.every((k) => r.sections[k] && typeof r.sections[k] === "object");
}

export async function POST(request) {
  try {
    // Auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const a = body?.idea_a;
    const b = body?.idea_b;
    if (!a || !a.analysis || !b || !b.analysis) {
      return NextResponse.json(
        { error: "Missing comparison data (need idea_a.analysis and idea_b.analysis)" },
        { status: 400 }
      );
    }

    const compareInput = {
      idea_a: buildCompareIdea(a.title, a.analysis),
      idea_b: buildCompareIdea(b.title, b.analysis),
      profile: body?.profile ?? null,
    };

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      temperature: 0,
      system: COMPARISON_SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(compareInput) }],
    });

    const rawText =
      response.content?.[0]?.text || response.content?.[0]?.value || "";

    let parsed;
    try {
      const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      // Non-fatal: degrade to the plain side-by-side.
      console.error("Comparison JSON parse error:", parseError);
      console.error("Raw response:", rawText);
      return NextResponse.json({ comparison: null });
    }

    if (!isValidComparison(parsed)) {
      console.error("Comparison shape invalid:", JSON.stringify(parsed)?.slice(0, 500));
      return NextResponse.json({ comparison: null });
    }

    // Ledger: a real comparison ran. idea_id stays null (a compare spans two
    // ideas); both titles ride in summary + meta. Compares aren't persisted
    // anywhere else, so this is the only record they ever leave.
    const titleA = a.title || "Idea A";
    const titleB = b.title || "Idea B";
    await logActivity(user.id, {
      kind: "compared", idea_id: null,
      summary: `Compared ${titleA} vs ${titleB}.`,
      meta: { a: titleA, b: titleB },
    });

    return NextResponse.json({ comparison: parsed });
  } catch (err) {
    console.error("Comparison API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
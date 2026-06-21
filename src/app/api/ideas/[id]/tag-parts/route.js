// src/app/api/ideas/[id]/tag-parts/route.js
//
// THE COLOUR PASS (route half) — one Haiku call at Evolve-open that returns the
// load-bearing clauses of the idea, each tagged to a part, so the Evolve canvas
// loads pre-coloured. Display-layer: engine byte-locked, no DB write, no score.
//
// FLOW: model proposes verbatim spans → CODE validates each is an exact, unique
// substring of the idea → only survivors are returned. A hallucinated or
// paraphrased quote is dropped here and never reaches the canvas (the founder can
// tag it himself). Under-tag, never mis-tag.
//
// NON-FATAL BY CONSTRUCTION: any failure (bad JSON, model error, thrown) returns
// { ok:false, tags:[] } with 200 — the client falls back to the plain idea text
// and the screen never blocks on this.
//
// Haiku (claude-haiku-4-5-20251001), temp 0.

import { NextResponse } from "next/server";
import client from "../../../../../lib/services/anthropic-client";
import { TAG_PARTS_SYSTEM_PROMPT } from "../../../../../lib/services/prompt-tag-parts";

const TAG_MODEL = "claude-haiku-4-5-20251001";
const PARTS = ["target", "problem", "mechanism", "money", "moat", "scope"];

// Same JSON cleaner as the Deep / Explore / walkthrough routes: slice first { to
// last } so bare / fenced / preamble-wrapped JSON all parse.
function cleanJsonResponse(text) {
  if (!text || typeof text !== "string") return text;
  const trimmed = text.trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return trimmed;
  return trimmed.slice(first, last + 1);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const ideaText = typeof body?.ideaText === "string" ? body.ideaText.trim() : "";
    const anatomy = body?.anatomy && typeof body.anatomy === "object" ? body.anatomy : {};

    if (!ideaText) return NextResponse.json({ ok: false, tags: [], reason: "no idea text" });

    let tags = [];
    try {
      const resp = await client.messages.create({
        model: TAG_MODEL,
        max_tokens: 1200,
        temperature: 0,
        system: TAG_PARTS_SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify({ idea: ideaText, anatomy }) }],
      });
      const text = resp && resp.content && resp.content[0] && resp.content[0].text;
      const parsed = JSON.parse(cleanJsonResponse(text));
      const raw = Array.isArray(parsed && parsed.tags) ? parsed.tags : [];

      // CODE validation — known part, verbatim, present EXACTLY ONCE, one per part.
      const seen = new Set();
      for (const t of raw) {
        const part = t && t.part;
        const quote = t && typeof t.quote === "string" ? t.quote.trim() : "";
        if (!PARTS.includes(part) || !quote || seen.has(part)) continue;
        const first = ideaText.indexOf(quote);
        if (first === -1) continue;                            // hallucinated → drop
        if (ideaText.indexOf(quote, first + 1) !== -1) continue; // ambiguous → drop
        seen.add(part);
        tags.push({ part, quote });
      }
    } catch (err) {
      console.error("tag-parts generation failed (non-fatal):", err && err.message ? err.message : err);
      tags = [];
    }

    return NextResponse.json({ ok: true, tags });
  } catch (err) {
    console.error("tag-parts route error (non-fatal):", err && err.message ? err.message : err);
    // 200 + empty so the client falls back to plain text; the screen never blocks.
    return NextResponse.json({ ok: false, tags: [] });
  }
}
// src/lib/services/tagIdeaHtml.js
//
// DISPLAY-LAYER ONLY. Wraps the Haiku-tagged load-bearing clauses into the EXACT
// dev-clz / dev-chip HTML the Evolve canvas (DeepEvolveView) renders, so a real
// idea loads pre-coloured the same way the mockup's hardcoded spans do. Engine
// byte-locked — this touches no score, reads nothing from the pipeline.
//
// CONTRACT (matches the tag-parts route):
//   tags = [{ part, quote }]  — part ∈ the Evolve UI vocabulary below; quote is a
//   VERBATIM substring of plainText. Anything that doesn't resolve to exactly one
//   match inside a single paragraph is dropped (under-tag, never mis-tag). With an
//   empty tag list this returns the same plain <p> HTML the fallback builds, so it
//   is always safe to call.

// Evolve UI parts → the metric class that colours them (DeepEvolveView.PARTS).
const PART_METRIC = { target: "md", problem: "md", mechanism: "or", money: "mo", moat: "or", scope: "tc" };
// → the uppercase chip label rendered inside each clause.
const PART_LABEL = { target: "TARGET", problem: "PROBLEM", mechanism: "MECHANISM", money: "MONEY", moat: "MOAT", scope: "SCOPE" };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Wrap the clauses that occur EXACTLY ONCE within this paragraph; drop overlaps.
function wrapParagraph(para, tags) {
  const ranges = [];
  for (const t of tags) {
    const q = t.quote;
    const first = para.indexOf(q);
    if (first === -1) continue;                       // not in this paragraph
    if (para.indexOf(q, first + 1) !== -1) continue;  // ambiguous here → skip
    ranges.push({ start: first, end: first + q.length, part: t.part });
  }
  ranges.sort((a, b) => a.start - b.start);
  const kept = [];
  let lastEnd = -1;
  for (const r of ranges) { if (r.start >= lastEnd) { kept.push(r); lastEnd = r.end; } } // no overlaps

  let html = "", cursor = 0;
  for (const r of kept) {
    html += esc(para.slice(cursor, r.start));
    const cls = PART_METRIC[r.part], label = PART_LABEL[r.part];
    html += `<span class="dev-clz ${cls}" data-part="${r.part}">${esc(para.slice(r.start, r.end))}` +
            `<span class="dev-chip" contenteditable="false">${label}</span></span>`;
    cursor = r.end;
  }
  html += esc(para.slice(cursor));
  return html;
}

export function buildTaggedIdeaHtml(plainText, tags = []) {
  const text = (plainText || "").trim();
  if (!text) return "";

  // keep only well-formed tags, one per part (first wins)
  const seen = new Set();
  const clean = [];
  for (const t of Array.isArray(tags) ? tags : []) {
    if (!t || !PART_METRIC[t.part] || typeof t.quote !== "string") continue;
    const quote = t.quote.trim();
    if (!quote || seen.has(t.part)) continue;
    seen.add(t.part);
    clean.push({ part: t.part, quote });
  }

  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (paras.length ? paras : [text]).map((p) => `<p>${wrapParagraph(p, clean)}</p>`).join("\n");
}
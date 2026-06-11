// SourcesStrip.js — LL1 Part 2: the per-metric evidence bibliography.
//
// Renders a collapsed-by-default "Based on N sources" strip at the foot of a
// metric card, resolving the scorer's committed evidence trail
// (_internal.predicate_commitments.*.evidence_cited + the binding-constraint
// evidence_cited fields) into receipt rows with trust markers.
//
// DISPLAY-ONLY. Reads fields already restored on the payload at final assembly
// (route.js V5.0 _internal restore). Touches no score, no prompt, no stage
// output. Same doctrine as MetricProseDetail's header features: render what
// the engine already committed; never re-derive judgment.
//
// SHARED PRIMITIVE (spine doctrine): resolveEvidenceSources is exported as a
// pure, mode-agnostic function — it takes a reference to Stage 1's shared
// evidence (the competitors array) and a committed evidence trail, and returns
// receipt rows with trust classes. Deep uses it here for the metric-card
// bibliography; Explore reuses the SAME resolver for "why this angle is
// plausible." Do NOT weld Deep-only assumptions into it. The trust grammar
// (external/verified · AI-identified · domain signal · your input · landscape
// read) is a property of the EVIDENCE, not the mode — it must read identically
// in both modes.
//
// Trust classes (derived, never asserted):
//   external  — [competitor: Name] whose Stage 1 object has a retrieval source
//               (github/tavily/exa/google). Green. Links out when url exists.
//   ai        — [competitor: Name] with source "llm" or no Stage 1 match.
//               The competitor exists as a claim, not a retrieval receipt —
//               badged honestly with the same AI tone the competitor cards use.
//   domain    — [domain_flag: X] from Stage 1's domain_risk_flags. Blue.
//   input     — [idea_description] / [user_claim]: the founder's own words.
//   landscape — [narrative_field]: Stage 1's own landscape prose. Lowest
//               trust in the locked tag space; shown dimmest, never hidden.
//
// Parse contract (verified against the June-10 run, 1391 real evidence_cited
// strings):
//   - tags appear ANYWHERE in the fact string (65% suffix) — match all, strip
//     anywhere; competitor tags are replaced by their name so multi-tag chains
//     ("[competitor: A] + [competitor: B] sustain $99-300") stay readable
//   - one competitor tag may carry a comma-list of names — split on failed
//     exact match and emit one row per name
//   - ~46% of evidence_cited strings are tagless scorer reasoning ("No trust
//     friction signal evidenced in packet") — skipped; reasoning is not a source
//   - dedupe by source identity, longest fact body wins (one row per source,
//     not per predicate — predicates repeat sources)
//
// Graceful degradation: missing _internal (pre-V5 saves, the known MD
// emission bug), no evidence_cited, no tagged strings, or a malformed shape
// -> returns null -> the strip simply does not render. No empty shells,
// never crashes. Competitor objects without source/url (old saves) degrade
// to the "ai" class with no link.
//
// Colour discipline: trust tones only (green/blue/AI/neutral). The score-band
// colour never reaches this strip — trust is a property of evidence, not of
// the score.

import React, { useState, useMemo } from "react";

// Locked 5-tag space (Stage 2a SOURCE TAGGING). Matches tags anywhere in the
// string; [1]/[2] capture valued tags (competitor/domain_flag), [3] bare tags.
const TAG_RE = /\[(competitor|domain_flag):\s*([^\]]+)\]|\[(idea_description|narrative_field|user_claim)\]/g;

// Stage 1 retrieval sources = externally verified receipts. "llm" is not.
const RETRIEVED_SOURCES = new Set(["github", "tavily", "exa", "google"]);

const humaniseFlag = (s) =>
  typeof s === "string" && s.length
    ? s.replace(/^is_/, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
    : "";

// Strip tags from a fact string for display: competitor tags become the bare
// name (keeps "[competitor: Vanta] + [competitor: Drata] sustain $99-300"
// readable as "Vanta + Drata sustain $99-300"); all other tags vanish. Then
// tidy the whitespace/punctuation seams the removal leaves behind.
function stripTags(s) {
  return s
    .replace(TAG_RE, (full, kind, val) => (kind === "competitor" ? val : ""))
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:)])/g, "$1")
    .trim()
    .replace(/^[\s\-–—:;,.+]+/, "")
    .replace(/[\s\-–—:;,+]+$/, "");
}

// Recursively collect every evidence_cited string under an _internal block.
// Covers all three scorers' shapes without per-metric schema knowledge:
// MD/MO/OR predicate families, binding_friction / binding_payment_constraint /
// binding_constraint, OR's secondary_subtypes + exposure checks.
function collectEvidenceStrings(node, out) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectEvidenceStrings(item, out);
    return;
  }
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (key === "evidence_cited" && typeof v === "string" && v.trim()) {
      out.push(v);
    } else if (v && typeof v === "object") {
      collectEvidenceStrings(v, out);
    }
  }
}

// ── THE SHARED RESOLVER (mode-agnostic; Explore reuses this) ────────────────
// (internal, competitors) -> array of { cls, name, text, url } rows sorted by
// trust class, or null when nothing resolves.
export function resolveEvidenceSources(internal, competitors) {
  if (!internal || typeof internal !== "object") return null;

  const strings = [];
  collectEvidenceStrings(internal, strings);
  if (strings.length === 0) return null;

  const compIndex = new Map();
  (Array.isArray(competitors) ? competitors : []).forEach((c) => {
    if (c && typeof c.name === "string" && c.name.trim()) {
      compIndex.set(c.name.trim().toLowerCase(), c);
    }
  });

  const rows = new Map();
  const upsert = (key, row) => {
    const prev = rows.get(key);
    if (!prev || (row.text || "").length > (prev.text || "").length) {
      rows.set(key, row);
    }
  };

  for (const s of strings) {
    const matches = Array.from(s.matchAll(TAG_RE));
    if (matches.length === 0) continue; // tagless = scorer reasoning, not a source
    const body = stripTags(s);

    for (const m of matches) {
      if (m[1] === "competitor") {
        const rawVal = m[2].trim();
        // One tag can carry a comma-list of names; split only when the exact
        // value fails to match a Stage 1 competitor (names themselves may
        // legitimately contain commas in theory — exact match wins first).
        let names = [rawVal];
        if (!compIndex.has(rawVal.toLowerCase()) && rawVal.includes(",")) {
          names = rawVal.split(",").map((n) => n.trim()).filter(Boolean);
        }
        for (const name of names) {
          const comp = compIndex.get(name.toLowerCase()) || null;
          const retrieved = comp && RETRIEVED_SOURCES.has(comp.source);
          upsert(`competitor:${name.toLowerCase()}`, {
            cls: retrieved ? "external" : "ai",
            name,
            text: body,
            url: (comp && comp.url) || null,
          });
        }
      } else if (m[1] === "domain_flag") {
        const flag = m[2].trim();
        upsert(`domain:${flag.toLowerCase()}`, {
          cls: "domain",
          name: humaniseFlag(flag),
          text: body,
          url: null,
        });
      } else if (m[3] === "narrative_field") {
        upsert("landscape", { cls: "landscape", name: null, text: body, url: null });
      } else {
        // idea_description + user_claim: the founder is one source.
        upsert("input", { cls: "input", name: null, text: body, url: null });
      }
    }
  }

  if (rows.size === 0) return null;

  const order = { external: 0, ai: 1, domain: 2, input: 3, landscape: 4 };
  return Array.from(rows.values()).sort((a, b) => order[a.cls] - order[b.cls]);
}

// ── presentation ────────────────────────────────────────────────────────────

const SUMMARY_LABELS = {
  external: "external",
  ai: "AI-identified",
  domain: "domain signal",
  input: "your input",
  landscape: "landscape read",
};

const ROW_FALLBACK_TEXT = {
  input: "Stated in your idea description.",
  landscape: "From the landscape analysis.",
};

export default function SourcesStrip({ internal, competitors, t }) {
  const [open, setOpen] = useState(false); // collapsed by default — pulled, not pushed
  const rows = useMemo(
    () => resolveEvidenceSources(internal, competitors),
    [internal, competitors]
  );
  if (!rows) return null; // degrade: no trail, no strip

  const llmTone = (t.srcBadge && t.srcBadge.llm) || t.mut;
  const chips = {
    external: { color: "#34d399", bg: "rgba(16,185,129,0.10)", label: "verified competitor" },
    ai: { color: llmTone, bg: `${llmTone}1A`, label: "AI-identified" },
    domain: { color: "#60a5fa", bg: "rgba(59,130,246,0.10)", label: "domain signal" },
    input: { color: t.mut, bg: "rgba(150,150,160,0.10)", label: "your input" },
    landscape: { color: t.mut, bg: "transparent", label: "landscape read" },
  };

  const counts = {};
  rows.forEach((r) => {
    counts[r.cls] = (counts[r.cls] || 0) + 1;
  });
  const summary = ["external", "ai", "domain", "input", "landscape"]
    .filter((c) => counts[c])
    .map((c) => `${counts[c]} ${SUMMARY_LABELS[c]}`)
    .join(" · ");

  const toggle = () => setOpen((o) => !o);

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`Sources: based on ${rows.length} source${rows.length === 1 ? "" : "s"}`}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          borderTop: `1px solid ${t.divider}`,
          marginTop: 22,
          paddingTop: 14,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>
          Based on {rows.length} source{rows.length === 1 ? "" : "s"}
        </span>
        <span style={{ fontSize: 11, color: t.mut }}>{summary}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={t.mut}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            marginLeft: "auto",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {open && (
        <div style={{ marginTop: 4 }}>
          {rows.map((r, i) => {
            const chip = chips[r.cls];
            const text = r.text || ROW_FALLBACK_TEXT[r.cls] || r.name || "";
            const showNamePrefix =
              r.name &&
              text &&
              !text.toLowerCase().startsWith(r.name.toLowerCase());
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "9px 0",
                  borderTop: i === 0 ? "none" : `1px solid ${t.divider}`,
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: chip.bg,
                    color: chip.color,
                    border: r.cls === "landscape" ? `1px solid ${t.border}` : "none",
                    whiteSpace: "nowrap",
                    letterSpacing: "0.02em",
                    marginTop: 1,
                  }}
                >
                  {chip.label}
                </span>
                <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.55, color: t.sec, minWidth: 0 }}>
                  {showNamePrefix && (
                    <>
                      <strong style={{ color: t.text, fontWeight: 600 }}>{r.name}</strong>
                      {" — "}
                    </>
                  )}
                  {text}
                </span>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      flexShrink: 0,
                      fontSize: 11,
                      color: t.link,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      marginTop: 1,
                    }}
                  >
                    Visit →
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
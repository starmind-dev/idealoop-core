"use client";

// OverviewView.js — the Overview "control room" (the front door inside DashboardShell).
//
// A faithful build of the approved Claude-Design export (IdeaLoop_Core_-_Overview_
// Dashboard.html). Two states, switched on whether the user has any ideas:
//   • EMPTY    → "Bring one rough idea." + the three entry modes, centered.
//   • POPULATED→ "Every idea, still in the loop." + resume card · START A NEW LOOP
//                band · YOUR PORTFOLIO (stats + the across-the-loop strip) · the
//                board + NEEDS YOUR MOVE column · THE LEDGER.
//
// HONESTY TIERS (what the live schema can back today vs. what's parked):
//   TIER 1 — REAL NOW, no schema change: portfolio stats, the loop strip, the
//     resume card, the board rows, the entry modes, the empty state. All derived
//     from the widened /api/ideas (listHub) payload — each family card now carries
//     family_stage / family_score / family_has_brief / loop_bucket / generation /
//     last_activity_at (see listHub's familyAggregate).
//   TIER 2 — designed-not-built: "Revived" needs a revived_at column (rendered as
//     0 until it exists); the LEDGER is an event log with no events table, so it
//     renders a DERIVED-LITE view from real timestamps + disposition only — no
//     fabricated COMPARED / RE-JUDGED rows. It lights up fully once the activity
//     table lands.
//   TIER 3 — PARKED: "NEEDS YOUR MOVE" needs a weekly evidence-recheck cron + a
//     signals table. There is NO live-evidence pipeline yet, so it renders an
//     honest empty state (the promise of the feature) — never invented specifics.
//
// Self-contained palette + fonts (Spectral + JetBrains Mono), matching the export
// pixel-for-pixel — the same "designed-surface owns its tokens" pattern as the
// landing + ExploreView. `t` is accepted for call-site compatibility; the content
// uses the design palette below.
//
// Props (drop-in — the existing required props are unchanged):
//   t              — theme token bag (accepted; content uses the design palette)
//   onStartExplore — fn(): begin an Explore session
//   onStartDeep    — fn(): begin a Deep analysis session
//   onStartRough   — fn(): capture a rough idea (OPTIONAL; defaults to onViewAll →
//                    the hub, where the live "+ Rough idea" capture lives)
//   onContinue     — fn(id): resume a family (wired to loadSavedIdea)
//   onOpenIdea     — fn(id): open a family (wired to loadSavedIdea)
//   onViewAll      — fn(): go to the My Ideas hub

import { useState, useEffect } from "react";
import { getLastIdea, readHubCache, writeHubCache } from "./components";
import { supabase } from "../lib/supabase";

// ── design palette (from the approved export) ────────────────────────────────
const C = {
  text: "#fafafa", text2: "#f0f0f1", text3: "#e8e8ea",
  sec: "#c8c8cc", sec2: "#b4b4bd", mut: "#9a9aa3", mut2: "#71717a",
  faint: "#6b7280", faint2: "#52525b", faint3: "#6b6b74",
  teal: "#5fe3bd", tealDeep: "#34d8a8",
  blue: "#8aa9f7", blue2: "#6b93f5", blueAlt: "#8ea2f0", blueLed: "#a6b6f5",
  violet: "#b3a3f5", violet2: "#8b7ff0", violet3: "#9d86f0", violetText: "#bdb4f0",
  amber: "#e7bd7a", red: "#ee8a8a", greyState: "#8a8a93",
  line: "rgba(255,255,255,0.07)", line2: "rgba(255,255,255,0.05)", line3: "rgba(255,255,255,0.04)",
  panel: "rgba(255,255,255,0.018)",
};
const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Spectral',serif";

// load the two design fonts once (idempotent) so the surface renders identically
// regardless of how the user arrived here.
function useDesignFonts() {
  useEffect(() => {
    // current-step glow for the resume rail (inline styles can't hold @keyframes).
    // Guarded independently so it lands even if the fonts were injected elsewhere.
    if (!document.getElementById("ilc-ov-kf")) {
      const kf = document.createElement("style");
      kf.id = "ilc-ov-kf";
      kf.textContent =
        "@keyframes ilcResumePulse{0%,100%{opacity:.5}50%{opacity:1}}" +
        "@media (prefers-reduced-motion:reduce){.ilc-resume-glow{animation:none!important;opacity:1!important}}";
      document.head.appendChild(kf);
    }

    const id = "ilc-ov-fonts";
    if (document.getElementById(id)) return;
    const pre1 = document.createElement("link");
    pre1.rel = "preconnect"; pre1.href = "https://fonts.googleapis.com";
    const pre2 = document.createElement("link");
    pre2.rel = "preconnect"; pre2.href = "https://fonts.gstatic.com"; pre2.crossOrigin = "";
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Spectral:wght@400;500&family=JetBrains+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(pre1); document.head.appendChild(pre2); document.head.appendChild(link);
  }, []);
}

// ── small helpers ────────────────────────────────────────────────────────────
const sv = (color, size = 21) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: color, strokeWidth: 1.6, "aria-hidden": true,
});
const ExploreGlyph = ({ color = C.blue, size = 21 }) => (
  <svg {...sv(color, size)}>
    <circle cx="12" cy="12" r="9" />
    <polygon points="15.6,8.4 10.8,10.8 8.4,15.6 13.2,13.2" />
  </svg>
);
const DeepGlyph = ({ color = C.violet, size = 21 }) => (
  <svg {...sv(color, size)}>
    <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.4" fill={color} />
  </svg>
);
const RoughGlyph = ({ color = C.mut, size = 21 }) => (
  <svg {...sv(color, size)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" strokeLinecap="round" />
  </svg>
);

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function fmtScore(v) { const n = num(v); return n == null ? null : n.toFixed(1); }

function relTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const min = 60000, hr = 3600000, day = 86400000;
  if (diff < hr) return `${Math.max(1, Math.round(diff / min))}m ago`;
  if (diff < day) return `${Math.round(diff / hr)}h ago`;
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.round(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function ledgerTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const hr = 3600000, day = 86400000;
  if (diff < hr) return `${Math.max(1, Math.round(diff / 60000))}m`;
  if (diff < day) return "Today";
  if (diff < 2 * day) return "Yest.";
  if (diff < 8 * day) return `${Math.round(diff / day)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// a card's lifecycle state → STATE pill styling (REVIVED needs revived_at — Tier 2)
function stateOf(card) {
  if (card.disposition === "killed") return { label: "KILLED", color: C.red };
  if (card.disposition === "parked") return { label: "PARKED", color: C.amber };
  return { label: "ACTIVE", color: C.teal };
}
function stageLabel(s) {
  return s === "deep" ? "DEEP" : s === "explore" ? "EXPLORE" : s === "handoff" ? "HANDOFF" : "ROUGH";
}
function stageColor(s) {
  if (s === "handoff") return C.violet2;
  if (s === "deep") return C.violet;
  if (s === "explore") return C.blue;
  return C.greyState;
}
// what the STAGE column shows: handoff outranks deep when a brief exists.
function boardStage(card) {
  if (card.family_has_brief) return "handoff";
  return card.family_stage || "rough";
}

// ── resume-card theme ────────────────────────────────────────────────────────
// The "continue where you left off" card is tri-color by how far the family has
// travelled: rough → anthracite, explore → dawn blue, deep/brief → deep violet.
// Each theme also carries the secondary-button label = the honest next move.
function resumeTheme(card) {
  const stage = card.family_stage || "rough";
  if (stage === "deep") {
    return {
      key: "deep", accent: C.violet2, eyebrow: C.violet2, tagText: C.violetText,
      tagBg: "rgba(139,127,240,0.14)", tagBorder: "rgba(139,127,240,0.30)",
      cardBg: "linear-gradient(180deg,rgba(139,127,240,0.07),rgba(255,255,255,0.012))",
      cardBorder: "rgba(139,127,240,0.22)", cardGlow: "0 0 50px rgba(139,127,240,0.05)",
      connectorDone: "rgba(139,127,240,0.5)",
      tagLabel: "DEEP",
      secondLabel: "Evolve", secondText: C.violetText, secondBorder: "rgba(139,127,240,0.3)",
      secondIntent: "evolve",
    };
  }
  if (stage === "explore") {
    return {
      key: "explore", accent: C.blue2, eyebrow: C.blue2, tagText: C.blueLed,
      tagBg: "rgba(107,147,245,0.14)", tagBorder: "rgba(107,147,245,0.30)",
      cardBg: "linear-gradient(180deg,rgba(107,147,245,0.07),rgba(255,255,255,0.012))",
      cardBorder: "rgba(107,147,245,0.24)", cardGlow: "0 0 50px rgba(107,147,245,0.05)",
      connectorDone: "rgba(107,147,245,0.5)",
      tagLabel: "EXPLORED",
      secondLabel: "Take it to deep", secondText: C.blueLed, secondBorder: "rgba(107,147,245,0.30)",
      secondIntent: "graduate-deep",
    };
  }
  return {
    key: "rough", accent: C.mut2, eyebrow: C.mut, tagText: C.sec2,
    tagBg: "rgba(154,154,163,0.12)", tagBorder: "rgba(154,154,163,0.28)",
    cardBg: "linear-gradient(180deg,rgba(154,154,163,0.055),rgba(255,255,255,0.012))",
    cardBorder: "rgba(154,154,163,0.20)", cardGlow: "0 0 40px rgba(154,154,163,0.03)",
    connectorDone: "rgba(154,154,163,0.5)",
    tagLabel: "ROUGH",
    secondLabel: "Take it to explore", secondText: C.sec2, secondBorder: "rgba(154,154,163,0.28)",
    secondIntent: "graduate-explore",
  };
}

// The five honest loop nodes. done/current are derived from the family's real
// stage + brief flag — the current node glows, prior nodes get a teal ✓, later
// nodes stay dim. (An explore-only family stops at node 2 = current, not done.)
function resumeNodes(card) {
  const stage = card.family_stage || "rough";
  const hasBrief = !!card.family_has_brief;
  const roughDone = stage === "explore" || stage === "deep";
  const exploreDone = stage === "deep"; // reaching deep implies explore is behind you
  const deepDone = stage === "deep" && hasBrief;
  return [
    { label: "Rough", done: roughDone, current: stage === "rough" },
    { label: "Explore", done: exploreDone, current: stage === "explore" },
    { label: "Deep Analysis", done: deepDone, current: stage === "deep" && !hasBrief },
    { label: "Execution Brief", done: false, current: stage === "deep" && hasBrief },
    { label: "Evolve", done: false, current: false },
  ];
}

const eyebrow = (color = C.faint, size = 12, ls = ".16em") => ({
  fontFamily: MONO, fontSize: size, letterSpacing: ls, color, margin: 0,
});

// ── entry-mode cards ─────────────────────────────────────────────────────────
const MODES = [
  {
    key: "explore", title: "Explore", Glyph: ExploreGlyph, accent: C.blue,
    bandBody: "Widen a rough idea into angles",
    emptyBody: "Widen a rough idea into angles — no verdict, just directions.",
    emptyCta: "Start exploring →", emptyCtaColor: C.blue,
    bg: "rgba(107,147,245,0.04)", bgEmpty: "rgba(107,147,245,0.05)",
    border: "rgba(107,147,245,0.2)", borderEmpty: "rgba(107,147,245,0.25)",
    borderHover: "rgba(107,147,245,0.5)", borderHoverEmpty: "rgba(107,147,245,0.6)",
    iconBg: "rgba(107,147,245,0.12)", iconBorder: "rgba(107,147,245,0.3)",
  },
  {
    key: "deep", title: "Deep Analysis", Glyph: DeepGlyph, accent: C.violet,
    bandBody: "Put an idea under pressure",
    emptyBody: "Put an idea under pressure — scores, risks, an execution brief.",
    emptyCta: "Start deep analysis →", emptyCtaColor: C.violet,
    bg: "rgba(157,134,240,0.04)", bgEmpty: "rgba(157,134,240,0.05)",
    border: "rgba(157,134,240,0.2)", borderEmpty: "rgba(157,134,240,0.25)",
    borderHover: "rgba(157,134,240,0.5)", borderHoverEmpty: "rgba(157,134,240,0.6)",
    iconBg: "rgba(157,134,240,0.12)", iconBorder: "rgba(157,134,240,0.3)",
  },
  {
    key: "rough", title: "Rough idea", Glyph: RoughGlyph, accent: C.mut,
    bandBody: "Capture a spark to come back to",
    emptyBody: "Capture a spark to come back to — one sentence is enough.",
    emptyCta: "Capture a spark →", emptyCtaColor: "#a1a1aa",
    bg: "rgba(255,255,255,0.02)", bgEmpty: "rgba(255,255,255,0.022)",
    border: "rgba(255,255,255,0.09)", borderEmpty: "rgba(255,255,255,0.1)",
    borderHover: "rgba(255,255,255,0.2)", borderHoverEmpty: "rgba(255,255,255,0.22)",
    iconBg: "rgba(255,255,255,0.05)", iconBorder: "rgba(255,255,255,0.14)",
  },
];

function BandCard({ mode, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick && onClick(); } }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 16, boxSizing: "border-box",
        background: mode.bg, border: `1px solid ${hover ? mode.borderHover : mode.border}`,
        borderRadius: 15, padding: "20px 22px", cursor: "pointer", transition: "border-color .15s",
      }}
    >
      <span style={{
        width: 44, height: 44, flexShrink: 0, borderRadius: 12,
        background: mode.iconBg, border: `1px solid ${mode.iconBorder}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <mode.Glyph color={mode.accent} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 16, color: C.text2, fontWeight: 600 }}>{mode.title}</div>
        <div style={{ fontSize: 13, color: C.mut, marginTop: 4, lineHeight: 1.4 }}>{mode.bandBody}</div>
      </div>
    </div>
  );
}

function EmptyCard({ mode, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick && onClick(); } }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        textAlign: "left", boxSizing: "border-box",
        background: mode.bgEmpty, border: `1px solid ${hover ? mode.borderHoverEmpty : mode.borderEmpty}`,
        borderRadius: 18, padding: 28, cursor: "pointer", transition: "border-color .15s",
      }}
    >
      <span style={{
        width: 46, height: 46, borderRadius: 13, background: mode.iconBg,
        border: `1px solid ${mode.iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <mode.Glyph color={mode.accent} size={22} />
      </span>
      <div style={{ fontSize: 19, color: C.text3, fontWeight: 600, marginTop: 20 }}>{mode.title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.5, color: C.mut, marginTop: 8 }}>{mode.emptyBody}</div>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: mode.emptyCtaColor, marginTop: 20 }}>{mode.emptyCta}</div>
    </div>
  );
}

// ── resume card (the focal "continue where you left off") ────────────────────
function ResumeSteps({ card, theme }) {
  // Five honest loop nodes: Rough → Explore → Deep Analysis → Execution Brief →
  // Evolve. done/current come from the family's real stage; the current node
  // glows in the stage color, prior nodes carry a teal ✓, later nodes stay dim.
  const steps = resumeNodes(card);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 15, flexWrap: "wrap" }}>
      {steps.map((s, i) => {
        const connectorActive = i > 0 && (steps[i].done || steps[i].current);
        return (
          <span key={s.label} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && (
              <span style={{
                width: 22, height: 1, margin: "0 9px",
                background: connectorActive ? theme.connectorDone : "rgba(255,255,255,0.1)",
              }} />
            )}
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {s.done ? (
                <span style={{
                  width: 18, height: 18, borderRadius: "50%", border: `1px solid rgba(52,216,168,0.55)`,
                  color: C.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9,
                }}>✓</span>
              ) : s.current ? (
                <span
                  className="ilc-resume-glow"
                  style={{
                    width: 20, height: 20, borderRadius: "50%", background: theme.accent, color: "#0b0b0d",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700,
                    animation: "ilcResumePulse 2.4s ease-in-out infinite",
                  }}
                >{i + 1}</span>
              ) : (
                <span style={{
                  width: 18, height: 18, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.18)",
                  color: C.mut2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9,
                }}>{i + 1}</span>
              )}
              <span style={{
                fontSize: 12.5,
                color: s.done ? C.mut : s.current ? C.text3 : C.mut2,
                fontWeight: s.current ? 600 : 400,
              }}>{s.label}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

function ResumeCard({ card, bindingConstraint, onContinue }) {
  const [h1, setH1] = useState(false), [h2, setH2] = useState(false);
  const theme = resumeTheme(card);
  const score = fmtScore(card.family_score);
  const hasBrief = !!card.family_has_brief;
  // The hub card's id is the family ROOT (fixed identity). But "continue where you
  // left off" must open the node the rollup actually describes — the deep/brief
  // node carried as resume_id by listHub. Falling back to card.id preserves
  // behavior if the API hasn't shipped resume_id yet.
  const resumeId = card.resume_id || card.id;
  const detail = [];
  if (score) detail.push(`Verdict ${score}`);
  else if (card.family_stage === "explore") detail.push("Explored — no verdict");
  else if ((card.family_stage || "rough") === "rough") detail.push("Captured spark");
  return (
    <div style={{
      marginTop: 34, background: theme.cardBg,
      border: `1px solid ${theme.cardBorder}`, borderRadius: 18, padding: "26px 30px",
      display: "flex", alignItems: "center", gap: 30, flexWrap: "wrap", boxShadow: theme.cardGlow,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ ...eyebrow(theme.eyebrow, 11, ".14em") }}>CONTINUE WHERE YOU LEFT OFF</span>
          <span style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: ".1em", color: theme.tagText,
            background: theme.tagBg, border: `1px solid ${theme.tagBorder}`,
            padding: "2px 9px", borderRadius: 999,
          }}>{theme.tagLabel}</span>
          {hasBrief && (
            <span style={{
              fontFamily: MONO, fontSize: 10.5, letterSpacing: ".06em", color: C.violetText,
              background: "rgba(139,127,240,0.14)", border: "1px solid rgba(139,127,240,0.3)",
              padding: "2px 9px", borderRadius: 999,
            }}>EXECUTION BRIEF READY</span>
          )}
        </div>
        <div style={{
          fontSize: 19, color: C.text2, fontWeight: 500, marginTop: 11,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{card.title}</div>

        <ResumeSteps card={card} theme={theme} />

        <div style={{ fontSize: 13, color: C.mut2, marginTop: 13 }}>
          {detail.join(" · ")}
          {bindingConstraint && (
            <>{detail.length ? " · " : ""}binding constraint: <span style={{ color: C.amber }}>{bindingConstraint}</span></>
          )}
          {card.last_activity_at && <>{(detail.length || bindingConstraint) ? " · " : ""}last edited {relTime(card.last_activity_at)}</>}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9, flexShrink: 0 }}>
        <button
          onClick={() => onContinue(resumeId, hasBrief ? "brief" : null)}
          onMouseEnter={() => setH1(true)} onMouseLeave={() => setH1(false)}
          style={{
            whiteSpace: "nowrap", background: theme.accent, color: "#fff", border: "none", borderRadius: 11,
            padding: "13px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            filter: h1 ? "brightness(1.1)" : "none", transition: "filter .15s",
          }}
        >{hasBrief ? "Open execution brief →" : "Continue →"}</button>
        <button
          onClick={() => onContinue(resumeId, theme.secondIntent || null)}
          onMouseEnter={() => setH2(true)} onMouseLeave={() => setH2(false)}
          style={{
            whiteSpace: "nowrap", background: h2 ? "rgba(255,255,255,0.04)" : "transparent", color: theme.secondText,
            border: `1px solid ${theme.secondBorder}`, borderRadius: 11, padding: "11px 24px",
            fontSize: 13.5, fontWeight: 500, cursor: "pointer", transition: "background .15s",
          }}
        >{theme.secondLabel}</button>
      </div>
    </div>
  );
}

// ── across-the-loop strip ────────────────────────────────────────────────────
const BUCKETS = [
  { key: "rough", label: "Rough", color: C.greyState },
  { key: "explore", label: "Explore", color: C.blue2 },
  { key: "deep", label: "Deep Analysis", color: C.violet3 },
  { key: "branched", label: "Branched", color: C.blueAlt },
  { key: "handoff", label: "Handoff", color: C.violet2 },
  { key: "evolve", label: "Evolve", color: C.tealDeep },
];

function LoopStrip({ counts, total }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ ...eyebrow(C.faint, 11, ".14em") }}>ACROSS THE LOOP · WHERE YOUR IDEAS SIT</div>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".06em", color: C.teal }}>↻ the cycle never closes</div>
      </div>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", gap: 2 }}>
        {BUCKETS.map((b) => {
          const w = total ? (counts[b.key] / total) * 100 : 0;
          if (!w) return null;
          return <div key={b.key} style={{ width: `${w}%`, background: b.color }} />;
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 13, gap: 8, flexWrap: "wrap" }}>
        {BUCKETS.map((b) => (
          <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color }} />
            <span style={{ fontSize: 13, color: C.sec }}>{b.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.mut2 }}>{counts[b.key] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── the board ────────────────────────────────────────────────────────────────
const BOARD_COLS = "2.5fr 0.95fr 1.05fr 0.9fr 1fr";

function BoardRow({ card, last, onOpenIdea }) {
  const [hover, setHover] = useState(false);
  const st = stateOf(card);
  const stage = boardStage(card);
  const reachedDeep = (card.family_stage || card.mode) === "deep";
  const score = reachedDeep ? fmtScore(card.family_score) : null;
  const dotColor = card.disposition === "killed" ? C.red : card.disposition === "parked" ? C.amber : C.teal;
  const gen = `G${card.generation || 1}${card.family_size > 1 ? ` · ${card.family_size}☉` : ""}`;
  return (
    <div
      onClick={() => onOpenIdea(card.id)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "grid", gridTemplateColumns: BOARD_COLS, gap: 12, padding: "15px 20px",
        borderBottom: last ? "none" : `1px solid ${C.line3}`, alignItems: "center", cursor: "pointer",
        background: hover ? "rgba(255,255,255,0.015)" : "transparent", transition: "background .12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 14, color: card.disposition ? C.sec : C.text3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.title}</span>
        {card.is_main && (
          <span style={{
            fontFamily: MONO, fontSize: 8.5, letterSpacing: ".08em", color: C.teal,
            background: "rgba(52,216,168,0.12)", border: "1px solid rgba(52,216,168,0.3)",
            padding: "2px 6px", borderRadius: 5, flexShrink: 0,
          }}>LEAD</span>
        )}
      </div>
      <span style={{
        fontFamily: MONO, fontSize: 10, letterSpacing: ".08em", color: st.color,
        background: `${st.color}1a`, border: `1px solid ${st.color}47`,
        padding: "3px 7px", borderRadius: 6, justifySelf: "start",
      }}>{st.label}</span>
      <span style={{ fontFamily: MONO, fontSize: 11, color: stageColor(stage) }}>{stageLabel(stage)}</span>
      <span style={{ fontSize: 14, color: score ? C.text2 : C.sec }}>
        {score || "—"}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 11, color: C.greyState }}>{gen}</span>
    </div>
  );
}

// NEEDS YOUR MOVE — Tier 3 PARKED. No live-evidence pipeline exists yet, so this is
// an HONEST empty state (the promise of the feature), never invented signals.
function NeedsYourMove() {
  return (
    <div>
      <div style={{ ...eyebrow(C.amber, 12, ".16em"), marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <span>⚡</span> NEEDS YOUR MOVE
      </div>
      <div style={{
        background: "rgba(255,255,255,0.018)", border: `1px dashed ${C.line}`, borderRadius: 14, padding: "20px 18px",
      }}>
        <div style={{ fontSize: 13.5, color: C.sec, fontWeight: 500 }}>No new signals this week.</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: C.mut, marginTop: 7 }}>
          IdeaLoop re‑checks your active ideas' evidence in the background and flags a move here when the world shifts.
        </div>
      </div>
    </div>
  );
}

// THE LEDGER — real events from the activity table (preferred), else DERIVED-LITE.
// kind → display label + colour.
const KIND_META = {
  captured: { label: "CAPTURED", color: C.greyState },
  explored: { label: "EXPLORED", color: C.blue },
  judged: { label: "JUDGED", color: C.teal },
  rejudged: { label: "RE-JUDGED", color: C.violetText },
  compared: { label: "COMPARED", color: C.blueAlt },
  parked: { label: "PARKED", color: C.amber },
  killed: { label: "KILLED", color: C.red },
  briefed: { label: "BRIEFED", color: C.violet2 },
};
// Real activity rows (newest-first) → ledger display rows. This is the full,
// honest ledger — it carries the three events the derived-lite version can't:
// RE-JUDGED, COMPARED, and (once revived_at exists) revival.
function activityToLedger(activity) {
  return (activity || [])
    .map((e) => {
      const m = KIND_META[e.kind] || { label: String(e.kind || "").toUpperCase(), color: C.mut };
      return { at: e.created_at, kind: m.label, color: m.color, text: e.summary };
    })
    .slice(0, 6);
}

// DERIVED-LITE fallback (used until the activity table has rows): only events we
// can reconstruct from real timestamps + disposition. No fabricated COMPARED /
// RE-JUDGED rows — those arrive with the real table.
function buildLedger(all) {
  const ev = [];
  all.forEach((c) => {
    const at = c.last_activity_at;
    if (!at) return;
    const score = fmtScore(c.family_score);
    if (c.disposition === "killed") {
      ev.push({ at, kind: "KILLED", color: C.red, text: `${c.title} — set aside as killed.` });
    } else if (c.disposition === "parked") {
      ev.push({ at, kind: "PARKED", color: C.amber, text: `${c.title} — parked${score ? ` at ${score}` : ""}, kept revivable.` });
    } else if (score != null) {
      ev.push({ at, kind: "JUDGED", color: C.teal, text: `${c.title} — deep verdict landed at ${score}.` });
    } else if (c.family_stage === "explore") {
      ev.push({ at, kind: "EXPLORED", color: C.blue, text: `${c.title} — widened into angles${c.family_size > 1 ? `, ${c.family_size - 1} taken forward` : ""}.` });
    } else {
      ev.push({ at, kind: "CAPTURED", color: C.greyState, text: `${c.title} — captured as a rough idea.` });
    }
  });
  return ev.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6);
}

function Ledger({ rows, onViewAll }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ marginTop: 56 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ ...eyebrow(C.faint, 12, ".16em") }}>RECENT ACTIVITY · THE LEDGER</div>
        <span
          onClick={onViewAll}
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          style={{ fontSize: 13, color: hover ? C.blue : C.blue2, cursor: "pointer" }}
        >View all →</span>
      </div>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "6px 22px" }}>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "54px 130px 1fr", gap: 16, alignItems: "baseline",
            padding: "13px 0", borderBottom: i < rows.length - 1 ? `1px solid ${C.line2}` : "none",
          }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint3 }}>{ledgerTime(r.at)}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".06em", color: r.color }}>{r.kind}</span>
            <span style={{ fontSize: 13.5, color: C.sec }}>{r.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── portfolio stats ──────────────────────────────────────────────────────────
function PortfolioStats({ stats }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 13, flexWrap: "wrap" }}>
      <span style={{ color: C.mut }}>
        <span style={{ fontFamily: SERIF, fontSize: 17, color: C.text }}>{stats.total}</span> ideas
      </span>
      <span style={{ color: C.teal }}>{stats.active} active</span>
      {stats.parked > 0 && <span style={{ color: C.amber }}>{stats.parked} parked</span>}
      {stats.killed > 0 && <span style={{ color: C.red }}>{stats.killed} killed</span>}
      {stats.revived > 0 && <span style={{ color: C.blue }}>{stats.revived} revived</span>}
      {stats.avg != null && (
        <span style={{ color: C.mut }}>avg <span style={{ fontFamily: SERIF, fontSize: 17, color: C.text }}>{stats.avg}</span></span>
      )}
    </div>
  );
}

// ── derive everything the populated view needs from the family cards ─────────
function derive(all, activity) {
  const total = all.length;
  const active = all.filter((c) => !c.disposition).length;
  const parked = all.filter((c) => c.disposition === "parked").length;
  const killed = all.filter((c) => c.disposition === "killed").length;
  const revived = 0; // Tier 2 — needs a revived_at column; honestly 0 until then.
  const deepScores = all.map((c) => num(c.family_score)).filter((n) => n != null);
  const avg = deepScores.length ? (deepScores.reduce((a, b) => a + b, 0) / deepScores.length).toFixed(1) : null;

  const counts = { rough: 0, explore: 0, deep: 0, branched: 0, handoff: 0, evolve: 0 };
  all.forEach((c) => { const b = c.loop_bucket || c.family_stage || "rough"; if (counts[b] != null) counts[b] += 1; });

  // board: active/parked/killed first, then by recency; cap to keep it scannable.
  const board = [...all].sort((a, b) => {
    const rank = (c) => (c.disposition === "killed" ? 2 : c.disposition === "parked" ? 1 : 0);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return new Date(b.last_activity_at || b.created_at || 0) - new Date(a.last_activity_at || a.created_at || 0);
  }).slice(0, 8);

  const ledger = (activity && activity.length) ? activityToLedger(activity) : buildLedger(all);
  return { stats: { total, active, parked, killed, revived, avg }, counts, board, ledger };
}

// ── main ─────────────────────────────────────────────────────────────────────
export default function OverviewView({ t, onStartExplore, onStartDeep, onStartRough, onContinue, onOpenIdea, onViewAll }) {
  useDesignFonts();
  const startRough = onStartRough || onViewAll;
  const handlers = { explore: onStartExplore, deep: onStartDeep, rough: startRough };

  const [rough, setRough] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [activity, setActivity] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | ready
  const [lastId, setLastId] = useState(null);
  const [binding, setBinding] = useState(null); // resume card's binding constraint (lazy)

  // stale-while-revalidate against the per-user hub cache (no flash on repeat
  // loads), then refresh + reconcile. Same contract the prior Overview used.
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!alive) return;
      if (!session) { setStatus("ready"); return; }
      const uid = session.user.id;
      const cached = readHubCache(uid);
      if (cached) { setRough(cached.rough); setIdeas(cached.ideas); setStatus("ready"); }
      else setStatus("loading");
      try {
        const res = await fetch("/api/ideas", { headers: { Authorization: `Bearer ${session.access_token}` } });
        const d = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(d.error || "load failed");
        const r = d.rough || [], i = d.ideas || [];
        setRough(r); setIdeas(i); setActivity(d.activity || []); writeHubCache(uid, r, i);
      } catch { /* keep cache */ }
      finally { if (alive) setStatus("ready"); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { const s = getLastIdea(); setLastId(s && s.id ? s.id : null); }, []);

  const all = [...rough, ...ideas];
  const hasIdeas = all.length > 0;

  // resume target: the last-opened family card, else the most recently active one.
  let resume = lastId ? all.find((c) => c.id === lastId) : null;
  if (!resume && all.length) {
    resume = [...all].sort((a, b) => new Date(b.last_activity_at || b.created_at || 0) - new Date(a.last_activity_at || a.created_at || 0))[0];
  }

  // lazily enrich the resume card with its binding constraint (the one field the
  // light hub payload omits). Non-fatal; the clause is simply absent if missing.
  useEffect(() => {
    let alive = true;
    setBinding(null);
    if (!resume || resume.family_stage !== "deep") return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !alive) return;
        const res = await fetch(`/api/ideas/${resume.id}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const d = await res.json();
        if (!alive || !res.ok) return;
        const mb = d.analysis?.estimates?.main_bottleneck;
        if (mb && typeof mb === "string" && mb.toLowerCase() !== "specification") setBinding(mb.toLowerCase());
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [resume && resume.id, resume && resume.family_stage]);

  const populated = status === "ready" && hasIdeas;
  const showEmpty = status === "ready" && !hasIdeas;
  const d = populated ? derive(all, activity) : null;

  return (
    <div style={{ width: "100%" }}>
      {/* ============================ EMPTY STATE ============================ */}
      {showEmpty && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ maxWidth: 980, width: "100%", textAlign: "center", padding: "40px 0" }}>
            <div style={{ ...eyebrow(C.faint, 12, ".2em"), display: "inline-flex", alignItems: "center", gap: 9 }}>
              <span style={{ color: C.tealDeep, fontSize: 15 }}>∞</span> WELCOME TO IDEALOOP CORE
            </div>
            <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 46, lineHeight: 1.08, letterSpacing: "-0.01em", margin: "18px 0 0", color: C.text }}>
              Bring one rough idea.
            </h1>
            <p style={{ fontSize: 16.5, lineHeight: 1.55, color: C.sec2, margin: "14px auto 0", maxWidth: 540 }}>
              Every idea runs the loop — widened, pressured, re‑judged. Pick how you want to start.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginTop: 46, textAlign: "left" }}>
              {MODES.map((m) => <EmptyCard key={m.key} mode={m} onClick={handlers[m.key]} />)}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: ".08em", color: C.faint2, marginTop: 34 }}>
              ↻&nbsp;&nbsp;ONCE AN IDEA, ALWAYS IN THE LOOP
            </div>
          </div>
        </div>
      )}

      {/* ============================ POPULATED STATE ============================ */}
      {populated && (
        <div style={{ maxWidth: 1440 }}>
          {/* header */}
          <div style={{ ...eyebrow(C.faint, 12, ".2em"), display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ color: C.tealDeep, fontSize: 15 }}>∞</span> OVERVIEW
          </div>
          <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 40, lineHeight: 1.08, letterSpacing: "-0.01em", margin: "15px 0 0", color: C.text }}>
            Every idea, still in the loop.
          </h1>

          {/* 1. resume */}
          {resume && <ResumeCard card={resume} bindingConstraint={binding} onContinue={onContinue} />}

          {/* 2. start a new loop */}
          <div style={{ marginTop: 56 }}>
            <div style={{ ...eyebrow(C.faint, 12, ".16em"), marginBottom: 16 }}>START A NEW LOOP</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
              {MODES.map((m) => <BandCard key={m.key} mode={m} onClick={handlers[m.key]} />)}
            </div>
          </div>

          {/* 3. portfolio + across-the-loop + board + signals */}
          <div style={{ marginTop: 56 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 18, flexWrap: "wrap" }}>
              <div style={{ ...eyebrow(C.faint, 12, ".16em") }}>YOUR PORTFOLIO</div>
              <PortfolioStats stats={d.stats} />
            </div>

            <LoopStrip counts={d.counts} total={d.stats.total} />

            <div style={{ display: "grid", gridTemplateColumns: "1.62fr 1fr", gap: 24, marginTop: 20, alignItems: "start" }}>
              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: BOARD_COLS, gap: 12, padding: "13px 20px",
                  borderBottom: `1px solid ${C.line}`, fontFamily: MONO, fontSize: 10, letterSpacing: ".1em", color: C.faint2,
                }}>
                  <span>IDEA</span><span>STATE</span><span>STAGE</span><span>VERDICT</span><span>LINEAGE</span>
                </div>
                {d.board.map((c, i) => (
                  <BoardRow key={c.id} card={c} last={i === d.board.length - 1} onOpenIdea={onOpenIdea} />
                ))}
              </div>
              <NeedsYourMove />
            </div>
          </div>

          {/* 4. ledger (derived-lite; only when there's something real to show) */}
          {d.ledger.length > 0 && <Ledger rows={d.ledger} onViewAll={onViewAll} />}

          <div style={{ marginTop: 48, paddingTop: 22, borderTop: `1px solid ${C.line2}`, fontSize: 13, color: C.faint2 }}>
            IdeaLoop Core — All analysis is AI-generated. Use as a guide, not a definitive assessment.
          </div>
        </div>
      )}

      {/* loading: leave the space calm (the shell frames it) */}
      {status === "loading" && (
        <div style={{ maxWidth: 1440 }}>
          <div style={{ ...eyebrow(C.faint, 12, ".2em"), display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ color: C.tealDeep, fontSize: 15 }}>∞</span> OVERVIEW
          </div>
          <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 40, lineHeight: 1.08, letterSpacing: "-0.01em", margin: "15px 0 0", color: C.text }}>
            Every idea, still in the loop.
          </h1>
          <div style={{ marginTop: 34, height: 120, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, opacity: 0.5 }} />
        </div>
      )}
    </div>
  );
}
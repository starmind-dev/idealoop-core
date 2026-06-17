"use client";

import { useRef } from "react";

// ============================================
// DeepInputView — the Deep mode's own idea-input screen.
//
// Deliberately NOT Explore's input. Explore opens a rough seed to branch
// (quiet star field, three angles); Deep puts the idea UNDER PRESSURE — it
// holds the idea against the evidence and credits what stands. So this screen
// is a calm, serious intake: a stated creed (harsh · fair · traceable), one
// idea box, and a single run. It does NOT pre-enact the streaming pipeline
// (that's the live SSE view) nor duplicate the specificity-gate "sharpen"
// screen (the gate fires on vague input and renders below, via gateNode).
//
// Loop continuity: nothing here is a terminus. The line under the box says the
// output feeds forward — "where the next loop sharpens." Parity with Explore is
// load-bearing: neither mode is "better." Footer doctrine — EXPLORE WIDENS ·
// DEEP PRESSURES · SAME LOOP.
//
// Rendered by page.js inside DashboardShell when inputMode === "deep".
// Props: t, idea, setIdea, onRun, onBack, isAnalyzing, evalsRemaining,
//        gateNode (SpecificityGate element if it fired, else null), error,
//        profile ({ coding, ai }) + onEditProfile (opens the profile screen),
//        provenance ("explore" | "rough" | null) + sourceTitle (optional).
//
// provenance strip — shown ONLY when the idea arrived via a "take this to Deep"
// handoff. "explore" -> blue ✦ "Continued from Explore"; "rough" -> amber
// "Continued from a rough seed". A cold/direct open passes null -> no strip.
// (Today the deep input route is reached only by cold open, so provenance is
// null in practice; the strip is wired and ready for when handoffs route
// through this screen.) onBack is accepted for contract parity with Explore;
// primary nav is owned by the DashboardShell rail, so no back button is drawn —
// the profile chip holds the top-right slot per the locked design.
// ============================================

const ACCENT = "#8a82c2"; // Deep's serious indigo-violet — the ◆ and TRACEABLE label
const RULE   = "#6b62b8"; // subtitle left rule + CTA border
const CTA_BG = "#5c52a6";
const CTA_TX = "#ece9fb";
const BLUE   = "#60a5fa"; // explore-origin provenance
const AMBER  = "#caa15a"; // rough-origin provenance
const MONO   = "ui-monospace, Menlo, monospace";

// ---- provenance strip: lineage of a "take this to Deep" handoff ----------------
function Provenance({ provenance, sourceTitle }) {
  if (provenance !== "explore" && provenance !== "rough") return null;
  const isExplore = provenance === "explore";
  const color = isExplore ? BLUE : AMBER;
  const label = isExplore ? "✦ CONTINUED FROM EXPLORE" : "CONTINUED FROM A ROUGH SEED";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 22,
      background: `${color}10`, border: `1px solid ${color}47`, borderRadius: 8, padding: "7px 12px",
    }}>
      <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.08em", color }}>{label}</span>
      {sourceTitle && (
        <span style={{ fontSize: 12.5, color: "#c8ccd2" }}>&ldquo;{sourceTitle}&rdquo;</span>
      )}
    </div>
  );
}

const CREED = [
  { label: "HARSH", line: "Finds the weak points that matter.", accent: false },
  { label: "FAIR", line: "Credits strength when the evidence backs it.", accent: false },
  { label: "TRACEABLE", line: "Shows why each judgment was made.", accent: true },
];

export default function DeepInputView({
  t, idea, setIdea, onRun, onBack, isAnalyzing, evalsRemaining, gateNode, error,
  profile, onEditProfile, provenance = null, sourceTitle = null,
}) {
  const inputRef = useRef(null);
  const noEvals = evalsRemaining != null && evalsRemaining <= 0;
  const canRun = !!(idea && idea.trim()) && !isAnalyzing && !noEvals;
  // CTA stays lit (serious, inviting); clicking with an empty box focuses the
  // idea field instead of firing a dead run — same posture as Explore.
  const handleRun = () => {
    if (isAnalyzing) return;
    if (canRun) onRun();
    else if (inputRef.current) inputRef.current.focus();
  };
  const evalsText = evalsRemaining == null
    ? ""
    : evalsRemaining <= 0
      ? "No evaluation credits remaining"
      : `${evalsRemaining} evaluation ${evalsRemaining === 1 ? "credit" : "credits"} remaining`;

  return (
    <div style={{ position: "relative", width: "100%", minHeight: "calc(100vh - 90px)" }}>
      <style>{`[data-ilc-deep-idea]::placeholder { color: #5f656d; opacity: 1; }`}</style>

      {/* The gravity field — pure smooth shading, no lines, one full-bleed transparent
          layer (same seamless principle as Explore's star layer). Three stacked radials,
          each fading to transparent before the rail/top edge so nothing can seam:
            1) a faint focal LIGHT up behind the headline — dimension, light-vs-shade
            2) a heavy core POOL — the mass, the deepest dark
            3) a soft volume HALO around it — wider, lighter shade so the mass has body.
          All built from the page's own blue-grey: no rings, no black, no card. */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0,
        background: [
          "radial-gradient(ellipse 34% 26% at 50% 32%, rgba(124,128,166,0.05) 0%, rgba(124,128,166,0) 72%)",
          "radial-gradient(ellipse 50% 60% at 50% 40%, rgba(0,1,6,0.70) 0%, rgba(3,4,10,0.24) 52%, rgba(3,4,10,0) 84%)",
          "radial-gradient(ellipse 58% 72% at 50% 42%, rgba(4,5,12,0.34) 0%, rgba(5,6,13,0.12) 50%, rgba(5,6,13,0) 82%)",
        ].join(", "),
      }} />

      {/* Content column — lifted translateY(-20px) to sit on Explore's line, no card. */}
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 760, margin: "0 auto", transform: "translateY(-20px)" }}>

      {/* header: mode mark + profile chip (rail owns back nav) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.2em", color: t.sec }}>
          <span style={{ color: ACCENT, marginRight: 6 }}>◆</span>DEEP ANALYSIS
        </span>
        {profile && (
          <button
            onClick={onEditProfile}
            style={{
              fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em", color: t.mut,
              border: `1px solid ${t.border}`, borderRadius: 999, padding: "4px 11px",
              background: "none", cursor: onEditProfile ? "pointer" : "default",
            }}
          >
            {profile.coding} · {profile.ai} AI · Edit ✎
          </button>
        )}
      </div>
      <div style={{ height: 1, background: t.divider || t.border, marginBottom: 18 }} />

      <Provenance provenance={provenance} sourceTitle={sourceTitle} />

      {/* headline + ruled subtitle */}
      <h1 style={{ margin: "0 0 11px", fontSize: 27, fontWeight: 500, letterSpacing: "-0.02em", color: t.text }}>
        Put the idea under pressure.
      </h1>
      <p style={{
        margin: "0 0 24px", borderLeft: `3px solid ${RULE}`, paddingLeft: 14,
        fontSize: 14, lineHeight: 1.6, color: "#a8aab4", maxWidth: 585,
      }}>
        Deep holds the idea against the evidence &mdash; then credits what stands.
      </p>

      {/* the creed — harsh · fair · traceable — a stamped slab with weight */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#12151e",
        border: "1px solid rgba(74,74,88,0.85)", borderRadius: 12, overflow: "hidden", marginBottom: 26,
        boxShadow: "0 16px 36px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.035)",
      }}>
        {CREED.map((c, i) => (
          <div key={c.label} style={{
            padding: "18px",
            borderLeft: i === 0 ? "none" : "1px solid rgba(74,74,90,0.95)",
          }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: c.accent ? "#9d97d2" : "#d6dae1", marginBottom: 6 }}>
              {c.label}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.45, color: "#8f95a0" }}>{c.line}</div>
          </div>
        ))}
      </div>

      {/* the idea box */}
      <span style={{ display: "block", fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: t.sec, marginBottom: 9 }}>
        THE IDEA
      </span>
      <textarea
        ref={inputRef}
        data-ilc-deep-idea
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        rows={5}
        placeholder="What it does, who it serves, the problem it removes, why now…"
        style={{
          width: "100%", boxSizing: "border-box", background: "#07090e",
          border: "1px solid rgba(124,116,196,0.36)", borderRadius: 12, padding: "16px 18px",
          fontSize: 14, lineHeight: 1.65, color: t.text, resize: "none", outline: "none",
          fontFamily: "inherit", marginBottom: 11,
          boxShadow: "inset 0 6px 20px rgba(0,0,0,0.78), inset 0 2px 4px rgba(0,0,0,0.62), inset 0 1px 0 rgba(0,0,0,0.5)",
        }}
      />
      <p style={{ margin: "0 0 18px", fontSize: 12.5, color: "#7d838d" }}>
        Whatever it finds is where the next loop sharpens &mdash; nothing here is the last word.
      </p>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 20px", margin: "0 0 18px" }}>
          <p style={{ fontSize: 14, color: "#f87171", margin: 0 }}>{error}</p>
        </div>
      )}

      {gateNode}

      {/* quiet standards footnote */}
      <p style={{ margin: "0 0 22px", fontFamily: MONO, fontSize: 10, letterSpacing: "0.05em", color: "#45494f" }}>
        Deep judges the evidence shape, not the underlying phenomenon.
      </p>

      {/* footer: parity doctrine + run */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "#5a5f66" }}>
          EXPLORE WIDENS · DEEP PRESSURES · SAME LOOP
        </span>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <button
            onClick={handleRun}
            style={{
              display: "inline-flex", alignItems: "center", fontSize: 13.5, fontWeight: 500,
              padding: "12px 24px", borderRadius: 10, cursor: isAnalyzing ? "default" : "pointer",
              color: CTA_TX, background: CTA_BG, border: `1px solid ${RULE}`,
              boxShadow: "0 10px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
              opacity: isAnalyzing ? 0.8 : 1,
            }}
          >
            {isAnalyzing ? "Running deep analysis…" : "Run deep analysis →"}
          </button>
          {evalsText && (
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em", color: t.mut }}>{evalsText}</span>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
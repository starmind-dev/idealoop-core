"use client";

import { useRef } from "react";

import { ModeTitle } from "./ModeTitle";

// ============================================
// ExploreInputView — the Explore mode's own idea-input screen.
//
// Deliberately NOT Deep's input. Deep extracts to score (who/what/problem ->
// MD/MO/OR/TC + risk); Explore opens to branch. So this screen drops the
// 4-step stepper and the evaluative checklist, and frames a rough seed at the
// center of a quiet star field whose three angles — positioning, mechanism,
// target — are the directions Explore will fan it into. The guiding questions
// reflect that divergent operation: the rough shape, what's still open (the
// branch fuel), where it might go.
//
// The star field is a subtle full-bleed layer behind the whole content area
// (not just the map), so the screen reads as one quiet sky.
//
// Rendered by page.js inside DashboardShell when inputMode === "explore".
// Props: t, idea, setIdea, onRun, isAnalyzing, evalsRemaining,
//        gateNode (SpecificityGate element if it fired, else null), error.
// ============================================

const BLUE = "#60a5fa";
const MONO = "ui-monospace, Menlo, monospace";

const ic = (size) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round",
  "aria-hidden": true,
});
function IcLayout({ s = 16 }) { return (<svg {...ic(s)}><rect x="3" y="3" width="7" height="18" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>); }
function IcMech({ s = 16 }) { return (<svg {...ic(s)}><circle cx="12" cy="12" r="3.2" /><path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18 6l-1.8 1.8M7.8 16.2 6 18M18 18l-1.8-1.8M7.8 7.8 6 6" /></svg>); }
function IcTarget({ s = 16 }) { return (<svg {...ic(s)}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /></svg>); }
function IcEye({ s = 13 }) { return (<svg {...ic(s)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="2.6" /></svg>); }
function IcBranch({ s = 13 }) { return (<svg {...ic(s)}><circle cx="6" cy="6" r="2.2" /><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="8" r="2.2" /><path d="M6 8.2v7.6M8.2 6H14a2 2 0 0 1 2 2v0" /></svg>); }
function IcPin({ s = 13 }) { return (<svg {...ic(s)}><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" /><circle cx="12" cy="10" r="2.4" /></svg>); }
function IcArrow({ s = 13 }) { return (<svg {...ic(s)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>); }
function IcSpark({ s = 15 }) { return (<svg {...ic(s)}><path d="M12 3v5M12 16v5M3 12h5M16 12h5M6.5 6.5l3 3M14.5 14.5l3 3M17.5 6.5l-3 3M9.5 14.5l-3 3" /></svg>); }

// Full-bleed star field across the whole content area. Deterministic
// (index-hashed, no Math.random) so server and client render identically — no
// hydration flicker. Kept faint so it reads as atmosphere, not decoration.
// Deterministic pseudo-random hash (stable across server/client -> no hydration
// flicker) that scatters far more naturally than the old golden-angle stepping.
// Positions/opacity rounded to 2 decimals so engine ULP differences never desync.
const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const r2 = (n) => Math.round(n * 100) / 100;
const FIELD = Array.from({ length: 120 }, (_, i) => {
  const x = r2(1 + hash(i * 3 + 1) * 98);
  const y = r2(1 + hash(i * 3 + 2) * 98);
  const q = hash(i * 3 + 3);
  const big = q > 0.9;
  const mid = !big && q > 0.62;
  const rad = big ? 2.4 : mid ? 1.7 : 1.1;
  const mx = r2(0.22 + hash(i + 53) * 0.4);           // peak (resting) opacity
  const mn = r2(mx * (0.12 + hash(i * 9 + 5) * 0.5)); // trough — varied depth per star
  const dur = r2(2.4 + hash(i * 9 + 7) * 4.4);        // varied speed: 2.4 .. 6.8s
  const delay = r2(-hash(i * 9 + 11) * dur);          // negative => desynced phase
  return [x, y, rad, mx, big, mn, dur, delay];
});

// label %, line-anchor in the 600x384 viewBox (preserveAspectRatio none -> % maps directly)
const NODES = [
  { key: "pos", label: "POSITIONING", x: 13, y: 14, ax: 78, ay: 54, Icon: IcLayout },
  { key: "mech", label: "MECHANISM", x: 90, y: 21, ax: 540, ay: 81, Icon: IcMech },
  { key: "tgt", label: "TARGET", x: 67, y: 89, ax: 402, ay: 342, Icon: IcTarget },
];
const CHIPS = ["the rough shape", "what's still open", "where it might go"];
const RAIL = [
  { label: "OUR READ", Icon: IcEye },
  { label: "WHERE IT COULD GO", Icon: IcBranch },
  { label: "WHERE IT FITS", Icon: IcPin },
  { label: "FROM HERE", Icon: IcArrow },
];

export default function ExploreInputView({ t, idea, setIdea, onRun, isAnalyzing, evalsRemaining, gateNode, error, sourceIdea, onBackToSource }) {
  const inputRef = useRef(null);
  const noEvals = evalsRemaining != null && evalsRemaining <= 0;
  const canRun = !!(idea && idea.trim()) && !isAnalyzing && !noEvals;
  // CTA is always lit (inviting); clicking with an empty box gently focuses the
  // idea field instead of firing a dead run.
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
      <style>{`@keyframes ilcTwinkle { 0%, 100% { opacity: var(--ilc-mx); } 50% { opacity: var(--ilc-mn); } } @media (prefers-reduced-motion: reduce) { [data-ilc-stars] span { animation: none !important; } } @media (max-width: 1024px) { .ilc-jumpback { display: none !important; } }`}</style>
      {/* subtle full-bleed star field; each star twinkles on its own clock — varied
          speed, depth and phase — so the field shimmers organically, not in unison */}
      <div data-ilc-stars aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        {FIELD.map((s, i) => (
          <span key={"f" + i} style={{
            position: "absolute", left: s[0] + "%", top: s[1] + "%",
            width: s[2], height: s[2], borderRadius: "50%", background: "#fff",
            opacity: s[3], transform: "translate(-50%,-50%)",
            boxShadow: s[4] ? "0 0 4px 1px rgba(255,255,255,0.35)" : "none",
            "--ilc-mx": s[3], "--ilc-mn": s[5],
            animation: `ilcTwinkle ${s[6]}s ease-in-out ${s[7]}s infinite`,
          }} />
        ))}
      </div>

      {/* Jump-back card — shown only when this Explore input was reached from a
          saved explored idea (or one of its angles). Pinned to the left gutter,
          heading height; auto-hides on narrow viewports. Whole card returns you
          to that explored idea. Stays Dawn-blue (explore identity) by design. */}
      {sourceIdea && (
        <div
          className="ilc-jumpback"
          onClick={onBackToSource}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBackToSource && onBackToSource(); } }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(96,165,250,0.55)"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 12px 30px -12px rgba(96,165,250,0.7)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(96,165,250,0.28)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 8px 26px -14px rgba(96,165,250,0.5)"; }}
          style={{
            position: "absolute", left: 24, top: 22, width: 220, zIndex: 4, cursor: "pointer",
            background: "linear-gradient(180deg, rgba(96,165,250,0.07), rgba(96,165,250,0.025))",
            border: "1px solid rgba(96,165,250,0.28)", borderRadius: 13,
            padding: "13px 14px 12px",
            boxShadow: "0 8px 26px -14px rgba(96,165,250,0.5)",
            transition: "border-color 0.18s, box-shadow 0.18s, transform 0.18s",
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.18em", color: BLUE, textTransform: "uppercase", marginBottom: 9 }}>
            ↩ you were exploring
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "#cfd6e2", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 11 }}>
            {sourceIdea.text}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, borderTop: "1px solid rgba(96,165,250,0.16)", paddingTop: 10, fontSize: 12, color: BLUE, fontWeight: 500 }}>
            ← Back to this idea
          </div>
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 760, margin: "0 auto", transform: "translateY(-20px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <ModeTitle mode="explore" />
        </div>

        <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
          <h1 style={{ margin: "0 0 12px", fontSize: 29, fontWeight: 600, letterSpacing: "-0.02em", color: t.text }}>
            Discover new angles.
          </h1>
          <span style={{ display: "inline-block", fontFamily: MONO, fontSize: 12, letterSpacing: "0.13em", color: "#7fa9d8", marginBottom: 14 }}>
            No verdict · No pressure
          </span>
          <p style={{ margin: "0 auto", fontSize: 15, lineHeight: 1.6, color: t.sec, maxWidth: 510 }}>
            This is where you re-discover your idea — or find a direction you didn&apos;t know existed.
          </p>
        </div>

        <div style={{ position: "relative", maxWidth: 620, height: 384, margin: "8px auto 0" }}>
          <svg viewBox="0 0 600 384" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden="true">
            {NODES.map((n) => (
              <line key={"l" + n.key} x1="300" y1="192" x2={n.ax} y2={n.ay} stroke="rgba(96,165,250,0.47)" strokeWidth="1" />
            ))}
            {NODES.map((n) => (
              <g key={"d" + n.key}>
                <circle cx={n.ax} cy={n.ay} r="6" fill="rgba(96,165,250,0.16)" />
                <circle cx={n.ax} cy={n.ay} r="2.8" fill={BLUE} />
              </g>
            ))}
          </svg>

          {NODES.map((n) => {
            const N = n.Icon;
            return (
              <div key={n.key} style={{
                position: "absolute", left: n.x + "%", top: n.y + "%", transform: "translate(-50%,-50%)",
                textAlign: "center", zIndex: 2,
              }}>
                <span style={{ color: BLUE, display: "block", marginBottom: 4 }}><N /></span>
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", color: "#aab0ba" }}>{n.label}</span>
              </div>
            );
          })}

          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 330, maxWidth: "84%", zIndex: 3 }}>
            <span style={{ display: "block", fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.1em", color: t.sec, marginBottom: 8 }}>
              Your rough idea
            </span>
            <textarea
              ref={inputRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={3}
              placeholder="Start anywhere — what you're picturing, what's still loose, where you sense it could go…"
              style={{
                width: "100%", boxSizing: "border-box", background: "rgba(13,17,24,0.95)",
                border: "1px solid rgba(96,165,250,0.6)", borderRadius: 12, padding: "13px 15px",
                fontSize: 14, lineHeight: 1.55, color: t.text, resize: "none", outline: "none", fontFamily: "inherit",
                boxShadow: "0 0 0 1px rgba(96,165,250,0.08), 0 8px 26px rgba(0,0,0,0.4)",
              }}
            />
            <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, marginTop: 11 }}>
              {CHIPS.map((c) => (
                <span key={c} style={{
                  fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.03em", color: "#a9c8ec",
                  border: "1px solid rgba(96,165,250,0.4)", borderRadius: 999, padding: "5px 12px",
                  background: "rgba(13,17,24,0.7)",
                }}>{c}</span>
              ))}
            </div>
          </div>
        </div>

        {gateNode}

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 20px", margin: "18px 0 0" }}>
            <p style={{ fontSize: 14, color: "#f87171", margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: 9, marginTop: 18 }}>
          {RAIL.map((r, i) => {
            const R = r.Icon;
            return (
              <span key={r.label} style={{ display: "inline-flex", alignItems: "center" }}>
                {i > 0 && <span style={{ color: "#3a3f47", fontSize: 11, margin: "0 9px 0 0" }}>›</span>}
                <span style={{ color: BLUE, display: "inline-flex", marginRight: 5 }}><R /></span>
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", color: "#7d838d" }}>{r.label}</span>
              </span>
            );
          })}
        </div>

        <div style={{ textAlign: "center", marginTop: 22 }}>
          <button
            onClick={handleRun}
            style={{
              display: "inline-flex", alignItems: "center", fontSize: 13.5, fontWeight: 600,
              padding: "11px 20px", borderRadius: 10, cursor: isAnalyzing ? "default" : "pointer",
              color: "#cfe3ff",
              background: "rgba(96,165,250,0.20)",
              border: "1px solid rgba(96,165,250,0.65)",
              boxShadow: "0 0 0 1px rgba(96,165,250,0.10), 0 4px 18px rgba(96,165,250,0.18)",
              opacity: isAnalyzing ? 0.8 : 1,
            }}
          >
            <span style={{ display: "inline-flex", marginRight: 7 }}><IcSpark /></span>
            {isAnalyzing ? "Exploring…" : "Discover angles →"}
          </button>
          {evalsText && (
            <p style={{ margin: "14px 0 0", fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em", color: t.mut }}>{evalsText}</p>
          )}
        </div>

        <div style={{ marginTop: 28, textAlign: "center", fontFamily: MONO, fontSize: 11, letterSpacing: "0.11em", color: t.mut, opacity: 0.85 }}>
          EXPLORE — WIDENS A ROUGH IDEA · NO SCORE, NO RANK, NO VERDICT
        </div>
      </div>
    </div>
  );
}
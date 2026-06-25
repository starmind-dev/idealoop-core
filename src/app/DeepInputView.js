"use client";

import { useRef, useEffect } from "react";

import { ModeTitle } from "./ModeTitle";

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
// THE FIELD — a canvas "gravity well": the idea sits at the centre of a 3D
// funnel that dips toward a throat. Explore's world is a flat scattered star
// field (divergence); Deep's is a bent surface that pulls inward (convergence).
// Same honest rhyme, opposite operation, and it names no engine part. The 3D
// read is carried entirely by LIGHT — directional opacity on the contour rings
// (far lip lit, near edge in shadow), a grazing rim highlight, a warm lift from
// the throat against a cool dark core. Settings are baked: accretion mode,
// intensity 28 (a quiet bend), slow motes, motion on (prefers-reduced-motion
// auto-falls to static). The idea box is the hero; the field serves it.
//
// Loop continuity: nothing here is a terminus. The line under the creed says the
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
// onBack is accepted for contract parity with Explore; primary nav is owned by
// the DashboardShell rail, so no back button is drawn — the profile chip holds
// the top-right slot per the locked design.
// ============================================

const ACCENT = "#8a82c2"; // Deep's serious indigo-violet — the ◆ and TRACEABLE label
const RULE   = "#6b62b8"; // subtitle left rule
const CTA_BG = "#6a60c0"; // brighter, confident run button
const CTA_BD = "#7d72d0";
const CTA_TX = "#f1eefc";
const BLUE   = "#60a5fa"; // explore-origin provenance
const AMBER  = "#caa15a"; // rough-origin provenance
const MONO   = "ui-monospace, Menlo, monospace";

// ---- the gravity well — a 3D funnel rendered with light only -------------------
function GravityWell() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduce = typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

    const ACC = "138,130,194", ACC_HI = "182,172,228", BG = "10,13,19";
    const I = Math.pow(0.28, 0.85); // baked intensity 28 — the depth of the bend
    let W = 0, H = 0, cx = 0, cy = 0, dpr = 1, t = 0, raf = 0;
    let motes = [], contourR = [];

    function seed() {
      const R = Math.min(W, H), rim = R * 0.6;
      motes = [];
      for (let i = 0; i < 11; i++) {
        const a = Math.random() * 6.283, r = rim * (0.3 + Math.random() * 0.62);
        motes.push({ a, r, sp: 0.18 + Math.random() * 0.25 });
      }
      contourR = [0.60, 0.485, 0.385, 0.295, 0.215, 0.145].map((v) => v * R);
    }
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W * 0.5; cy = H * 0.42; seed();
    }
    function funnel() {
      const R = Math.min(W, H);
      const DEPTH = R * (0.18 + 0.34 * I), r0 = R * 0.22, TILT = 0.52, yshift = DEPTH * 0.56;
      return {
        R, DEPTH,
        project(wx, wy) {
          const r = Math.hypot(wx, wy);
          const dep = DEPTH * (r0 / (r0 + r));
          return [cx + wx, cy + wy * TILT + dep - yshift, dep / DEPTH, r];
        },
      };
    }
    // soft top light so the field reads serious, not sleepy
    function ambient() {
      const R = Math.min(W, H);
      const a = ctx.createRadialGradient(cx, cy - R * 0.3, 0, cx, cy - R * 0.3, Math.max(W, H) * 0.6);
      a.addColorStop(0, `rgba(${ACC},0.04)`); a.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = a; ctx.fillRect(0, 0, W, H);
    }
    // the volume of the bowl — pure shading: warm lift from the depths, a grazing
    // light on the far lip, a cool dark throat. This is what makes it read 3D.
    function sculpt(f, breath) {
      const [tx, ty] = f.project(0, 0), R = f.R;
      let cg = ctx.createRadialGradient(tx, ty, 0, tx, ty, R * 0.42);
      cg.addColorStop(0, `rgba(${ACC_HI},${(0.14 + 0.02 * breath) * I})`);
      cg.addColorStop(0.45, `rgba(${ACC},${0.05 * I})`); cg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
      let lip = ctx.createRadialGradient(cx, ty - f.DEPTH * 0.5, 0, cx, ty - f.DEPTH * 0.5, R * 0.52);
      lip.addColorStop(0, `rgba(${ACC_HI},${0.07 * I})`); lip.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = lip; ctx.fillRect(0, 0, W, H);
      let sh = ctx.createRadialGradient(tx, ty, 0, tx, ty, R * 0.17);
      sh.addColorStop(0, `rgba(2,3,11,${0.88 * I})`); sh.addColorStop(1, "rgba(2,3,11,0)");
      ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(tx, ty, R * 0.17, 0, 6.2832); ctx.fill();
    }
    // contour rings of the funnel — drawn per-segment so the FAR/upper arc catches
    // light and the NEAR/lower arc sinks into shadow. Directional opacity = 3D.
    function contours(f) {
      for (let k = 0; k < contourR.length; k++) {
        const r = contourR[k], outer = k === 0, baseA = (outer ? 0.17 : 0.085) * I;
        let prev = null;
        for (let a = 0; a <= 6.2832 + 0.001; a += 0.16) {
          const p = f.project(Math.cos(a) * r, Math.sin(a) * r);
          if (prev) {
            const lit = (1 - Math.sin(a)) / 2; // far/upper bright → near/lower dark
            ctx.strokeStyle = `rgba(${ACC},${baseA * (0.28 + 1.0 * lit)})`;
            ctx.lineWidth = outer ? 1.2 : 1;
            ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
          }
          prev = p;
        }
      }
      // brightest grazing highlight on the far lip
      const r = contourR[0]; let started = false;
      ctx.beginPath();
      for (let a = Math.PI; a <= 2 * Math.PI; a += 0.1) {
        const [sx, sy] = f.project(Math.cos(a) * r, Math.sin(a) * r);
        if (started) ctx.lineTo(sx, sy); else { ctx.moveTo(sx, sy); started = true; }
      }
      ctx.strokeStyle = `rgba(${ACC_HI},${0.2 * I})`; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // a few quiet motes settled into the well; front of the bowl brighter than back
    function drawMotes(f, moving) {
      const R = f.R, n = Math.round(motes.length * Math.max(0.5, I));
      for (let i = 0; i < n; i++) {
        const p = motes[i];
        if (moving) {
          p.r -= p.sp * (0.25 + 10 / p.r); p.a += 0.0035;
          if (p.r < R * 0.05) { p.r = R * 0.6 * (0.7 + Math.random() * 0.3); p.a = Math.random() * 6.283; }
        }
        const [sx, sy, depthF] = f.project(Math.cos(p.a) * p.r, Math.sin(p.a) * p.r);
        const front = (Math.sin(p.a) + 1) / 2;
        ctx.fillStyle = `rgba(${ACC_HI},${(0.30 + 0.34 * front) * I * (1 - 0.4 * depthF)})`;
        ctx.beginPath(); ctx.arc(sx, sy, 1.1 + front * 0.7, 0, 6.2832); ctx.fill();
      }
    }
    // dissolve the field into the page at the edges — no seam
    function vignette() {
      const v = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.16, cx, cy, Math.max(W, H) * 0.68);
      v.addColorStop(0, `rgba(${BG},0)`); v.addColorStop(1, `rgba(${BG},1)`);
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    }
    function frame() {
      t++;
      if (W && H) {
        const moving = !reduce, breath = moving ? Math.sin(t * 0.02) : 0;
        ctx.clearRect(0, 0, W, H);
        const f = funnel();
        ambient(); sculpt(f, breath); contours(f); drawMotes(f, moving); vignette();
      }
      raf = requestAnimationFrame(frame);
    }

    resize();
    raf = requestAnimationFrame(frame);
    let ro = null;
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(resize); ro.observe(canvas); }
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <canvas ref={ref} aria-hidden="true" style={{
      position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none",
    }} />
  );
}

// ---- provenance strip: lineage of a "take this to Deep" handoff -----------------
function Provenance({ provenance, sourceTitle }) {
  if (provenance !== "explore" && provenance !== "rough") return null;
  const isExplore = provenance === "explore";
  const color = isExplore ? BLUE : AMBER;
  const label = isExplore ? "✦ CONTINUED FROM EXPLORE" : "CONTINUED FROM A ROUGH SEED";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 18,
      background: `${color}14`, border: `1px solid ${color}4d`, borderRadius: 8, padding: "7px 12px",
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
  profile, onEditProfile, provenance = null, sourceTitle = null, sourceIdea = null, onBackToSource,
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
      <style>{`[data-ilc-deep-idea]::placeholder { color: #6a707c; opacity: 1; } @media (max-width: 1024px) { .ilc-jumpback { display: none !important; } }`}</style>

      {/* the gravity well — bent 3D funnel, behind everything, seamless */}
      <GravityWell />

      {/* Jump-back card — shown only when this Deep input was reached from a saved
          explored idea (or one of its angles). Pinned to the left gutter, heading
          height; auto-hides on narrow viewports. Stays Dawn-blue (explore identity)
          even on Deep — it returns you to Explore, the reverse of a hand-off in. */}
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

      {/* Content column — lifted translateY(-20px) to sit on Explore's line, no card. */}
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 760, margin: "0 auto", transform: "translateY(-20px)" }}>

        {/* header: mode mark + profile chip (rail owns back nav) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <ModeTitle mode="deep" />
          {profile && (
            <button
              onClick={onEditProfile}
              style={{
                fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em", color: t.mut,
                border: `1px solid ${t.border}`, borderRadius: 999, padding: "4px 11px",
                background: "rgba(10,13,19,0.5)", cursor: onEditProfile ? "pointer" : "default",
              }}
            >
              {profile.coding} · {profile.ai} AI · Edit ✎
            </button>
          )}
        </div>
        <div style={{ height: 1, background: t.divider || t.border, marginBottom: 18 }} />

        {/* centred intro — provenance · headline · ruled subtitle */}
        <div style={{ textAlign: "center" }}>
          <Provenance provenance={provenance} sourceTitle={sourceTitle} />
          <h1 style={{
            margin: "0 0 12px", fontSize: 30, fontWeight: 500, letterSpacing: "-0.025em",
            color: t.text, textShadow: "0 2px 26px rgba(0,0,0,0.85)",
          }}>
            Put the idea under pressure.
          </h1>
          <p style={{
            display: "inline-block", textAlign: "left", borderLeft: `3px solid ${RULE}`, paddingLeft: 14,
            margin: 0, fontSize: 14, lineHeight: 1.6, color: "#bcbec8", maxWidth: 540,
          }}>
            Same evidence as Explore — a different job: pressure the claims, credit what holds.
          </p>
        </div>

        {/* the idea box — the hero, where the pressure converges */}
        <div style={{ textAlign: "center", margin: "30px 0 24px" }}>
          <span style={{ display: "block", fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: t.sec, marginBottom: 10, textShadow: "0 1px 12px rgba(0,0,0,0.95)" }}>
            THE IDEA — WHERE THE PRESSURE CONVERGES
          </span>
          <textarea
            ref={inputRef}
            data-ilc-deep-idea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={6}
            placeholder="What it does, who it serves, the problem it removes, why now…"
            style={{
              width: "100%", boxSizing: "border-box", background: "rgba(11,14,21,0.96)",
              border: "1px solid rgba(138,130,194,0.58)", borderRadius: 13, padding: "17px 19px",
              fontSize: 14, lineHeight: 1.65, color: t.text, resize: "none", outline: "none",
              fontFamily: "inherit", textAlign: "left",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 8px 26px rgba(0,0,0,0.7), 0 0 0 1px rgba(138,130,194,0.12), 0 0 60px rgba(138,130,194,0.18), 0 26px 60px rgba(0,0,0,0.6)",
            }}
          />
        </div>

        {/* the creed — harsh · fair · traceable — a stamped slab with weight */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "rgba(20,23,32,0.92)",
          border: "1px solid rgba(80,80,96,0.9)", borderRadius: 12, overflow: "hidden", marginBottom: 22,
          boxShadow: "0 18px 40px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}>
          {CREED.map((c, i) => (
            <div key={c.label} style={{
              padding: "16px 17px",
              borderLeft: i === 0 ? "none" : "1px solid rgba(80,80,98,0.95)",
            }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: c.accent ? "#a59ed9" : "#dde0e7", marginBottom: 6 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: "#969ba6" }}>{c.line}</div>
            </div>
          ))}
        </div>

        {/* loop-continuity line — output feeds forward, nothing here is terminal */}
        <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "#828893", textAlign: "center" }}>
          Whatever it finds is where the next loop sharpens — nothing here is the last word.
        </p>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 20px", margin: "0 0 18px" }}>
            <p style={{ fontSize: 14, color: "#f87171", margin: 0 }}>{error}</p>
          </div>
        )}

        {gateNode}

        {/* quiet standards footnote */}
        <p style={{ margin: "0 0 22px", fontFamily: MONO, fontSize: 10, letterSpacing: "0.05em", color: "#4a4e55", textAlign: "center" }}>
          Deep judges the evidence shape, not the underlying phenomenon.
        </p>

        {/* footer: parity doctrine + run */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "#5f646b" }}>
            EXPLORE WIDENS · DEEP PRESSURES · SAME LOOP
          </span>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <button
              onClick={handleRun}
              style={{
                display: "inline-flex", alignItems: "center", fontSize: 14, fontWeight: 600,
                padding: "13px 26px", borderRadius: 10, cursor: isAnalyzing ? "default" : "pointer",
                color: CTA_TX, background: CTA_BG, border: `1px solid ${CTA_BD}`,
                boxShadow: "0 10px 26px rgba(92,82,166,0.4), 0 0 24px rgba(138,130,194,0.25), inset 0 1px 0 rgba(255,255,255,0.12)",
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
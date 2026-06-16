"use client";

// CognitiveLoop.js — the figure-8 "cognitive loop" mark for the Overview.
//
// A slim, woven infinity ribbon that is permanently "drawing itself": a small
// gap travels endlessly around the loop, starting at Explore and moving in the
// product's cognitive order —
//   Explore → Re-evaluate → Branch out → Compare → Re-evaluate → Deep analysis → (back to Explore)
//
// The band carries the palette as a left→right gradient (modes on the left lobe,
// verbs on the right, the re-evaluate hinge at the centre crossover), weaves
// over/under at that crossover, and seats the five stations as nodes on the band.
//
// DISPLAY-ONLY. No data, no score. Pure geometry + one rAF that moves the gap.
//
// Conventions: inline-SVG icons (no webfont — that is what rendered as broken
// squares in the prototype). The animation lives in a useEffect with a real
// cancelAnimationFrame cleanup and a prefers-reduced-motion guard (the gap then
// rests, open at Explore). Station colours: modes carry MODE_COLOR (blue/teal,
// same as HubView); the three verbs take a cognitive-fit colour — green for the
// renewal/refresh of Re-evaluate, indigo for the weighing of Compare, coral for
// the generative divergence of Branch out. Amber (score band) and purple (CTA)
// are deliberately avoided.
//
// Props:
//   t        — theme token bag (used only for a sensible default surface)
//   bg       — the colour of the surface the loop sits on; the woven gap and the
//              travelling gap are "cut" in this colour, so it MUST match the panel
//              behind the loop (defaults to t.surface)
//   maxWidth — cap on the rendered width (default 520)

import { useEffect, useId, useMemo, useRef } from "react";

// ── geometry (Gerono figure-eight) ──────────────────────────────────────────
const VB_W = 760, VB_H = 380;
const A = 290, B = 110, CX = 380, CY = 180, TAU = Math.PI * 2;
const CENTER2 = (3 * Math.PI) / 2; // the second centre crossing — the over-strand
const EXPLORE_XY = [175, 70];      // the gap opens here

const P = (t) => [CX + A * Math.cos(t), CY + B * Math.sin(2 * t)];

function buildFull(n = 240) {
  let d = "";
  for (let i = 0; i < n; i++) {
    const [x, y] = P((i / n) * TAU);
    d += (i ? " L" : "M") + x.toFixed(2) + " " + y.toFixed(2);
  }
  return d + " Z";
}
function buildOver(steps = 46) {
  const t0 = CENTER2 - 0.55, t1 = CENTER2 + 0.55;
  let d = "";
  for (let k = 0; k <= steps; k++) {
    const [x, y] = P(t0 + (t1 - t0) * (k / steps));
    d += (k ? " L" : "M") + x.toFixed(2) + " " + y.toFixed(2);
  }
  return d;
}

// ── inline icons (stroke style, matches HubView) ─────────────────────────────
const iconProps = (color, size) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
  "aria-hidden": true,
});
function Telescope({ color, size = 16 }) {
  return (
    <svg {...iconProps(color, size)}>
      <path d="M4 14.5l10.5-4" />
      <path d="M14.2 10.2l2.8 1a1.6 1.6 0 0 0 2-1l.4-1.1a1.6 1.6 0 0 0-1-2l-2.4-.9" />
      <path d="M5.5 14.8L7.6 19" /><path d="M11 12.8l1.9 3.9" />
    </svg>
  );
}
function Microscope({ color, size = 15 }) {
  return (
    <svg {...iconProps(color, size)}>
      <path d="M6 19h8" /><path d="M9 19v-2.5" />
      <path d="M9 16.5a4.5 4.5 0 0 0 4.2-6.2" />
      <path d="M11.7 9.2l3.1 1.8" />
      <path d="M13.2 6.6l3.1 1.8-1.5 2.6-3.1-1.8z" />
    </svg>
  );
}
function Refresh({ color, size = 15 }) {
  return (
    <svg {...iconProps(color, size)}>
      <path d="M3.5 12a8.5 8.5 0 0 1 14.2-6.3L20.5 8" /><path d="M20.5 3.5V8h-4.5" />
      <path d="M20.5 12a8.5 8.5 0 0 1-14.2 6.3L3.5 16" /><path d="M3.5 20.5V16H8" />
    </svg>
  );
}
function ArrowsLR({ color, size = 15 }) {
  return (
    <svg {...iconProps(color, size)}>
      <path d="M4 9h13" /><path d="M14 6l3 3-3 3" />
      <path d="M20 15H7" /><path d="M10 12l-3 3 3 3" />
    </svg>
  );
}
function GitBranch({ color, size = 15 }) {
  return (
    <svg {...iconProps(color, size)}>
      <circle cx="7" cy="6" r="2.1" /><circle cx="7" cy="18" r="2.1" /><circle cx="17" cy="8" r="2.1" />
      <path d="M7 8.1v7.8" /><path d="M16.6 9.7c-.7 3.6-3.8 4.2-6.4 4.2" />
    </svg>
  );
}

// ── stations ─────────────────────────────────────────────────────────────────
const STATIONS = [
  { key: "explore", color: "#60a5fa", left: "23%", top: "18.4%", label: "Explore", Icon: Telescope, iconSize: 16 },
  { key: "deep", color: "#2dd4bf", left: "23%", top: "76.3%", label: "Deep analysis", Icon: Microscope, iconSize: 16 },
  { key: "reeval", color: "#34d399", left: "50%", top: "47.4%", label: "Re-evaluate", Icon: Refresh, iconSize: 15 },
  { key: "compare", color: "#818cf8", left: "77%", top: "18.4%", label: "Compare", Icon: ArrowsLR, iconSize: 15 },
  { key: "branch", color: "#fb7185", left: "77%", top: "76.3%", label: "Branch out", Icon: GitBranch, iconSize: 15 },
];

export default function CognitiveLoop({ t, bg, maxWidth = 520 }) {
  const surface = bg || (t && t.surface) || "#0e1117";
  const uid = useId().replace(/:/g, "");
  const gradId = `clg-${uid}`, glossId = `cls-${uid}`;

  const dFull = useMemo(() => buildFull(), []);
  const dOver = useMemo(() => buildOver(), []);
  const ribbonRef = useRef(null);
  const gapRef = useRef(null);

  useEffect(() => {
    const ribbon = ribbonRef.current, gap = gapRef.current;
    if (!ribbon || !gap || typeof ribbon.getTotalLength !== "function") return;

    const L = ribbon.getTotalLength();
    const gapLen = 0.09 * L;
    gap.setAttribute("stroke-dasharray", `${gapLen.toFixed(1)} ${(L - gapLen).toFixed(1)}`);

    // arc-length of the Explore station, so the opening starts there
    let sExp = 0, best = Infinity;
    for (let s = 0; s < L; s += L / 720) {
      const p = ribbon.getPointAtLength(s);
      const dd = (p.x - EXPLORE_XY[0]) ** 2 + (p.y - EXPLORE_XY[1]) ** 2;
      if (dd < best) { best = dd; sExp = s; }
    }
    const phase = gapLen / 2 - sExp;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { gap.style.strokeDashoffset = String(phase); return; }

    const LAP = 9000; // ms per lap — constant, linear
    let raf = 0, startedAt = null;
    const frame = (now) => {
      if (startedAt === null) startedAt = now;
      const raw = ((now - startedAt) / LAP) * L;
      // increasing offset moves the gap in decreasing-t = the cognitive order
      gap.style.strokeDashoffset = String(raw + phase);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [dFull, dOver]);

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: `${VB_W} / ${VB_H}`, maxWidth, margin: "0 auto" }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0, display: "block" }} aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="90" y1="180" x2="670" y2="180">
            <stop offset="0" stopColor="#60a5fa" />
            <stop offset="0.27" stopColor="#2dd4bf" />
            <stop offset="0.5" stopColor="#34d399" />
            <stop offset="0.73" stopColor="#818cf8" />
            <stop offset="1" stopColor="#fb7185" />
          </linearGradient>
          <linearGradient id={glossId} gradientUnits="userSpaceOnUse" x1="380" y1="60" x2="380" y2="300">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.16" />
          </linearGradient>
        </defs>

        {/* full ribbon + gloss */}
        <path ref={ribbonRef} d={dFull} fill="none" stroke={`url(#${gradId})`} strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
        <path d={dFull} fill="none" stroke={`url(#${glossId})`} strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />

        {/* weave: knock a gap into the under-strand, then redraw the over-arc on top */}
        <path d={dOver} fill="none" stroke={surface} strokeWidth="21" strokeLinecap="round" strokeLinejoin="round" />
        <path d={dOver} fill="none" stroke={`url(#${gradId})`} strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
        <path d={dOver} fill="none" stroke={`url(#${glossId})`} strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />

        {/* the travelling opening (bg-coloured, animated via stroke-dashoffset) */}
        <path ref={gapRef} d={dFull} fill="none" stroke={surface} strokeWidth="18" strokeLinecap="round" />
      </svg>

      {STATIONS.map(({ key, color, left, top, label, Icon, iconSize }) => (
        <div key={key} style={{ position: "absolute", left, top, transform: "translate(-50%,-50%)", width: 40, height: 40 }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: "50%", border: `1.5px solid ${color}`,
              background: surface, display: "flex", alignItems: "center", justifyContent: "center",
              color, boxShadow: `0 2px 8px rgba(0,0,0,0.5), 0 0 10px ${color}4d`,
            }}
          >
            <Icon color={color} size={iconSize} />
          </div>
          <span style={{ position: "absolute", top: 47, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: 11.5, fontWeight: 500, color }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
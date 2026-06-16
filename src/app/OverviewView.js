"use client";

// OverviewView.js — the Overview screen content (the "front door").
//
// Lives INSIDE DashboardShell (the shell owns the rail + the email/log-out top
// bar; this file owns only the centre column). Three beats:
//   1. the framing question — "Start with how you want to think"
//   2. the two entry modes — Explore (widen) and Deep analysis (decide)
//   3. the loop panel — what happens to an idea after either mode: it never
//      dead-ends, it re-enters the loop (re-evaluate / compare / branch).
//
// The two modes are the ONLY global entry points. The three loop verbs are
// contextual operations on an existing idea — they are shown here as the shape
// of the system, never as buttons you press from a blank slate. That is why the
// loop is illustrative (the CognitiveLoop mark), not a row of CTAs.
//
// Props:
//   t              — theme token bag
//   onStartExplore — fn(): begin an Explore session
//   onStartDeep    — fn(): begin a Deep analysis session

import { useState } from "react";
import CognitiveLoop from "./CognitiveLoop";

const iconProps = (color, size) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
  "aria-hidden": true,
});
function Telescope({ color, size = 22 }) {
  return (
    <svg {...iconProps(color, size)}>
      <path d="M4 14.5l10.5-4" />
      <path d="M14.2 10.2l2.8 1a1.6 1.6 0 0 0 2-1l.4-1.1a1.6 1.6 0 0 0-1-2l-2.4-.9" />
      <path d="M5.5 14.8L7.6 19" /><path d="M11 12.8l1.9 3.9" />
    </svg>
  );
}
function Microscope({ color, size = 22 }) {
  return (
    <svg {...iconProps(color, size)}>
      <path d="M6 19h8" /><path d="M9 19v-2.5" />
      <path d="M9 16.5a4.5 4.5 0 0 0 4.2-6.2" />
      <path d="M11.7 9.2l3.1 1.8" />
      <path d="M13.2 6.6l3.1 1.8-1.5 2.6-3.1-1.8z" />
    </svg>
  );
}

function ModeCard({ t, color, Icon, title, body, cta, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick && onClick(); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, minWidth: 260, boxSizing: "border-box",
        background: t.surface,
        border: `1px solid ${hover ? color : t.border}`,
        borderRadius: 16, padding: "26px 26px 22px",
        cursor: "pointer", transition: "border-color 0.15s, transform 0.12s, box-shadow 0.15s",
        transform: hover ? "translateY(-2px)" : "none",
        boxShadow: hover ? `0 10px 30px rgba(0,0,0,0.35), 0 0 0 1px ${color}33` : "none",
        display: "flex", flexDirection: "column",
      }}
    >
      <div
        style={{
          width: 46, height: 46, borderRadius: 12, marginBottom: 18,
          background: `${color}1A`, border: `1px solid ${color}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Icon color={color} />
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: t.text }}>{title}</h3>
      <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.6, color: t.sec, flex: 1 }}>{body}</p>
      <span style={{ fontSize: 14, fontWeight: 600, color }}>{cta}</span>
    </div>
  );
}

export default function OverviewView({ t, onStartExplore, onStartDeep }) {
  return (
    <div style={{ width: "100%", maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 10px", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: t.text }}>
        Start with how you want to think
      </h1>
      <p style={{ margin: "0 0 32px", fontSize: 15, lineHeight: 1.6, color: t.sec }}>
        Two lenses on the same idea — widen it, or decide on it.
      </p>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 40 }}>
        <ModeCard
          t={t} color="#60a5fa" Icon={Telescope} title="Explore"
          body="Think an idea wide. Surface angles and branch freely — no verdict, no pressure."
          cta="Start exploring →" onClick={onStartExplore}
        />
        <ModeCard
          t={t} color="#2dd4bf" Icon={Microscope} title="Deep analysis"
          body="Take an idea to the verdict — scores, risks, and an execution brief."
          cta="Start deep analysis →" onClick={onStartDeep}
        />
      </div>

      <section
        style={{
          background: t.surface, border: `1px solid ${t.border}`,
          borderRadius: 18, padding: "30px 30px 18px",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: t.text }}>
          Then it enters the loop
        </h2>
        <p style={{ margin: "0 auto", maxWidth: 620, fontSize: 14, lineHeight: 1.65, color: t.sec }}>
          An explored or deep idea never dead-ends. You re-evaluate it, compare it, and branch it —
          straight from the idea, anytime.
        </p>
        <div style={{ paddingTop: 14 }}>
          <CognitiveLoop t={t} bg={t.surface} maxWidth={540} />
        </div>
      </section>
    </div>
  );
}
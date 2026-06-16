"use client";

// OverviewView.js — the Overview screen content (the "front door").
//
// Lives INSIDE DashboardShell (the shell owns the rail + the email/log-out top
// bar; this file owns only the centre column). Beats:
//   1. the framing question — "Start with how you want to think"
//   2. the two entry modes — Explore (widen) and Deep analysis (decide)
//   3. the bare cognitive-loop mark (display-only; no card, no prose — the mark
//      carries the loop story on its own)
//   4. a quiet PRESENCE layer (E3 editorial): a left contents column (Continue
//      where you left off + a Browse index) beside a wide Recent-activity list.
//
// The two modes are the ONLY global entry points. The presence layer is ambient
// context — it self-fetches GET /api/ideas (the same hub payload), renders the
// resume target / recents / counts, and every row is a door into an idea or the
// hub. It hides entirely when the user has no ideas (or isn't signed in), so a
// brand-new front door is just question + modes + loop.
//
// "Continue where you left off" = the family last opened (the iv_last_idea
// marker), resolved to its authoritative /api/ideas card; falls back to the
// newest idea when there's no marker or it points outside the one-card-per-
// family list.
//
// Props:
//   t              — theme token bag
//   onStartExplore — fn(): begin an Explore session
//   onStartDeep    — fn(): begin a Deep analysis session
//   onContinue     — fn(id): resume an idea (wired to loadSavedIdea)
//   onOpenIdea     — fn(id): open a recent idea (wired to loadSavedIdea)
//   onViewAll      — fn(): go to the My Ideas hub

import { useState, useEffect, useCallback } from "react";
import CognitiveLoop from "./CognitiveLoop";
import { getLastIdea, getScoreColor } from "./components";
import { supabase } from "../lib/supabase";

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
function Pencil({ color, size = 15 }) {
  return (
    <svg {...iconProps(color, size)}>
      <path d="M5 19l3.3-.9L18.4 8a1.7 1.7 0 0 0 0-2.4l-.6-.6a1.7 1.7 0 0 0-2.4 0L5.3 15.2z" />
      <path d="M13.7 6.6l3 3" />
    </svg>
  );
}
function StackIcon({ color, size = 15 }) {
  return (
    <svg {...iconProps(color, size)}>
      <path d="M12 3.5l8.5 4.2-8.5 4.2-8.5-4.2 8.5-4.2z" />
      <path d="M3.5 12l8.5 4.2 8.5-4.2" /><path d="M3.5 16l8.5 4.2 8.5-4.2" />
    </svg>
  );
}
function CheckCircle({ color, size = 15 }) {
  return (
    <svg {...iconProps(color, size)}>
      <circle cx="12" cy="12" r="9" /><path d="M8.5 12.2l2.3 2.3 4.7-4.7" />
    </svg>
  );
}

// ── presence helpers ─────────────────────────────────────────────────────────
const MODE_LABEL = { explore: "Explore", deep: "Deep analysis", rough: "Rough" };

// Matches HubView's ModeStamp backgrounds exactly so stamps read identically on
// both surfaces.
function scoreBg(s) {
  if (s >= 8) return "rgba(16,185,129,0.15)";
  if (s >= 6) return "rgba(59,130,246,0.15)";
  if (s >= 4) return "rgba(245,158,11,0.15)";
  return "rgba(239,68,68,0.15)";
}

// Postgres NUMERIC scores can arrive as strings — coerce before .toFixed (the
// known white-screen trap), and degrade a score-less deep card to a neutral mark.
function Stamp({ mode, score, size = 32 }) {
  const n = Number(score);
  const hasScore = Number.isFinite(n) && n > 0;
  const base = { width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" };
  if (mode === "deep" && hasScore) {
    const c = getScoreColor(n);
    return (
      <div style={{ ...base, border: `2px solid ${c}`, background: scoreBg(n) }}>
        <span style={{ fontSize: size * 0.34, fontWeight: 700, fontFamily: "monospace", color: c }}>{n.toFixed(1)}</span>
      </div>
    );
  }
  if (mode === "explore") {
    return <div style={{ ...base, border: "2px solid #60a5fa", background: "rgba(96,165,250,0.1)" }}><Telescope color="#60a5fa" size={size * 0.45} /></div>;
  }
  if (mode === "rough") {
    return <div style={{ ...base, border: "2px solid rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.04)" }}><Pencil color="rgba(255,255,255,0.5)" size={size * 0.42} /></div>;
  }
  return <div style={{ ...base, border: "2px solid #2dd4bf", background: "rgba(45,212,191,0.1)" }}><Microscope color="#2dd4bf" size={size * 0.45} /></div>;
}

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

function byCreatedDesc(a, b) {
  return new Date(b.created_at || 0) - new Date(a.created_at || 0);
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

// ── presence sub-views ───────────────────────────────────────────────────────
function IndexRow({ t, Icon, iconColor, label, count, onClick, last }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 0", cursor: "pointer",
        borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <Icon color={iconColor} />
        <span style={{ fontSize: 13, color: hover ? t.text : t.sec, transition: "color 0.12s" }}>{label}</span>
      </span>
      <span style={{ fontSize: 12, color: t.mut, flexShrink: 0 }}>{count}</span>
    </div>
  );
}

function RecentRow({ t, card, onOpenIdea, last }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={() => onOpenIdea(card.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 2px", cursor: "pointer",
        borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.05)",
        opacity: hover ? 0.85 : 1, transition: "opacity 0.12s",
      }}
    >
      <Stamp mode={card.mode} score={card.score} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.title}</div>
        <div style={{ fontSize: 11, color: t.mut, marginTop: 2 }}>{MODE_LABEL[card.mode] || ""} · {relTime(card.created_at)}</div>
      </div>
    </div>
  );
}

function PresenceLayer({ t, rough, ideas, lastId, onContinue, onOpenIdea, onViewAll }) {
  const all = [...rough, ...ideas];
  const recents = [...all].sort(byCreatedDesc).slice(0, 3);
  let cont = lastId ? all.find((c) => c.id === lastId) : null;
  if (!cont && all.length) cont = [...all].sort(byCreatedDesc)[0];

  const eyebrow = { fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: t.mut };

  return (
    <>
      <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "30px 0 24px" }} />
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
        {/* contents column */}
        <div style={{ flex: 1, minWidth: 190, borderRight: "1px solid rgba(255,255,255,0.07)", paddingRight: 26 }}>
          {cont && (
            <>
              <div style={{ ...eyebrow, marginBottom: 10 }}>Continue</div>
              <div
                onClick={() => onContinue(cont.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, cursor: "pointer" }}
              >
                <Stamp mode={cont.mode} score={cont.score} size={32} />
                <span style={{ fontSize: 13, fontWeight: 500, color: t.text, lineHeight: 1.35 }}>{cont.title}</span>
              </div>
              <div onClick={() => onContinue(cont.id)} style={{ fontSize: 13, fontWeight: 600, color: "#8b5cf6", cursor: "pointer", marginBottom: 22 }}>Continue →</div>
            </>
          )}

          <div style={{ ...eyebrow, marginBottom: 6 }}>Browse</div>
          <IndexRow t={t} Icon={StackIcon} iconColor={t.sec} label="All ideas" count={all.length} onClick={onViewAll} />
          <IndexRow t={t} Icon={CheckCircle} iconColor={t.sec} label="Evaluated ideas" count={ideas.length} onClick={onViewAll} />
          <IndexRow t={t} Icon={Pencil} iconColor="rgba(255,255,255,0.5)" label="Rough captures" count={rough.length} onClick={onViewAll} last />
        </div>

        {/* recents column */}
        <div style={{ flex: 2, minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.sec }}>Recent activity</span>
            <span onClick={onViewAll} style={{ fontSize: 12.5, fontWeight: 600, color: t.link, cursor: "pointer" }}>View all →</span>
          </div>
          {recents.map((c, i) => (
            <RecentRow key={c.id} t={t} card={c} onOpenIdea={onOpenIdea} last={i === recents.length - 1} />
          ))}
        </div>
      </div>
    </>
  );
}

export default function OverviewView({ t, onStartExplore, onStartDeep, onContinue, onOpenIdea, onViewAll }) {
  const [rough, setRough] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [lastId, setLastId] = useState(null);

  const authedFetch = useCallback(async (url) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not signed in.");
    return fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await authedFetch("/api/ideas");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "load failed");
      setRough(d.rough || []);
      setIdeas(d.ideas || []);
    } catch {
      setRough([]); setIdeas([]);
    } finally {
      setLoaded(true);
    }
  }, [authedFetch]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const s = getLastIdea(); setLastId(s && s.id ? s.id : null); }, []);

  const hasIdeas = rough.length + ideas.length > 0;

  return (
    <div style={{ width: "100%", maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 10px", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: t.text }}>
        Start with how you want to think
      </h1>
      <p style={{ margin: "0 0 32px", fontSize: 15, lineHeight: 1.6, color: t.sec }}>
        Two lenses on the same idea — widen it, or decide on it.
      </p>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
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

      {/* the bare cognitive-loop mark — display-only, no card, no prose */}
      <div style={{ padding: "30px 0 6px" }}>
        <CognitiveLoop t={t} bg={t.bg} maxWidth={540} />
      </div>

      {loaded && hasIdeas && (
        <PresenceLayer
          t={t} rough={rough} ideas={ideas} lastId={lastId}
          onContinue={onContinue} onOpenIdea={onOpenIdea} onViewAll={onViewAll}
        />
      )}
    </div>
  );
}

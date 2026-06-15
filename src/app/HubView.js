"use client";

// src/app/HubView.js
// SHELL of the rebuilt My Ideas Hub (this session's model). Self-fetches
// GET /api/ideas -> { folders, rough, ideas } (one card per family, pre-split
// into the two shelves). Mounted behind currentScreen === "hubpreview" so it can
// be seen live without disturbing the current flat hub.
//
// Shelves: Rough ideas / Ideas (a card sits by its face's state — rough is
// quarantined to its own shelf). Folders are a left rail that filters both
// shelves. Cards: mode stamp (pencil / telescope / deep-score-ring), title,
// "N versions" + Lineage when the family has branches. Click a card -> open its
// room (onOpenIdea); Lineage -> the genealogy canvas (onOpenLineage).
//
// SHELL SCOPE: render + create (rough idea, folder) against live endpoints.
// Move-to-folder of existing cards, rename, delete, and rough/explore room
// routing land in the cutover (they need the [id] route rewrites). Deep cards
// open today; rough/explore opening is the deferred [id]-GET fix.

import { useState, useEffect, useCallback } from "react";
import { getScoreColor } from "./components";
import { supabase } from "../lib/supabase";

const MODE_COLOR = { explore: "#60a5fa", deep: "#2dd4bf", rough: "rgba(255,255,255,0.5)" };

function getScoreBg(s) {
  if (s >= 8) return "rgba(16,185,129,0.15)";
  if (s >= 6) return "rgba(59,130,246,0.15)";
  if (s >= 4) return "rgba(245,158,11,0.15)";
  return "rgba(239,68,68,0.15)";
}

function Telescope({ color, size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14.5l10.5-4" /><path d="M14.2 10.2l2.8 1a1.6 1.6 0 0 0 2-1l.4-1.1a1.6 1.6 0 0 0-1-2l-2.4-.9" />
      <path d="M5.5 14.8L7.6 19" /><path d="M11 12.8l1.9 3.9" />
    </svg>
  );
}
function Pencil({ color, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19l3.3-.9L18.4 8a1.7 1.7 0 0 0 0-2.4l-.6-.6a1.7 1.7 0 0 0-2.4 0L5.3 15.2z" /><path d="M13.7 6.6l3 3" />
    </svg>
  );
}

function ModeStamp({ mode, score }) {
  const n = Number(score);
  const s = Number.isFinite(n) ? n : 0;
  if (mode === "deep") {
    const c = getScoreColor(s);
    return (
      <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, border: `2px solid ${c}`, background: getScoreBg(s), display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: c }}>{s.toFixed(1)}</span>
      </div>
    );
  }
  const c = MODE_COLOR[mode];
  return (
    <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, border: `2px solid ${c}`, display: "flex", alignItems: "center", justifyContent: "center", background: mode === "explore" ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.04)" }}>
      {mode === "explore" ? <Telescope color={c} /> : <Pencil color={c} />}
    </div>
  );
}

function pill(t, bg, color, border) {
  return { fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: bg, color, border: `1px solid ${border}`, whiteSpace: "nowrap" };
}

function IdeaCard({ card, t, onOpenIdea, onOpenLineage }) {
  const [hover, setHover] = useState(false);
  const hasFamily = (card.family_size || 1) > 1;
  return (
    <div
      onClick={() => onOpenIdea(card.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: t.surface, border: `1px solid ${hover ? "rgba(255,255,255,0.18)" : t.border}`,
        borderRadius: 12, padding: "13px 15px", cursor: "pointer", transition: "border-color 0.15s, transform 0.1s",
        display: "flex", flexDirection: "column", gap: 9, transform: hover ? "translateY(-1px)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <ModeStamp mode={card.mode} score={card.score} />
        <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: t.text, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {card.title}
        </p>
        {card.has_brief && (
          <span title="Has execution brief" style={{ flexShrink: 0, fontSize: 13, color: "#a78bfa" }}>◆</span>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
        {card.is_main && (card.family_size || 1) > 1 && (
          <span style={pill(t, "rgba(255,255,255,0.12)", "rgba(255,255,255,0.85)", "transparent")}>★ Main</span>
        )}
        {card.branch_reason && (
          <span style={{ ...pill(t, "rgba(255,255,255,0.05)", t.sec, t.border), maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.branch_reason}</span>
        )}
        {hasFamily && (
          <span
            onClick={(e) => { e.stopPropagation(); onOpenLineage(card.id); }}
            style={{ ...pill(t, "rgba(96,165,250,0.12)", "#60a5fa", "rgba(96,165,250,0.25)"), cursor: "pointer", marginLeft: "auto" }}
            title="View the evolution tree"
          >
            ⑂ {card.family_size} versions · Lineage
          </span>
        )}
      </div>
    </div>
  );
}

function AddRough({ t, onCreate }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    await onCreate(v);
    setBusy(false);
    setText("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ fontSize: 13, fontWeight: 600, padding: "7px 14px", borderRadius: 8, border: `1px dashed ${t.border}`, background: "transparent", color: t.sec, cursor: "pointer" }}>
        + Rough idea
      </button>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 12 }}>
      <textarea
        autoFocus value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Jot a raw idea — no mode, no scoring. Just capture it."
        rows={3}
        style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontSize: 13, color: t.text, background: t.surfAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", outline: "none", fontFamily: "inherit" }}
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={() => { setOpen(false); setText(""); }} style={{ fontSize: 12, color: t.mut, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
        <button onClick={submit} disabled={!text.trim() || busy} style={{ fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 8, border: "none", cursor: text.trim() && !busy ? "pointer" : "not-allowed", background: text.trim() && !busy ? "#8b5cf6" : t.surfAlt, color: text.trim() && !busy ? "#fff" : t.mut }}>
          {busy ? "Saving…" : "Save rough idea"}
        </button>
      </div>
    </div>
  );
}

function Shelf({ title, subtitle, cards, t, onOpenIdea, onOpenLineage, addSlot }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: 0 }}>{title} <span style={{ fontSize: 13, fontWeight: 500, color: t.mut }}>· {cards.length}</span></h2>
          {subtitle && <p style={{ fontSize: 12.5, color: t.mut, margin: "4px 0 0" }}>{subtitle}</p>}
        </div>
        {addSlot}
      </div>
      {cards.length === 0 ? (
        <p style={{ fontSize: 13, color: t.mut, padding: "14px 0", margin: 0 }}>Nothing here yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {cards.map((c) => (
            <IdeaCard key={c.id} card={c} t={t} onOpenIdea={onOpenIdea} onOpenLineage={onOpenLineage} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function HubView({ t, onOpenIdea, onOpenLineage, onBack }) {
  const [data, setData] = useState({ folders: [], rough: [], ideas: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [folderId, setFolderId] = useState(null); // null = All
  const [newFolder, setNewFolder] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);

  const authedFetch = useCallback(async (url, opts = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not signed in.");
    return fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${session.access_token}` } });
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await authedFetch("/api/ideas");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load.");
      setData({ folders: d.folders || [], rough: d.rough || [], ideas: d.ideas || [] });
    } catch (e) {
      setError(e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { load(); }, [load]);

  const createRough = async (text) => {
    try {
      await authedFetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_idea_text: text, source: "manual", folder_id: folderId }),
      });
      await load();
    } catch (e) { setError(e.message); }
  };

  const createFolder = async () => {
    const name = newFolder.trim();
    if (!name) return;
    try {
      await authedFetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setNewFolder(""); setAddingFolder(false);
      await load();
    } catch (e) { setError(e.message); }
  };

  const inFolder = (c) => folderId === null ? true : c.folder_id === folderId;
  const rough = data.rough.filter(inFolder);
  const ideas = data.ideas.filter(inFolder);

  const railItem = (id, label, count) => {
    const active = folderId === id;
    return (
      <div
        key={id ?? "all"}
        onClick={() => setFolderId(id)}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
          padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13,
          fontWeight: active ? 600 : 400, color: active ? t.text : t.sec,
          background: active ? t.surfAlt : "transparent",
        }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ fontSize: 11, color: t.mut, flexShrink: 0 }}>{count}</span>
      </div>
    );
  };

  const totalAll = data.rough.length + data.ideas.length;
  const folderCount = (fid) => data.rough.filter((c) => c.folder_id === fid).length + data.ideas.filter((c) => c.folder_id === fid).length;

  return (
    <div style={{ width: "100%", maxWidth: 1160, margin: "0 auto", padding: "0 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: t.text, margin: 0 }}>My Ideas</h1>
          <p style={{ fontSize: 13, color: t.mut, margin: "5px 0 0" }}>Your idea operating system — rough captures on the left shelf, explored &amp; deep on the right.</p>
        </div>
        {onBack && (
          <button onClick={onBack} style={{ fontSize: 13, color: t.sec, background: "none", border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 18px", cursor: "pointer" }}>← Back</button>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 13, color: "#f87171", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 18 }}>{error}</div>
      )}

      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        {/* folder rail */}
        <aside style={{ width: 190, flexShrink: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: t.mut, margin: "0 0 8px 10px" }}>Folders</p>
          {railItem(null, "All ideas", totalAll)}
          {data.folders.map((f) => railItem(f.id, f.name, folderCount(f.id)))}
          {addingFolder ? (
            <div style={{ display: "flex", gap: 6, marginTop: 8, padding: "0 4px" }}>
              <input
                autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") { setAddingFolder(false); setNewFolder(""); } }}
                placeholder="Folder name"
                style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: t.text, background: t.surfAlt, border: `1px solid ${t.border}`, borderRadius: 7, padding: "5px 8px", outline: "none" }}
              />
              <button onClick={createFolder} style={{ fontSize: 12, fontWeight: 600, padding: "0 10px", borderRadius: 7, border: "none", background: "#8b5cf6", color: "#fff", cursor: "pointer" }}>Add</button>
            </div>
          ) : (
            <div onClick={() => setAddingFolder(true)} style={{ fontSize: 12.5, color: t.mut, cursor: "pointer", padding: "8px 10px", marginTop: 2 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = t.sec)} onMouseLeave={(e) => (e.currentTarget.style.color = t.mut)}>
              + New folder
            </div>
          )}
        </aside>

        {/* shelves */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <p style={{ fontSize: 14, color: t.mut, padding: "40px 0" }}>Loading your ideas…</p>
          ) : (
            <>
              <Shelf
                title="Rough ideas" subtitle="Raw captures — not yet explored or evaluated."
                cards={rough} t={t} onOpenIdea={onOpenIdea} onOpenLineage={onOpenLineage}
                addSlot={<AddRough t={t} onCreate={createRough} />}
              />
              <Shelf
                title="Ideas" subtitle="Explored and deep-evaluated — one card per family."
                cards={ideas} t={t} onOpenIdea={onOpenIdea} onOpenLineage={onOpenLineage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
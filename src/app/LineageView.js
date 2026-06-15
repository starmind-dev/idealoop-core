"use client";

// src/app/LineageView.js
// The genealogy canvas. Drop-in replacement: same props as before, but the body
// is now a pannable / zoomable / glow-favorite mind-map instead of the old
// overflow-x flex tree.
//
// DATA: self-fetches the authoritative family from GET /api/ideas/[id]/lineage
// (server resolves species + score). `myIdeas` is still accepted and used for an
// instant optimistic first paint so there's no loading flash; the fetch then
// reconciles to the server's view.
//
// SPECIES (this session's model): deep -> score ring + microscope; explore ->
// telescope, no number; rough -> pencil, no number. Score lives ONLY on deep
// nodes — there is no cross-mode number anywhere on the map.
//
// GESTURES: drag empty space = pan; scroll = zoom (cursor-anchored); click a card
// = open its room (onViewIdea); the star = toggle a glow favorite (non-favorites
// dim when any favorite is lit). Rename / delete are inline; Compare is the same
// 2-node same-shelf select as before. The status dropdown is intentionally gone.

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { getScoreColor } from "./components";
import { supabase } from "../lib/supabase";

// ----------------------------------------------------------------------------
// constants + helpers
// ----------------------------------------------------------------------------
const ROW_H = 152;
const COL_W = 222;
const NODE_W = 202;
const NODE_H = 96;
const OFF_X = 150;
const PAD_TOP = 28;

const MODE_COLOR = {
  explore: "#60a5fa", // telescope blue
  deep: "#2dd4bf",    // microscope teal (accent; the score ring carries the band color)
  rough: "rgba(255,255,255,0.45)",
};

function getScoreBg(s) {
  if (s >= 8) return "rgba(16,185,129,0.15)";
  if (s >= 6) return "rgba(59,130,246,0.15)";
  if (s >= 4) return "rgba(245,158,11,0.15)";
  return "rgba(239,68,68,0.15)";
}

// Optimistic client resolver (server is authoritative). Mirrors the service:
// 0 evals -> rough; explore-tagged -> explore; scored -> deep.
function resolveClientMode(idea) {
  const evals = idea.evaluations || [];
  if (evals.length === 0) return { mode: "rough", score: null };
  const latest = evals[0];
  const m = String(latest.mode || latest.evaluation_mode || "").toLowerCase();
  const raw = latest.weighted_overall_score;
  const hasScore = raw !== null && raw !== undefined && Number(raw) > 0;
  if (m.includes("explore")) return { mode: "explore", score: null };
  if (m === "deep" || hasScore) return { mode: "deep", score: hasScore ? Number(raw) : null };
  return { mode: "explore", score: null };
}

// Build the family node list from the flat myIdeas (optimistic first paint).
function deriveNodesFromMyIdeas(myIdeas, targetIdeaId) {
  if (!myIdeas || !myIdeas.length || !targetIdeaId) return [];
  const byId = {};
  myIdeas.forEach((i) => (byId[i.id] = i));
  if (!byId[targetIdeaId]) return [];

  let cur = byId[targetIdeaId];
  let hops = 0;
  while (cur && cur.parent_idea_id && byId[cur.parent_idea_id] && hops++ < 50) {
    cur = byId[cur.parent_idea_id];
  }
  const rootId = cur.id;

  const fam = [];
  const visit = (id) => {
    const n = byId[id];
    if (!n) return;
    const st = resolveClientMode(n);
    fam.push({
      id: n.id,
      parent_id: n.parent_idea_id || null,
      title: n.title,
      mode: st.mode,
      score: st.score,
      is_root: n.id === rootId,
      is_main: !!n.is_main_version,
      branch_reason: n.branch_reason || null,
    });
    myIdeas.filter((x) => x.parent_idea_id === id).forEach((c) => visit(c.id));
  };
  visit(rootId);
  return fam;
}

// Recursive tidy-tree layout: leaves get sequential columns, parents center over
// their children. Returns a map id -> { cx, top, depth }.
function layoutTree(nodes) {
  const byId = {};
  nodes.forEach((n) => (byId[n.id] = { ...n, kids: [] }));
  let root = null;
  nodes.forEach((n) => {
    if (n.parent_id && byId[n.parent_id]) byId[n.parent_id].kids.push(byId[n.id]);
    else if (!n.parent_id) root = byId[n.id];
  });
  if (!root) root = byId[nodes[0]?.id];

  const pos = {};
  let leaf = 0;
  const walk = (node, depth) => {
    if (!node) return;
    node.kids.sort((a, b) => 0); // preserve incoming order
    if (node.kids.length === 0) {
      pos[node.id] = { cx: leaf * COL_W + OFF_X, top: depth * ROW_H + PAD_TOP, depth };
      leaf++;
    } else {
      node.kids.forEach((k) => walk(k, depth + 1));
      const first = pos[node.kids[0].id].cx;
      const last = pos[node.kids[node.kids.length - 1].id].cx;
      pos[node.id] = { cx: (first + last) / 2, top: depth * ROW_H + PAD_TOP, depth };
    }
  };
  walk(root, 0);

  let maxCx = 0;
  let maxBottom = 0;
  Object.values(pos).forEach((p) => {
    if (p.cx > maxCx) maxCx = p.cx;
    if (p.top + NODE_H > maxBottom) maxBottom = p.top + NODE_H;
  });
  return {
    pos,
    worldW: maxCx + NODE_W / 2 + OFF_X,
    worldH: maxBottom + 60,
    rootId: root ? root.id : null,
  };
}

// ----------------------------------------------------------------------------
// mode marks
// ----------------------------------------------------------------------------
function Telescope({ color, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14.5l10.5-4" />
      <path d="M14.2 10.2l2.8 1a1.6 1.6 0 0 0 2-1l.4-1.1a1.6 1.6 0 0 0-1-2l-2.4-.9" />
      <path d="M5.5 14.8L7.6 19" />
      <path d="M11 12.8l1.9 3.9" />
    </svg>
  );
}
function Microscope({ color, size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 20h11" />
      <path d="M9.5 20a5 5 0 0 0 4-7.5" />
      <path d="M8 6.5l3.2 3.2" />
      <path d="M10.2 4.3l3.2 3.2-1.7 1.7-3.2-3.2z" />
    </svg>
  );
}
function Pencil({ color, size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19l3.3-.9L18.4 8a1.7 1.7 0 0 0 0-2.4l-.6-.6a1.7 1.7 0 0 0-2.4 0L5.3 15.2z" />
      <path d="M13.7 6.6l3 3" />
    </svg>
  );
}

function StarToggle({ active, onClick, t }) {
  return (
    <span
      onClick={onClick}
      title={active ? "Remove favorite" : "Glow as favorite"}
      style={{
        cursor: "pointer", flexShrink: 0, lineHeight: 1, fontSize: 13,
        color: active ? "#fde68a" : "rgba(255,255,255,0.32)",
        transition: "color 0.15s, transform 0.15s",
        transform: active ? "scale(1.12)" : "scale(1)",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.32)"; }}
    >
      {active ? "★" : "☆"}
    </span>
  );
}

// ----------------------------------------------------------------------------
// node card
// ----------------------------------------------------------------------------
function NodeCard({
  node, t, isFavorite, anyFavorite, comparing, isSelected, isLoading,
  onOpen, onToggleFavorite, onToggleSelect, onRename, onDelete, registerRef,
}) {
  const { mode, score } = node;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [editing]);

  const commitRename = () => {
    const v = draft.trim();
    if (v && v !== node.title) onRename(node.id, v);
    setEditing(false);
  };

  const ringColor = mode === "deep" ? getScoreColor(score || 0) : MODE_COLOR[mode];
  const ringBg = mode === "deep" ? getScoreBg(score || 0) : "transparent";

  const dim = anyFavorite && !isFavorite;

  return (
    <div
      ref={registerRef}
      onClick={(e) => {
        e.stopPropagation();
        if (isLoading) return;
        if (comparing) onToggleSelect(node.id);
        else onOpen(node.id);
      }}
      style={{
        position: "absolute",
        left: node.cx - NODE_W / 2,
        top: node.top,
        width: NODE_W,
        height: NODE_H,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 7,
        padding: "11px 13px",
        background: isFavorite ? "#1d1d23" : t.surface,
        border: isSelected
          ? "1px solid rgba(96,165,250,0.7)"
          : isFavorite
          ? "1px solid rgba(255,255,255,0.55)"
          : `1px solid ${t.border}`,
        borderRadius: 13,
        cursor: isLoading ? "default" : "pointer",
        boxShadow: isFavorite
          ? "0 0 0 1px rgba(255,255,255,0.32), 0 0 22px 2px rgba(255,255,255,0.14)"
          : isSelected
          ? "0 0 14px rgba(96,165,250,0.18)"
          : "none",
        opacity: isLoading ? 0.6 : dim ? 0.4 : 1,
        transition: "opacity 0.25s, box-shadow 0.25s, border-color 0.2s, background 0.2s",
        zIndex: isFavorite ? 5 : 1,
      }}
    >
      {isLoading && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 13, zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(10,10,12,0.55)",
        }}>
          <style>{`@keyframes lin-spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{
            width: 18, height: 18, borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#fff",
            animation: "lin-spin 0.6s linear infinite",
          }} />
        </div>
      )}

      {/* top row: stamp + title + controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        {comparing && (
          <div style={{
            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
            border: isSelected ? "2px solid #60a5fa" : `2px solid ${t.border}`,
            background: isSelected ? "rgba(96,165,250,0.2)" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, color: "#60a5fa", fontWeight: 700,
          }}>{isSelected ? "✓" : ""}</div>
        )}

        {/* stamp: deep=ring+score+micro, explore=telescope, rough=pencil */}
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0, position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `2px solid ${ringColor}`, background: ringBg,
        }}>
          {mode === "deep" ? (
            <>
              <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "monospace", color: ringColor }}>
                {(score ?? 0).toFixed(1)}
              </span>
              <span style={{ position: "absolute", right: -4, bottom: -4, background: t.surface, borderRadius: "50%", padding: 1, display: "flex" }}>
                <Microscope color={MODE_COLOR.deep} />
              </span>
            </>
          ) : mode === "explore" ? (
            <Telescope color={MODE_COLOR.explore} />
          ) : (
            <Pencil color={MODE_COLOR.rough} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 3 }}>
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") { setDraft(node.title); setEditing(false); }
              }}
              style={{
                width: "100%", minWidth: 0, fontSize: 12.5, fontWeight: 600, color: t.text,
                background: t.surfAlt, border: "1px solid rgba(96,165,250,0.4)",
                borderRadius: 6, padding: "2px 6px", outline: "none",
              }}
            />
          ) : (
            <p style={{
              margin: 0, flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: t.text,
              lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>{node.title}</p>
          )}
        </div>

        {!comparing && !editing && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <StarToggle active={isFavorite} t={t}
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(node.id); }} />
            <span
              title="Rename"
              onClick={(e) => { e.stopPropagation(); setDraft(node.title); setEditing(true); }}
              style={{ cursor: "pointer", opacity: 0.45, fontSize: 11, transition: "opacity 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.45")}
            >✏️</span>
            {onDelete && (
              <span
                title="Delete (and its branches)"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm("Delete this idea and all branches below it? This cannot be undone.")) onDelete(node.id);
                }}
                style={{ cursor: "pointer", opacity: 0.45, fontSize: 11, transition: "opacity 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.45")}
              >🗑</span>
            )}
          </div>
        )}
      </div>

      {/* tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", overflow: "hidden" }}>
        {node.is_root && (
          <span style={pill("rgba(255,255,255,0.1)", "rgba(255,255,255,0.82)", "rgba(255,255,255,0.18)", true)}>Root</span>
        )}
        {node.is_main && (
          <span style={pill("rgba(255,255,255,0.14)", "rgba(255,255,255,0.88)", "transparent")}>★ Main</span>
        )}
        {node.branch_reason && (
          <span style={{ ...pill("rgba(255,255,255,0.05)", t.sec, t.border), maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.branch_reason}
          </span>
        )}
      </div>
    </div>
  );
}

function pill(bg, color, border, upper) {
  return {
    fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 6,
    background: bg, color, border: `1px solid ${border}`, whiteSpace: "nowrap",
    textTransform: upper ? "uppercase" : "none", letterSpacing: upper ? "0.04em" : 0,
  };
}

// ----------------------------------------------------------------------------
// main
// ----------------------------------------------------------------------------
export default function LineageView({
  myIdeas, targetIdeaId, t, onBack, onViewIdea, onStartComparison,
  onUpdateIdea, onDelete, loadingIdeaId,
}) {
  const [nodes, setNodes] = useState(() => deriveNodesFromMyIdeas(myIdeas, targetIdeaId));
  const [favorites, setFavorites] = useState(() => new Set());
  const [comparing, setComparing] = useState(false);
  const [selected, setSelected] = useState([]);

  const vpRef = useRef(null);
  const worldRef = useRef(null);
  const view = useRef({ k: 0.62, panX: 0, panY: 0 });
  const drag = useRef({ on: false, moved: false, x: 0, y: 0 });

  // optimistic first paint, then reconcile with the authoritative server family
  useEffect(() => {
    setNodes(deriveNodesFromMyIdeas(myIdeas, targetIdeaId));
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !targetIdeaId) return;
        const res = await fetch(`/api/ideas/${targetIdeaId}/lineage`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data && Array.isArray(data.nodes)) setNodes(data.nodes);
      } catch { /* keep optimistic paint */ }
    })();
    return () => { cancelled = true; };
  }, [targetIdeaId, myIdeas]);

  const { pos, worldW, worldH } = useMemo(() => layoutTree(nodes), [nodes]);

  const applyTransform = useCallback(() => {
    const v = view.current;
    if (worldRef.current) worldRef.current.style.transform = `translate(${v.panX}px, ${v.panY}px) scale(${v.k})`;
    if (vpRef.current) {
      vpRef.current.style.backgroundPosition = `${v.panX}px ${v.panY}px`;
      vpRef.current.style.backgroundSize = `${22 * v.k}px ${22 * v.k}px`;
    }
  }, []);

  const fit = useCallback(() => {
    const vp = vpRef.current;
    if (!vp || !worldW) return;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    const k = Math.max(0.34, Math.min(0.85, Math.min((vw - 60) / worldW, (vh - 60) / worldH)));
    view.current = { k, panX: (vw - worldW * k) / 2, panY: 24 };
    applyTransform();
  }, [worldW, worldH, applyTransform]);

  useLayoutEffect(() => { fit(); }, [fit]);

  // wheel zoom (cursor-anchored) — native listener so we can preventDefault
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const v = view.current, ok = v.k;
      // Magnitude-aware, dampened zoom. A trackpad fires many wheel events per
      // gesture, so a fixed per-event factor compounds and snaps to the extremes.
      // Scale by the (normalized, clamped) deltaY so one gesture moves smoothly
      // and no single event can jump more than ~10%.
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;                    // line mode -> ~pixels
      else if (e.deltaMode === 2) dy *= vp.clientHeight;  // page mode (rare)
      dy = Math.max(-50, Math.min(50, dy));
      const k = Math.max(0.25, Math.min(2.4, ok * Math.exp(-dy * 0.0038)));
      view.current = { k, panX: mx - (mx - v.panX) * (k / ok), panY: my - (my - v.panY) * (k / ok) };
      applyTransform();
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [applyTransform]);

  // pan
  useEffect(() => {
    const onMove = (e) => {
      if (!drag.current.on) return;
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
      view.current.panX += dx; view.current.panY += dy;
      drag.current.x = e.clientX; drag.current.y = e.clientY;
      applyTransform();
    };
    const onUp = () => {
      drag.current.on = false;
      if (vpRef.current) vpRef.current.style.cursor = "grab";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [applyTransform]);

  const startPan = (e) => {
    drag.current = { on: true, moved: false, x: e.clientX, y: e.clientY };
    if (vpRef.current) vpRef.current.style.cursor = "grabbing";
  };

  const zoomBtn = (factor) => {
    const vp = vpRef.current; if (!vp) return;
    const mx = vp.clientWidth / 2, my = vp.clientHeight / 2;
    const v = view.current, ok = v.k;
    const k = Math.max(0.25, Math.min(2.4, v.k * factor));
    view.current = { k, panX: mx - (mx - v.panX) * (k / ok), panY: my - (my - v.panY) * (k / ok) };
    applyTransform();
  };

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const i = prev.findIndex((s) => s.ideaId === id);
      if (i !== -1) return prev.filter((_, j) => j !== i);
      if (prev.length >= 2) return prev;
      return [...prev, { ideaId: id, evaluationId: null }];
    });
  };

  // connectors (exact: fixed NODE_H means parent bottom = top + NODE_H)
  const edges = useMemo(() => {
    const paths = [];
    nodes.forEach((n) => {
      if (!n.parent_id || !pos[n.id] || !pos[n.parent_id]) return;
      const p = pos[n.parent_id], c = pos[n.id];
      const x1 = p.cx, y1 = p.top + NODE_H, x2 = c.cx, y2 = c.top, my = (y1 + y2) / 2;
      paths.push(`M${x1} ${y1} C${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`);
    });
    return paths;
  }, [nodes, pos]);

  const anyFavorite = favorites.size > 0;
  const nodeCount = nodes.length;

  if (!nodes.length) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: t.mut }}>Loading lineage…</p>
        <button onClick={onBack} style={backBtn(t)}>← Back to Idea Hub</button>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 1200, margin: "0 auto", padding: "0 20px" }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>Idea Evolution Tree</h2>
          <p style={{ fontSize: 13, color: t.mut, margin: "6px 0 0" }}>
            {nodeCount} version{nodeCount !== 1 ? "s" : ""} · drag to pan · scroll to zoom · ☆ to glow a favorite
          </p>
        </div>
        <button onClick={onBack} style={backBtn(t)}>← Back to Idea Hub</button>
      </div>

      {/* canvas */}
      <div
        ref={vpRef}
        onMouseDown={startPan}
        style={{
          position: "relative", height: 540, overflow: "hidden",
          border: `1px solid ${t.border}`, borderRadius: 14, cursor: "grab",
          backgroundColor: "#09090b",
          backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          userSelect: "none",
        }}
      >
        <div ref={worldRef} style={{ position: "absolute", top: 0, left: 0, transformOrigin: "0 0", width: worldW, height: worldH }}>
          <svg width={worldW} height={worldH} style={{ position: "absolute", top: 0, left: 0, overflow: "visible", pointerEvents: "none" }}>
            {edges.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" />
            ))}
          </svg>

          {nodes.map((n) => pos[n.id] ? (
            <NodeCard
              key={n.id}
              node={{ ...n, cx: pos[n.id].cx, top: pos[n.id].top }}
              t={t}
              isFavorite={favorites.has(n.id)}
              anyFavorite={anyFavorite}
              comparing={comparing}
              isSelected={selected.some((s) => s.ideaId === n.id)}
              isLoading={n.id === loadingIdeaId}
              onOpen={onViewIdea}
              onToggleFavorite={toggleFavorite}
              onToggleSelect={toggleSelect}
              onRename={(id, title) => onUpdateIdea(id, { title })}
              onDelete={onDelete}
              registerRef={() => {}}
            />
          ) : null)}
        </div>

        {/* controls */}
        <div style={{ position: "absolute", left: 14, bottom: 14, display: "flex", gap: 6 }}>
          <CtrlBtn t={t} label="−" onClick={() => zoomBtn(0.83)} />
          <CtrlBtn t={t} label="+" onClick={() => zoomBtn(1.2)} />
          <CtrlBtn t={t} label="⊡" onClick={() => { setFavorites(new Set()); fit(); }} title="Fit & clear glow" />
        </div>
      </div>

      {/* compare bar */}
      {nodeCount >= 2 && (
        <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
            {!comparing ? (
              <button onClick={() => setComparing(true)} style={{ fontSize: 13, fontWeight: 600, padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}>
                Compare
              </button>
            ) : (
              <>
                <span style={{ fontSize: 13, color: t.sec }}>
                  {selected.length === 0 ? "Select 2 nodes to compare" : selected.length === 1 ? "Select 1 more" : "2 selected"}
                </span>
                <button
                  onClick={() => selected.length === 2 && onStartComparison(selected)}
                  disabled={selected.length !== 2}
                  style={{ fontSize: 13, fontWeight: 600, padding: "8px 20px", borderRadius: 8, border: "none", cursor: selected.length === 2 ? "pointer" : "not-allowed", background: selected.length === 2 ? "#60a5fa" : t.surfAlt, color: selected.length === 2 ? "#fff" : t.mut }}>
                  Compare Selected
                </button>
                <button onClick={() => { setComparing(false); setSelected([]); }} style={{ fontSize: 12, color: t.mut, background: "none", border: "none", cursor: "pointer" }}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CtrlBtn({ label, onClick, title, t }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(20,20,24,0.9)", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 8, color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 17, padding: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(40,40,46,0.95)"; e.currentTarget.style.color = "#fff"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(20,20,24,0.9)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
    >{label}</button>
  );
}

function backBtn(t) {
  return {
    fontSize: 13, color: t.sec, background: "none", border: `1px solid ${t.border}`,
    borderRadius: 8, padding: "8px 20px", cursor: "pointer", flexShrink: 0,
  };
}
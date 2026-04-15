"use client";

import { useState, useRef, useEffect } from "react";
import { getScoreColor } from "./components";

// ============================================
// HELPERS
// ============================================

// getScoreColor imported from ./components

function getScoreBg(s) {
  if (s >= 8) return "rgba(16,185,129,0.15)";
  if (s >= 6) return "rgba(59,130,246,0.15)";
  if (s >= 4) return "rgba(245,158,11,0.15)";
  return "rgba(239,68,68,0.15)";
}

const STATUS_CONFIG = {
  exploring: { label: "Exploring", color: "#60a5fa", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.25)" },
  lead:      { label: "Lead",      color: "#34d399", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)" },
  parked:    { label: "Parked",    color: t.sec, bg: "rgba(115,115,115,0.12)", border: "rgba(115,115,115,0.25)" },
  killed:    { label: "Killed",    color: "#f87171", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)" },
};
const STATUS_OPTIONS = ["exploring", "lead", "parked", "killed"];

// Walk parent_idea_id chain to find root
function findRoot(ideaId, ideasMap) {
  let current = ideasMap[ideaId];
  if (!current) return ideaId;
  let safety = 20;
  while (current.parent_idea_id && ideasMap[current.parent_idea_id] && safety-- > 0) {
    current = ideasMap[current.parent_idea_id];
  }
  return current.id;
}

// Build nested tree from flat list
function buildTree(ideas, rootId) {
  const childrenOf = {};
  ideas.forEach((idea) => {
    const pid = idea.parent_idea_id || null;
    if (!childrenOf[pid]) childrenOf[pid] = [];
    childrenOf[pid].push(idea);
  });

  function buildNode(id) {
    const idea = ideas.find((i) => i.id === id);
    if (!idea) return null;
    const kids = (childrenOf[id] || [])
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return {
      idea,
      children: kids.map((k) => buildNode(k.id)).filter(Boolean),
    };
  }

  return buildNode(rootId);
}

// ============================================
// STATUS DROPDOWN
// ============================================
function StatusDropdown({ currentStatus, onSelect, onClose, t }) {
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        marginTop: 4,
        background: t.modalBg,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        padding: 4,
        zIndex: 20,
        minWidth: 120,
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      {STATUS_OPTIONS.map((key) => {
        const cfg = STATUS_CONFIG[key];
        const isActive = key === currentStatus;
        return (
          <div
            key={key}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(key);
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? cfg.color : t.sec,
              background: isActive ? cfg.bg : "transparent",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = t.surfAlt; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
          >
            {cfg.label}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// NODE CARD
// ============================================
function NodeCard({ idea, isRoot, isSelected, comparing, onToggleSelect, onClickNode, onUpdateIdea, isLoading, t }) {
  const evals = idea.evaluations || [];
  const latestEval = evals.length > 0 ? evals[0] : null; // sorted desc by list route
  const score = latestEval?.weighted_overall_score || 0;
  const color = getScoreColor(score);
  const bg = getScoreBg(score);

  const [statusOpen, setStatusOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(idea.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleRename = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== idea.title) {
      onUpdateIdea(idea.id, { title: trimmed });
    }
    setEditing(false);
  };

  const handleStatusChange = (newStatus) => {
    if (newStatus !== (idea.status_label || "exploring")) {
      onUpdateIdea(idea.id, { status_label: newStatus });
    }
    setStatusOpen(false);
  };

  const statusKey = idea.status_label || "exploring";
  const statusCfg = STATUS_CONFIG[statusKey];

  return (
    <div
      style={{
        background: t.surface,
        border: isLoading
          ? "1px solid rgba(234,179,8,0.6)"
          : isSelected
          ? "1px solid rgba(59,130,246,0.6)"
          : `1px solid ${t.border}`,
        borderRadius: 12,
        padding: "12px 16px",
        minWidth: 160,
        maxWidth: 220,
        cursor: isLoading ? "default" : "pointer",
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: isLoading
          ? "0 0 16px rgba(234,179,8,0.2)"
          : isSelected ? "0 0 12px rgba(59,130,246,0.15)" : "none",
        position: "relative",
        opacity: isLoading ? 0.7 : 1,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!isLoading) onClickNode(idea.id);
      }}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div style={{
          position: "absolute",
          inset: 0,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          background: "rgba(10,10,10,0.5)",
        }}>
          <style>{`@keyframes lineage-spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{
            width: 20,
            height: 20,
            border: "2px solid rgba(234,179,8,0.3)",
            borderTopColor: "#eab308",
            borderRadius: "50%",
            animation: "lineage-spin 0.6s linear infinite",
          }} />
        </div>
      )}
      {/* Checkbox — only in compare mode */}
      {comparing && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(idea.id);
          }}
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            width: 20,
            height: 20,
            borderRadius: 5,
            border: isSelected
              ? "2px solid #60a5fa"
              : `2px solid ${t.border}`,
            background: isSelected ? "rgba(59,130,246,0.2)" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: "#60a5fa",
            fontWeight: 700,
            cursor: "pointer",
            zIndex: 2,
          }}
        >
          {isSelected ? "✓" : ""}
        </div>
      )}

      {/* Score circle + Title row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: comparing ? 20 : 0 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: bg,
            border: `2px solid ${color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "monospace",
              color: color,
            }}
          >
            {score.toFixed(1)}
          </span>
        </div>
        <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
          {editing ? (
            <input
              ref={inputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") { setEditTitle(idea.title); setEditing(false); }
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: t.text,
                background: t.surfAlt,
                border: `1px solid rgba(59,130,246,0.4)`,
                borderRadius: 6,
                padding: "2px 6px",
                outline: "none",
                width: "100%",
                minWidth: 0,
              }}
            />
          ) : (
            <>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: t.text,
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {idea.title}
              </p>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setEditTitle(idea.title);
                  setEditing(true);
                }}
                style={{
                  fontSize: 12,
                  cursor: "pointer",
                  flexShrink: 0,
                  opacity: 0.5,
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
                title="Rename idea"
              >
                ✏️
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tags row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          marginTop: 8,
          marginLeft: comparing ? 20 : 0,
        }}
      >
        {/* Status badge — tappable */}
        <div style={{ position: "relative" }}>
          <span
            onClick={(e) => {
              e.stopPropagation();
              setStatusOpen((prev) => !prev);
            }}
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: 9999,
              background: statusCfg.bg,
              color: statusCfg.color,
              border: `1px solid ${statusCfg.border}`,
              cursor: "pointer",
              transition: "all 0.15s",
              userSelect: "none",
            }}
          >
            {statusCfg.label}
          </span>
          {statusOpen && (
            <StatusDropdown
              currentStatus={statusKey}
              onSelect={handleStatusChange}
              onClose={() => setStatusOpen(false)}
              t={t}
            />
          )}
        </div>

        {isRoot && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: 9999,
              background: "rgba(245,158,11,0.12)",
              color: "#fbbf24",
              border: "1px solid rgba(245,158,11,0.25)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Root
          </span>
        )}
        {idea.is_main_version && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: 9999,
              background: "rgba(16,185,129,0.12)",
              color: "#34d399",
              border: "1px solid rgba(16,185,129,0.25)",
            }}
          >
            ★ Main
          </span>
        )}
        {idea.branch_reason && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 500,
              padding: "2px 7px",
              borderRadius: 9999,
              background: t.surfAlt,
              color: t.sec,
              border: `1px solid ${t.border}`,
              maxWidth: 140,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {idea.branch_reason}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// TREE NODE (recursive with connectors)
// ============================================
function TreeNode({ node, isRoot, selected, comparing, onToggleSelect, onClickNode, onUpdateIdea, loadingIdeaId, t }) {
  const { idea, children } = node;
  const isSelected = selected.some((s) => s.ideaId === idea.id);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <NodeCard
        idea={idea}
        isRoot={isRoot}
        isSelected={isSelected}
        comparing={comparing}
        onToggleSelect={onToggleSelect}
        onClickNode={onClickNode}
        onUpdateIdea={onUpdateIdea}
        isLoading={idea.id === loadingIdeaId}
        t={t}
      />

      {children.length > 0 && (
        <>
          {/* Vertical line down from parent */}
          <div
            style={{
              width: 2,
              height: 24,
              background: t.border,
            }}
          />

          {/* Children row with horizontal connectors */}
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            {children.map((child, i) => (
              <div
                key={child.idea.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "0 8px",
                }}
              >
                {/* Horizontal connector bar piece */}
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    height: 24,
                  }}
                >
                  {/* Left half */}
                  <div
                    style={{
                      flex: 1,
                      borderTop:
                        i > 0
                          ? `2px solid ${t.border}`
                          : "none",
                      height: "100%",
                    }}
                  />
                  {/* Center vertical drop */}
                  <div
                    style={{
                      width: 2,
                      height: "100%",
                      background: t.border,
                    }}
                  />
                  {/* Right half */}
                  <div
                    style={{
                      flex: 1,
                      borderTop:
                        i < children.length - 1
                          ? `2px solid ${t.border}`
                          : "none",
                      height: "100%",
                    }}
                  />
                </div>

                {/* Recurse */}
                <TreeNode
                  node={child}
                  isRoot={false}
                  selected={selected}
                  comparing={comparing}
                  onToggleSelect={onToggleSelect}
                  onClickNode={onClickNode}
                  onUpdateIdea={onUpdateIdea}
                  loadingIdeaId={loadingIdeaId}
                  t={t}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// LINEAGE VIEW (main export)
// ============================================
export default function LineageView({
  myIdeas,
  targetIdeaId,
  onBack,
  onViewIdea,
  onStartComparison,
  onUpdateIdea,
  loadingIdeaId,
  t,
}) {
  const [selected, setSelected] = useState([]);
  const [comparing, setComparing] = useState(false);

  // Build ideas map
  const ideasMap = {};
  myIdeas.forEach((i) => (ideasMap[i.id] = i));

  // Find root
  const rootId = findRoot(targetIdeaId, ideasMap);

  // Get all ideas in this lineage
  const lineageIds = new Set();
  function collectLineage(id) {
    lineageIds.add(id);
    myIdeas.forEach((i) => {
      if (i.parent_idea_id === id && !lineageIds.has(i.id)) {
        collectLineage(i.id);
      }
    });
  }
  collectLineage(rootId);
  const lineageIdeas = myIdeas.filter((i) => lineageIds.has(i.id));

  // Build tree
  const tree = buildTree(lineageIdeas, rootId);

  // Toggle comparison selection
  const toggleSelect = (ideaId) => {
    setSelected((prev) => {
      const idx = prev.findIndex((s) => s.ideaId === ideaId);
      if (idx !== -1) return prev.filter((_, i) => i !== idx);
      if (prev.length >= 2) return prev;
      return [...prev, { ideaId, evaluationId: null }];
    });
  };

  // Handle compare
  const handleCompare = () => {
    if (selected.length === 2) {
      onStartComparison(selected);
    }
  };

  if (!tree) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: t.mut }}>Could not load lineage data.</p>
        <button
          onClick={onBack}
          style={{
            marginTop: 16,
            fontSize: 13,
            color: t.sec,
            background: "none",
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            padding: "8px 20px",
            cursor: "pointer",
          }}
        >
          ← Back to Idea Hub
        </button>
      </div>
    );
  }

  const nodeCount = lineageIdeas.length;

  return (
    <div style={{ width: "100%", maxWidth: 1200, margin: "0 auto", padding: "0 20px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: t.text,
              margin: 0,
            }}
          >
            Idea Evolution Tree
          </h2>
          <p
            style={{
              fontSize: 13,
              color: t.mut,
              margin: "6px 0 0",
            }}
          >
            {nodeCount} idea{nodeCount !== 1 ? "s" : ""} in this lineage.
            Tap a node to view, use checkboxes to compare.
          </p>
        </div>
        <button
          onClick={onBack}
          style={{
            fontSize: 13,
            color: t.sec,
            background: "none",
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            padding: "8px 20px",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          ← Back to Idea Hub
        </button>
      </div>

      {/* Tree container with horizontal scroll */}
      <div
        style={{
          overflowX: "auto",
          paddingBottom: 24,
          paddingTop: 16,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            justifyContent: "center",
            minWidth: "100%",
          }}
        >
          <TreeNode
            node={tree}
            isRoot={true}
            selected={selected}
            comparing={comparing}
            onToggleSelect={toggleSelect}
            onClickNode={(ideaId) => onViewIdea(ideaId)}
            onUpdateIdea={onUpdateIdea}
            loadingIdeaId={loadingIdeaId}
            t={t}
          />
        </div>
      </div>

      {/* Bottom action bar */}
      {nodeCount >= 2 && (
        <div
          style={{
            position: "sticky",
          bottom: 16,
          display: "flex",
          justifyContent: "center",
          gap: 12,
          padding: "16px 0",
          zIndex: 10,
        }}
      >
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            backdropFilter: "blur(8px)",
          }}
        >
          {!comparing ? (
            <button
              onClick={() => setComparing(true)}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 20px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                background: "rgba(59,130,246,0.15)",
                color: "#60a5fa",
                transition: "all 0.2s",
              }}
            >
              Compare
            </button>
          ) : (
            <>
              <span style={{ fontSize: 13, color: t.sec }}>
                {selected.length === 0
                  ? "Select 2 nodes to compare"
                  : selected.length === 1
                  ? "Select 1 more"
                  : "2 selected"}
              </span>
              <button
                onClick={handleCompare}
                disabled={selected.length !== 2}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  cursor: selected.length === 2 ? "pointer" : "not-allowed",
                  background: selected.length === 2 ? "#60a5fa" : t.surfAlt,
                  color: selected.length === 2 ? "#fff" : t.mut,
                  transition: "all 0.2s",
                }}
              >
                Compare Selected
              </button>
              <button
                onClick={() => { setComparing(false); setSelected([]); }}
                style={{
                  fontSize: 12,
                  color: t.mut,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
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
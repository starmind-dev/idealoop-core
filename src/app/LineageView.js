"use client";

import { useState } from "react";

// ============================================
// HELPERS
// ============================================

function getScoreColor(s) {
  if (s >= 8) return "#10b981";
  if (s >= 6) return "#3b82f6";
  if (s >= 4) return "#f59e0b";
  return "#ef4444";
}

function getScoreBg(s) {
  if (s >= 8) return "rgba(16,185,129,0.15)";
  if (s >= 6) return "rgba(59,130,246,0.15)";
  if (s >= 4) return "rgba(245,158,11,0.15)";
  return "rgba(239,68,68,0.15)";
}

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
// NODE CARD
// ============================================
function NodeCard({ idea, isRoot, isSelected, onToggleSelect, onClickNode }) {
  const evals = idea.evaluations || [];
  const latestEval = evals.length > 0 ? evals[0] : null; // sorted desc by list route
  const score = latestEval?.weighted_overall_score || 0;
  const color = getScoreColor(score);
  const bg = getScoreBg(score);

  return (
    <div
      style={{
        background: "rgba(23,23,23,0.8)",
        border: isSelected
          ? "1px solid rgba(59,130,246,0.6)"
          : "1px solid rgba(38,38,38,0.8)",
        borderRadius: 12,
        padding: "12px 16px",
        minWidth: 160,
        maxWidth: 220,
        cursor: "pointer",
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: isSelected ? "0 0 12px rgba(59,130,246,0.15)" : "none",
        position: "relative",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClickNode(idea.id);
      }}
    >
      {/* Checkbox */}
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
            : "2px solid rgba(64,64,64,0.6)",
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

      {/* Score circle + Title row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 20 }}>
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
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#e5e5e5",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {idea.title}
          </p>
        </div>
      </div>

      {/* Tags row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          marginTop: 8,
          marginLeft: 20,
        }}
      >
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
              background: "rgba(64,64,64,0.3)",
              color: "#a3a3a3",
              border: "1px solid rgba(64,64,64,0.4)",
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
function TreeNode({ node, isRoot, selected, onToggleSelect, onClickNode }) {
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
        onToggleSelect={onToggleSelect}
        onClickNode={onClickNode}
      />

      {children.length > 0 && (
        <>
          {/* Vertical line down from parent */}
          <div
            style={{
              width: 2,
              height: 24,
              background: "rgba(64,64,64,0.6)",
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
                          ? "2px solid rgba(64,64,64,0.6)"
                          : "none",
                      height: "100%",
                    }}
                  />
                  {/* Center vertical drop */}
                  <div
                    style={{
                      width: 2,
                      height: "100%",
                      background: "rgba(64,64,64,0.6)",
                    }}
                  />
                  {/* Right half */}
                  <div
                    style={{
                      flex: 1,
                      borderTop:
                        i < children.length - 1
                          ? "2px solid rgba(64,64,64,0.6)"
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
                  onToggleSelect={onToggleSelect}
                  onClickNode={onClickNode}
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
}) {
  const [selected, setSelected] = useState([]);

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
        <p style={{ color: "#737373" }}>Could not load lineage data.</p>
        <button
          onClick={onBack}
          style={{
            marginTop: 16,
            fontSize: 13,
            color: "#a3a3a3",
            background: "none",
            border: "1px solid rgba(64,64,64,0.5)",
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
              color: "#f5f5f5",
              margin: 0,
            }}
          >
            Idea Evolution Tree
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#737373",
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
            color: "#a3a3a3",
            background: "none",
            border: "1px solid rgba(64,64,64,0.5)",
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
            onToggleSelect={toggleSelect}
            onClickNode={(ideaId) => onViewIdea(ideaId)}
          />
        </div>
      </div>

      {/* Bottom action bar */}
      {selected.length > 0 && (
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
              background: "rgba(23,23,23,0.95)",
              border: "1px solid rgba(38,38,38,0.8)",
              borderRadius: 12,
              padding: "12px 24px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              backdropFilter: "blur(8px)",
            }}
          >
            <span style={{ fontSize: 13, color: "#a3a3a3" }}>
              {selected.length === 1
                ? "Select 1 more to compare"
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
                cursor:
                  selected.length === 2 ? "pointer" : "not-allowed",
                background:
                  selected.length === 2
                    ? "#60a5fa"
                    : "rgba(38,38,38,0.6)",
                color: selected.length === 2 ? "#fff" : "#525252",
                transition: "all 0.2s",
              }}
            >
              Compare Selected
            </button>
            <button
              onClick={() => setSelected([])}
              style={{
                fontSize: 12,
                color: "#737373",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";

// ============================================
// DATA PREPARATION
// ============================================
const competitorTypeOrder = { direct: 0, adjacent: 1, substitute: 2, internal_build: 3 };

function prepareComparisonData(ideaA, ideaB) {
  const a = ideaA.analysis, b = ideaB.analysis;
  const competitorsA = [...(a.competition?.competitors || [])].sort((x, y) => (competitorTypeOrder[x.competitor_type] ?? 9) - (competitorTypeOrder[y.competitor_type] ?? 9));
  const competitorsB = [...(b.competition?.competitors || [])].sort((x, y) => (competitorTypeOrder[x.competitor_type] ?? 9) - (competitorTypeOrder[y.competitor_type] ?? 9));
  const namesA = new Set(competitorsA.map(c => c.name.toLowerCase().trim()));
  const namesB = new Set(competitorsB.map(c => c.name.toLowerCase().trim()));
  const sharedNames = new Set([...namesA].filter(n => namesB.has(n)));

  const metrics = [
    { key: "md", label: "Market demand", scoreA: a.evaluation.market_demand.score, scoreB: b.evaluation.market_demand.score, explA: a.evaluation.market_demand.explanation, explB: b.evaluation.market_demand.explanation },
    { key: "mo", label: "Monetization", scoreA: a.evaluation.monetization.score, scoreB: b.evaluation.monetization.score, explA: a.evaluation.monetization.explanation, explB: b.evaluation.monetization.explanation },
    { key: "or", label: "Originality", scoreA: a.evaluation.originality.score, scoreB: b.evaluation.originality.score, explA: a.evaluation.originality.explanation, explB: b.evaluation.originality.explanation },
    { key: "tc", label: "Technical complexity", scoreA: a.evaluation.technical_complexity.score, scoreB: b.evaluation.technical_complexity.score, explA: a.evaluation.technical_complexity.explanation, explB: b.evaluation.technical_complexity.explanation, isTC: true },
  ];

  const fs = t => { if (!t) return ""; const m = t.match(/^[^.!?]+[.!?]/); return m ? m[0].trim() : t.substring(0, 120).trim(); };

  const tradeoffs = metrics.map(m => {
    const delta = Math.abs(m.scoreA - m.scoreB);
    let winner, loser, deltaBadge;
    if (m.isTC) {
      if (m.scoreA < m.scoreB) { winner = "a"; loser = "b"; deltaBadge = `Lower TC by ${delta.toFixed(1)}`; }
      else if (m.scoreB < m.scoreA) { winner = "b"; loser = "a"; deltaBadge = `Lower TC by ${delta.toFixed(1)}`; }
      else { winner = null; loser = null; deltaBadge = "Tied"; }
    } else {
      if (m.scoreA > m.scoreB) { winner = "a"; loser = "b"; deltaBadge = `+${delta.toFixed(1)}`; }
      else if (m.scoreB > m.scoreA) { winner = "b"; loser = "a"; deltaBadge = `+${delta.toFixed(1)}`; }
      else { winner = null; loser = null; deltaBadge = "Tied"; }
    }
    return { ...m, delta, winner, loser, deltaBadge, winnerExpl: fs(winner === "a" ? m.explA : winner === "b" ? m.explB : m.explA), loserExpl: fs(loser === "b" ? m.explB : loser === "a" ? m.explA : m.explB) };
  });

  const nameA = ideaA.title.length > 30 ? ideaA.title.substring(0, 28) + "…" : ideaA.title;
  const nameB = ideaB.title.length > 30 ? ideaB.title.substring(0, 28) + "…" : ideaB.title;
  const overallA = a.evaluation.overall_score, overallB = b.evaluation.overall_score;
  const aWins = tradeoffs.filter(t => t.winner === "a").map(t => t.label.toLowerCase());
  const bWins = tradeoffs.filter(t => t.winner === "b").map(t => t.label.toLowerCase());
  let overallSummary = "";
  if (overallA > overallB) { overallSummary = `${nameA} is stronger if you prioritize ${aWins.join(" and ") || "overall balance"}.`; if (bWins.length > 0) overallSummary += ` ${nameB} is stronger if ${bWins.join(" and ")} matter${bWins.length === 1 ? "s" : ""} more to you.`; }
  else if (overallB > overallA) { overallSummary = `${nameB} is stronger if you prioritize ${bWins.join(" and ") || "overall balance"}.`; if (aWins.length > 0) overallSummary += ` ${nameA} is stronger if ${aWins.join(" and ")} matter${aWins.length === 1 ? "s" : ""} more to you.`; }
  else { overallSummary = `Both score identically. ${nameA} leads on ${aWins.join(", ") || "nothing specific"}, ${nameB} leads on ${bWins.join(", ") || "nothing specific"}.`; }

  const extractRisks = (an) => { const r = an.evaluation?.failure_risks || an.failure_risks || an.risks || []; if (!Array.isArray(r)) return []; return r.map(x => typeof x === "string" ? x : x.description || x.risk || x.title || ""); };

  return { competitorsA, competitorsB, sharedNames, metrics, tradeoffs, overallA, overallB, overallSummary, nameA, nameB, risksA: extractRisks(a), risksB: extractRisks(b), phasesA: a.phases || [], phasesB: b.phases || [], toolsA: a.tools || [], toolsB: b.tools || [], estimatesA: a.estimates || {}, estimatesB: b.estimates || {}, confidenceA: a.evaluation.confidence_level, confidenceB: b.evaluation.confidence_level };
}

// ============================================
// HELPERS
// ============================================
const getScoreColor = s => s >= 8 ? "#10b981" : s >= 6 ? "#3b82f6" : s >= 4 ? "#f59e0b" : "#ef4444";
const getBarColor = (s, tc) => tc ? (s >= 8 ? "#ef4444" : s >= 6 ? "#f59e0b" : "#3b82f6") : getScoreColor(s);
const typeColors = { direct: { label: "Direct", color: "#f87171", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.25)" }, adjacent: { label: "Adjacent", color: "#fbbf24", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)" }, substitute: { label: "Substitute", color: "#60a5fa", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.25)" }, internal_build: { label: "Internal Build", color: "#a78bfa", bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.25)" } };
const sourceColors = { github: { bg: "rgba(110,84,148,0.15)", color: "#a78bfa", border: "rgba(110,84,148,0.3)", label: "GitHub" }, google: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "rgba(59,130,246,0.3)", label: "Google" }, llm: { bg: "rgba(115,115,115,0.15)", color: "#a3a3a3", border: "rgba(115,115,115,0.3)", label: "AI" } };
const SCREENS = [{ key: "competitors", label: "Competitors" }, { key: "scores", label: "Scores" }, { key: "risks", label: "Key risks" }, { key: "roadmap", label: "Roadmap" }, { key: "tools", label: "Tools & estimates" }, { key: "tradeoffs", label: "Key tradeoffs" }];
const shortTitle = (t, max = 24) => t.length > max ? t.substring(0, max - 1) + "…" : t;

// Shared two-column container used by all screens except scores and tradeoffs
function TwoCol({ left, right, isMobile, activeTab, padded = true }) {
  if (isMobile) return <div style={{ padding: padded ? 16 : 0 }}>{activeTab === "a" ? left : right}</div>;
  return (
    <div style={{ display: "flex", width: "100%" }}>
      <div style={{ flex: 1, minWidth: 0, borderRight: "1px solid rgba(38,38,38,0.8)", padding: padded ? 20 : 0, boxSizing: "border-box", overflow: "hidden" }}>{left}</div>
      <div style={{ flex: 1, minWidth: 0, padding: padded ? 20 : 0, boxSizing: "border-box", overflow: "hidden" }}>{right}</div>
    </div>
  );
}

// Badge pill
function Badge({ label, color, bg, border }) {
  return <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, border: `1px solid ${border}`, background: bg, color, whiteSpace: "nowrap" }}>{label}</span>;
}

// ============================================
// COMPETITORS
// ============================================
function CompetitorsScreen({ data, ideaA, ideaB, isMobile, activeTab }) {
  const renderCard = (comp, otherTitle) => {
    const tc = typeColors[comp.competitor_type]; const src = sourceColors[comp.source] || sourceColors.llm;
    const isShared = data.sharedNames.has(comp.name.toLowerCase().trim());
    return (
      <div style={{ background: "rgba(23,23,23,0.6)", border: isShared ? "1.5px solid rgba(59,130,246,0.4)" : "1px solid rgba(38,38,38,0.8)", borderRadius: 14, padding: "16px 18px", height: "100%", boxSizing: "border-box" }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", margin: "0 0 8px 0" }}>{comp.name}</h4>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
          {isShared && <Badge label="Shared" color="#60a5fa" bg="rgba(59,130,246,0.15)" border="rgba(59,130,246,0.3)" />}
          {tc && <Badge label={tc.label} color={tc.color} bg={tc.bg} border={tc.border} />}
          <Badge label={src.label} color={src.color} bg={src.bg} border={src.border} />
        </div>
        <p style={{ fontSize: 12, color: "#a3a3a3", lineHeight: 1.6, margin: 0 }}>{comp.description}</p>
        {comp.outcome && <p style={{ fontSize: 11, color: "#34d399", fontWeight: 600, margin: "8px 0 0 0" }}>{comp.outcome}</p>}
        {comp.url && <a href={comp.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#60a5fa", textDecoration: "none", display: "inline-block", marginTop: 4 }}>Visit →</a>}
        {isMobile && isShared && otherTitle && <p style={{ fontSize: 11, color: "#60a5fa", margin: "6px 0 0 0" }}>Also appears in: {otherTitle}</p>}
      </div>
    );
  };

  if (isMobile) {
    const comps = activeTab === "a" ? data.competitorsA : data.competitorsB;
    const other = activeTab === "a" ? ideaB.title : ideaA.title;
    return <div style={{ padding: 16 }}>{comps.map((c, i) => <div key={i} style={{ marginBottom: 10 }}>{renderCard(c, other)}</div>)}</div>;
  }

  const maxComps = Math.max(data.competitorsA.length, data.competitorsB.length);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
      {Array.from({ length: maxComps }, (_, i) => (
        <div key={i} style={{ display: "contents" }}>
          <div style={{ borderRight: "1px solid rgba(38,38,38,0.8)", padding: "10px 20px 0 20px", overflow: "hidden" }}>
            {data.competitorsA[i] ? renderCard(data.competitorsA[i], ideaB.title) : <div />}
          </div>
          <div style={{ padding: "10px 20px 0 20px", overflow: "hidden" }}>
            {data.competitorsB[i] ? renderCard(data.competitorsB[i], ideaA.title) : <div />}
          </div>
        </div>
      ))}
      <div style={{ borderRight: "1px solid rgba(38,38,38,0.8)", padding: "0 20px 20px 20px" }} />
      <div style={{ padding: "0 20px 20px 20px" }} />
    </div>
  );
}

// ============================================
// SCORES (grid-row aligned — this one NEEDS row alignment)
// ============================================
function ScoresScreen({ data, isMobile, activeTab }) {
  const renderMetric = (m, side) => {
    const score = side === "a" ? m.scoreA : m.scoreB; const other = side === "a" ? m.scoreB : m.scoreA;
    const expl = side === "a" ? m.explA : m.explB;
    let arrow = null;
    if (!m.isTC) {
      if (score > other) arrow = <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 2L10 7H2Z" fill="#10b981" /></svg>;
      else if (score < other) arrow = <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 10L2 5H10Z" fill="#ef4444" /></svg>;
    }
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#e5e5e5" }}>{m.label}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, fontFamily: "monospace", color: getScoreColor(score) }}>{score.toFixed(1)}</span>
            {arrow}
          </div>
        </div>
        <div style={{ width: "100%", height: 6, background: "#262626", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(score / 10) * 100}%`, background: getBarColor(score, m.isTC), borderRadius: 3 }} />
        </div>
        <p style={{ fontSize: 12, color: "#737373", marginTop: 6, lineHeight: 1.5 }}>{expl}</p>
      </div>
    );
  };
  const renderOverall = (side) => {
    const score = side === "a" ? data.overallA : data.overallB; const conf = side === "a" ? data.confidenceA : data.confidenceB;
    return (
      <div style={{ background: "rgba(38,38,38,0.4)", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#737373" }}>Overall score</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: "#f5f5f5" }}>{score.toFixed(1)}</span>
        </div>
        {conf && <p style={{ fontSize: 11, color: "#525252", margin: "4px 0 0 0" }}>Confidence: {conf.level}</p>}
      </div>
    );
  };
  if (isMobile) return <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>{data.metrics.map((m, i) => <div key={i}>{renderMetric(m, activeTab)}</div>)}{renderOverall(activeTab)}</div>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
      {data.metrics.map((m, i) => (
        <div key={i} style={{ display: "contents" }}>
          <div style={{ borderRight: "1px solid rgba(38,38,38,0.8)", padding: "20px 20px 0 20px", overflow: "hidden" }}>{renderMetric(m, "a")}</div>
          <div style={{ padding: "20px 20px 0 20px", overflow: "hidden" }}>{renderMetric(m, "b")}</div>
        </div>
      ))}
      <div style={{ borderRight: "1px solid rgba(38,38,38,0.8)", padding: 20 }}>{renderOverall("a")}</div>
      <div style={{ padding: 20 }}>{renderOverall("b")}</div>
    </div>
  );
}

// ============================================
// KEY RISKS
// ============================================
function RisksScreen({ data, isMobile, activeTab }) {
  const renderRisk = (risk, i) => {
    if (risk === null) return <div />;
    return (
      <div style={{ background: "rgba(23,23,23,0.6)", borderLeft: `3px solid ${i < 2 ? "#ef4444" : "#f59e0b"}`, padding: "14px 16px", borderRadius: "0 12px 12px 0", height: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: i < 2 ? "#f87171" : "#fbbf24", flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
          <p style={{ fontSize: 13, color: "#a3a3a3", lineHeight: 1.6, margin: 0 }}>{risk}</p>
        </div>
      </div>
    );
  };

  const renderEmpty = () => (
    <div style={{ padding: "32px 0", textAlign: "center" }}>
      <p style={{ fontSize: 13, color: "#404040" }}>No failure risks in this evaluation</p>
      <p style={{ fontSize: 11, color: "#333" }}>Re-evaluate this idea to generate risk analysis.</p>
    </div>
  );

  if (isMobile) {
    const risks = activeTab === "a" ? data.risksA : data.risksB;
    if (!risks || risks.length === 0) return <div style={{ padding: 20 }}>{renderEmpty()}</div>;
    return <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>{risks.map((r, i) => <div key={i}>{renderRisk(r, i)}</div>)}</div>;
  }

  const emptyA = !data.risksA || data.risksA.length === 0;
  const emptyB = !data.risksB || data.risksB.length === 0;

  if (emptyA && emptyB) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
        <div style={{ borderRight: "1px solid rgba(38,38,38,0.8)", padding: 20 }}>{renderEmpty()}</div>
        <div style={{ padding: 20 }}>{renderEmpty()}</div>
      </div>
    );
  }

  const maxRisks = Math.max(data.risksA.length, data.risksB.length);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
      {Array.from({ length: maxRisks }, (_, i) => (
        <div key={i} style={{ display: "contents" }}>
          <div style={{ borderRight: "1px solid rgba(38,38,38,0.8)", padding: "10px 20px 0 20px", overflow: "hidden" }}>
            {data.risksA[i] ? renderRisk(data.risksA[i], i) : <div />}
          </div>
          <div style={{ padding: "10px 20px 0 20px", overflow: "hidden" }}>
            {data.risksB[i] ? renderRisk(data.risksB[i], i) : <div />}
          </div>
        </div>
      ))}
      <div style={{ borderRight: "1px solid rgba(38,38,38,0.8)", padding: "0 20px 20px 20px" }} />
      <div style={{ padding: "0 20px 20px 20px" }} />
    </div>
  );
}

// ============================================
// ROADMAP
// ============================================
function RoadmapScreen({ data, isMobile, activeTab }) {
  const [expanded, setExpanded] = useState({});
  const toggle = k => setExpanded(p => ({ ...p, [k]: !p[k] }));

  const renderPhase = (phase, side, i) => {
    if (!phase) return <div style={{ minHeight: 120 }} />;
    const isGate = (phase.phase_type === "validate" || phase.phase_type === "survival") && i === 0;
    const k = `${side}-${i}`;
    return (
      <div style={{ background: "rgba(23,23,23,0.6)", border: "1px solid rgba(38,38,38,0.8)", borderRadius: 12, overflow: "hidden", minHeight: 120, boxSizing: "border-box" }}>
        <div onClick={() => toggle(k)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: isGate ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: isGate ? "#f87171" : "#60a5fa", flexShrink: 0 }}>{i + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5" }}>{phase.title}</span>
            {isGate && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 6, background: "rgba(239,68,68,0.15)", color: "#f87171", marginLeft: 6 }}>survival gate</span>}
            <p style={{ fontSize: 11, color: "#737373", margin: "3px 0 0 0", lineHeight: 1.4 }}>{phase.summary}</p>
          </div>
          <span style={{ color: "#404040", fontSize: 14, flexShrink: 0, transform: expanded[k] ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
        </div>
        {expanded[k] && phase.details && (
          <div style={{ padding: "0 14px 12px 48px", borderTop: "1px solid rgba(38,38,38,0.6)" }}>
            <p style={{ fontSize: 12, color: "#a3a3a3", lineHeight: 1.7, margin: "10px 0 0 0", whiteSpace: "pre-line" }}>{phase.details}</p>
          </div>
        )}
      </div>
    );
  };

  if (isMobile) {
    const phases = activeTab === "a" ? data.phasesA : data.phasesB;
    const side = activeTab;
    return <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>{phases.map((phase, i) => <div key={i}>{renderPhase(phase, side, i)}</div>)}</div>;
  }

  const maxPhases = Math.max(data.phasesA.length, data.phasesB.length);
  return (
    <div style={{ display: "flex", width: "100%" }}>
      <div style={{ flex: 1, minWidth: 0, borderRight: "1px solid rgba(38,38,38,0.8)", padding: "10px 20px 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: maxPhases }, (_, i) => <div key={i}>{renderPhase(data.phasesA[i] || null, "a", i)}</div>)}
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: "10px 20px 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: maxPhases }, (_, i) => <div key={i}>{renderPhase(data.phasesB[i] || null, "b", i)}</div>)}
      </div>
    </div>
  );
}

// ============================================
// TOOLS & ESTIMATES
// ============================================
function ToolsScreen({ data, isMobile, activeTab }) {
  const cats = ["Validate & Prototype", "Core Tech Stack", "Launch & Grow"];
  const icons = { "Validate & Prototype": "🔍", "Core Tech Stack": "🛠", "Launch & Grow": "🚀" };

  const renderToolCard = (tool) => {
    if (!tool) return <div />;
    return (
      <div style={{ background: "rgba(23,23,23,0.6)", border: "1px solid rgba(38,38,38,0.8)", borderRadius: 12, padding: "12px 14px", height: "100%", boxSizing: "border-box" }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5", margin: "0 0 4px 0" }}>{tool.name}</h4>
        <p style={{ fontSize: 11, color: "rgba(96,165,250,0.8)", lineHeight: 1.5, margin: 0 }}>{tool.description}</p>
      </div>
    );
  };

  const renderCatHeader = (cat, count) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 13 }}>{icons[cat]}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#d4d4d4" }}>{cat}</span>
      <span style={{ fontSize: 11, color: "#404040" }}>{count}</span>
    </div>
  );

  const renderEstimates = (estimates) => (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flex: 1, background: "rgba(38,38,38,0.4)", borderRadius: 10, padding: "10px 12px" }}>
        <p style={{ fontSize: 10, color: "#525252", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Duration</p>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#f5f5f5", margin: "4px 0 0 0" }}>{estimates.duration || "N/A"}</p>
      </div>
      <div style={{ flex: 1, background: "rgba(38,38,38,0.4)", borderRadius: 10, padding: "10px 12px" }}>
        <p style={{ fontSize: 10, color: "#525252", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Difficulty</p>
        <p style={{ fontSize: 15, fontWeight: 700, margin: "4px 0 0 0", color: estimates.difficulty === "Very Hard" ? "#f87171" : estimates.difficulty === "Hard" ? "#fbbf24" : estimates.difficulty === "Moderate" ? "#60a5fa" : "#34d399" }}>{estimates.difficulty || "N/A"}</p>
      </div>
    </div>
  );

  if (isMobile) {
    const tools = activeTab === "a" ? data.toolsA : data.toolsB;
    const estimates = activeTab === "a" ? data.estimatesA : data.estimatesB;
    const hasCats = tools.some(t => cats.includes(t.category));
    return (
      <div style={{ padding: 20 }}>
        {hasCats ? cats.map(cat => {
          const ct = tools.filter(t => t.category === cat);
          if (ct.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: 20 }}>
              {renderCatHeader(cat, ct.length)}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {ct.map((t, i) => <div key={i}>{renderToolCard(t)}</div>)}
              </div>
            </div>
          );
        }) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {tools.map((t, i) => <div key={i}>{renderToolCard(t)}</div>)}
          </div>
        )}
        {renderEstimates(estimates)}
      </div>
    );
  }

  const hasCatsA = data.toolsA.some(t => cats.includes(t.category));
  const hasCatsB = data.toolsB.some(t => cats.includes(t.category));
  const useCatGrid = hasCatsA || hasCatsB;

  if (useCatGrid) {
    const rows = [];
    cats.forEach(cat => {
      const ctA = data.toolsA.filter(t => t.category === cat);
      const ctB = data.toolsB.filter(t => t.category === cat);
      if (ctA.length === 0 && ctB.length === 0) return;
      rows.push({ type: "header", cat, countA: ctA.length, countB: ctB.length });
      const maxTools = Math.max(ctA.length, ctB.length);
      for (let i = 0; i < maxTools; i++) {
        rows.push({ type: "tool", toolA: ctA[i] || null, toolB: ctB[i] || null });
      }
    });

    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
        {rows.map((row, idx) => {
          if (row.type === "header") {
            return (
              <div key={idx} style={{ display: "contents" }}>
                <div style={{ borderRight: "1px solid rgba(38,38,38,0.8)", padding: "16px 20px 6px 20px" }}>{renderCatHeader(row.cat, row.countA)}</div>
                <div style={{ padding: "16px 20px 6px 20px" }}>{renderCatHeader(row.cat, row.countB)}</div>
              </div>
            );
          }
          return (
            <div key={idx} style={{ display: "contents" }}>
              <div style={{ borderRight: "1px solid rgba(38,38,38,0.8)", padding: "4px 20px 0 20px", overflow: "hidden", display: "flex" }}>{renderToolCard(row.toolA)}</div>
              <div style={{ padding: "4px 20px 0 20px", overflow: "hidden", display: "flex" }}>{renderToolCard(row.toolB)}</div>
            </div>
          );
        })}
        <div style={{ display: "contents" }}>
          <div style={{ borderRight: "1px solid rgba(38,38,38,0.8)", padding: "16px 20px 20px 20px" }}>{renderEstimates(data.estimatesA)}</div>
          <div style={{ padding: "16px 20px 20px 20px" }}>{renderEstimates(data.estimatesB)}</div>
        </div>
      </div>
    );
  }

  const maxTools = Math.max(data.toolsA.length, data.toolsB.length);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
      {Array.from({ length: maxTools }, (_, i) => (
        <div key={i} style={{ display: "contents" }}>
          <div style={{ borderRight: "1px solid rgba(38,38,38,0.8)", padding: "4px 20px 0 20px", overflow: "hidden", display: "flex" }}>{renderToolCard(data.toolsA[i] || null)}</div>
          <div style={{ padding: "4px 20px 0 20px", overflow: "hidden", display: "flex" }}>{renderToolCard(data.toolsB[i] || null)}</div>
        </div>
      ))}
      <div style={{ display: "contents" }}>
        <div style={{ borderRight: "1px solid rgba(38,38,38,0.8)", padding: "16px 20px 20px 20px" }}>{renderEstimates(data.estimatesA)}</div>
        <div style={{ padding: "16px 20px 20px 20px" }}>{renderEstimates(data.estimatesB)}</div>
      </div>
    </div>
  );
}

// ============================================
// KEY TRADEOFFS
// ============================================
function TradeoffsScreen({ data, ideaA, ideaB }) {
  const nA = shortTitle(ideaA.title, 28), nB = shortTitle(ideaB.title, 28);
  return (
    <div style={{ padding: "20px 24px" }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: "#a3a3a3", margin: "0 0 20px 0" }}>Key tradeoffs</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {data.tradeoffs.map((t, i) => {
          const wn = t.winner === "a" ? nA : t.winner === "b" ? nB : null;
          const ln = t.loser === "b" ? nB : t.loser === "a" ? nA : null;
          return (
            <div key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#525252", minWidth: 130 }}>{t.label}</span>
                {wn ? (<><span style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5" }}>{wn}</span><span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 8, background: "rgba(16,185,129,0.15)", color: "#34d399" }}>{t.deltaBadge}</span></>) : (<span style={{ fontSize: 12, color: "#525252" }}>Tied at {t.scoreA.toFixed(1)}</span>)}
              </div>
              <div style={{ marginLeft: 130, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0, marginTop: 2 }}><path d="M6 2L10 7H2Z" fill="#10b981" /></svg>
                  <p style={{ fontSize: 12, color: "#737373", margin: 0, lineHeight: 1.5 }}><span style={{ fontWeight: 600, color: "#a3a3a3" }}>{wn || nA}:</span> {t.winnerExpl}</p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0, marginTop: 2 }}><path d="M6 10L2 5H10Z" fill="#ef4444" /></svg>
                  <p style={{ fontSize: 12, color: "#737373", margin: 0, lineHeight: 1.5 }}><span style={{ fontWeight: 600, color: "#a3a3a3" }}>{ln || nB}:</span> {t.loserExpl}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ borderTop: "1px solid rgba(38,38,38,0.6)", paddingTop: 16, marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#525252", minWidth: 130 }}>Overall</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5" }}>{data.overallA >= data.overallB ? nA : nB}</span>
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 8, background: "rgba(16,185,129,0.15)", color: "#34d399" }}>{data.overallA.toFixed(1)} vs {data.overallB.toFixed(1)}</span>
          </div>
          <p style={{ fontSize: 12, color: "#737373", margin: "0 0 0 130px", lineHeight: 1.6 }}>{data.overallSummary}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPARISON VIEW
// ============================================
export default function ComparisonView({ ideaA, ideaB, onBack }) {
  const [cur, setCur] = useState(0);
  const [tab, setTab] = useState("a");
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);

  const data = prepareComparisonData(ideaA, ideaB);
  const screen = SCREENS[cur];
  const tA = shortTitle(ideaA.title, 28), tB = shortTitle(ideaB.title, 28);

  const content = (() => {
    switch (screen.key) {
      case "competitors": return <CompetitorsScreen data={data} ideaA={ideaA} ideaB={ideaB} isMobile={isMobile} activeTab={tab} />;
      case "scores": return <ScoresScreen data={data} isMobile={isMobile} activeTab={tab} />;
      case "risks": return <RisksScreen data={data} isMobile={isMobile} activeTab={tab} />;
      case "roadmap": return <RoadmapScreen data={data} isMobile={isMobile} activeTab={tab} />;
      case "tools": return <ToolsScreen data={data} isMobile={isMobile} activeTab={tab} />;
      case "tradeoffs": return <TradeoffsScreen data={data} ideaA={ideaA} ideaB={ideaB} />;
      default: return null;
    }
  })();

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "0 16px" }}>
      <button onClick={onBack} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer", padding: "12px 0", marginBottom: 8 }}>← Back to My Ideas</button>
      <div style={{ background: "rgba(23,23,23,0.6)", border: "1px solid rgba(38,38,38,0.8)", borderRadius: 16, overflow: "hidden" }}>
        {/* Screen tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(38,38,38,0.8)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {SCREENS.map((s, i) => (
            <button key={s.key} onClick={() => setCur(i)} style={{ flex: isMobile ? "none" : 1, padding: isMobile ? "10px 14px" : "10px 8px", fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer", whiteSpace: "nowrap", background: i === cur ? "rgba(23,23,23,0.6)" : "rgba(15,15,15,0.8)", color: i === cur ? "#f5f5f5" : "#525252", borderBottom: i === cur ? "2px solid #f5f5f5" : "2px solid transparent" }}>{s.label}</button>
          ))}
        </div>
        {/* Column headers / tab toggle */}
        {screen.key !== "tradeoffs" && (
          isMobile ? (
            <div style={{ display: "flex", borderBottom: "1px solid rgba(38,38,38,0.8)" }}>
              {["a", "b"].map(s => (
                <button key={s} onClick={() => setTab(s)} style={{ flex: 1, padding: 10, fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer", background: tab === s ? "rgba(23,23,23,0.6)" : "rgba(15,15,15,0.8)", color: tab === s ? "#f5f5f5" : "#525252", borderBottom: tab === s ? "2px solid #f5f5f5" : "2px solid transparent" }}>{s === "a" ? tA : tB}</button>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", borderBottom: "1px solid rgba(38,38,38,0.8)" }}>
              <div style={{ flex: 1, padding: "12px 20px", background: "rgba(38,38,38,0.3)", borderRight: "1px solid rgba(38,38,38,0.8)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>{tA}</span>
                <span style={{ fontSize: 13, color: "#525252", fontFamily: "monospace" }}>{data.overallA.toFixed(1)}</span>
              </div>
              <div style={{ flex: 1, padding: "12px 20px", background: "rgba(38,38,38,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>{tB}</span>
                <span style={{ fontSize: 13, color: "#525252", fontFamily: "monospace" }}>{data.overallB.toFixed(1)}</span>
              </div>
            </div>
          )
        )}
        {/* Content */}
        <div style={{ minHeight: 200 }}>{content}</div>
        {/* Nav */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid rgba(38,38,38,0.8)" }}>
          <button onClick={() => setCur(p => Math.max(0, p - 1))} style={{ padding: "8px 16px", fontSize: 12, border: "1px solid rgba(38,38,38,0.8)", borderRadius: 8, background: "transparent", color: "#525252", cursor: "pointer", visibility: cur === 0 ? "hidden" : "visible" }}>← {cur > 0 ? SCREENS[cur - 1].label : ""}</button>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>{SCREENS.map((_, i) => <div key={i} onClick={() => setCur(i)} style={{ width: 6, height: 6, borderRadius: "50%", background: i === cur ? "#f5f5f5" : "#262626", cursor: "pointer" }} />)}</div>
          <button onClick={() => setCur(p => Math.min(SCREENS.length - 1, p + 1))} style={{ padding: "8px 16px", fontSize: 12, border: "1px solid rgba(38,38,38,0.8)", borderRadius: 8, background: "transparent", color: "#525252", cursor: "pointer", visibility: cur === SCREENS.length - 1 ? "hidden" : "visible" }}>{cur < SCREENS.length - 1 ? SCREENS[cur + 1].label : ""} →</button>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { getScoreColor, getMainBottleneckColor } from "./components";

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

  const risksA = extractRisks(a), risksB = extractRisks(b);
  const phasesA = a.phases || [], phasesB = b.phases || [];
  const toolsA = a.tools || [], toolsB = b.tools || [];
  const estimatesA = a.estimates || {}, estimatesB = b.estimates || {};

  // Conditional per-screen summaries — only shown when meaningful asymmetry exists
  const summaries = {};

  // Competitors: show if different direct counts or shared competitors exist
  const directA = competitorsA.filter(c => c.competitor_type === "direct").length;
  const directB = competitorsB.filter(c => c.competitor_type === "direct").length;
  if (directA !== directB || sharedNames.size > 0) {
    const parts = [];
    if (directA !== directB) parts.push(`${nameA} faces ${directA} direct competitor${directA !== 1 ? "s" : ""} vs ${nameB}'s ${directB}`);
    if (sharedNames.size > 0) parts.push(`${sharedNames.size} shared competitor${sharedNames.size !== 1 ? "s" : ""}`);
    summaries.competitors = parts.join(". ") + ".";
  }

  // Risks: show only if counts differ
  if (risksA.length !== risksB.length) {
    summaries.risks = `${nameA} has ${risksA.length} failure risk${risksA.length !== 1 ? "s" : ""} vs ${nameB}'s ${risksB.length}.`;
  }

  // Roadmap: show if phase counts differ or one has a survival gate and the other doesn't
  const gateA = phasesA.length > 0 && (phasesA[0].phase_type === "validate" || phasesA[0].phase_type === "survival");
  const gateB = phasesB.length > 0 && (phasesB[0].phase_type === "validate" || phasesB[0].phase_type === "survival");
  if (phasesA.length !== phasesB.length) {
    summaries.roadmap = `${nameA} has ${phasesA.length} phases vs ${nameB}'s ${phasesB.length}.`;
  } else if (gateA !== gateB) {
    summaries.roadmap = gateA ? `${nameA} starts with a survival gate, ${nameB} does not.` : `${nameB} starts with a survival gate, ${nameA} does not.`;
  }

  // Tools: show if duration or difficulty differ
  if (estimatesA.duration !== estimatesB.duration || estimatesA.difficulty !== estimatesB.difficulty) {
    const parts = [];
    if (estimatesA.duration !== estimatesB.duration) parts.push(`${nameA}: ${estimatesA.duration || "N/A"} vs ${nameB}: ${estimatesB.duration || "N/A"}`);
    if (estimatesA.difficulty !== estimatesB.difficulty) parts.push(`${nameA}: ${estimatesA.difficulty || "N/A"} vs ${nameB}: ${estimatesB.difficulty || "N/A"}`);
    summaries.tools = parts.join(". ") + ".";
  }

  return { competitorsA, competitorsB, sharedNames, metrics, tradeoffs, overallA, overallB, overallSummary, nameA, nameB, risksA, risksB, phasesA, phasesB, toolsA, toolsB, estimatesA, estimatesB, confidenceA: a.evaluation.confidence_level, confidenceB: b.evaluation.confidence_level, summaries };
}

// ============================================
// HELPERS
// ============================================
const getBarColor = (s, tc) => tc ? (s >= 8 ? "#ef4444" : s >= 6 ? "#f59e0b" : "#3b82f6") : getScoreColor(s);
const typeColors = { direct: { label: "Direct", color: "#f87171", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.25)" }, adjacent: { label: "Adjacent", color: "#fbbf24", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)" }, substitute: { label: "Substitute", color: "#60a5fa", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.25)" }, internal_build: { label: "Internal Build", color: "#a78bfa", bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.25)" } };
const sourceColors = { github: { bg: "rgba(110,84,148,0.15)", color: "#a78bfa", border: "rgba(110,84,148,0.3)", label: "GitHub" }, google: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "rgba(59,130,246,0.3)", label: "Google" }, llm: { bg: "rgba(115,115,115,0.15)", color: "#a3a3a3", border: "rgba(115,115,115,0.3)", label: "AI" } };
const SCREENS = [{ key: "competitors", label: "Competitors" }, { key: "scores", label: "Scores" }, { key: "risks", label: "Key risks" }, { key: "roadmap", label: "Roadmap" }, { key: "tools", label: "Tools & estimates" }, { key: "tradeoffs", label: "Key tradeoffs" }];
const shortTitle = (t, max = 24) => t.length > max ? t.substring(0, max - 1) + "…" : t;

// Badge pill
function Badge({ label, color, bg, border }) {
  return <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, border: `1px solid ${border}`, background: bg, color, whiteSpace: "nowrap" }}>{label}</span>;
}

// Per-screen difference summary — shown only when data.summaries has an entry for this screen
function SummaryLine({ text, t }) {
  if (!text) return null;
  return (
    <div style={{ padding: "8px 20px", background: t.surfAlt, borderBottom: `1px solid ${t.border}` }}>
      <p style={{ fontSize: 12, color: t.mut, margin: 0, fontStyle: "italic" }}>{text}</p>
    </div>
  );
}

// ============================================
// COMPETITORS
// ============================================
function CompetitorsScreen({ data, ideaA, ideaB, isMobile, activeTab, t }) {
  const renderCard = (comp, otherTitle) => {
    const tc = typeColors[comp.competitor_type]; const src = sourceColors[comp.source] || sourceColors.llm;
    const isShared = data.sharedNames.has(comp.name.toLowerCase().trim());
    return (
      <div style={{ background: t.surface, border: isShared ? "1.5px solid rgba(59,130,246,0.4)" : "1px solid rgba(38,38,38,0.8)", borderRadius: 14, padding: "16px 18px", height: "100%", boxSizing: "border-box" }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: "0 0 8px 0" }}>{comp.name}</h4>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
          {isShared && <Badge label="Shared" color="#60a5fa" bg="rgba(59,130,246,0.15)" border="rgba(59,130,246,0.3)" />}
          {tc && <Badge label={tc.label} color={tc.color} bg={tc.bg} border={tc.border} />}
          <Badge label={src.label} color={src.color} bg={src.bg} border={src.border} />
        </div>
        <p style={{ fontSize: 12, color: t.sec, lineHeight: 1.6, margin: 0 }}>{comp.description}</p>
        {comp.outcome && <p style={{ fontSize: 11, color: "#34d399", fontWeight: 600, margin: "8px 0 0 0" }}>{comp.outcome}</p>}
        {comp.url && <a href={comp.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#60a5fa", textDecoration: "none", display: "inline-block", marginTop: 4 }}>Visit →</a>}
        {isMobile && isShared && otherTitle && <p style={{ fontSize: 11, color: "#60a5fa", margin: "6px 0 0 0" }}>Also appears in: {otherTitle}</p>}
      </div>
    );
  };

  if (isMobile) {
    const comps = activeTab === "a" ? data.competitorsA : data.competitorsB;
    const other = activeTab === "a" ? ideaB.title : ideaA.title;
    return (<>{data.summaries?.competitors && <SummaryLine text={data.summaries.competitors} t={t} />}<div style={{ padding: 16 }}>{comps.map((c, i) => <div key={i} style={{ marginBottom: 10 }}>{renderCard(c, other)}</div>)}</div></>);
  }

  const maxComps = Math.max(data.competitorsA.length, data.competitorsB.length);
  return (
    <>
    {data.summaries?.competitors && <SummaryLine text={data.summaries.competitors} t={t} />}
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
      {Array.from({ length: maxComps }, (_, i) => (
        <div key={i} style={{ display: "contents" }}>
          <div style={{ borderRight: `1px solid ${t.border}`, padding: "10px 20px 0 20px", overflow: "hidden" }}>
            {data.competitorsA[i] ? renderCard(data.competitorsA[i], ideaB.title) : <div />}
          </div>
          <div style={{ padding: "10px 20px 0 20px", overflow: "hidden" }}>
            {data.competitorsB[i] ? renderCard(data.competitorsB[i], ideaA.title) : <div />}
          </div>
        </div>
      ))}
      <div style={{ borderRight: `1px solid ${t.border}`, padding: "0 20px 20px 20px" }} />
      <div style={{ padding: "0 20px 20px 20px" }} />
    </div>
    </>
  );
}

// ============================================
// SCORES (grid-row aligned — this one NEEDS row alignment)
// ============================================
function ScoresScreen({ data, isMobile, activeTab, t }) {
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
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{m.label}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, fontFamily: "monospace", color: getScoreColor(score) }}>{score.toFixed(1)}</span>
            {arrow}
          </div>
        </div>
        <div style={{ width: "100%", height: 6, background: t.barBg, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(score / 10) * 100}%`, background: getBarColor(score, m.isTC), borderRadius: 3 }} />
        </div>
        <p style={{ fontSize: 12, color: t.mut, marginTop: 6, lineHeight: 1.5 }}>{expl}</p>
      </div>
    );
  };
  const renderOverall = (side) => {
    const score = side === "a" ? data.overallA : data.overallB; const conf = side === "a" ? data.confidenceA : data.confidenceB;
    return (
      <div style={{ background: t.surfAlt, borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: t.mut }}>Overall score</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: t.text }}>{score.toFixed(1)}</span>
        </div>
        {conf && <p style={{ fontSize: 11, color: t.mut, margin: "4px 0 0 0" }}>Confidence: {conf.level}</p>}
      </div>
    );
  };
  if (isMobile) return <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>{data.metrics.map((m, i) => <div key={i}>{renderMetric(m, activeTab)}</div>)}{renderOverall(activeTab)}</div>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
      {data.metrics.map((m, i) => (
        <div key={i} style={{ display: "contents" }}>
          <div style={{ borderRight: `1px solid ${t.border}`, padding: "20px 20px 0 20px", overflow: "hidden" }}>{renderMetric(m, "a")}</div>
          <div style={{ padding: "20px 20px 0 20px", overflow: "hidden" }}>{renderMetric(m, "b")}</div>
        </div>
      ))}
      <div style={{ borderRight: `1px solid ${t.border}`, padding: 20 }}>{renderOverall("a")}</div>
      <div style={{ padding: 20 }}>{renderOverall("b")}</div>
    </div>
  );
}

// ============================================
// KEY RISKS
// ============================================
function RisksScreen({ data, isMobile, activeTab, t }) {
  const renderRisk = (risk, i) => {
    if (risk === null) return <div />;
    return (
      <div style={{ background: t.surface, borderLeft: `3px solid ${i < 2 ? "#ef4444" : "#f59e0b"}`, padding: "14px 16px", borderRadius: "0 12px 12px 0", height: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: i < 2 ? "#f87171" : "#fbbf24", flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
          <p style={{ fontSize: 13, color: t.sec, lineHeight: 1.6, margin: 0 }}>{risk}</p>
        </div>
      </div>
    );
  };

  const renderEmpty = () => (
    <div style={{ padding: "32px 0", textAlign: "center" }}>
      <p style={{ fontSize: 13, color: t.mut }}>No failure risks in this evaluation</p>
      <p style={{ fontSize: 11, color: t.mut }}>Re-evaluate this idea to generate risk analysis.</p>
    </div>
  );

  if (isMobile) {
    const risks = activeTab === "a" ? data.risksA : data.risksB;
    if (!risks || risks.length === 0) return <div style={{ padding: 20 }}>{renderEmpty()}</div>;
    return (<>{data.summaries?.risks && <SummaryLine text={data.summaries.risks} t={t} />}<div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>{risks.map((r, i) => <div key={i}>{renderRisk(r, i)}</div>)}</div></>);
  }

  const emptyA = !data.risksA || data.risksA.length === 0;
  const emptyB = !data.risksB || data.risksB.length === 0;

  if (emptyA && emptyB) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
        <div style={{ borderRight: `1px solid ${t.border}`, padding: 20 }}>{renderEmpty()}</div>
        <div style={{ padding: 20 }}>{renderEmpty()}</div>
      </div>
    );
  }

  const maxRisks = Math.max(data.risksA.length, data.risksB.length);
  return (
    <>
    {data.summaries?.risks && <SummaryLine text={data.summaries.risks} t={t} />}
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
      {Array.from({ length: maxRisks }, (_, i) => (
        <div key={i} style={{ display: "contents" }}>
          <div style={{ borderRight: `1px solid ${t.border}`, padding: "10px 20px 0 20px", overflow: "hidden" }}>
            {data.risksA[i] ? renderRisk(data.risksA[i], i) : <div />}
          </div>
          <div style={{ padding: "10px 20px 0 20px", overflow: "hidden" }}>
            {data.risksB[i] ? renderRisk(data.risksB[i], i) : <div />}
          </div>
        </div>
      ))}
      <div style={{ borderRight: `1px solid ${t.border}`, padding: "0 20px 20px 20px" }} />
      <div style={{ padding: "0 20px 20px 20px" }} />
    </div>
    </>
  );
}

// ============================================
// ROADMAP
// ============================================
function RoadmapScreen({ data, isMobile, activeTab, t }) {
  const [expanded, setExpanded] = useState({});
  const toggle = k => setExpanded(p => ({ ...p, [k]: !p[k] }));

  const renderPhase = (phase, side, i) => {
    if (!phase) return <div style={{ minHeight: 120 }} />;
    const isGate = (phase.phase_type === "validate" || phase.phase_type === "survival") && i === 0;
    const k = `${side}-${i}`;
    return (
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden", minHeight: 120, boxSizing: "border-box" }}>
        <div onClick={() => toggle(k)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: isGate ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: isGate ? "#f87171" : "#60a5fa", flexShrink: 0 }}>{i + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{phase.title}</span>
            {isGate && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 6, background: "rgba(239,68,68,0.15)", color: "#f87171", marginLeft: 6 }}>survival gate</span>}
            <p style={{ fontSize: 11, color: t.mut, margin: "3px 0 0 0", lineHeight: 1.4 }}>{phase.summary}</p>
          </div>
          <span style={{ color: t.mut, fontSize: 14, flexShrink: 0, transform: expanded[k] ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
        </div>
        {expanded[k] && phase.details && (
          <div style={{ padding: "0 14px 12px 48px", borderTop: `1px solid ${t.border}` }}>
            <p style={{ fontSize: 12, color: t.sec, lineHeight: 1.7, margin: "10px 0 0 0", whiteSpace: "pre-line" }}>{phase.details}</p>
          </div>
        )}
      </div>
    );
  };

  if (isMobile) {
    const phases = activeTab === "a" ? data.phasesA : data.phasesB;
    const side = activeTab;
    return (<>{data.summaries?.roadmap && <SummaryLine text={data.summaries.roadmap} t={t} />}<div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>{phases.map((phase, i) => <div key={i}>{renderPhase(phase, side, i)}</div>)}</div></>);
  }

  const maxPhases = Math.max(data.phasesA.length, data.phasesB.length);
  return (
    <>
    {data.summaries?.roadmap && <SummaryLine text={data.summaries.roadmap} t={t} />}
    <div style={{ display: "flex", width: "100%" }}>
      <div style={{ flex: 1, minWidth: 0, borderRight: `1px solid ${t.border}`, padding: "10px 20px 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: maxPhases }, (_, i) => <div key={i}>{renderPhase(data.phasesA[i] || null, "a", i)}</div>)}
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: "10px 20px 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: maxPhases }, (_, i) => <div key={i}>{renderPhase(data.phasesB[i] || null, "b", i)}</div>)}
      </div>
    </div>
    </>
  );
}

// ============================================
// TOOLS & ESTIMATES
// ============================================
function ToolsScreen({ data, isMobile, activeTab, t }) {
  const cats = ["Validate & Prototype", "Core Tech Stack", "Launch & Grow"];
  const icons = { "Validate & Prototype": "🔍", "Core Tech Stack": "🛠", "Launch & Grow": "🚀" };

  const renderToolCard = (tool) => {
    if (!tool) return <div />;
    return (
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 14px", height: "100%", boxSizing: "border-box" }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: t.text, margin: "0 0 4px 0" }}>{tool.name}</h4>
        <p style={{ fontSize: 11, color: t.toolDesc, lineHeight: 1.5, margin: 0 }}>{tool.description}</p>
      </div>
    );
  };

  const renderCatHeader = (cat, count) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 13 }}>{icons[cat]}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: t.sec }}>{cat}</span>
      <span style={{ fontSize: 11, color: t.mut }}>{count}</span>
    </div>
  );

  const renderEstimates = (estimates) => {
    const mb = estimates.main_bottleneck;
    const mbColor = mb ? getMainBottleneckColor(mb, t.mode) : null;
    const isSparse = mb === "Specification";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
        <div style={{ background: t.surfAlt, borderRadius: 10, padding: "10px 12px" }}>
          <p style={{ fontSize: 10, color: t.mut, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Duration</p>
          <p style={{ fontSize: isSparse ? 12 : 15, fontWeight: 700, color: t.text, margin: "4px 0 0 0", lineHeight: 1.35 }}>{estimates.duration || "N/A"}</p>
        </div>
        <div style={{ background: t.surfAlt, borderRadius: 10, padding: "10px 12px" }}>
          <p style={{ fontSize: 10, color: t.mut, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Difficulty</p>
          <p style={{ fontSize: 15, fontWeight: 700, margin: "4px 0 0 0", color: estimates.difficulty === "Very Hard" ? "#f87171" : estimates.difficulty === "Hard" ? "#fbbf24" : estimates.difficulty === "Moderate" ? "#60a5fa" : estimates.difficulty === "Easy" ? "#34d399" : t.sec }}>{estimates.difficulty || "N/A"}</p>
        </div>
        <div style={{ background: t.surfAlt, borderRadius: 10, padding: "10px 12px" }}>
          <p style={{ fontSize: 10, color: t.mut, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Main Bottleneck</p>
          {mb && mbColor ? (
            <span style={{
              display: "inline-block",
              marginTop: 6,
              fontSize: 12,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 9999,
              background: mbColor.bg,
              color: mbColor.color,
              border: `1px solid ${mbColor.border}`,
              whiteSpace: "nowrap",
            }}>
              {mb}
            </span>
          ) : (
            <p style={{ fontSize: 13, fontWeight: 700, color: t.sec, margin: "4px 0 0 0" }}>—</p>
          )}
        </div>
      </div>
    );
  };

  if (isMobile) {
    const tools = activeTab === "a" ? data.toolsA : data.toolsB;
    const estimates = activeTab === "a" ? data.estimatesA : data.estimatesB;
    const hasCats = tools.some(t => cats.includes(t.category));
    return (
      <>
      {data.summaries?.tools && <SummaryLine text={data.summaries.tools} t={t} />}
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
      </>
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
      <>
      {data.summaries?.tools && <SummaryLine text={data.summaries.tools} t={t} />}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
        {rows.map((row, idx) => {
          if (row.type === "header") {
            return (
              <div key={idx} style={{ display: "contents" }}>
                <div style={{ borderRight: `1px solid ${t.border}`, padding: "16px 20px 6px 20px" }}>{renderCatHeader(row.cat, row.countA)}</div>
                <div style={{ padding: "16px 20px 6px 20px" }}>{renderCatHeader(row.cat, row.countB)}</div>
              </div>
            );
          }
          return (
            <div key={idx} style={{ display: "contents" }}>
              <div style={{ borderRight: `1px solid ${t.border}`, padding: "4px 20px 0 20px", overflow: "hidden", display: "flex" }}>{renderToolCard(row.toolA)}</div>
              <div style={{ padding: "4px 20px 0 20px", overflow: "hidden", display: "flex" }}>{renderToolCard(row.toolB)}</div>
            </div>
          );
        })}
        <div style={{ display: "contents" }}>
          <div style={{ borderRight: `1px solid ${t.border}`, padding: "16px 20px 20px 20px", display: "flex" }}>{renderEstimates(data.estimatesA)}</div>
          <div style={{ padding: "16px 20px 20px 20px", display: "flex" }}>{renderEstimates(data.estimatesB)}</div>
        </div>
      </div>
      </>
    );
  }

  const maxTools = Math.max(data.toolsA.length, data.toolsB.length);
  return (
    <>
    {data.summaries?.tools && <SummaryLine text={data.summaries.tools} t={t} />}
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
      {Array.from({ length: maxTools }, (_, i) => (
        <div key={i} style={{ display: "contents" }}>
          <div style={{ borderRight: `1px solid ${t.border}`, padding: "4px 20px 0 20px", overflow: "hidden", display: "flex" }}>{renderToolCard(data.toolsA[i] || null)}</div>
          <div style={{ padding: "4px 20px 0 20px", overflow: "hidden", display: "flex" }}>{renderToolCard(data.toolsB[i] || null)}</div>
        </div>
      ))}
      <div style={{ display: "contents" }}>
        <div style={{ borderRight: `1px solid ${t.border}`, padding: "16px 20px 20px 20px", display: "flex" }}>{renderEstimates(data.estimatesA)}</div>
        <div style={{ padding: "16px 20px 20px 20px", display: "flex" }}>{renderEstimates(data.estimatesB)}</div>
      </div>
    </div>
    </>
  );
}

// ============================================
// KEY TRADEOFFS (Sonnet-powered synthesis)
// ============================================
function TradeoffsScreen({ data, ideaA, ideaB, tradeoffsResult, tradeoffsLoading, tradeoffsError, t }) {
  const nA = shortTitle(ideaA.title, 28), nB = shortTitle(ideaB.title, 28);

  // Loading state
  if (tradeoffsLoading) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center" }}>
        <div style={{ display: "inline-block", width: 28, height: 28, border: "2.5px solid rgba(96,165,250,0.2)", borderTop: "2.5px solid #60a5fa", borderRadius: "50%", animation: "tradeoffsSpin 0.8s linear infinite", marginBottom: 16 }} />
        <p style={{ fontSize: 14, color: t.mut, margin: 0 }}>Analyzing tradeoffs...</p>
        <p style={{ fontSize: 12, color: t.mut, margin: "8px 0 0 0" }}>Identifying decision-relevant tensions between these ideas</p>
        <style>{`@keyframes tradeoffsSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Error state — fall back to basic score comparison
  if (tradeoffsError || !tradeoffsResult) {
    return (
      <div style={{ padding: "20px 24px" }}>
        {tradeoffsError && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>Could not generate tradeoff analysis: {tradeoffsError}</p>
          </div>
        )}
        <p style={{ fontSize: 14, fontWeight: 600, color: t.sec, margin: "0 0 16px 0" }}>Score comparison</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.tradeoffs.map((t, i) => {
            const wn = t.winner === "a" ? nA : t.winner === "b" ? nB : null;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: t.mut, minWidth: 130 }}>{t.label}</span>
                {wn ? (<><span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{wn}</span><span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 8, background: "rgba(16,185,129,0.15)", color: "#34d399" }}>{t.deltaBadge}</span></>) : (<span style={{ fontSize: 12, color: t.mut }}>Tied at {t.scoreA.toFixed(1)}</span>)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Sonnet-generated tradeoff synthesis
  const tr = tradeoffsResult;
  return (
    <div style={{ padding: "20px 24px" }}>
      {/* Screen header */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 18, fontWeight: 600, color: t.text, margin: "0 0 4px 0" }}>What you're choosing between</p>
        <p style={{ fontSize: 12, color: t.mut, margin: 0 }}>Decision-relevant tensions across these two ideas</p>
      </div>
      {/* Decision summary */}
      <div style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 14, padding: "16px 20px", marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px 0" }}>Decision summary</p>
        <p style={{ fontSize: 13, color: t.sec, lineHeight: 1.7, margin: 0 }}>{tr.decision_summary}</p>
      </div>

      {/* Tradeoff cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {(tr.tradeoffs || []).map((t, i) => (
          <div key={i} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: "16px 20px", overflow: "hidden" }}>
            {/* Tension label */}
            <p style={{ fontSize: 13, fontWeight: 700, color: t.text, margin: "0 0 14px 0" }}>{t.tension}</p>

            {/* Idea A */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#60a5fa" }}>{nA}</span>
              </div>
              <div style={{ marginLeft: 14 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 4 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0, marginTop: 3 }}><path d="M5 1L9 6H1Z" fill="#10b981" /></svg>
                  <p style={{ fontSize: 12, color: t.sec, margin: 0, lineHeight: 1.6 }}>{t.idea_a_advantage}</p>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0, marginTop: 3 }}><path d="M5 9L1 4H9Z" fill="#ef4444" /></svg>
                  <p style={{ fontSize: 12, color: t.mut, margin: 0, lineHeight: 1.6 }}>{t.idea_a_cost}</p>
                </div>
              </div>
            </div>

            {/* Idea B */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#a78bfa", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#a78bfa" }}>{nB}</span>
              </div>
              <div style={{ marginLeft: 14 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 4 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0, marginTop: 3 }}><path d="M5 1L9 6H1Z" fill="#10b981" /></svg>
                  <p style={{ fontSize: 12, color: t.sec, margin: 0, lineHeight: 1.6 }}>{t.idea_b_advantage}</p>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0, marginTop: 3 }}><path d="M5 9L1 4H9Z" fill="#ef4444" /></svg>
                  <p style={{ fontSize: 12, color: t.mut, margin: 0, lineHeight: 1.6 }}>{t.idea_b_cost}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dominant idea assessment (only if Sonnet found clear dominance) */}
      {tr.dominant_idea && tr.dominant_reason && (
        <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 14, padding: "16px 20px", marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}><path d="M7 1L9 5H13L10 8L11 12L7 10L3 12L4 8L1 5H5Z" fill="#34d399" /></svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#34d399" }}>
              {tr.dominant_idea === "idea_a" ? nA : nB} is stronger overall
            </span>
          </div>
          <p style={{ fontSize: 12, color: t.sec, lineHeight: 1.6, margin: 0 }}>{tr.dominant_reason}</p>
        </div>
      )}

      {/* Score reference bar at bottom */}
      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 16, marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
            <span style={{ fontSize: 12, color: t.mut }}>{nA}</span>
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace", color: getScoreColor(data.overallA) }}>{data.overallA.toFixed(1)}</span>
          </div>
          <span style={{ fontSize: 12, color: t.mut }}>vs</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#a78bfa" }} />
            <span style={{ fontSize: 12, color: t.mut }}>{nB}</span>
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace", color: getScoreColor(data.overallB) }}>{data.overallB.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPARISON VIEW
// ============================================
// ============================================
// TRADEOFFS DATA PREPROCESSOR
// ============================================
function buildTradeoffsPayload(ideaA, ideaB, data) {
  const extractCompSummary = (analysis) => analysis.competition?.competition_summary || analysis.competition?.summary || "";
  const extractCompCount = (analysis) => (analysis.competition?.competitors || []).length;
  const extractRisks = (analysis) => {
    const r = analysis.evaluation?.failure_risks || analysis.failure_risks || analysis.risks || [];
    if (!Array.isArray(r)) return [];
    return r.map(x => typeof x === "string" ? x : x.description || x.risk || x.title || "").filter(Boolean);
  };

  const aE = ideaA.analysis.evaluation, bE = ideaB.analysis.evaluation;
  const aScores = { md: aE.market_demand.score, mo: aE.monetization.score, or: aE.originality.score, tc: aE.technical_complexity.score, overall: aE.overall_score };
  const bScores = { md: bE.market_demand.score, mo: bE.monetization.score, or: bE.originality.score, tc: bE.technical_complexity.score, overall: bE.overall_score };

  const risksA = extractRisks(ideaA.analysis), risksB = extractRisks(ideaB.analysis);

  // Competitor asymmetry
  const directA = (ideaA.analysis.competition?.competitors || []).filter(c => c.competitor_type === "direct").length;
  const directB = (ideaB.analysis.competition?.competitors || []).filter(c => c.competitor_type === "direct").length;
  const competitorAsymmetry = `${ideaA.title} faces ${directA} direct competitor${directA !== 1 ? "s" : ""} out of ${extractCompCount(ideaA.analysis)} total. ${ideaB.title} faces ${directB} direct competitor${directB !== 1 ? "s" : ""} out of ${extractCompCount(ideaB.analysis)} total. ${data.sharedNames.size} shared competitor${data.sharedNames.size !== 1 ? "s" : ""}.`;

  // Risk asymmetry
  const riskAsymmetry = `${ideaA.title} has ${risksA.length} failure risk${risksA.length !== 1 ? "s" : ""}${risksA.length > 0 ? ": " + risksA.slice(0, 3).join("; ") : ""}. ${ideaB.title} has ${risksB.length} failure risk${risksB.length !== 1 ? "s" : ""}${risksB.length > 0 ? ": " + risksB.slice(0, 3).join("; ") : ""}.`;

  // Execution asymmetry
  const estA = ideaA.analysis.estimates || {}, estB = ideaB.analysis.estimates || {};
  const executionAsymmetry = `${ideaA.title}: ${estA.duration || "N/A"} duration, ${estA.difficulty || "N/A"} difficulty, ${(ideaA.analysis.phases || []).length} roadmap phases. ${ideaB.title}: ${estB.duration || "N/A"} duration, ${estB.difficulty || "N/A"} difficulty, ${(ideaB.analysis.phases || []).length} roadmap phases.`;

  return {
    idea_a: {
      title: ideaA.title,
      scores: aScores,
      failure_risks: risksA,
      confidence: aE.confidence_level || null,
      competition_summary: extractCompSummary(ideaA.analysis),
      competitor_count: extractCompCount(ideaA.analysis),
      roadmap_phase_count: (ideaA.analysis.phases || []).length,
      estimated_duration: estA.duration || "N/A",
      estimated_difficulty: estA.difficulty || "N/A",
    },
    idea_b: {
      title: ideaB.title,
      scores: bScores,
      failure_risks: risksB,
      confidence: bE.confidence_level || null,
      competition_summary: extractCompSummary(ideaB.analysis),
      competitor_count: extractCompCount(ideaB.analysis),
      roadmap_phase_count: (ideaB.analysis.phases || []).length,
      estimated_duration: estB.duration || "N/A",
      estimated_difficulty: estB.difficulty || "N/A",
    },
    deltas: {
      md: +(aScores.md - bScores.md).toFixed(1),
      mo: +(aScores.mo - bScores.mo).toFixed(1),
      or: +(aScores.or - bScores.or).toFixed(1),
      tc: +(aScores.tc - bScores.tc).toFixed(1),
      overall: +(aScores.overall - bScores.overall).toFixed(1),
    },
    shared_competitors: [...data.sharedNames],
    competitor_asymmetry: competitorAsymmetry,
    risk_asymmetry: riskAsymmetry,
    execution_asymmetry: executionAsymmetry,
  };
}

export default function ComparisonView({ ideaA, ideaB, onBack, authToken, t }) {
  const [cur, setCur] = useState(0);
  const [tab, setTab] = useState("a");
  const [isMobile, setIsMobile] = useState(false);
  const [tradeoffsResult, setTradeoffsResult] = useState(null);
  const [tradeoffsLoading, setTradeoffsLoading] = useState(false);
  const [tradeoffsError, setTradeoffsError] = useState("");
  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);

  const data = prepareComparisonData(ideaA, ideaB);

  // Background fetch tradeoffs on mount
  useEffect(() => {
    if (!authToken || tradeoffsResult) return;
    const fetchTradeoffs = async () => {
      setTradeoffsLoading(true);
      setTradeoffsError("");
      try {
        const payload = buildTradeoffsPayload(ideaA, ideaB, data);
        const res = await fetch("/api/compare/tradeoffs", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ comparisonData: payload }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setTradeoffsResult(json.tradeoffs);
      } catch (err) {
        console.error("Tradeoffs fetch error:", err);
        setTradeoffsError(err.message || "Failed to generate tradeoff analysis");
      } finally {
        setTradeoffsLoading(false);
      }
    };
    fetchTradeoffs();
  }, [authToken]);
  const screen = SCREENS[cur];
  const tA = shortTitle(ideaA.title, 28), tB = shortTitle(ideaB.title, 28);

  const content = (() => {
    switch (screen.key) {
      case "competitors": return <CompetitorsScreen data={data} ideaA={ideaA} ideaB={ideaB} isMobile={isMobile} activeTab={tab} t={t} />;
      case "scores": return <ScoresScreen data={data} isMobile={isMobile} activeTab={tab} t={t} />;
      case "risks": return <RisksScreen data={data} isMobile={isMobile} activeTab={tab} t={t} />;
      case "roadmap": return <RoadmapScreen data={data} isMobile={isMobile} activeTab={tab} t={t} />;
      case "tools": return <ToolsScreen data={data} isMobile={isMobile} activeTab={tab} t={t} />;
      case "tradeoffs": return <TradeoffsScreen data={data} ideaA={ideaA} ideaB={ideaB} tradeoffsResult={tradeoffsResult} tradeoffsLoading={tradeoffsLoading} tradeoffsError={tradeoffsError} t={t} />;
      default: return null;
    }
  })();

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "0 16px" }}>
      <button onClick={onBack} style={{ fontSize: 12, color: t.mut, background: "none", border: "none", cursor: "pointer", padding: "12px 0", marginBottom: 8 }}>← Back to My Ideas</button>
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, overflow: "hidden" }}>
        {/* Screen tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {SCREENS.map((s, i) => (
            <button key={s.key} onClick={() => setCur(i)} style={{ flex: isMobile ? "none" : 1, padding: isMobile ? "10px 14px" : "10px 8px", fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer", whiteSpace: "nowrap", background: i === cur ? t.surface : t.bg, color: i === cur ? t.text : t.mut, borderBottom: i === cur ? `2px solid ${t.text}` : "2px solid transparent" }}>{s.label}</button>
          ))}
        </div>
        {/* Column headers / tab toggle */}
        {screen.key !== "tradeoffs" && (
          isMobile ? (
            <div style={{ display: "flex", borderBottom: `1px solid ${t.border}` }}>
              {["a", "b"].map(s => (
                <button key={s} onClick={() => setTab(s)} style={{ flex: 1, padding: 10, fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer", background: tab === s ? t.surface : t.bg, color: tab === s ? t.text : t.mut, borderBottom: tab === s ? `2px solid ${t.text}` : "2px solid transparent" }}>{s === "a" ? tA : tB}</button>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", borderBottom: `1px solid ${t.border}` }}>
              <div style={{ flex: 1, padding: "12px 20px", background: t.surfAlt, borderRight: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{tA}</span>
                <span style={{ fontSize: 13, color: t.mut, fontFamily: "monospace" }}>{data.overallA.toFixed(1)}</span>
              </div>
              <div style={{ flex: 1, padding: "12px 20px", background: t.surfAlt, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{tB}</span>
                <span style={{ fontSize: 13, color: t.mut, fontFamily: "monospace" }}>{data.overallB.toFixed(1)}</span>
              </div>
            </div>
          )
        )}
        {/* Content */}
        <div style={{ minHeight: 200 }}>{content}</div>
        {/* Nav */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderTop: `1px solid ${t.border}` }}>
          <button onClick={() => setCur(p => Math.max(0, p - 1))} style={{ padding: "8px 16px", fontSize: 12, border: `1px solid ${t.border}`, borderRadius: 8, background: "transparent", color: t.mut, cursor: "pointer", visibility: cur === 0 ? "hidden" : "visible" }}>← {cur > 0 ? SCREENS[cur - 1].label : ""}</button>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>{SCREENS.map((_, i) => <div key={i} onClick={() => setCur(i)} style={{ width: 6, height: 6, borderRadius: "50%", background: i === cur ? t.text : t.divider, cursor: "pointer" }} />)}</div>
          <button onClick={() => setCur(p => Math.min(SCREENS.length - 1, p + 1))} style={{ padding: "8px 16px", fontSize: 12, border: `1px solid ${t.border}`, borderRadius: 8, background: "transparent", color: t.mut, cursor: "pointer", visibility: cur === SCREENS.length - 1 ? "hidden" : "visible" }}>{cur < SCREENS.length - 1 ? SCREENS[cur + 1].label : ""} →</button>
        </div>
      </div>
    </div>
  );
}
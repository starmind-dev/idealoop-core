"use client";

import {
  StepProgress,
  StatusBadge,
  ScoreBar,
  SectionHeader,
  Card,
  PageContainer,
  AuthModal,
  DevModeBadge,
  getScoreColor,
  getTcColor,
} from "./components";

export default function EvaluationView({
  // Screen
  screen,
  // Theme
  t,
  // Core data
  analysis,
  entitlements,
  profile,
  user,
  authLoading,
  // Navigation context
  viewingFromSaved,
  isBranchIdea,
  // Dev mode
  devMode,
  devModeExplicit,
  // Popups
  showScoreGuide,
  showAuthModal,
  // Save state
  saveStatus,
  saveError,
  savedIdeasCount,
  ideaName,
  // Phase/progress state
  currentPhases,
  expandedPhases,
  editedPhases,
  phaseProgress,
  editingNotePhase,
  noteText,
  savingProgress,
  editingPhase,
  currentEvaluationId,
  currentIdeaId,
  myIdeas,
  // Branch state
  branchReason,
  branchDimensions,
  // Re-eval state
  isReEvalResult,
  evalsRemaining,
  deltaData,
  deltaLoading,
  // Shared styles
  headerStyle,
  footerStyle,
  // Simple setters (for inline form interactions)
  setCurrentScreen,
  setShowAuthModal,
  setShowScoreGuide,
  setUser,
  setViewingFromSaved,
  setIdeaName,
  setSaveStatus,
  setSaveError,
  setBranchReason,
  setBranchDimensions,
  setBranchSetAsMain,
  setEditingNotePhase,
  setNoteText,
  setIsReEvalResult,
  // Functions
  goToMyIdeas,
  handleLogout,
  handleSaveIdea,
  startReEvaluation,
  togglePhase,
  togglePhaseProgress,
  startEditingPhase,
  stopEditingPhase,
  savePhaseEdit,
  savePhaseNote,
  getStepNumber,
  // Wrapped callbacks (multi-setter operations)
  onResetAndNewIdea,
  onBackToMyIdeasCleanup,
  onDiscardReEval,
  onSetAsMain,
  onNavigateToDelta,
}) {

  // ==========================================
  // SCREEN: ANALYSIS (results1)
  // ==========================================
  if (screen === "results1") {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, color: t.text, display: "flex", flexDirection: "column", overflowX: "hidden" }}>
        {t.accentBar && <div style={{ height: 3, background: "#eab308", opacity: 0.4 }} />}
        {devModeExplicit && <DevModeBadge mode={devMode} />}
        <header style={headerStyle}>
          <PageContainer wide>
            <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 onClick={() => setCurrentScreen(profile.coding && profile.ai ? "input" : "profile")} style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: t.mut, margin: 0, cursor: "pointer" }}>
                IdeaLoop Core
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => {
                  if (viewingFromSaved) {
                    setViewingFromSaved(false);
                    goToMyIdeas();
                  } else {
                    setCurrentScreen("input");
                  }
                }} style={{ fontSize: 12, color: t.mut, background: "none", border: "none", cursor: "pointer" }}>
                  {viewingFromSaved ? "← Back to My Ideas" : "← Back to idea"}
                </button>
                {!authLoading && (
                  user ? (
                    <>
                      <span style={{ color: t.divider }}>|</span>
                      {!viewingFromSaved && (
                        <>
                          <button onClick={goToMyIdeas} style={{ fontSize: 12, color: t.link, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
                            My Ideas
                          </button>
                          <span style={{ color: t.divider }}>|</span>
                        </>
                      )}
                      <span style={{ fontSize: 12, color: t.mut }}>{user.email}</span>
                      <button onClick={handleLogout} style={{ fontSize: 12, color: t.mut, background: "none", border: "none", cursor: "pointer" }}>
                        Log out
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ color: t.divider }}>|</span>
                      <button
                        onClick={() => setShowAuthModal(true)}
                        style={{ fontSize: 12, color: t.link, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
                      >
                        Log in to save
                      </button>
                    </>
                  )
                )}
              </div>
            </div>
          </PageContainer>
        </header>

        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onAuth={(u) => setUser(u)}
            t={t}
          />
        )}

        <StepProgress currentStep={getStepNumber()} savedMode={viewingFromSaved} branchMode={viewingFromSaved && isBranchIdea} t={t} />

        <main style={{ flex: 1, paddingBottom: 64 }}>
          <PageContainer wide>

            {/* Scope Warning */}
            {analysis.scope_warning && (
              <div style={{
                padding: "12px 16px",
                marginBottom: 24,
                borderRadius: 12,
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.2)",
                fontSize: 13,
                color: "#fbbf24",
                lineHeight: 1.5,
              }}>
                ⚠️ This idea includes components outside our primary evaluation scope (hardware, physical services, or non-software elements). Scores evaluate the software and AI components. Challenges specific to physical components may not be fully captured.
              </div>
            )}

            {/* Classification */}
            {analysis.classification && (
              <div style={{ marginBottom: 24, display: "flex", gap: 8 }}>
                <span style={{
                  display: "inline-block",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 9999,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  ...(analysis.classification === "social_impact"
                    ? { background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }
                    : { background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }),
                }}>
                  {analysis.classification === "social_impact" ? "Social Impact" : "Commercial"}
                </span>
              </div>
            )}

            {/* Competition */}
            <section style={{ marginBottom: 48 }}>
              <SectionHeader icon="🌐" title="Competition Landscape" subtitle="Similar existing products in the market" t={t} />

              {analysis.competition.data_source === "verified" ? (
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 16,
                  padding: "6px 14px",
                  borderRadius: 9999,
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.2)",
                }}>
                  <span style={{ fontSize: 12, color: "#34d399", fontWeight: 600 }}>Verified Sources</span>
                  <span style={{ fontSize: 11, color: t.sec }}>via GitHub & Google</span>
                </div>
              ) : (
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 16,
                  padding: "6px 14px",
                  borderRadius: 9999,
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.2)",
                }}>
                  <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600 }}>AI-Generated</span>
                  <span style={{ fontSize: 11, color: t.sec }}>use as directional guide</span>
                </div>
              )}

              {(() => {
                const sourceColors = {
                  github: { bg: `${t.srcBadge.github}26`, color: t.srcBadge.github, border: `${t.srcBadge.github}4D`, label: "GitHub" },
                  google: { bg: `${t.srcBadge.google}26`, color: t.srcBadge.google, border: `${t.srcBadge.google}4D`, label: "Google" },
                  llm: { bg: `${t.srcBadge.llm}26`, color: t.srcBadge.llm, border: `${t.srcBadge.llm}4D`, label: "AI" },
                };
                const typeColors = {
                  direct: { label: "Direct", color: t.typeBadge.direct, bg: `${t.typeBadge.direct}1A`, border: `${t.typeBadge.direct}40` },
                  adjacent: { label: "Adjacent", color: t.typeBadge.adjacent, bg: `${t.typeBadge.adjacent}1A`, border: `${t.typeBadge.adjacent}40` },
                  substitute: { label: "Substitute", color: t.typeBadge.substitute, bg: `${t.typeBadge.substitute}1A`, border: `${t.typeBadge.substitute}40` },
                  internal_build: { label: "Internal Build", color: t.srcBadge.github, bg: `${t.srcBadge.github}1A`, border: `${t.srcBadge.github}40` },
                };

                const renderCompCard = (comp, i) => {
                  const src = sourceColors[comp.source] || sourceColors.llm;
                  const tc = typeColors[comp.competitor_type] || null;
                  return (
                    <Card key={i} style={{ display: "flex", flexDirection: "column", gap: 12 }} t={t}>
                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: "0 0 8px 0", wordBreak: "break-word" }}>{comp.name}</h3>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          {tc && (
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 9999,
                              border: `1px solid ${tc.border}`, background: tc.bg, color: tc.color,
                              letterSpacing: "0.03em", whiteSpace: "nowrap",
                            }}>
                              {tc.label}
                            </span>
                          )}
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 9999,
                            border: `1px solid ${src.border}`, background: src.bg, color: src.color,
                            textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
                          }}>
                            {src.label}
                          </span>
                          <StatusBadge status={comp.status} />
                        </div>
                      </div>
                      <p style={{ fontSize: 14, color: t.sec, lineHeight: 1.6, margin: 0, flex: 1 }}>
                        {comp.description}
                      </p>
                      <p style={{ fontSize: 12, color: "#34d399", fontWeight: 600, lineHeight: 1.5, margin: 0 }}>
                        {comp.outcome}
                      </p>
                      {comp.url && (
                        <a href={comp.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 12, color: t.link, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          Visit →
                        </a>
                      )}
                    </Card>
                  );
                };

                const hasCompetitorTypes = analysis.competition.competitors.some(c => c.competitor_type);

                if (hasCompetitorTypes) {
                  const directCompetitors = analysis.competition.competitors.filter(
                    c => c.competitor_type === "direct" || c.competitor_type === "adjacent"
                  );
                  const alternatives = analysis.competition.competitors.filter(
                    c => c.competitor_type === "substitute" || c.competitor_type === "internal_build"
                  );

                  return (
                    <div style={{ marginBottom: 16 }}>
                      {directCompetitors.length > 0 && (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 8 }}>
                            <span style={{ fontSize: 15 }}>⚔️</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: t.text, letterSpacing: "0.01em" }}>Direct Competitors</span>
                            <span style={{ fontSize: 11, color: t.mut, fontWeight: 500, marginLeft: 2 }}>{directCompetitors.length}</span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, marginBottom: 24 }}>
                            {directCompetitors.map((comp, i) => renderCompCard(comp, `direct-${i}`))}
                          </div>
                        </>
                      )}
                      {alternatives.length > 0 && (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 8 }}>
                            <span style={{ fontSize: 15 }}>🔄</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: t.text, letterSpacing: "0.01em" }}>Alternatives</span>
                            <span style={{ fontSize: 11, color: t.mut, fontWeight: 500, marginLeft: 2 }}>{alternatives.length}</span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, marginBottom: 16 }}>
                            {alternatives.map((comp, i) => renderCompCard(comp, `alt-${i}`))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                } else {
                  // Fallback: flat list for old saved evaluations without competitor_type
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, marginBottom: 16 }}>
                      {analysis.competition.competitors.map((comp, i) => renderCompCard(comp, i))}
                    </div>
                  );
                }
              })()}

              {analysis.competition.differentiation && (
                <Card style={{ background: t.surfAlt, marginBottom: 16 }} t={t}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: "0 0 8px 0" }}>
                    How your idea compares
                  </h3>
                  <p style={{ fontSize: 14, color: t.sec, lineHeight: 1.6, margin: 0 }}>
                    {analysis.competition.differentiation}
                  </p>
                </Card>
              )}
            </section>

            {/* Final Evaluation */}
            <section style={{ marginBottom: 48 }}>
              <SectionHeader icon="📊" title="Evaluation" subtitle="Scored analysis of your AI product idea" t={t} />

              {/* Overall score */}
              <Card style={{ padding: 32, textAlign: "center", marginBottom: 16 }} t={t}>
                <p style={{ fontSize: 12, color: t.sec, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, margin: "0 0 4px 0" }}>
                  Overall Idea Potential
                </p>
                <p style={{ fontSize: 10, color: t.mut, margin: "0 0 12px 0" }}>
                  Weighted average · Higher is better
                </p>
                <p style={{ fontSize: 64, fontWeight: 700, color: t.text, margin: 0, lineHeight: 1 }}>
                  {analysis.evaluation.overall_score.toFixed(1)}
                  <span style={{ fontSize: 20, fontWeight: 400, color: t.mut }}>/10</span>
                </p>
                <button
                  onClick={() => setShowScoreGuide(true)}
                  style={{
                    marginTop: 12,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 10px",
                    borderRadius: 8,
                    color: t.mut,
                    fontSize: 11,
                    fontWeight: 500,
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = t.sec}
                  onMouseLeave={(e) => e.currentTarget.style.color = t.mut}
                >
                  <span style={{ fontSize: 13 }}>ⓘ</span> What does this score mean?
                </button>
              </Card>

              {/* Score Guide Popup */}
              {showScoreGuide && (
                <div
                  onClick={() => setShowScoreGuide(false)}
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(0,0,0,0.7)",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999,
                    padding: 16,
                  }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      background: t.modalBg,
                      border: `1px solid ${t.inputBorder}`,
                      borderRadius: 16,
                      padding: 28,
                      maxWidth: 480,
                      width: "100%",
                      maxHeight: "80vh",
                      overflowY: "auto",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>
                        Score Guide
                      </h3>
                      <button
                        onClick={() => setShowScoreGuide(false)}
                        style={{
                          background: t.surfAlt,
                          border: `1px solid ${t.border}`,
                          borderRadius: 8,
                          width: 28,
                          height: 28,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: t.sec,
                          fontSize: 14,
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    <p style={{ fontSize: 13, color: t.sec, lineHeight: 1.6, margin: "0 0 20px 0" }}>
                      This evaluator is deliberately rigorous. A 7+ is rare and means a genuinely strong startup opportunity. Most real ideas land between 5–7, and that's normal.
                    </p>

                    {[
                      {
                        range: "9 – 10",
                        color: "#10b981",
                        title: "Category Creators",
                        desc: "Ideas that redefine behavior for hundreds of millions. Think Google, iPhone, WhatsApp, Uber. Almost no idea scores here at conception — these scores are essentially theoretical.",
                      },
                      {
                        range: "8 – 9",
                        color: "#10b981",
                        title: "Exceptional Opportunities",
                        desc: "Massive proven markets with strong structural moats. Think Shopify, Stripe, Zoom. Very few ideas score here — many that became 8–9 companies would have scored 6–7 at the idea stage.",
                      },
                      {
                        range: "7 – 8",
                        color: "#3b82f6",
                        title: "Strong Startup Ideas",
                        desc: "Clear demand, real differentiation, viable revenue path. This is what a genuinely good startup idea looks like. Most successful startups began in this range.",
                      },
                      {
                        range: "6 – 7",
                        color: "#3b82f6",
                        title: "Strong Opportunity",
                        desc: "Clear demand, viable revenue path, and real challenges to solve. A score here means the idea is worth serious validation. Many successful companies started in this range.",
                      },
                      {
                        range: "5 – 6",
                        color: "#3b82f6",
                        title: "Viable but Competitive",
                        desc: "Where most decent ideas land. Real pain exists, but there's friction — competitive pressure, unclear monetization, or weak differentiation. Not a rejection — it means solve these challenges and you have something.",
                      },
                      {
                        range: "3 – 5",
                        color: "#f59e0b",
                        title: "Fundamental Issues",
                        desc: "Missing buyer clarity, saturated market, or unproven core value proposition. Needs significant pivoting or rethinking before building.",
                      },
                      {
                        range: "1 – 3",
                        color: "#ef4444",
                        title: "Critical Flaws",
                        desc: "No real demand, no viable revenue path, or depends on unproven assumptions across every dimension.",
                      },
                    ].map((tier, i) => (
                      <div key={i} style={{
                        padding: "12px 14px",
                        marginBottom: 8,
                        borderRadius: 10,
                        background: t.surface,
                        border: `1px solid ${t.border}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <span style={{
                            fontSize: 13,
                            fontWeight: 700,
                            fontFamily: "monospace",
                            color: tier.color,
                            minWidth: 44,
                          }}>
                            {tier.range}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                            {tier.title}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: t.sec, lineHeight: 1.5, margin: 0 }}>
                          {tier.desc}
                        </p>
                      </div>
                    ))}

                    <p style={{ fontSize: 11, color: t.mut, lineHeight: 1.5, margin: "16px 0 0 0", textAlign: "center" }}>
                      A score of 5–6 doesn't mean "bad idea" — it means "real challenges to solve."
                    </p>
                  </div>
                </div>
              )}

              {/* Confidence Level */}
              {analysis.evaluation.confidence_level && (
                <div style={{
                  marginBottom: 16,
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: analysis.evaluation.confidence_level.level === "HIGH"
                    ? "rgba(16,185,129,0.06)"
                    : analysis.evaluation.confidence_level.level === "LOW"
                    ? "rgba(239,68,68,0.06)"
                    : "rgba(245,158,11,0.06)",
                  border: `1px solid ${
                    analysis.evaluation.confidence_level.level === "HIGH"
                      ? "rgba(16,185,129,0.2)"
                      : analysis.evaluation.confidence_level.level === "LOW"
                      ? "rgba(239,68,68,0.2)"
                      : "rgba(245,158,11,0.2)"
                  }`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: t.sec, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Evaluation Confidence
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 6,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      background: analysis.evaluation.confidence_level.level === "HIGH"
                        ? "rgba(16,185,129,0.15)"
                        : analysis.evaluation.confidence_level.level === "LOW"
                        ? "rgba(239,68,68,0.15)"
                        : "rgba(245,158,11,0.15)",
                      color: analysis.evaluation.confidence_level.level === "HIGH"
                        ? "#34d399"
                        : analysis.evaluation.confidence_level.level === "LOW"
                        ? "#f87171"
                        : "#fbbf24",
                    }}>
                      {analysis.evaluation.confidence_level.level}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, color: t.sec, lineHeight: 1.5 }}>
                    {analysis.evaluation.confidence_level.reason}
                  </span>
                </div>
              )}

              {/* Metrics */}
              <Card style={{ padding: 32, marginBottom: 16 }} t={t}>
                <ScoreBar
                  name="Market Demand"
                  score={analysis.evaluation.market_demand.score}
                  explanation={analysis.evaluation.market_demand.explanation}
                  weight="30%"
                  notes={[
                    analysis.evaluation.market_demand.geographic_note,
                    analysis.evaluation.market_demand.trajectory_note,
                  ].filter(Boolean)}
                  t={t}
                />
                <ScoreBar
                  name={analysis.evaluation.monetization.label || "Monetization Potential"}
                  score={analysis.evaluation.monetization.score}
                  explanation={analysis.evaluation.monetization.explanation}
                  weight="25%"
                  t={t}
                />
                <ScoreBar
                  name="Originality"
                  score={analysis.evaluation.originality.score}
                  explanation={analysis.evaluation.originality.explanation}
                  weight="25%"
                  t={t}
                />
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                      Technical Complexity
                      <span style={{ fontSize: 11, fontWeight: 400, color: t.mut, marginLeft: 8 }}>20% · inverted</span>
                    </span>
                    <span style={{
                      fontSize: 14,
                      fontFamily: "monospace",
                      fontWeight: 600,
                      color: getTcColor(analysis.evaluation.technical_complexity.score),
                    }}>
                      {analysis.evaluation.technical_complexity.score.toFixed(1)}/10
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 8, background: t.barBg, borderRadius: 9999, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      borderRadius: 9999,
                      background: getTcColor(analysis.evaluation.technical_complexity.score),
                      width: `${(analysis.evaluation.technical_complexity.score / 10) * 100}%`,
                      transition: "width 1s ease-out",
                    }} />
                  </div>
                  <p style={{ fontSize: 12, color: t.sec, marginTop: 8, lineHeight: 1.5 }}>
                    {analysis.evaluation.technical_complexity.base_score_explanation}
                    {" "}{analysis.evaluation.technical_complexity.adjustment_explanation}
                    {" "}{analysis.evaluation.technical_complexity.explanation}
                  </p>
                  {analysis.evaluation.technical_complexity.incremental_note && (
                    <p style={{ fontSize: 11, color: t.mut, marginTop: 4, lineHeight: 1.4, fontStyle: "italic" }}>
                      {analysis.evaluation.technical_complexity.incremental_note}
                    </p>
                  )}
                </div>
              </Card>

              {/* Marketplace Note */}
              {analysis.evaluation.marketplace_note && (
                <Card style={{ padding: 24, marginBottom: 16, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }} t={t}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: t.link, margin: "0 0 6px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Marketplace Note
                  </p>
                  <p style={{ fontSize: 13, color: t.sec, lineHeight: 1.6, margin: 0 }}>
                    {analysis.evaluation.marketplace_note}
                  </p>
                </Card>
              )}

              {/* Summary */}
              <Card style={{ padding: 32 }} t={t}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: "0 0 12px 0" }}>Summary</h3>
                <p style={{ fontSize: 14, color: t.sec, lineHeight: 1.7, margin: 0 }}>
                  {analysis.evaluation.summary}
                </p>
              </Card>

              {/* Disclaimer */}
              <p style={{ fontSize: 12, color: t.mut, textAlign: "center", margin: "16px 0 24px 0", lineHeight: 1.5 }}>
                Scores evaluate the idea's potential. Actual outcomes also depend on execution quality, distribution, timing, and market conditions.
              </p>
            </section>

            <button
              onClick={() => setCurrentScreen("results2")}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                background: t.ctaBg,
                color: t.ctaText,
                cursor: "pointer",
              }}
            >
              {viewingFromSaved ? "View Your Roadmap" : "Continue to Roadmap"}
            </button>
          </PageContainer>
        </main>

        <footer style={footerStyle}>
          <PageContainer wide>
            <p style={{ fontSize: 12, color: t.mut, margin: 0 }}>
              IdeaLoop Core — All analysis is AI-generated. Use as a guide, not a definitive assessment.
            </p>
          </PageContainer>
        </footer>
      </div>
    );
  }

  // ==========================================
  // SCREEN: EXECUTION PLAN + TOOLS + ESTIMATES (results2)
  // ==========================================
  if (screen === "results2") {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, color: t.text, display: "flex", flexDirection: "column", overflowX: "hidden" }}>
        {t.accentBar && <div style={{ height: 3, background: "#eab308", opacity: 0.4 }} />}
        {devModeExplicit && <DevModeBadge mode={devMode} />}
        <header style={headerStyle}>
          <PageContainer wide>
            <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 onClick={() => setCurrentScreen(profile.coding && profile.ai ? "input" : "profile")} style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: t.mut, margin: 0, cursor: "pointer" }}>
                IdeaLoop Core
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => setCurrentScreen("results1")} style={{ fontSize: 12, color: t.mut, background: "none", border: "none", cursor: "pointer" }}>
                  ← Back to analysis
                </button>
                {!authLoading && user && (
                  <>
                    <span style={{ color: t.divider }}>|</span>
                    {!viewingFromSaved && (
                      <>
                        <button onClick={goToMyIdeas} style={{ fontSize: 12, color: t.link, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
                          My Ideas
                        </button>
                        <span style={{ color: t.divider }}>|</span>
                      </>
                    )}
                    <span style={{ fontSize: 12, color: t.mut }}>{user.email}</span>
                    <button onClick={handleLogout} style={{ fontSize: 12, color: t.mut, background: "none", border: "none", cursor: "pointer" }}>
                      Log out
                    </button>
                  </>
                )}
              </div>
            </div>
          </PageContainer>
        </header>

        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onAuth={(u) => setUser(u)}
            t={t}
          />
        )}

        <StepProgress currentStep={getStepNumber()} savedMode={viewingFromSaved} branchMode={viewingFromSaved && isBranchIdea} t={t} />

        <main style={{ flex: 1, paddingBottom: 64 }}>
          <PageContainer wide>
            {/* Failure Risks */}
            {analysis.evaluation.failure_risks && analysis.evaluation.failure_risks.length > 0 && (
              <section style={{ marginBottom: 48 }}>
                <SectionHeader icon="⚠️" title="Key Risks" subtitle="Potential challenges to be aware of before building" t={t} />
                <Card style={{
                  padding: 24,
                  background: "rgba(239,68,68,0.04)",
                  border: "1px solid rgba(239,68,68,0.15)",
                }} t={t}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {analysis.evaluation.failure_risks.map((risk, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: t.riskNum,
                          flexShrink: 0,
                          marginTop: 1,
                        }}>
                          {i + 1}.
                        </span>
                        <p style={{ fontSize: 14, color: t.sec, lineHeight: 1.6, margin: 0 }}>
                          {risk}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            )}

            {/* Phases */}
            <section style={{ marginBottom: 48 }}>
              <SectionHeader icon="⚙" title="Execution Phases" subtitle={viewingFromSaved ? "Track your progress across each phase" : "Recommended roadmap for building your idea"} t={t} />

              {/* Progress summary bar — only show for saved ideas */}
              {viewingFromSaved && currentEvaluationId && currentPhases.length > 0 && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 16,
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: t.surfAlt,
                  border: `1px solid ${t.border}`,
                }}>
                  <div style={{
                    display: "flex",
                    gap: 3,
                    flex: 1,
                  }}>
                    {currentPhases.map((_, idx) => {
                      const phaseKey = `phase_${idx + 1}`;
                      const isCompleted = phaseProgress[phaseKey]?.completed;
                      return (
                        <div key={idx} style={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          background: isCompleted ? "#10b981" : t.barBg,
                          transition: "background 0.3s",
                        }} />
                      );
                    })}
                  </div>
                  <span style={{ fontSize: 12, color: t.sec, flexShrink: 0 }}>
                    {currentPhases.filter((_, idx) => phaseProgress[`phase_${idx + 1}`]?.completed).length}/{currentPhases.length} complete
                  </span>
                </div>
              )}

              {(() => {
                const hasPhaseTypes = currentPhases.some(p => p.phase_type);
                const canTrackProgress = viewingFromSaved && !!currentEvaluationId;

                // Build phase cards with original index preserved
                const phasesWithIndex = currentPhases.map((phase, i) => ({ phase, originalIndex: i }));

                const renderPhaseCard = ({ phase, originalIndex }) => {
                  const i = originalIndex;
                  const phaseKey = `phase_${i + 1}`;
                  const progress = phaseProgress[phaseKey];
                  const isCompleted = progress?.completed;
                  const isSaving = savingProgress[phaseKey];

                  return (
                  <div
                    key={i}
                    style={{
                      background: t.surface,
                      border: `1px solid ${isCompleted ? "rgba(16,185,129,0.3)" : t.border}`,
                      borderRadius: 16,
                      overflow: "hidden",
                      transition: "border-color 0.3s",
                      boxShadow: t.shadow,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "20px 24px",
                      }}
                    >
                      {/* Checkbox — only for saved ideas */}
                      {canTrackProgress ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePhaseProgress(phaseKey);
                          }}
                          disabled={isSaving}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: isCompleted ? `${t.stepDone}33` : t.phaseNum.bg,
                            border: `2px solid ${isCompleted ? `${t.stepDone}80` : t.phaseNum.border}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: isCompleted ? 16 : 14,
                            fontWeight: 700,
                            color: isCompleted ? t.stepDone : t.phaseNum.color,
                            flexShrink: 0,
                            cursor: isSaving ? "not-allowed" : "pointer",
                            transition: "all 0.2s",
                            opacity: isSaving ? 0.5 : 1,
                            padding: 0,
                          }}
                        >
                          {isCompleted ? "✓" : phase.number}
                        </button>
                      ) : (
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: t.phaseNum.bg,
                          border: `1px solid ${t.phaseNum.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          fontWeight: 700,
                          color: t.phaseNum.color,
                          flexShrink: 0,
                        }}>
                          {phase.number}
                        </div>
                      )}

                      <div
                        onClick={() => togglePhase(i)}
                        style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                      >
                        <h3 style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: isCompleted ? t.sec : t.text,
                          margin: 0,
                          textDecoration: isCompleted ? "line-through" : "none",
                          transition: "all 0.2s",
                        }}>
                          {phase.title}
                        </h3>
                        <p style={{
                          fontSize: 14,
                          color: isCompleted ? t.mut : t.sec,
                          margin: "4px 0 0 0",
                          lineHeight: 1.5,
                        }}>
                          {phase.summary}
                        </p>
                      </div>
                      <span
                        onClick={() => togglePhase(i)}
                        style={{
                          color: t.mut,
                          transition: "transform 0.2s",
                          transform: expandedPhases[i] ? "rotate(180deg)" : "rotate(0deg)",
                          flexShrink: 0,
                          fontSize: 18,
                          cursor: "pointer",
                        }}
                      >
                        ▾
                      </span>
                    </div>

                    {expandedPhases[i] && (
                      <div style={{ padding: "0 24px 24px 24px", borderTop: `1px solid ${t.border}` }}>
                        {editingPhase === i ? (
                          <div style={{ paddingTop: 20 }}>
                            <input
                              type="text"
                              value={(editedPhases || analysis.phases)[i].title}
                              onChange={(e) => savePhaseEdit(i, "title", e.target.value)}
                              style={{
                                width: "100%",
                                background: t.inputBg,
                                border: `1px solid ${t.inputBorder}`,
                                borderRadius: 12,
                                padding: "10px 16px",
                                fontSize: 14,
                                color: t.inputText,
                                outline: "none",
                                boxSizing: "border-box",
                                marginBottom: 12,
                              }}
                            />
                            <textarea
                              value={(editedPhases || analysis.phases)[i].details}
                              onChange={(e) => savePhaseEdit(i, "details", e.target.value)}
                              rows={6}
                              style={{
                                width: "100%",
                                background: t.inputBg,
                                border: `1px solid ${t.inputBorder}`,
                                borderRadius: 12,
                                padding: "12px 16px",
                                fontSize: 14,
                                color: t.inputText,
                                outline: "none",
                                resize: "none",
                                lineHeight: 1.6,
                                boxSizing: "border-box",
                                fontFamily: "inherit",
                                marginBottom: 12,
                              }}
                            />
                            <button
                              onClick={stopEditingPhase}
                              style={{ fontSize: 12, fontWeight: 500, color: "#34d399", background: "none", border: "none", cursor: "pointer" }}
                            >
                              ✓ Done editing
                            </button>
                          </div>
                        ) : (
                          <div style={{ paddingTop: 20 }}>
                            <p style={{ fontSize: 14, color: t.sec, lineHeight: 1.7, margin: "0 0 16px 0", whiteSpace: "pre-line" }}>
                              {(editedPhases || analysis.phases)[i].details}
                            </p>

                            {/* Notes section — only for saved ideas */}
                            {canTrackProgress && (
                              <div style={{
                                marginTop: 16,
                                padding: "12px 16px",
                                borderRadius: 12,
                                background: t.surfAlt,
                                border: `1px solid ${t.border}`,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: t.sec, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Notes
                                  </span>
                                  {progress?.note && editingNotePhase !== phaseKey && (
                                    <button
                                      onClick={() => {
                                        setEditingNotePhase(phaseKey);
                                        setNoteText(progress.note);
                                      }}
                                      style={{ fontSize: 11, color: t.mut, background: "none", border: "none", cursor: "pointer" }}
                                    >
                                      Edit
                                    </button>
                                  )}
                                </div>

                                {editingNotePhase === phaseKey ? (
                                  <div>
                                    <textarea
                                      value={noteText}
                                      onChange={(e) => setNoteText(e.target.value)}
                                      placeholder="Add notes about your progress on this phase..."
                                      rows={3}
                                      style={{
                                        width: "100%",
                                        background: t.inputBg,
                                        border: `1px solid ${t.inputBorder}`,
                                        borderRadius: 8,
                                        padding: "10px 12px",
                                        fontSize: 13,
                                        color: t.text,
                                        outline: "none",
                                        resize: "none",
                                        lineHeight: 1.5,
                                        boxSizing: "border-box",
                                        fontFamily: "inherit",
                                      }}
                                    />
                                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                      <button
                                        onClick={() => {
                                          savePhaseNote(phaseKey, noteText);
                                          setEditingNotePhase(null);
                                        }}
                                        disabled={isSaving}
                                        style={{
                                          fontSize: 12,
                                          fontWeight: 500,
                                          color: "#34d399",
                                          background: "none",
                                          border: "none",
                                          cursor: isSaving ? "not-allowed" : "pointer",
                                        }}
                                      >
                                        {isSaving ? "Saving..." : "Save note"}
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingNotePhase(null);
                                          setNoteText("");
                                        }}
                                        style={{ fontSize: 12, color: t.mut, background: "none", border: "none", cursor: "pointer" }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : progress?.note ? (
                                  <p style={{ fontSize: 13, color: t.sec, lineHeight: 1.5, margin: 0, whiteSpace: "pre-line" }}>
                                    {progress.note}
                                  </p>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingNotePhase(phaseKey);
                                      setNoteText("");
                                    }}
                                    style={{
                                      fontSize: 12,
                                      color: t.mut,
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      padding: 0,
                                    }}
                                  >
                                    + Add a note
                                  </button>
                                )}
                              </div>
                            )}

                            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                              <button
                                onClick={() => startEditingPhase(i)}
                                style={{ fontSize: 12, fontWeight: 500, color: t.mut, background: "none", border: "none", cursor: "pointer" }}
                              >
                                Edit this phase
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                };

                if (hasPhaseTypes) {
                  const groups = [
                    { type: "validate", icon: "🔍", title: "Validate & Prototype" },
                    { type: "build", icon: "🛠", title: "Core Build" },
                    { type: "launch", icon: "🚀", title: "Launch & Grow" },
                  ];
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {groups.map(group => {
                        const groupPhases = phasesWithIndex.filter(p => p.phase.phase_type === group.type);
                        if (groupPhases.length === 0) return null;
                        return (
                          <div key={group.type}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 8 }}>
                              <span style={{ fontSize: 15 }}>{group.icon}</span>
                              <span style={{ fontSize: 14, fontWeight: 600, color: t.text, letterSpacing: "0.01em" }}>{group.title}</span>
                              <span style={{ fontSize: 11, color: t.mut, fontWeight: 500, marginLeft: 2 }}>{groupPhases.length} phases</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                              {groupPhases.map(p => renderPhaseCard(p))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                } else {
                  // Fallback: flat list for old saved evaluations
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {phasesWithIndex.map(p => renderPhaseCard(p))}
                    </div>
                  );
                }
              })()}
            </section>



            {/* Tools */}
            <section style={{ marginBottom: 48 }}>
              <SectionHeader icon="🔧" title="Tool Recommendations" subtitle="Platforms and tools to help you build" t={t} />

              {(() => {
                const toolCategories = ["Validate & Prototype", "Core Tech Stack", "Launch & Grow"];
                const hasNewCategories = analysis.tools?.some(tl => toolCategories.includes(tl.category));

                if (hasNewCategories) {
                  const groupIcons = {
                    "Validate & Prototype": "🔍",
                    "Core Tech Stack": "🛠",
                    "Launch & Grow": "🚀",
                  };
                  return (
                    <div>
                      {toolCategories.map(category => {
                        const groupTools = analysis.tools.filter(tl => tl.category === category);
                        if (groupTools.length === 0) return null;
                        return (
                          <div key={category}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 8 }}>
                              <span style={{ fontSize: 15 }}>{groupIcons[category]}</span>
                              <span style={{ fontSize: 14, fontWeight: 600, color: t.text, letterSpacing: "0.01em" }}>{category}</span>
                              <span style={{ fontSize: 11, color: t.mut, fontWeight: 500, marginLeft: 2 }}>{groupTools.length} tools</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 24 }}>
                              {groupTools.map((tool, i) => (
                                <Card key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }} t={t}>
                                  <div>
                                    <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: 0 }}>{tool.name}</h3>
                                  </div>
                                  <p style={{ fontSize: 14, color: t.toolDesc, lineHeight: 1.6, margin: 0 }}>
                                    {tool.description}
                                  </p>
                                </Card>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                } else {
                  // Fallback: flat list for old saved evaluations
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                      {analysis.tools.map((tool, i) => (
                        <Card key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }} t={t}>
                          <div>
                            <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: 0 }}>{tool.name}</h3>
                            <p style={{ fontSize: 12, color: t.sec, margin: "4px 0 0 0", fontWeight: 500 }}>{tool.category}</p>
                          </div>
                          <p style={{ fontSize: 14, color: t.toolDesc, lineHeight: 1.6, margin: 0 }}>
                            {tool.description}
                          </p>
                        </Card>
                      ))}
                    </div>
                  );
                }
              })()}
            </section>

            {/* Time & Difficulty */}
            <section style={{ marginBottom: 48 }}>
              <SectionHeader icon="⏱" title="Time & Difficulty" subtitle="Calibrated to your experience level" t={t} />

              <Card style={{ padding: 32 }} t={t}>
                <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", marginBottom: 24 }}>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: t.sec, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, margin: "0 0 8px 0" }}>
                      Estimated Duration
                    </p>
                    <p style={{ fontSize: 24, fontWeight: 700, color: t.text, margin: 0 }}>
                      {analysis.estimates.duration}
                    </p>
                  </div>
                  <div style={{ width: 1, height: 64, background: t.divider }} />
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: t.sec, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, margin: "0 0 8px 0" }}>
                      Difficulty Level
                    </p>
                    <span style={{
                      display: "inline-block",
                      fontSize: 14,
                      fontWeight: 700,
                      padding: "6px 16px",
                      borderRadius: 9999,
                      ...(analysis.estimates.difficulty === "Very Hard"
                        ? { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }
                        : analysis.estimates.difficulty === "Hard"
                        ? { background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }
                        : analysis.estimates.difficulty === "Moderate"
                        ? { background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }
                        : { background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }),
                    }}>
                      {analysis.estimates.difficulty}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: t.sec, textAlign: "center", lineHeight: 1.6, maxWidth: 560, margin: "0 auto" }}>
                  {analysis.estimates.explanation}
                </p>
              </Card>
            </section>

            {/* Save / Decision block — shown after user has seen everything */}
            {!viewingFromSaved && (
              <div style={{ marginBottom: 16 }}>
                {isReEvalResult ? (
                  /* POST-EVALUATION DECISION BLOCK — shown for re-eval results */
                  <div style={{
                    padding: "20px 24px",
                    borderRadius: 16,
                    background: "rgba(108,99,255,0.04)",
                    border: "1px solid rgba(108,99,255,0.2)",
                  }}>
                    {saveStatus === "saved" ? (
                      <div style={{
                        width: "100%",
                        padding: "14px 0",
                        borderRadius: 12,
                        fontSize: 14,
                        fontWeight: 600,
                        textAlign: "center",
                        background: "rgba(16,185,129,0.1)",
                        border: "1px solid rgba(16,185,129,0.3)",
                        color: "#34d399",
                      }}>
                        ✓ Saved as branch
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#a78bfa", flexShrink: 0 }} />
                          <p style={{ fontSize: 15, fontWeight: 600, color: t.text, margin: 0 }}>
                            What do you want to do with this version?
                          </p>
                        </div>
                        {saveStatus === "naming" ? (
                          <div style={{
                            padding: "16px 20px",
                            borderRadius: 12,
                            background: t.surface,
                            border: "1px solid rgba(108,99,255,0.3)",
                          }}>
                            {/* Branch name */}
                            <label style={{ fontSize: 13, fontWeight: 500, color: t.sec, display: "block", marginBottom: 8 }}>
                              Name this branch
                            </label>
                            <input
                              type="text"
                              value={ideaName}
                              onChange={(e) => setIdeaName(e.target.value)}
                              placeholder="e.g., B2B pivot, Enterprise focus, Narrower wedge..."
                              autoFocus
                              maxLength={80}
                              style={{
                                width: "100%",
                                background: t.inputBg,
                                border: `1px solid ${t.inputBorder}`,
                                borderRadius: 10,
                                padding: "10px 14px",
                                fontSize: 14,
                                color: t.inputText,
                                outline: "none",
                                boxSizing: "border-box",
                                marginBottom: 14,
                              }}
                            />

                            {/* Branch reason */}
                            <label style={{ fontSize: 13, fontWeight: 500, color: t.sec, display: "block", marginBottom: 8 }}>
                              Why is this a different direction?
                            </label>
                            <input
                              type="text"
                              value={branchReason}
                              onChange={(e) => setBranchReason(e.target.value)}
                              placeholder="e.g., Narrowed to enterprise buyers for clearer revenue"
                              maxLength={200}
                              style={{
                                width: "100%",
                                background: t.inputBg,
                                border: `1px solid ${t.inputBorder}`,
                                borderRadius: 10,
                                padding: "10px 14px",
                                fontSize: 14,
                                color: t.inputText,
                                outline: "none",
                                boxSizing: "border-box",
                                marginBottom: 14,
                              }}
                            />

                            {/* Changed dimensions */}
                            <label style={{ fontSize: 13, fontWeight: 500, color: t.sec, display: "block", marginBottom: 8 }}>
                              What changed? <span style={{ fontWeight: 400, color: t.mut }}>(select at least one)</span>
                            </label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                              {[
                                { key: "target_user", label: "Target user" },
                                { key: "problem", label: "Problem" },
                                { key: "wedge", label: "Value prop / Wedge" },
                                { key: "monetization", label: "Monetization" },
                                { key: "gtm", label: "Go-to-market" },
                                { key: "core_concept", label: "Core concept" },
                              ].map((dim) => {
                                const selected = branchDimensions.includes(dim.key);
                                return (
                                  <button
                                    key={dim.key}
                                    onClick={() => {
                                      setBranchDimensions((prev) =>
                                        selected ? prev.filter((d) => d !== dim.key) : [...prev, dim.key]
                                      );
                                    }}
                                    style={{
                                      padding: "6px 12px",
                                      borderRadius: 8,
                                      fontSize: 12,
                                      fontWeight: 500,
                                      border: selected ? "1px solid rgba(139,92,246,0.5)" : `1px solid ${t.border}`,
                                      background: selected ? "rgba(139,92,246,0.15)" : "transparent",
                                      color: selected ? "#a78bfa" : t.sec,
                                      cursor: "pointer",
                                      transition: "all 0.15s",
                                    }}
                                  >
                                    {selected ? "✓ " : ""}{dim.label}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Action buttons */}
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={handleSaveIdea}
                                disabled={!ideaName.trim() || !branchReason.trim() || branchDimensions.length === 0}
                                style={{
                                  flex: 1,
                                  padding: "10px 0",
                                  borderRadius: 10,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  border: "none",
                                  cursor: (!ideaName.trim() || !branchReason.trim() || branchDimensions.length === 0) ? "not-allowed" : "pointer",
                                  background: (!ideaName.trim() || !branchReason.trim() || branchDimensions.length === 0) ? t.surfAlt : "rgba(139,92,246,0.2)",
                                  color: (!ideaName.trim() || !branchReason.trim() || branchDimensions.length === 0) ? t.mut : "#a78bfa",
                                }}
                              >
                                Save branch
                              </button>
                              <button
                                onClick={() => { setSaveStatus("idle"); setIdeaName(""); setBranchReason(""); setBranchDimensions([]); }}
                                style={{
                                  padding: "10px 16px",
                                  borderRadius: 10,
                                  fontSize: 13,
                                  fontWeight: 500,
                                  border: `1px solid ${t.border}`,
                                  background: "transparent",
                                  color: t.mut,
                                  cursor: "pointer",
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <button
                              onClick={handleSaveIdea}
                              disabled={saveStatus === "saving"}
                              style={{
                                width: "100%",
                                padding: "14px 16px",
                                borderRadius: 12,
                                fontSize: 14,
                                fontWeight: 600,
                                border: "1px solid rgba(108,99,255,0.4)",
                                cursor: saveStatus === "saving" ? "not-allowed" : "pointer",
                                background: saveStatus === "saving" ? t.surfAlt : "rgba(108,99,255,0.12)",
                                color: saveStatus === "saving" ? t.mut : "#a78bfa",
                                textAlign: "left",
                                transition: "all 0.2s",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span>{saveStatus === "saving" ? "Saving..." : "Save as branch"}</span>
                                <span style={{ fontSize: 18, opacity: 0.5 }}>→</span>
                              </div>
                              <p style={{ fontSize: 12, color: t.sec, margin: "6px 0 0", fontWeight: 400 }}>
                                Keep this as a new direction linked to the parent idea
                              </p>
                            </button>

                            {/* Set as main version — saves branch + marks it as main */}
                            <button
                              onClick={() => {
                                // Open branch form with set-as-main flag
                                setBranchSetAsMain(true);
                                setBranchReason("");
                                setBranchDimensions([]);
                                setIdeaName("Branch");
                                setSaveStatus("naming");
                              }}
                              disabled={saveStatus === "saving"}
                              style={{
                                width: "100%",
                                padding: "14px 16px",
                                borderRadius: 12,
                                fontSize: 14,
                                fontWeight: 500,
                                border: "1px solid rgba(16,185,129,0.3)",
                                cursor: saveStatus === "saving" ? "not-allowed" : "pointer",
                                background: "rgba(16,185,129,0.06)",
                                color: "#34d399",
                                textAlign: "left",
                                transition: "all 0.2s",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span>★ Set as main version</span>
                                <span style={{ fontSize: 18, opacity: 0.5 }}>→</span>
                              </div>
                              <p style={{ fontSize: 12, color: t.mut, margin: "6px 0 0", fontWeight: 400 }}>
                                Save as branch and promote it as your current best direction
                              </p>
                            </button>

                            <button
                              onClick={onDiscardReEval}
                              style={{
                                width: "100%",
                                padding: "14px 16px",
                                borderRadius: 12,
                                fontSize: 14,
                                fontWeight: 500,
                                border: `1px solid ${t.border}`,
                                background: "transparent",
                                color: t.sec,
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 0.2s",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span>Discard</span>
                                <span style={{ fontSize: 18, opacity: 0.3 }}>×</span>
                              </div>
                              <p style={{ fontSize: 12, color: t.mut, margin: "6px 0 0", fontWeight: 400 }}>
                                This was just a test, don't save
                              </p>
                            </button>
                          </div>
                        )}
                        {saveStatus === "error" && saveError && (
                          <p style={{ fontSize: 12, color: "#f87171", textAlign: "center", marginTop: 8 }}>
                            {saveError}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  /* NORMAL SAVE FLOW — for first-time evaluations */
                  user ? (
                    saveStatus === "saved" ? (
                    <div style={{
                      width: "100%",
                      padding: "14px 0",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 600,
                      textAlign: "center",
                      background: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.3)",
                      color: "#34d399",
                    }}>
                      ✓ Saved to My Ideas {entitlements.isSubscriber ? "" : `(${savedIdeasCount}/${entitlements.saveCap})`}
                    </div>
                  ) : !entitlements.isSubscriber && savedIdeasCount >= entitlements.saveCap ? (
                    <div style={{
                      width: "100%",
                      padding: "14px 0",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 500,
                      textAlign: "center",
                      background: "rgba(245,158,11,0.08)",
                      border: "1px solid rgba(245,158,11,0.2)",
                      color: "#fbbf24",
                    }}>
                      Save limit reached ({entitlements.saveCap}/{entitlements.saveCap} ideas saved)
                    </div>
                  ) : saveStatus === "naming" ? (
                    <div style={{
                      padding: "16px 20px",
                      borderRadius: 12,
                      background: t.surface,
                      border: "1px solid rgba(59,130,246,0.3)",
                    }}>
                      <label style={{ fontSize: 13, fontWeight: 500, color: t.sec, display: "block", marginBottom: 8 }}>
                        Name this idea
                      </label>
                      <input
                        type="text"
                        value={ideaName}
                        onChange={(e) => setIdeaName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && ideaName.trim() && handleSaveIdea()}
                        placeholder="e.g., AI Nutrition Coach, Learning OS..."
                        autoFocus
                        maxLength={80}
                        style={{
                          width: "100%",
                          background: t.inputBg,
                          border: `1px solid ${t.inputBorder}`,
                          borderRadius: 10,
                          padding: "10px 14px",
                          fontSize: 14,
                          color: t.inputText,
                          outline: "none",
                          boxSizing: "border-box",
                          marginBottom: 12,
                        }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={handleSaveIdea}
                          disabled={!ideaName.trim()}
                          style={{
                            flex: 1,
                            padding: "10px 0",
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 600,
                            border: "none",
                            cursor: !ideaName.trim() ? "not-allowed" : "pointer",
                            background: !ideaName.trim() ? t.surfAlt : "rgba(59,130,246,0.15)",
                            color: !ideaName.trim() ? t.mut : t.link,
                          }}
                        >
                          Save {entitlements.isSubscriber ? "" : `(${savedIdeasCount}/${entitlements.saveCap})`}
                        </button>
                        <button
                          onClick={() => { setSaveStatus("idle"); setIdeaName(""); }}
                          style={{
                            padding: "10px 16px",
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 500,
                            border: `1px solid ${t.border}`,
                            background: "transparent",
                            color: t.mut,
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={handleSaveIdea}
                        disabled={saveStatus === "saving"}
                        style={{
                          width: "100%",
                          padding: "14px 0",
                          borderRadius: 12,
                          fontSize: 14,
                          fontWeight: 600,
                          border: "1px solid rgba(59,130,246,0.4)",
                          cursor: saveStatus === "saving" ? "not-allowed" : "pointer",
                          background: saveStatus === "saving" ? t.surfAlt : "rgba(59,130,246,0.12)",
                          color: saveStatus === "saving" ? t.mut : t.link,
                          transition: "all 0.2s",
                        }}
                      >
                        {saveStatus === "saving" ? "Saving..." : entitlements.isSubscriber ? "Save to My Ideas" : `Save to My Ideas (${savedIdeasCount}/${entitlements.saveCap})`}
                      </button>
                      {saveStatus === "error" && saveError && (
                        <p style={{ fontSize: 12, color: "#f87171", textAlign: "center", marginTop: 8 }}>
                          {saveError}
                        </p>
                      )}
                    </>
                  )
                ) : (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    style={{
                      width: "100%",
                      padding: "14px 0",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 500,
                      border: `1px solid ${t.border}`,
                      background: "transparent",
                      color: t.sec,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    Sign up to save your evaluations
                  </button>
                )
                )}
              </div>
            )}

            {viewingFromSaved ? (
              <>
                {/* Branch ideas get "See what changed" button leading to delta screen */}
                {isBranchIdea ? (
                  <>
                    {entitlements.canUseWorkflow ? (
                      <>
                        <button
                          onClick={startReEvaluation}
                          disabled={evalsRemaining <= 0}
                          style={{
                            width: "100%",
                            padding: "14px 0",
                            borderRadius: 12,
                            fontSize: 14,
                            fontWeight: 600,
                            border: "none",
                            cursor: evalsRemaining <= 0 ? "not-allowed" : "pointer",
                            background: evalsRemaining <= 0 ? t.surfAlt : "rgba(108,99,255,0.12)",
                            color: evalsRemaining <= 0 ? t.mut : "#a78bfa",
                            marginBottom: 10,
                          }}
                        >
                          {evalsRemaining <= 0 ? "No evaluations remaining" : "Evolve this idea"}
                        </button>
                        <button
                          onClick={onNavigateToDelta}
                          style={{
                            width: "100%",
                            padding: "14px 0",
                            borderRadius: 12,
                            fontSize: 14,
                            fontWeight: 600,
                            border: "none",
                            cursor: "pointer",
                            background: "rgba(139,92,246,0.15)",
                            color: "#a78bfa",
                            marginBottom: 10,
                          }}
                        >
                          See what changed →
                        </button>
                      </>
                    ) : (
                      <div style={{
                        padding: "16px 20px",
                        borderRadius: 12,
                        border: "1px solid rgba(108,99,255,0.2)",
                        background: "rgba(108,99,255,0.04)",
                        marginBottom: 10,
                        textAlign: "center",
                      }}>
                        <p style={{ fontSize: 13, color: "#a78bfa", margin: "0 0 4px", fontWeight: 600 }}>Workspace feature</p>
                        <p style={{ fontSize: 12, color: t.sec, margin: 0 }}>
                          Subscribe to evolve ideas, see what changed, compare, and track lineage.
                        </p>
                      </div>
                    )}
                    <button
                      onClick={onBackToMyIdeasCleanup}
                      style={{
                        width: "100%",
                        padding: "14px 0",
                        borderRadius: 12,
                        fontSize: 14,
                        fontWeight: 600,
                        border: `1px solid ${t.border}`,
                        background: "transparent",
                        color: t.sec,
                        cursor: "pointer",
                      }}
                    >
                      ← Back to My Ideas
                    </button>
                  </>
                ) : (
                  <>
                    {entitlements.canUseWorkflow ? (
                      <>
                        <button
                          onClick={startReEvaluation}
                          disabled={evalsRemaining <= 0}
                          style={{
                            width: "100%",
                            padding: "14px 0",
                            borderRadius: 12,
                            fontSize: 14,
                            fontWeight: 600,
                            border: "none",
                            cursor: evalsRemaining <= 0 ? "not-allowed" : "pointer",
                            background: evalsRemaining <= 0 ? t.surfAlt : "rgba(108,99,255,0.12)",
                            color: evalsRemaining <= 0 ? t.mut : "#a78bfa",
                            marginBottom: 10,
                          }}
                        >
                          {evalsRemaining <= 0 ? "No evaluations remaining" : "Evolve this idea"}
                        </button>
                        {/* Set as main version — only for branches that aren't already main */}
                        {currentIdeaId && (() => {
                          const currentIdea = myIdeas.find(i => i.id === currentIdeaId);
                          if (!currentIdea?.parent_idea_id || currentIdea?.is_main_version) return null;
                          return (
                            <button
                              onClick={() => onSetAsMain(currentIdeaId)}
                              style={{
                                width: "100%",
                                padding: "12px 0",
                                borderRadius: 12,
                                fontSize: 13,
                                fontWeight: 600,
                                border: "1px solid rgba(16,185,129,0.3)",
                                background: "rgba(16,185,129,0.06)",
                                color: "#34d399",
                                cursor: "pointer",
                                marginBottom: 10,
                              }}
                            >
                              ★ Set as main version
                            </button>
                          );
                        })()}
                      </>
                    ) : (
                      <div style={{
                        padding: "16px 20px",
                        borderRadius: 12,
                        border: "1px solid rgba(108,99,255,0.2)",
                        background: "rgba(108,99,255,0.04)",
                        marginBottom: 10,
                        textAlign: "center",
                      }}>
                        <p style={{ fontSize: 13, color: "#a78bfa", margin: "0 0 4px", fontWeight: 600 }}>Workspace feature</p>
                        <p style={{ fontSize: 12, color: t.sec, margin: 0 }}>
                          Subscribe to evolve ideas, compare versions, and track your decision lineage.
                        </p>
                      </div>
                    )}
                    <button
                      onClick={onBackToMyIdeasCleanup}
                      style={{
                        width: "100%",
                        padding: "14px 0",
                        borderRadius: 12,
                        fontSize: 14,
                        fontWeight: 600,
                        border: `1px solid ${t.border}`,
                        background: "transparent",
                        color: t.sec,
                        cursor: "pointer",
                      }}
                    >
                      ← Back to My Ideas
                    </button>
                  </>
                )}
              </>
            ) : (
              <button
                onClick={onResetAndNewIdea}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  border: `1px solid ${t.border}`,
                  background: "transparent",
                  color: t.sec,
                  cursor: "pointer",
                }}
              >
                Analyze Another Idea
              </button>
            )}
          </PageContainer>
        </main>

        <footer style={footerStyle}>
          <PageContainer wide>
            <p style={{ fontSize: 12, color: t.mut, margin: 0 }}>
              IdeaLoop Core — All analysis is AI-generated. Use as a guide, not a definitive assessment.
            </p>
          </PageContainer>
        </footer>
      </div>
    );
  }

  return null;
}
"use client";

import { useState } from "react";

import {
  StepProgress,
  SectionHeader,
  Card,
  PageContainer,
  AuthModal,
  getMainBottleneckColor,
  MainBottleneckIcon,
  PreviewBanner,
} from "./components";
import { ProvenanceStrip, PressureRead, DeepMetricCard, DeepTcCard, ExecutionReality, KeyRisks, CompetitorGrid } from "./DeepResultParts";
import { ChangeWalkthrough, ChangeMarker } from "./ChangeWalkthrough";

export default function EvaluationView({
  // Screen
  screen,
  // Theme
  t,
  // Core data
  analysis,
  walkthroughData,
  profile,
  user,
  // Navigation context
  viewingFromSaved,
  isBranchIdea,
  // Popups
  showScoreGuide,
  showAuthModal,
  // Save state
  saveStatus,
  saveError,
  savedIdeasCount,
  ideaName,
  currentEvaluationId,
  currentIdeaId,
  myIdeas,
  // Branch state
  branchReason,
  branchDimensions,
  // Re-eval state
  isReEvalResult,
  evalsRemaining,
  // Execution Brief (Screen 3)
  openExecutionBrief,
  hasExecutionBrief,
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
  setIsReEvalResult,
  // Functions
  goToMyIdeas,
  handleSaveIdea,
  startReEvaluation,
  getStepNumber,
  // Wrapped callbacks (multi-setter operations)
  onResetAndNewIdea,
  onBackToMyIdeasCleanup,
  onDiscardReEval,
}) {

  // V4S23 entitlement system removed. Content gating retired — all content is full.
  // PreviewBanner teaser left dormant (isPreviewUser=false) pending M5/Paddle credit wiring.
  const isGated = false;
  const isPreviewUser = false;
  const [openWT, setOpenWT] = useState(null);
  const wt = walkthroughData && walkthroughData.anchors;

  // Deep provenance (V6 lineage strip). Today cold-open is the only live path,
  // so most results show the gray "straight to Deep" state. reeval and branched
  // light up as those paths route through. The bet/limit prose for branched
  // stays sparse until the Explore→Deep handoff carries branch_reason here.
  const deepProvenance = isReEvalResult
    ? { state: "reeval" }
    : isBranchIdea
    ? { state: "branched", onExplore: viewingFromSaved ? goToMyIdeas : undefined }
    : { state: "cold" };

  // ==========================================
  // SCREEN: ANALYSIS (results1)
  // ==========================================
  if (screen === "results1") {
    return (
      <>
        <ChangeWalkthrough anchor={openWT} onClose={() => setOpenWT(null)} />
        <PageContainer wide>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "4px 0 0" }}>
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
          </div>
        </PageContainer>

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

            {/* Free Preview Banner */}
            {isPreviewUser && <PreviewBanner t={t} evalsRemaining={evalsRemaining} />}

            {/* Provenance — where this idea came from (Explore branch / cold / re-eval) */}
            <ProvenanceStrip provenance={deepProvenance} t={t} />

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


            {/* Final Evaluation */}
            <section style={{ marginBottom: 48 }}>
              <SectionHeader icon="📊" title="The Pressure Read" subtitle="What held, what capped it, and what would move it — based on the evidence." t={t} />

              {/*
                ============================================================
                V6 — PRESSURE READ (verdict-first, June 2026)
                ============================================================
                The verdict leads. PressureRead renders, in one card: the
                Stage-2c verdict paragraph (honest degrade) + a confidence line
                (from evidence_strength) + the neutral overall gauge + the
                identity-coloured MD/MO/OR tiles (with contribution = score ×
                weight) + the TC build-difficulty word-ladder (execution context).
                The three per-metric prose cards follow. Competition, Key Risks,
                and Execution Reality moved to the next screen (Evidence &
                Reality). See DeepResultParts.js for the new components.
                ============================================================
              */}

              <PressureRead analysis={analysis} t={t} onScoreGuide={() => setShowScoreGuide(true)} wt={wt} onWt={setOpenWT} />

              {/* ===== PER-METRIC CARDS — mockup rail+body layout ===== */}
              <DeepMetricCard
                metricKey="market_demand"
                wt={wt}
                onWt={setOpenWT}
                metric={analysis.evaluation.market_demand}
                name="Market Demand"
                weightLabel="37.5% weight"
                notes={[analysis.evaluation.market_demand.geographic_note, analysis.evaluation.market_demand.trajectory_note]}
                competitors={analysis.competition?.competitors}
                t={t}
              />
              <DeepMetricCard
                metricKey="monetization"
                wt={wt}
                onWt={setOpenWT}
                metric={analysis.evaluation.monetization}
                name={analysis.evaluation.monetization.label || "Monetization Potential"}
                weightLabel="31.25% weight"
                competitors={analysis.competition?.competitors}
                t={t}
              />
              <DeepMetricCard
                metricKey="originality"
                wt={wt}
                onWt={setOpenWT}
                metric={analysis.evaluation.originality}
                name="Originality"
                weightLabel="31.25% weight"
                competitors={analysis.competition?.competitors}
                t={t}
              />

              {/* TC — the 4th card (execution context, not in the overall) */}
              <DeepTcCard tc={analysis.evaluation.technical_complexity} t={t} wt={wt} onWt={setOpenWT} />

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

              {/* Verdict moved to the top (PressureRead). No trailing summary card. */}

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
              {viewingFromSaved ? "View Evidence & Reality" : "Continue to Evidence & Reality"}
            </button>
          </PageContainer>
        </main>
      </>
    );
  }

  // ==========================================
  // SCREEN: FAILURE RISKS + EXECUTION REALITY (results2)
  // ==========================================
  if (screen === "results2") {
    return (
      <>
        <ChangeWalkthrough anchor={openWT} onClose={() => setOpenWT(null)} />
        <PageContainer wide>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "4px 0 0" }}>
            <button onClick={() => setCurrentScreen("results1")} style={{ fontSize: 12, color: t.mut, background: "none", border: "none", cursor: "pointer" }}>
              ← Back to Deep Analysis
            </button>
          </div>
        </PageContainer>

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

            {/* Free Preview Banner */}
            {isPreviewUser && <PreviewBanner t={t} evalsRemaining={evalsRemaining} />}

            {/* Competition Landscape — verdict-first (How your idea compares at the
                top), then the competitor list. The editorial Overlap/You-win/Exposed
                copy needs a backend synthesis field; the Overlap/Exposed split here is
                derived honestly from competitor_type. */}
            {analysis.competition && analysis.competition.competitors && analysis.competition.competitors.length > 0 && (
              <section style={{ marginBottom: 48 }}>
                <SectionHeader icon="🌐" title="Competition Landscape" subtitle="Similar existing products in the market" t={t} />

                {analysis.competition.data_source === "verified" ? (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 18, padding: "6px 14px", borderRadius: 9999, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <span style={{ fontSize: 12, color: "#34d399", fontWeight: 600 }}>Verified Sources</span>
                    <span style={{ fontSize: 11, color: t.sec }}>via GitHub, Tavily, Exa &amp; Google</span>
                  </div>
                ) : (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 18, padding: "6px 14px", borderRadius: 9999, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600 }}>AI-Generated</span>
                    <span style={{ fontSize: 11, color: t.sec }}>use as directional guide</span>
                  </div>
                )}

                {(() => {
                  const comps = analysis.competition.competitors;
                  const accent = t.mode === "light" ? "#3b6fd0" : "#6b9cf0";
                  const cp = analysis.evaluation && analysis.evaluation.competitive_position;
                  const hasCp = cp && typeof cp === "object" && (cp.headline || cp.you_win || cp.overlap || cp.exposed);

                  // Stage 2c tri-split (A13): the judged competitive position.
                  if (hasCp) {
                    const cells = [
                      { key: "overlap", label: "Overlap", color: t.mut, text: cp.overlap },
                      { key: "you_win", label: "You win", color: "#34d399", text: cp.you_win },
                      { key: "exposed", label: "Exposed", color: "#fbbf24", text: cp.exposed },
                    ].filter((c) => c.text);
                    const cellIcon = (k) => k === "you_win"
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      : k === "exposed"
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="13" height="13" rx="2" /><rect x="8" y="8" width="13" height="13" rx="2" /></svg>;
                    return (
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 8, padding: "24px 28px 22px 30px", background: `linear-gradient(180deg, ${accent}14, ${accent}05)`, border: `1px solid ${accent}33` }}>
                        <div style={{ position: "absolute", left: 0, top: 22, bottom: 22, width: 3, borderRadius: "0 3px 3px 0", background: accent, opacity: 0.6 }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}><span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: accent }}>How your idea compares</span><ChangeMarker bundle={wt && wt.compare} onOpen={setOpenWT} title="How your idea compares — re-read" /></div>
                        {cp.headline && <h3 style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.34, letterSpacing: "-0.01em", color: t.text, margin: "0 0 20px", maxWidth: 880 }}>{cp.headline}</h3>}
                        {cells.length > 0 && (
                          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cells.length}, 1fr)`, gap: "0 28px", paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
                            {cells.map((c) => (
                              <div key={c.key}>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, color: c.color }}>
                                  {cellIcon(c.key)}
                                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>{c.label}</span>
                                </div>
                                <p style={{ fontSize: 13.5, color: t.sec, lineHeight: 1.55, margin: 0 }}>{c.text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 18, fontSize: 12, color: t.mut }}>
                          <span>↓</span><span>Drawn from the <strong style={{ color: t.sec, fontWeight: 600 }}>{comps.length} competitor{comps.length === 1 ? "" : "s"}</strong> below</span>
                        </div>
                      </div>
                    );
                  }

                  // Fallback (old saved evals / null competitive_position): descriptive split derived from competitor_type.
                  const overlap = comps.filter((c) => c.competitor_type === "direct" || c.competitor_type === "adjacent").map((c) => c.name);
                  const exposed = comps.filter((c) => c.competitor_type === "substitute" || c.competitor_type === "internal_build").map((c) => c.name);
                  const diff = analysis.competition.differentiation;
                  if (!diff && overlap.length === 0 && exposed.length === 0) return null;
                  return (
                    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 8, padding: "24px 28px 24px 30px", background: `linear-gradient(180deg, ${accent}14, ${accent}05)`, border: `1px solid ${accent}33` }}>
                      <div style={{ position: "absolute", left: 0, top: 22, bottom: 22, width: 3, borderRadius: "0 3px 3px 0", background: accent, opacity: 0.6 }} />
                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}><span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: accent }}>How your idea compares</span><ChangeMarker bundle={wt && wt.compare} onOpen={setOpenWT} title="How your idea compares — re-read" /></div>
                      {diff && <p style={{ fontSize: 15, lineHeight: 1.66, color: t.text, margin: "0 0 18px", maxWidth: 820 }}>{diff}</p>}
                      {(overlap.length > 0 || exposed.length > 0) && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px 28px", paddingTop: 4 }}>
                          {overlap.length > 0 && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: t.mut, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Overlaps with</div>
                              <p style={{ fontSize: 13, color: t.sec, lineHeight: 1.5, margin: 0 }}>{overlap.join(" \u00b7 ")}</p>
                            </div>
                          )}
                          {exposed.length > 0 && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: t.mut, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Exposed to</div>
                              <p style={{ fontSize: 13, color: t.sec, lineHeight: 1.5, margin: 0 }}>{exposed.join(" \u00b7 ")}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <CompetitorGrid competitors={analysis.competition.competitors} t={t} />
              </section>
            )}

            {/* Key Risks — 3-slot timeline (Market & category / Trust & adoption / Founder fit) */}
            {analysis.evaluation.failure_risks && analysis.evaluation.failure_risks.length > 0 && (
              <section style={{ marginBottom: 48 }}>
                <SectionHeader icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>} accent="#ef6f6c" title="Key Risks" subtitle="The threats that could constrain this, by where they come from" t={t} />
                <KeyRisks risks={analysis.evaluation.failure_risks} t={t} wt={wt} onWt={setOpenWT} />
              </section>
            )}


            {/* Execution Reality — mockup ercard (binding constraint + read-out + 3-beat flow) */}
            <section style={{ marginBottom: 48 }}>
              <SectionHeader icon="⏱" title="Execution Reality" subtitle="The one wall to clear first — and what it implies, calibrated to your background" t={t} />
              <ExecutionReality
                estimates={analysis.estimates}
                mbColorFn={getMainBottleneckColor}
                MbIcon={MainBottleneckIcon}
                wt={wt}
                onWt={setOpenWT}
                t={t}
              />
            </section>

            {/* Execution Brief CTA (Screen 3 / step-4 handoff).
                Shown only when the brief is actually available — mirrors the
                route's 422 guard (no Specification / no degraded synthesis) so
                the user can't click into an error — and only for full-content
                users (the brief is a paid surface, not part of the blurred
                free preview). Label keys on whether a brief is already attached;
                openExecutionBrief decides display-vs-generate. */}
            {!isGated &&
              analysis.estimates.main_bottleneck !== "Specification" &&
              !analysis.evaluation.synthesis_degraded && (
                <button
                  onClick={() => openExecutionBrief && openExecutionBrief()}
                  style={{
                    width: "100%",
                    padding: "16px 0",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    border: "none",
                    background: t.ctaBg,
                    color: t.ctaText,
                    cursor: "pointer",
                    marginBottom: 16,
                  }}
                >
                  {viewingFromSaved && hasExecutionBrief
                    ? "View Execution Brief →"
                    : hasExecutionBrief
                      ? "Continue to Execution Brief →"
                      : "Generate Execution Brief →"}
                  <span style={{ display: "block", fontSize: 12, fontWeight: 400, opacity: 0.75, marginTop: 4 }}>
                    {hasExecutionBrief
                      ? "Your handoff: the first move and what would prove it"
                      : "Turn this diagnosis into a first-move handoff — where our read stops"}
                  </span>
                </button>
              )}

            {/* Save / Decision block — shown after user has seen everything */}
            {!viewingFromSaved && (
              isPreviewUser ? (
                /* FREE PREVIEW — nudge toward credits, not content unlock */
                <Card style={{ padding: 28, textAlign: "center" }} t={t}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: "0 0 6px 0" }}>
                    Want to evaluate more ideas?
                  </p>
                  <p style={{ fontSize: 13, color: t.sec, margin: "0 0 20px 0", lineHeight: 1.5 }}>
                    {evalsRemaining > 0
                      ? `You have ${evalsRemaining} free evaluation${evalsRemaining !== 1 ? "s" : ""} remaining. Buy credits to keep evaluating after that.`
                      : "You've used your free evaluations. Buy credits to keep going."}
                  </p>
                  <button style={{
                    background: t.ctaBg,
                    color: t.ctaText,
                    border: "none",
                    borderRadius: 10,
                    padding: "12px 32px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}>
                    Get Credits
                  </button>
                </Card>
              ) : (
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
                      ✓ Saved to My Ideas
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
                          Save
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
                        {saveStatus === "saving" ? "Saving..." : "Save to My Ideas"}
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
              )
            )}

            {viewingFromSaved ? (
              <>
                {/* Branch ideas: Evolve entry — result-screen markers replace the old delta screen */}
                {isBranchIdea ? (
                  <>
                    {(
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
                      </>
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
                    {(
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
                      </>
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
      </>
    );
  }

  return null;
}
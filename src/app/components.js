"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

// ============================================
// THEME SYSTEM (V4S24b)
// ============================================
export const T = {
  light: {
    mode: "light",
    bg: "#f4f2ef", surface: "#faf9f7", surfAlt: "#eceae5",
    border: "rgba(80,75,65,0.1)", text: "#171919", sec: "#4d5258", mut: "#8c9196",
    shadow: "0 2px 8px rgba(50,55,60,0.06), 0 1px 2px rgba(50,55,60,0.03)",
    headerBg: "#f4f2ef", headerBorder: "rgba(80,75,65,0.12)",
    scoreRing: "#4d5258", scoreGlow: false,
    barBg: "rgba(80,75,65,0.07)",
    stepDone: "#16a34a", stepCurrent: "#171919", stepCurrentText: "#faf9f7",
    stepCurrentBorder: "#171919", stepCurrentShadow: "0 4px 12px rgba(0,0,0,0.08)",
    stepFutureBg: "rgba(80,75,65,0.06)", stepFutureText: "#8c9196", stepFutureBorder: "rgba(80,75,65,0.12)",
    stepLabel: "#4d5258", stepLabelMuted: "#8c9196",
    stepConnectorDone: "rgba(22,163,74,0.5)", stepConnectorFuture: "rgba(80,75,65,0.12)",
    stepBorder: "#2563eb",
    phaseNum: { bg: "rgba(37,99,235,0.06)", color: "#1d4ed8", border: "rgba(37,99,235,0.16)" },
    riskNum: "#dc2626",
    toolDesc: "rgba(37,99,235,0.75)",
    ctaBg: "#171919", ctaText: "#faf9f7",
    lockBg: "#2563eb",
    zoneLine: "rgba(80,75,65,0.1)", zoneText: "#8c9196",
    insightBorder: "#2563eb",
    srcBadge: { google: "#1d4ed8", github: "#6d28d9", llm: "#8c9196" },
    typeBadge: { direct: "#dc2626", adjacent: "#b45309", substitute: "#1d4ed8" },
    hubCard: "#faf9f7", hubCardBorder: "rgba(80,75,65,0.1)",
    inputBg: "#faf9f7", inputBorder: "rgba(80,75,65,0.18)", inputText: "#171919",
    link: "#2563eb",
    accentBar: false,
    modalBg: "#faf9f7", modalBorder: "rgba(80,75,65,0.14)",
    divider: "rgba(80,75,65,0.1)",
    streamOverlay: "rgba(244,242,239,0.85)", streamBg: "#faf9f7",
    streamBorder: "rgba(80,75,65,0.14)", streamDivider: "rgba(80,75,65,0.1)",
    streamShadow: "0 24px 64px rgba(50,55,60,0.1), 0 0 0 1px rgba(80,75,65,0.06)",
  },
  dark: {
    mode: "dark",
    bg: "#0a0a0a", surface: "rgba(20,20,20,0.95)", surfAlt: "rgba(30,30,30,0.8)",
    border: "rgba(55,55,55,0.4)", text: "#f0f0f0", sec: "#a0a0a0", mut: "#666666",
    shadow: "0 2px 8px rgba(0,0,0,0.4)",
    headerBg: "rgba(8,8,8,0.97)", headerBorder: "rgba(55,55,55,0.3)",
    scoreRing: "#eab308", scoreGlow: true,
    barBg: "rgba(35,35,35,0.9)",
    stepDone: "#34d399", stepCurrent: "#ffffff", stepCurrentText: "#0a0a0a",
    stepCurrentBorder: "#ffffff", stepCurrentShadow: "0 4px 12px rgba(255,255,255,0.1)",
    stepFutureBg: "rgba(38,38,38,0.6)", stepFutureText: "#525252", stepFutureBorder: "rgba(64,64,64,0.5)",
    stepLabel: "#d4d4d4", stepLabelMuted: "#525252",
    stepConnectorDone: "rgba(16,185,129,0.5)", stepConnectorFuture: "#262626",
    stepBorder: "#eab308",
    phaseNum: { bg: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "rgba(59,130,246,0.2)" },
    riskNum: "#f87171",
    toolDesc: "rgba(96,165,250,0.8)",
    ctaBg: "#8b5cf6", ctaText: "#fff",
    lockBg: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    zoneLine: "rgba(55,55,55,0.3)", zoneText: "#555555",
    insightBorder: "#60a5fa",
    srcBadge: { google: "#60a5fa", github: "#a78bfa", llm: "#808080" },
    typeBadge: { direct: "#f87171", adjacent: "#fbbf24", substitute: "#60a5fa" },
    hubCard: "rgba(23,23,23,0.8)", hubCardBorder: "rgba(38,38,38,0.8)",
    inputBg: "rgba(23,23,23,0.8)", inputBorder: "rgba(64,64,64,0.6)", inputText: "#f5f5f5",
    link: "#60a5fa",
    accentBar: false,
    modalBg: "#171717", modalBorder: "rgba(38,38,38,0.8)",
    divider: "#262626",
    streamOverlay: "rgba(0,0,0,0.75)", streamBg: "#0d0d0d",
    streamBorder: "#262626", streamDivider: "#1a1a1a",
    streamShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
  },
};

export function getTheme(mode) {
  return T[mode] || T.dark;
}

// Shared functional colors — same in both themes
//
// V4S28 B8 (April 30, 2026): Updated palette + boundaries to "Mix B" lock.
// Existing amber and blue preserved verbatim from prior product UI; red and
// green updated to vivid signal-bearing values matching their saturation.
//
// MD / MO / OR boundaries (rubric measures HOW GOOD):
//   < 3.0          → red    (#ef4444) — rare, real warning
//   3.0 to 4.5     → amber  (#f59e0b) — middling, common
//   > 4.5 to < 6.5 → blue   (#3b82f6) — viable, most common
//   >= 6.5         → green  (#10b981) — strong, rare
//
// Boundaries are exclusive at the upper end (4.5 → amber, NOT blue;
// 5.0/5.5/6.0 → blue; 6.5 → green) to give amber its proper share of the
// middling zone and reserve green for genuinely strong outcomes.
//
// TC uses inverted direction + shifted boundaries because TC distribution is
// shifted high (most builds land 6.0-8.0 — see audit findings, V4S28 B8 design).
// Same color semantic across all four metrics: green/blue = good, amber/red =
// signal of difficulty. Only the threshold + direction change.
//
// TC boundaries (rubric measures HOW HARD; inverted color direction):
//   1 to < 4       → green  (#10b981) — easy build, when this fires it's real
//   4 to < 6.5     → blue   (#3b82f6) — moderate build
//   6.5 to < 8     → amber  (#f59e0b) — hard build, worth understanding
//   >= 8           → red    (#ef4444) — very hard build, rare

export const getScoreColor = (s) => {
  if (s >= 6.5) return "#10b981";  // green
  if (s > 4.5) return "#3b82f6";   // blue
  if (s >= 3) return "#f59e0b";    // amber
  return "#ef4444";                // red
};

export const getTcColor = (s) => {
  if (s >= 8) return "#ef4444";    // red — very hard
  if (s >= 6.5) return "#f59e0b";  // amber — hard
  if (s >= 4) return "#3b82f6";    // blue — moderate
  return "#10b981";                // green — easy
};

// ============================================
// MAIN BOTTLENECK COLOR TAXONOMY (V4S28 B3 — Section 4)
// ============================================
// 8 enum values mapped to categorical colors. Both themes.
// Selected to NOT collide with existing severity colors (red / amber / blue /
// green are reserved for Difficulty pills, score colors, TC inverted colors,
// step indicators). The taxonomy is purely categorical — Trust/credibility is
// not "worse than" Buyer access, etc.
//
// Final mapping (locked April 26, 2026):
//   Technical build      → indigo
//   Buyer access         → purple
//   Trust/credibility    → teal
//   Compliance           → slate (cool, institutional)
//   Distribution         → pink
//   Data acquisition     → cyan
//   Category maturation  → sage  (gray-green; muted, "weathered/considered")
//   Specification        → stone (warm gray; muted edge state for sparse input)
//
// Each entry returns {bg, color, border} for the chip rendering.
export const MAIN_BOTTLENECK_COLORS = {
  "Technical build": {
    dark:  { bg: "rgba(99,102,241,0.14)",  color: "#a5b4fc", border: "rgba(99,102,241,0.32)" },
    light: { bg: "rgba(99,102,241,0.10)",  color: "#4338ca", border: "rgba(99,102,241,0.28)" },
  },
  "Buyer access": {
    dark:  { bg: "rgba(139,92,246,0.14)",  color: "#c4b5fd", border: "rgba(139,92,246,0.32)" },
    light: { bg: "rgba(139,92,246,0.10)",  color: "#6d28d9", border: "rgba(139,92,246,0.28)" },
  },
  "Trust/credibility": {
    dark:  { bg: "rgba(20,184,166,0.14)",  color: "#5eead4", border: "rgba(20,184,166,0.32)" },
    light: { bg: "rgba(20,184,166,0.10)",  color: "#0f766e", border: "rgba(20,184,166,0.28)" },
  },
  "Compliance": {
    dark:  { bg: "rgba(100,116,139,0.18)", color: "#cbd5e1", border: "rgba(100,116,139,0.36)" },
    light: { bg: "rgba(100,116,139,0.10)", color: "#334155", border: "rgba(100,116,139,0.28)" },
  },
  "Distribution": {
    dark:  { bg: "rgba(236,72,153,0.14)",  color: "#f9a8d4", border: "rgba(236,72,153,0.32)" },
    light: { bg: "rgba(236,72,153,0.10)",  color: "#be185d", border: "rgba(236,72,153,0.28)" },
  },
  "Data acquisition": {
    dark:  { bg: "rgba(6,182,212,0.14)",   color: "#67e8f9", border: "rgba(6,182,212,0.32)" },
    light: { bg: "rgba(6,182,212,0.10)",   color: "#0e7490", border: "rgba(6,182,212,0.28)" },
  },
  "Category maturation": {
    dark:  { bg: "rgba(132,169,140,0.16)", color: "#b8d4be", border: "rgba(132,169,140,0.36)" },
    light: { bg: "rgba(132,169,140,0.12)", color: "#4d6b53", border: "rgba(132,169,140,0.32)" },
  },
  "Specification": {
    dark:  { bg: "rgba(168,162,158,0.14)", color: "#d6d3d1", border: "rgba(168,162,158,0.32)" },
    light: { bg: "rgba(168,162,158,0.10)", color: "#57534e", border: "rgba(168,162,158,0.28)" },
  },
};

// Returns {bg, color, border} for a Main Bottleneck chip given its enum value
// and the current theme's mode ("light" | "dark"). Falls back to Specification
// stone-gray for unknown / null values (older saved evaluations from before B3).
export function getMainBottleneckColor(value, themeMode) {
  const mode = themeMode === "light" ? "light" : "dark";
  const palette = MAIN_BOTTLENECK_COLORS[value];
  if (!palette) {
    return MAIN_BOTTLENECK_COLORS["Specification"][mode];
  }
  return palette[mode];
}

// ============================================
// STEP PROGRESS BAR
// ============================================
export function StepProgress({ currentStep, savedMode, branchMode, t }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 480);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const steps = [
    { number: 1, label: "Profile" },
    { number: 2, label: "Idea" },
    { number: 3, label: "Analysis" },
    { number: 4, label: "Execution" },
    ...(branchMode ? [{ number: 5, label: "Delta" }] : savedMode ? [{ number: 5, label: "Evolve" }] : []),
  ];

  const circleSize = isMobile ? 28 : 40;
  const circleFontSize = isMobile ? 11 : 14;
  const connectorWidth = isMobile ? 28 : 80;
  const connectorMargin = isMobile ? "0 4px" : "0 12px";
  const labelFontSize = isMobile ? 9 : 12;
  const labelMarginTop = isMobile ? 5 : 8;
  const containerPadding = isMobile ? "20px 8px" : "32px 0";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, padding: containerPadding }}>
      {steps.map((step, index) => (
        <div key={step.number} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: circleSize,
                height: circleSize,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: circleFontSize,
                fontWeight: 600,
                transition: "all 0.3s",
                flexShrink: 0,
                ...(currentStep > step.number
                  ? { background: `${t.stepDone}33`, color: t.stepDone, border: `2px solid ${t.stepDone}80` }
                  : currentStep === step.number
                  ? { background: t.stepCurrent, color: t.stepCurrentText, border: `2px solid ${t.stepCurrentBorder}`, boxShadow: t.stepCurrentShadow }
                  : { background: t.stepFutureBg, color: t.stepFutureText, border: `2px solid ${t.stepFutureBorder}` }),
              }}
            >
              {currentStep > step.number ? "✓" : step.number}
            </div>
            <span
              style={{
                fontSize: labelFontSize,
                marginTop: labelMarginTop,
                fontWeight: 500,
                color: currentStep >= step.number ? t.stepLabel : t.stepLabelMuted,
                whiteSpace: "nowrap",
              }}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              style={{
                width: connectorWidth,
                height: 2,
                margin: connectorMargin,
                marginBottom: isMobile ? 18 : 24,
                borderRadius: 2,
                background: currentStep > step.number ? t.stepConnectorDone : t.stepConnectorFuture,
                transition: "all 0.3s",
                flexShrink: 0,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// STATUS BADGE (functional colors — same in both themes)
// ============================================
export function StatusBadge({ status }) {
  const colorMap = {
    growing: { bg: "rgba(16,185,129,0.15)", color: "#34d399", border: "rgba(16,185,129,0.3)" },
    active: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "rgba(59,130,246,0.3)" },
    acquired: { bg: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "rgba(245,158,11,0.3)" },
    failed: { bg: "rgba(239,68,68,0.15)", color: "#f87171", border: "rgba(239,68,68,0.3)" },
    shutdown: { bg: "rgba(239,68,68,0.15)", color: "#f87171", border: "rgba(239,68,68,0.3)" },
  };
  const c = colorMap[status] || colorMap.active;

  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 10px",
        borderRadius: 9999,
        border: `1px solid ${c.border}`,
        background: c.bg,
        color: c.color,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

// ============================================
// SCORE BAR
// ============================================
export function ScoreBar({ name, score, explanation, weight, notes, t, gated }) {
  const percentage = (score / 10) * 100;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
          {name}
          {weight && <span style={{ fontSize: 11, fontWeight: 400, color: t.mut, marginLeft: 8 }}>{weight}</span>}
        </span>
        <span style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 600, color: getScoreColor(score) }}>
          {score.toFixed(1)}/10
        </span>
      </div>
      <div style={{ width: "100%", height: 8, background: t.barBg, borderRadius: 9999, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            borderRadius: 9999,
            background: getScoreColor(score),
            width: `${percentage}%`,
            transition: "width 1s ease-out",
          }}
        />
      </div>
      {!gated && (
        <>
          <p style={{ fontSize: 12, color: t.sec, marginTop: 8, lineHeight: 1.5 }}>{explanation}</p>
          {notes && notes.map((note, i) => (
            <p key={i} style={{ fontSize: 11, color: t.mut, marginTop: 4, lineHeight: 1.4, fontStyle: "italic" }}>{note}</p>
          ))}
        </>
      )}
    </div>
  );
}

// ============================================
// SECTION HEADER
// ============================================
export function SectionHeader({ icon, title, subtitle, t }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 24 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: t.surfAlt,
          border: `1px solid ${t.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: t.text, margin: 0 }}>{title}</h2>
        <p style={{ fontSize: 14, color: t.sec, margin: "4px 0 0 0" }}>{subtitle}</p>
      </div>
    </div>
  );
}

// ============================================
// CARD WRAPPER
// ============================================
export function Card({ children, style = {}, t }) {
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        padding: 24,
        boxSizing: "border-box",
        overflow: "hidden",
        boxShadow: t.shadow,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// PAGE CONTAINER - ensures padding on ALL screens
// ============================================
export function PageContainer({ children, wide = false }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 480);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: wide ? 960 : 640,
        marginLeft: "auto",
        marginRight: "auto",
        paddingLeft: isMobile ? 16 : 32,
        paddingRight: isMobile ? 16 : 32,
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// AUTH MODAL
// ============================================
export function AuthModal({ onClose, onAuth, t }) {
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw signUpError;
        if (data.user && !data.session) {
          setSuccess("Check your email to confirm your account, then log in.");
          return;
        }
        if (data.session) {
          onAuth(data.session.user);
          onClose();
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        onAuth(data.user);
        onClose();
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.modalBg,
          border: `1px solid ${t.modalBorder}`,
          borderRadius: 16,
          padding: 32,
          width: "100%",
          maxWidth: 400,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 600, color: t.text, margin: "0 0 8px 0" }}>
          {mode === "login" ? "Log in" : "Create account"}
        </h2>
        <p style={{ fontSize: 14, color: t.sec, margin: "0 0 24px 0" }}>
          {mode === "login"
            ? "Log in to save and track your ideas."
            : "Create an account to save your evaluations."}
        </p>

        {error && (
          <div style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 12,
            padding: "10px 16px",
            marginBottom: 16,
          }}>
            <p style={{ fontSize: 13, color: "#f87171", margin: 0 }}>{error}</p>
          </div>
        )}

        {success && (
          <div style={{
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: 12,
            padding: "10px 16px",
            marginBottom: 16,
          }}>
            <p style={{ fontSize: 13, color: "#34d399", margin: 0 }}>{success}</p>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: t.sec, display: "block", marginBottom: 6 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={{
              width: "100%",
              background: t.inputBg,
              border: `1px solid ${t.inputBorder}`,
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 14,
              color: t.inputText,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: t.sec, display: "block", marginBottom: 6 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Min 6 characters" : "Your password"}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={{
              width: "100%",
              background: t.inputBg,
              border: `1px solid ${t.inputBorder}`,
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 14,
              color: t.inputText,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !email.trim() || !password.trim()}
          style={{
            width: "100%",
            padding: "12px 0",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            background: loading ? t.surfAlt : t.ctaBg,
            color: loading ? t.mut : t.ctaText,
            marginBottom: 16,
          }}
        >
          {loading
            ? "Please wait..."
            : mode === "login"
            ? "Log in"
            : "Create account"}
        </button>

        <p style={{ fontSize: 13, color: t.mut, textAlign: "center", margin: 0 }}>
          {mode === "login" ? (
            <>
              No account?{" "}
              <button
                onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
                style={{ color: t.link, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                style={{ color: t.link, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}
              >
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// ============================================
// DEV MODE BADGE (V4S23 — remove before ship)
// ============================================
export function DevModeBadge({ mode }) {
  const colorMap = {
    preview: { bg: "rgba(239,68,68,0.15)", color: "#f87171", border: "rgba(239,68,68,0.3)", label: "PREVIEW" },
    payg: { bg: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "rgba(245,158,11,0.3)", label: "PAYG" },
    subscriber: { bg: "rgba(16,185,129,0.15)", color: "#34d399", border: "rgba(16,185,129,0.3)", label: "SUBSCRIBER" },
  };
  const c = colorMap[mode] || colorMap.subscriber;
  return (
    <div style={{
      position: "fixed",
      bottom: 16,
      right: 16,
      zIndex: 9999,
      padding: "6px 14px",
      borderRadius: 8,
      background: c.bg,
      border: `1px solid ${c.border}`,
      backdropFilter: "blur(8px)",
      fontSize: 11,
      fontWeight: 700,
      fontFamily: "monospace",
      letterSpacing: "0.08em",
      color: c.color,
      pointerEvents: "none",
    }}>
      DEV: {c.label}
    </div>
  );
}

// ============================================
// CONTENT GATING COMPONENTS (V4S25)
// ============================================

// Lock CTA button — shown below gated sections
export function GateCTA({ text, t }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 4px 0" }}>
      <button style={{
        background: t.lockBg,
        color: "#fff",
        border: "none",
        borderRadius: 10,
        padding: "10px 24px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        letterSpacing: "0.01em",
        transition: "opacity 0.2s",
      }}
        onMouseOver={(e) => e.currentTarget.style.opacity = "0.85"}
        onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
      >
        <span style={{ fontSize: 13 }}>🔒</span> {text}
      </button>
    </div>
  );
}

// Blur gate — shows first sentence(s) of text, blurs the rest
export function BlurGate({ isGated, text, t }) {
  if (!isGated || !text) {
    return <p style={{ fontSize: 14, color: t.sec, textAlign: "center", lineHeight: 1.6, maxWidth: 560, margin: "0 auto" }}>{text}</p>;
  }

  // Split into sentences — match period/question/exclamation followed by space or end
  const sentences = text.match(/[^.!?]+[.!?]+[\s]?/g) || [text];
  const firstSentence = sentences[0] || "";
  const restText = sentences.slice(1).join("");

  return (
    <div>
      <p style={{ fontSize: 14, color: t.sec, textAlign: "center", lineHeight: 1.6, maxWidth: 560, margin: "0 auto" }}>
        {firstSentence}
      </p>
      {restText && (
        <div style={{
          position: "relative",
          maxHeight: 60,
          overflow: "hidden",
          marginTop: 4,
        }}>
          <p style={{
            fontSize: 14,
            color: t.sec,
            textAlign: "center",
            lineHeight: 1.6,
            maxWidth: 560,
            margin: "0 auto",
            filter: "blur(4px)",
            opacity: 0.5,
            userSelect: "none",
          }}>
            {restText}
          </p>
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 40,
            background: `linear-gradient(transparent, ${t.surface})`,
          }} />
        </div>
      )}
    </div>
  );
}

// Preview banner — informational, shown at top of free preview evaluation screens
export function PreviewBanner({ t, evalsRemaining }) {
  return (
    <div style={{
      background: t.surface,
      border: `1px solid ${t.border}`,
      borderRadius: 12,
      padding: "12px 20px",
      marginBottom: 24,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      flexWrap: "wrap",
    }}>
      <p style={{ fontSize: 13, color: t.sec, margin: 0 }}>
        <span style={{ fontWeight: 600, color: t.text }}>Free Preview</span> — {evalsRemaining != null ? `${evalsRemaining} of 2 evaluations remaining` : "limited evaluations"}
      </p>
      <span style={{
        fontSize: 11,
        fontWeight: 500,
        color: t.mut,
      }}>
        Get more with credits →
      </span>
    </div>
  );
}

// ============================================
// SPECIFICITY GATE (V4S28 B7 → B9)
// ============================================
// Renders the inline panel shown when the Haiku layer determines the input
// is too underspecified to evaluate honestly. Sits between the textarea and
// the Evaluate button on the input screen. The textarea above and Evaluate
// button below are owned by the parent; this component only renders the
// missing-element cards.
//
// V4S28 B9 redesign (May 2026):
// - Always show all 3 slots with state (passed = green check / muted; missing
//   = colored top border + suggestion). Removes the "moving goalposts" feel
//   of the prior B7 design which only rendered missing slots.
// - Complete-example footer below the cards (D2 reversed — parts first,
//   assembled example last).
//
// Locked design: execution-plan-v4-3-7.md Section 13 / Item 7 + pre-B10a
// Haiku calibration revisit (May 4, 2026).
// `missing_elements` is a coarse 3-value enum: target_user / use_case / mechanism.
// Unknown values are filtered. Empty array falls back to "all 3 missing"
// (defensive — should not happen if gate fired correctly).
//
// Enum semantics (locked May 4, 2026):
// - target_user = adoption unit (not necessarily literal payer)
// - use_case    = job/pain/task/workflow under one umbrella
// - mechanism   = how the product intervenes (feature/process/automation/method)
//
// Per-slot accent colors (1.5px top border) signal the dimension each card
// represents — Pink (audience), Teal (use case), Purple (mechanism).
// Light-mode hex = ramp 600 stop, dark-mode hex = ramp 200 stop, per the
// design system's "light = 600 stroke, dark = 200 stroke" convention.
const SLOT_ORDER = ["target_user", "use_case", "mechanism"];

const MISSING_ELEMENT_CARDS = {
  target_user: {
    title: "Who is it for?",
    passedTitle: "Target user",
    example: "solo professionals · small clinics · enterprise teams",
    accent: { light: "#993556", dark: "#ED93B1" }, // Pink 600 / 200
  },
  use_case: {
    title: "What does it help with?",
    passedTitle: "Use case",
    example: "scheduling appointments · drafting documents · tracking inventory",
    accent: { light: "#0F6E56", dark: "#5DCAA5" }, // Teal 600 / 200
  },
  mechanism: {
    title: "How does it work?",
    passedTitle: "Mechanism",
    example: "automates reminders · turns chat into tasks · drafts from templates",
    accent: { light: "#534AB7", dark: "#AFA9EC" }, // Purple 600 / 200
  },
};

// Locked B8 palette green (also used by getScoreColor). Single source of truth
// for the "passed slot" affordance — a green check mark + green top border.
const PASSED_GREEN = "#10b981";

// Complete-example footer text — shows the full assembled shape of a good
// input below the parts. Locked copy (D2 reversed).
const COMPLETE_EXAMPLE =
  "AI scheduling assistant for dental receptionists that drafts patient follow-ups.";

export function SpecificityGate({ gate, t }) {
  if (!gate) return null;

  // Filter to known missing_elements; empty array falls back to "all 3 missing"
  const validKeys = SLOT_ORDER;
  const requested = Array.isArray(gate.missing_elements) ? gate.missing_elements : [];
  const missingSet = new Set(requested.filter((k) => validKeys.includes(k)));
  // Defensive fallback — if gate fired but missing_elements is empty/garbage,
  // treat all 3 as missing rather than rendering an empty grid.
  const effectiveMissing = missingSet.size > 0 ? missingSet : new Set(validKeys);

  const themeMode = t?.mode === "dark" ? "dark" : "light";

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 10,
        marginBottom: 14,
      }}>
        {SLOT_ORDER.map((key) => {
          const card = MISSING_ELEMENT_CARDS[key];
          const isMissing = effectiveMissing.has(key);
          const accentColor = isMissing ? card.accent[themeMode] : PASSED_GREEN;

          return (
            <div key={key} style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderTop: `1.5px solid ${accentColor}`,
              borderRadius: 8,
              padding: "12px 14px",
              opacity: isMissing ? 1 : 0.65,
              transition: "opacity 200ms ease",
            }}>
              {isMissing ? (
                <>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: t.text,
                    marginBottom: 6,
                  }}>
                    {card.title}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: t.sec,
                    lineHeight: 1.5,
                    fontStyle: "italic",
                  }}>
                    {card.example}
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: t.text,
                    marginBottom: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}>
                    <span style={{ color: PASSED_GREEN, fontSize: 13, lineHeight: 1 }}>✓</span>
                    {card.passedTitle}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: t.sec,
                    lineHeight: 1.5,
                    fontStyle: "italic",
                  }}>
                    Covered
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Complete-example footer (D2 reversed — parts first, assembled example last) */}
      <div style={{
        fontSize: 12,
        color: t.sec,
        lineHeight: 1.5,
        padding: "10px 4px 0 4px",
      }}>
        <span style={{ fontWeight: 500, color: t.text }}>Example: </span>
        <span style={{ fontStyle: "italic" }}>{COMPLETE_EXAMPLE}</span>
      </div>
    </div>
  );
}
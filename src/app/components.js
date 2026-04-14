"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

// ============================================
// THEME SYSTEM (V4S24b)
// ============================================
export const T = {
  light: {
    bg: "#f5f5f4", surface: "#ffffff", surfAlt: "#eeeeed",
    border: "rgba(0,0,0,0.07)", text: "#1a1a1a", sec: "#5c5c5c", mut: "#8a8a8a",
    shadow: "0 1px 3px rgba(0,0,0,0.04)",
    headerBg: "#ffffff", headerBorder: "rgba(0,0,0,0.06)",
    scoreRing: "#6b7280", scoreGlow: false,
    barBg: "rgba(0,0,0,0.06)",
    stepDone: "#16a34a", stepCurrent: "#1a1a1a", stepCurrentText: "#ffffff",
    stepCurrentBorder: "#1a1a1a", stepCurrentShadow: "0 4px 12px rgba(0,0,0,0.08)",
    stepFutureBg: "rgba(0,0,0,0.04)", stepFutureText: "#8a8a8a", stepFutureBorder: "rgba(0,0,0,0.08)",
    stepLabel: "#5c5c5c", stepLabelMuted: "#8a8a8a",
    stepConnectorDone: "rgba(22,163,74,0.5)", stepConnectorFuture: "rgba(0,0,0,0.08)",
    stepBorder: "#2563eb",
    phaseNum: { bg: "rgba(37,99,235,0.08)", color: "#2563eb", border: "rgba(37,99,235,0.15)" },
    riskNum: "#dc2626",
    toolDesc: "rgba(37,99,235,0.75)",
    ctaBg: "#1a1a1a", ctaText: "#fff",
    lockBg: "#2563eb",
    zoneLine: "rgba(0,0,0,0.08)", zoneText: "#8a8a8a",
    insightBorder: "#2563eb",
    srcBadge: { google: "#2563eb", github: "#7c3aed", llm: "#8a8a8a" },
    typeBadge: { direct: "#dc2626", adjacent: "#b45309", substitute: "#2563eb" },
    hubCard: "#ffffff", hubCardBorder: "rgba(0,0,0,0.08)",
    inputBg: "rgba(0,0,0,0.03)", inputBorder: "rgba(0,0,0,0.1)", inputText: "#1a1a1a",
    link: "#2563eb",
    accentBar: false,
    modalBg: "#ffffff", modalBorder: "rgba(0,0,0,0.1)",
    divider: "rgba(0,0,0,0.06)",
  },
  dark: {
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
    accentBar: true,
    modalBg: "#171717", modalBorder: "rgba(38,38,38,0.8)",
    divider: "#262626",
  },
};

export function getTheme(mode) {
  return T[mode] || T.dark;
}

// Shared functional colors — same in both themes
export const getScoreColor = (s) => {
  if (s >= 8) return "#10b981";
  if (s >= 6) return "#3b82f6";
  if (s >= 4) return "#f59e0b";
  return "#ef4444";
};

export const getTcColor = (s) => {
  if (s >= 8) return "#ef4444";
  if (s >= 6) return "#f59e0b";
  if (s >= 4) return "#3b82f6";
  return "#10b981";
};

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
    { number: 4, label: "Roadmap" },
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
export function ScoreBar({ name, score, explanation, weight, notes, t }) {
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
      <p style={{ fontSize: 12, color: t.sec, marginTop: 8, lineHeight: 1.5 }}>{explanation}</p>
      {notes && notes.map((note, i) => (
        <p key={i} style={{ fontSize: 11, color: t.mut, marginTop: 4, lineHeight: 1.4, fontStyle: "italic" }}>{note}</p>
      ))}
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
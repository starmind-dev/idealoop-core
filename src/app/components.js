"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

// ============================================
// STEP PROGRESS BAR
// ============================================
export function StepProgress({ currentStep, savedMode, branchMode }) {
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
                  ? { background: "rgba(16,185,129,0.2)", color: "#34d399", border: "2px solid rgba(16,185,129,0.5)" }
                  : currentStep === step.number
                  ? { background: "#fff", color: "#0a0a0a", border: "2px solid #fff", boxShadow: "0 4px 12px rgba(255,255,255,0.1)" }
                  : { background: "rgba(38,38,38,0.6)", color: "#525252", border: "2px solid rgba(64,64,64,0.5)" }),
              }}
            >
              {currentStep > step.number ? "✓" : step.number}
            </div>
            <span
              style={{
                fontSize: labelFontSize,
                marginTop: labelMarginTop,
                fontWeight: 500,
                color: currentStep >= step.number ? "#d4d4d4" : "#525252",
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
                background: currentStep > step.number ? "rgba(16,185,129,0.5)" : "#262626",
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
// STATUS BADGE
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
export function ScoreBar({ name, score, explanation, weight, notes }) {
  const percentage = (score / 10) * 100;
  const getColor = (s) => {
    if (s >= 8) return "#10b981";
    if (s >= 6) return "#3b82f6";
    if (s >= 4) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#e5e5e5" }}>
          {name}
          {weight && <span style={{ fontSize: 11, fontWeight: 400, color: "#525252", marginLeft: 8 }}>{weight}</span>}
        </span>
        <span style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 600, color: getColor(score) }}>
          {score.toFixed(1)}/10
        </span>
      </div>
      <div style={{ width: "100%", height: 8, background: "#262626", borderRadius: 9999, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            borderRadius: 9999,
            background: getColor(score),
            width: `${percentage}%`,
            transition: "width 1s ease-out",
          }}
        />
      </div>
      <p style={{ fontSize: 12, color: "#737373", marginTop: 8, lineHeight: 1.5 }}>{explanation}</p>
      {notes && notes.map((note, i) => (
        <p key={i} style={{ fontSize: 11, color: "#525252", marginTop: 4, lineHeight: 1.4, fontStyle: "italic" }}>{note}</p>
      ))}
    </div>
  );
}

// ============================================
// SECTION HEADER
// ============================================
export function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 24 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "rgba(38,38,38,0.8)",
          border: "1px solid rgba(64,64,64,0.5)",
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
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#f5f5f5", margin: 0 }}>{title}</h2>
        <p style={{ fontSize: 14, color: "#737373", margin: "4px 0 0 0" }}>{subtitle}</p>
      </div>
    </div>
  );
}

// ============================================
// CARD WRAPPER
// ============================================
export function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: "rgba(23,23,23,0.6)",
        border: "1px solid rgba(38,38,38,0.8)",
        borderRadius: 16,
        padding: 24,
        boxSizing: "border-box",
        overflow: "hidden",
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
export function AuthModal({ onClose, onAuth }) {
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
          background: "#171717",
          border: "1px solid rgba(38,38,38,0.8)",
          borderRadius: 16,
          padding: 32,
          width: "100%",
          maxWidth: 400,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#f5f5f5", margin: "0 0 8px 0" }}>
          {mode === "login" ? "Log in" : "Create account"}
        </h2>
        <p style={{ fontSize: 14, color: "#737373", margin: "0 0 24px 0" }}>
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
          <label style={{ fontSize: 13, fontWeight: 500, color: "#a3a3a3", display: "block", marginBottom: 6 }}>
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
              background: "rgba(23,23,23,0.8)",
              border: "1px solid rgba(64,64,64,0.6)",
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 14,
              color: "#f5f5f5",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#a3a3a3", display: "block", marginBottom: 6 }}>
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
              background: "rgba(23,23,23,0.8)",
              border: "1px solid rgba(64,64,64,0.6)",
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 14,
              color: "#f5f5f5",
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
            background: loading ? "rgba(38,38,38,0.6)" : "#fff",
            color: loading ? "#525252" : "#0a0a0a",
            marginBottom: 16,
          }}
        >
          {loading
            ? "Please wait..."
            : mode === "login"
            ? "Log in"
            : "Create account"}
        </button>

        <p style={{ fontSize: 13, color: "#525252", textAlign: "center", margin: 0 }}>
          {mode === "login" ? (
            <>
              No account?{" "}
              <button
                onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
                style={{ color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                style={{ color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}
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
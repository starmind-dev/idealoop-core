"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import ComparisonView from "./ComparisonView";
import LineageView from "./LineageView";

// ============================================
// STEP PROGRESS BAR
// ============================================
function StepProgress({ currentStep, savedMode, branchMode }) {
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
function StatusBadge({ status }) {
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
function ScoreBar({ name, score, explanation, weight, notes }) {
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
function SectionHeader({ icon, title, subtitle }) {
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
function Card({ children, style = {} }) {
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
function PageContainer({ children, wide = false }) {
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
function AuthModal({ onClose, onAuth }) {
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
// MAIN APP
// ============================================
// ============================================
// EVALUATION LIMIT HELPERS
// ============================================
const EVAL_LIMIT = 3;
const EVAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getRecentEvals() {
  try {
    const raw = localStorage.getItem("iv_eval_timestamps");
    if (!raw) return [];
    const timestamps = JSON.parse(raw);
    const cutoff = Date.now() - EVAL_WINDOW_MS;
    return timestamps.filter((t) => t > cutoff);
  } catch {
    return [];
  }
}

function recordEval() {
  const recent = getRecentEvals();
  recent.push(Date.now());
  localStorage.setItem("iv_eval_timestamps", JSON.stringify(recent));
}

function getEvalsRemaining() {
  return Math.max(0, EVAL_LIMIT - getRecentEvals().length);
}

function getNextResetTime() {
  const recent = getRecentEvals();
  if (recent.length === 0) return null;
  const oldest = Math.min(...recent);
  const resetsAt = new Date(oldest + EVAL_WINDOW_MS);
  const now = new Date();
  const diffMs = resetsAt - now;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return "< 1h";
}

// ============================================
// MAIN APP
// ============================================
export default function Home() {
  const [currentScreen, setCurrentScreen] = useState("profile");
  const [profile, setProfile] = useState({ coding: "", ai: "", education: "" });
  const [evalsRemaining, setEvalsRemaining] = useState(EVAL_LIMIT);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | naming | saving | saved | error
  const [saveError, setSaveError] = useState("");
  const [savedIdeasCount, setSavedIdeasCount] = useState(0);
  const [savedIdeaId, setSavedIdeaId] = useState(null);
  const [ideaName, setIdeaName] = useState(""); // user-chosen name when saving
  const [showScoreGuide, setShowScoreGuide] = useState(false);
  const SAVED_IDEA_LIMIT = 5;

  // My Ideas Hub state
  const [myIdeas, setMyIdeas] = useState([]);
  const [myIdeasLoading, setMyIdeasLoading] = useState(false);
  const [myIdeasError, setMyIdeasError] = useState("");
  const [deletingIdeaId, setDeletingIdeaId] = useState(null);
  const [viewingFromSaved, setViewingFromSaved] = useState(false); // tracks if we opened from My Ideas

  // Comparison state
  const [compareSelected, setCompareSelected] = useState([]); // array of idea IDs (max 2)
  const [compareSelecting, setCompareSelecting] = useState(false); // true when in selection mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareData, setCompareData] = useState(null); // { ideaA, ideaB } with full analysis
  const [compareLoading, setCompareLoading] = useState(false);

  // Lineage view state
  const [lineageMode, setLineageMode] = useState(false);
  const [lineageTargetId, setLineageTargetId] = useState(null);

  // Progress tracking state
  const [currentEvaluationId, setCurrentEvaluationId] = useState(null);
  const [currentIdeaId, setCurrentIdeaId] = useState(null);
  const [phaseProgress, setPhaseProgress] = useState({}); // { phase_1: { completed, note }, ... }
  const [progressLoading, setProgressLoading] = useState(false);
  const [savingProgress, setSavingProgress] = useState({}); // tracks which phase_keys are currently saving
  const [editingNotePhase, setEditingNotePhase] = useState(null); // which phase is having its note edited
  const [noteText, setNoteText] = useState(""); // temp text for note editing
  const [dbNextResetTime, setDbNextResetTime] = useState(null); // DB-based reset time for logged-in users

  // Re-evaluation state
  const [reEvalMode, setReEvalMode] = useState(false); // true when on re-eval screen
  const [reEvalTargetUser, setReEvalTargetUser] = useState(""); // changed target user text
  const [reEvalProblem, setReEvalProblem] = useState(""); // changed problem text
  const [reEvalCoreIdea, setReEvalCoreIdea] = useState(""); // changed core idea text
  const [reEvalOriginalIdea, setReEvalOriginalIdea] = useState(""); // original idea text for display
  const [loadedIdeaText, setLoadedIdeaText] = useState(""); // full idea text including revisions (for re-eval of alternatives)
  const [isReEvaluating, setIsReEvaluating] = useState(false);
  const [isReEvalResult, setIsReEvalResult] = useState(false); // true when showing re-eval results (not yet saved)
  const [reEvalRevisionNotes, setReEvalRevisionNotes] = useState(null); // stored for saving later
  const [reEvalChangedFields, setReEvalChangedFields] = useState(null); // changed_fields metadata for delta explanation
  const [reEvalContextSnapshot, setReEvalContextSnapshot] = useState(null); // analysis snapshot from before re-eval

  // Branch creation form state (V4S14)
  const [branchReason, setBranchReason] = useState("");
  const [branchDimensions, setBranchDimensions] = useState([]); // array of strings like ["target_user", "problem"]
  const [branchSetAsMain, setBranchSetAsMain] = useState(false); // if true, set-main after saving branch
  const [reEvalEditTarget, setReEvalEditTarget] = useState(false); // toggle for target user edit field
  const [reEvalEditProblem, setReEvalEditProblem] = useState(false); // toggle for problem edit field
  const [reEvalEditCore, setReEvalEditCore] = useState(false); // toggle for core idea edit field

  // Delta explanation state (V4S16)
  const [deltaData, setDeltaData] = useState(null); // cached delta result from Sonnet
  const [deltaLoading, setDeltaLoading] = useState(false);
  const [deltaError, setDeltaError] = useState("");

  // Alternatives popup state
  const [showAlternativesPopup, setShowAlternativesPopup] = useState(false);
  const [alternativesData, setAlternativesData] = useState(null); // { ideaId, title, evaluations: [...] }

  // SSE streaming state
  const [streamSteps, setStreamSteps] = useState([]); // array of { step, message, done }
  const streamRef = useRef(null); // ref to track if stream should be aborted

  // Pro mode (dev toggle — uses chained pipeline)
  const [proMode, setProMode] = useState(false);

  // Listen for auth state changes (login, logout, session restore)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Migrate localStorage profile to database when user logs in
  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem("iv_profile");
    if (!saved) return;

    const localProfile = JSON.parse(saved);
    // Only migrate if the local profile has data
    if (localProfile.coding || localProfile.ai || localProfile.education) {
      // Use server-side API route to bypass RLS
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        fetch("/api/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            coding_level: localProfile.coding,
            ai_experience: localProfile.ai,
            education: localProfile.education,
          }),
        }).then((res) => {
          if (!res.ok) res.json().then((d) => console.error("Profile migration failed:", d.error));
        });
      });
    }
  }, [user]);

  // Fetch saved ideas count when user logs in
  useEffect(() => {
    if (!user) {
      setSavedIdeasCount(0);
      return;
    }
    supabase
      .from("ideas")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active")
      .is("parent_idea_id", null)
      .then(({ count, error }) => {
        if (!error && count !== null) setSavedIdeasCount(count);
      });
  }, [user]);

  // Sync eval usage from database for logged-in users
  useEffect(() => {
    if (!user) return;
    const syncEvalUsage = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch("/api/eval-usage", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setEvalsRemaining(data.remaining);
          if (data.next_reset_time) setDbNextResetTime(data.next_reset_time);
        }
      } catch (err) {
        console.error("Eval usage sync failed:", err);
      }
    };
    syncEvalUsage();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Load saved profile + eval count after mount (avoids hydration mismatch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const saved = localStorage.getItem("iv_profile");
    if (saved) {
      setProfile(JSON.parse(saved));
      setCurrentScreen("input");
    }
    setEvalsRemaining(getEvalsRemaining());
  }, []);
  const [idea, setIdea] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [expandedPhases, setExpandedPhases] = useState({});
  const [editingPhase, setEditingPhase] = useState(null);
  const [editedPhases, setEditedPhases] = useState(null);

  const togglePhase = (i) => setExpandedPhases((p) => ({ ...p, [i]: !p[i] }));

  const startEditingPhase = (i) => {
    if (!editedPhases) setEditedPhases([...analysis.phases]);
    setEditingPhase(i);
  };

  const savePhaseEdit = (i, field, value) => {
    const updated = [...(editedPhases || analysis.phases)];
    updated[i] = { ...updated[i], [field]: value };
    setEditedPhases(updated);
  };

  const stopEditingPhase = () => setEditingPhase(null);
  const currentPhases = editedPhases || (analysis ? analysis.phases : []);

  const getStepNumber = () => {
    const map = { profile: 1, input: 2, myideas: 2, reeval: 5, results1: 3, results2: 4, delta: 5 };
    return map[currentScreen] || 1;
  };

  // Check if the currently viewed idea is a branch (has a parent)
  const isBranchIdea = currentIdeaId ? !!myIdeas.find(i => i.id === currentIdeaId)?.parent_idea_id : false;

  // SSE streaming helper — reads events from /api/analyze and returns the final analysis
  const analyzeWithStream = async (ideaText, profileData, endpoint = "/api/analyze") => {
    setStreamSteps([]);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: ideaText, profile: profileData }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Analysis failed");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalAnalysis = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event = JSON.parse(line.slice(6));

            if (event.step === "error") {
              throw new Error(event.message);
            }

            if (event.step === "complete") {
              finalAnalysis = event.data;
              // Add final step to display
              setStreamSteps((prev) => [...prev, { step: "complete", message: "Evaluation complete ✓", done: true }]);
            } else if (event.step.endsWith("_start")) {
              // In-progress step (no checkmark yet)
              // For stage starts, also mark previous stage as done
              setStreamSteps((prev) => {
                const updated = prev.map((s) => {
                  // Mark stage1_start done when stage2_start arrives
                  if (event.step === "stage2_start" && s.step === "stage1_start") return { ...s, done: true };
                  // Mark stage2_start done when stage3_start arrives
                  if (event.step === "stage3_start" && s.step === "stage2_start") return { ...s, done: true };
                  return s;
                });
                return [...updated, { step: event.step, message: event.message, done: false }];
              });
            } else if (event.step.endsWith("_done") || event.step === "evidence_ready" || event.step === "scoring") {
              // Mark previous related _start step as done, add this as completed
              setStreamSteps((prev) => {
                const updated = prev.map((s) => {
                  // Mark keywords_start done when keywords_done arrives
                  if (event.step === "keywords_done" && s.step === "keywords_start") return { ...s, done: true };
                  // Mark search_start done when first search result arrives
                  if ((event.step === "github_done" || event.step === "serper_done") && s.step === "search_start") return { ...s, done: true };
                  // Mark stage starts done when their corresponding done arrives
                  if (event.step === "stage1_done" && s.step === "stage1_start") return { ...s, done: true };
                  if (event.step === "stage2_done" && s.step === "stage2_start") return { ...s, done: true };
                  if (event.step === "stage3_done" && s.step === "stage3_start") return { ...s, done: true };
                  return s;
                });
                return [...updated, { step: event.step, message: event.message, done: true }];
              });
            } else if (event.step === "evaluating") {
              // Evaluating is in-progress (longest step) — free tier only
              setStreamSteps((prev) => [...prev, { step: event.step, message: event.message, done: false }]);
            }
          } catch (e) {
            // Skip malformed SSE events
            if (e.message !== "Analysis failed" && !e.message.startsWith("Failed to parse")) {
              console.error("SSE parse error:", e);
            } else {
              throw e;
            }
          }
        }
      }
    }

    if (!finalAnalysis) {
      throw new Error("Analysis failed — no result received.");
    }

    // Mark any remaining in-progress steps as done (evaluating for free, stages for pro)
    setStreamSteps((prev) =>
      prev.map((s) => (s.done ? s : { ...s, done: true }))
    );

    // Check for ethics block
    if (finalAnalysis.ethics_blocked) {
      return { ethicsBlocked: true, message: finalAnalysis.ethics_message };
    }

    return { ethicsBlocked: false, analysis: finalAnalysis };
  };

  const handleAnalyze = async () => {
    if (!idea.trim()) return;

    // For logged-in users, check DB-based limits; for anon, use localStorage
    if (user) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch("/api/eval-usage", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const data = await res.json();
          if (res.ok && data.remaining <= 0) {
            const resetTime = data.next_reset_time
              ? formatResetTime(data.next_reset_time)
              : "soon";
            setError(`You've used all ${EVAL_LIMIT} free evaluations this week. Next slot opens in ${resetTime}.`);
            return;
          }
        }
      } catch (err) {
        // Fall through to localStorage check if DB check fails
        console.error("DB eval check failed, using localStorage:", err);
      }
    } else {
      const remaining = getEvalsRemaining();
      if (remaining <= 0) {
        setError(`You've used all ${EVAL_LIMIT} free evaluations this week. Next slot opens in ${getNextResetTime()}.`);
        return;
      }
    }

    setIsAnalyzing(true);
    setError("");
    // Reset save state for new evaluation
    setSaveStatus("idle");
    setSaveError("");
    setSavedIdeaId(null);
    setIdeaName("");
    setCurrentEvaluationId(null);
    setCurrentIdeaId(null);
    setPhaseProgress({});
    setViewingFromSaved(false);
    setIsReEvalResult(false);
    setReEvalRevisionNotes(null);
    try {
      const endpoint = proMode ? "/api/analyze-pro" : "/api/analyze";
      const result = await analyzeWithStream(idea, profile, endpoint);

      if (result.ethicsBlocked) {
        setError(result.message);
        return;
      }

      // Record eval usage: DB for logged-in users, localStorage for anon
      if (user) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const usageRes = await fetch("/api/eval-usage", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
            });
            const usageData = await usageRes.json();
            if (usageRes.ok) {
              setEvalsRemaining(usageData.remaining);
            }
          }
        } catch (err) {
          console.error("Failed to record eval usage in DB:", err);
        }
      } else {
        recordEval();
        setEvalsRemaining(getEvalsRemaining());
      }

      setAnalysis(result.analysis);
      setEditedPhases(null);
      setExpandedPhases({});
      setCurrentScreen("results1");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Re-evaluate a saved idea with optional changes
  const handleReEvaluate = async () => {
    if (!currentIdeaId || !user) return;

    // Check eval limits (same as handleAnalyze)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const res = await fetch("/api/eval-usage", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (res.ok && data.remaining <= 0) {
          const resetTime = data.next_reset_time
            ? formatResetTime(data.next_reset_time)
            : "soon";
          setError(`You've used all ${EVAL_LIMIT} free evaluations this week. Next slot opens in ${resetTime}.`);
          return;
        }
      }
    } catch (err) {
      console.error("DB eval check failed:", err);
    }

    setIsReEvaluating(true);
    setError("");

    try {
      // Build the modified idea text and track changed fields
      let modifiedIdea = reEvalOriginalIdea;
      const revisions = [];
      const changedFields = [];

      if (reEvalTargetUser.trim()) {
        revisions.push({ type: "target_user", text: reEvalTargetUser.trim() });
        changedFields.push({ field: "target_user", original_value: null, new_value: reEvalTargetUser.trim() });
        modifiedIdea += `\n\n[REVISION — Target user changed to: ${reEvalTargetUser.trim()}]`;
      }

      if (reEvalProblem.trim()) {
        revisions.push({ type: "problem", text: reEvalProblem.trim() });
        changedFields.push({ field: "problem", original_value: null, new_value: reEvalProblem.trim() });
        modifiedIdea += `\n\n[REVISION — Problem it solves changed to: ${reEvalProblem.trim()}]`;
      }

      if (reEvalCoreIdea.trim()) {
        revisions.push({ type: "core_idea", text: reEvalCoreIdea.trim() });
        changedFields.push({ field: "core_idea", original_value: null, new_value: reEvalCoreIdea.trim() });
        modifiedIdea += `\n\n[REVISION — Core idea changed to: ${reEvalCoreIdea.trim()}]`;
      }

      // Use SSE streaming
      const result = await analyzeWithStream(modifiedIdea, profile);

      if (result.ethicsBlocked) {
        setError(result.message);
        return;
      }

      // Record eval usage
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          const usageRes = await fetch("/api/eval-usage", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          const usageData = await usageRes.json();
          if (usageRes.ok) {
            setEvalsRemaining(usageData.remaining);
          }
        } catch (err) {
          console.error("Failed to record eval usage:", err);
        }
      }

      // Store revision notes and changed fields for when user saves later
      setReEvalRevisionNotes(revisions.length > 0 ? revisions : null);
      setReEvalChangedFields(changedFields.length > 0 ? changedFields : null);

      // Show results as FRESH evaluation (not saved, not viewing from saved)
      setAnalysis(result.analysis);
      setEditedPhases(null);
      setExpandedPhases({});
      setPhaseProgress({});
      setViewingFromSaved(false);
      setSaveStatus("idle");
      setSaveError("");
      setSavedIdeaId(null);
      setIdeaName("");
      setCurrentEvaluationId(null);
      setIsReEvalResult(true); // flag so save knows to use re-evaluate endpoint
      setReEvalMode(false);
      setReEvalTargetUser("");
      setReEvalProblem("");
      setReEvalCoreIdea("");
      setCurrentScreen("results1");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsReEvaluating(false);
    }
  };

  // Start re-evaluation flow from saved idea view
  const startReEvaluation = () => {
    // Capture context snapshot for the "Evolve This Idea" screen
    const ideaTitle = myIdeas.find(i => i.id === currentIdeaId)?.title || "";
    setReEvalContextSnapshot(analysis ? {
      title: ideaTitle,
      overall: analysis.evaluation?.overall_score || analysis.evaluation?.weighted_overall || 0,
      md: analysis.evaluation?.market_demand?.score,
      mo: analysis.evaluation?.monetization?.score,
      or: analysis.evaluation?.originality?.score,
      tc: analysis.evaluation?.technical_complexity?.score,
      failure_risks: analysis.evaluation?.failure_risks || [],
      confidence_level: analysis.evaluation?.confidence_level || null,
    } : null);
    setReEvalOriginalIdea(loadedIdeaText || idea);
    setReEvalTargetUser("");
    setReEvalProblem("");
    setReEvalCoreIdea("");
    setReEvalEditTarget(false);
    setReEvalEditProblem(false);
    setReEvalEditCore(false);
    setError("");
    setReEvalMode(true);
    setCurrentScreen("reeval");
  };

  // Helper: format a reset time ISO string to human-readable
  const formatResetTime = (isoString) => {
    const resetDate = new Date(isoString);
    const now = new Date();
    const diffMs = resetDate - now;
    if (diffMs <= 0) return "< 1h";
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return "< 1h";
  };

  // Save evaluation to database — two-step: first show name input, then save
  const handleSaveIdea = async () => {
    if (!user || !analysis || saveStatus === "saving" || saveStatus === "saved") return;

    // First click: show the naming input
    if (saveStatus !== "naming") {
      setSaveStatus("naming");
      if (isReEvalResult) {
        // Pre-fill with "Branch" for re-evaluations
        setIdeaName("Branch");
        setBranchReason("");
        setBranchDimensions([]);
        setBranchSetAsMain(false);
      } else {
        // Pre-fill with a sensible default from the idea text
        const firstLine = idea.split(/[.!?\n]/)[0].trim();
        setIdeaName(firstLine.length <= 60 ? firstLine : firstLine.substring(0, 57) + "...");
      }
      return;
    }

    // Second click (confirm): actually save with the chosen name
    if (!ideaName.trim()) return;

    setSaveStatus("saving");
    setSaveError("");

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSaveStatus("error");
        setSaveError("Session expired. Please log in again.");
        return;
      }

      if (isReEvalResult && currentIdeaId) {
        // Branch save: create new idea linked to parent
        // Validate branch form fields
        if (!branchReason.trim()) {
          setSaveStatus("naming");
          setSaveError("Please explain why this is a different direction.");
          return;
        }
        if (branchDimensions.length === 0) {
          setSaveStatus("naming");
          setSaveError("Select at least one dimension that changed.");
          return;
        }

        const res = await fetch(`/api/ideas/${currentIdeaId}/branch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title: ideaName.trim(),
            raw_idea_text: idea || reEvalOriginalIdea || "",
            branch_reason: branchReason.trim(),
            changed_dimensions: branchDimensions,
            analysis,
            profile,
            changed_fields: reEvalChangedFields,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setSaveStatus("error");
          setSaveError(data.error || "Failed to save. Please try again.");
          return;
        }

        setSaveStatus("saved");
        setCurrentIdeaId(data.idea_id);
        setCurrentEvaluationId(data.evaluation_id);
        setIsReEvalResult(false);

        // If user chose "Set as main version", call set-main after branch is created
        if (branchSetAsMain) {
          try {
            await fetch(`/api/ideas/${data.idea_id}/set-main`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
            });
          } catch (e) {
            console.error("Set-main failed:", e);
            // Branch is already saved — don't fail the whole operation
          }
          setBranchSetAsMain(false);
        }
      } else {
        // Normal save: create new idea + evaluation
        const res = await fetch("/api/ideas/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            idea_text: idea,
            idea_name: ideaName.trim(),
            profile,
            analysis,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setSaveStatus("error");
          setSaveError(data.error || "Failed to save. Please try again.");
          if (data.limit_reached) {
            setSavedIdeasCount(data.saved_count);
          }
          return;
        }

        setSaveStatus("saved");
        setSavedIdeaId(data.idea_id);
        setCurrentIdeaId(data.idea_id);
        setCurrentEvaluationId(data.evaluation_id);
        setSavedIdeasCount(data.saved_count);
      }
    } catch (err) {
      setSaveStatus("error");
      setSaveError("Something went wrong. Please try again.");
    }
  };

  // Fetch saved ideas for My Ideas Hub
  const fetchMyIdeas = async () => {
    if (!user) return;
    setMyIdeasLoading(true);
    setMyIdeasError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/ideas/list", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMyIdeas(data.ideas || []);
      setSavedIdeasCount(data.count || 0);
    } catch (err) {
      setMyIdeasError(err.message || "Failed to load ideas.");
    } finally {
      setMyIdeasLoading(false);
    }
  };

  // Load a saved idea's full evaluation and show it
  const loadSavedIdea = async (ideaId, evaluationId) => {
    if (!user) return;
    setMyIdeasLoading(true);
    setMyIdeasError("");
    setShowAlternativesPopup(false);
    setPhaseProgress({}); // Clear stale progress immediately so alternatives don't share state
    setDeltaData(null); // Clear previous delta
    setDeltaError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = evaluationId
        ? `/api/ideas/${ideaId}?evaluation_id=${evaluationId}`
        : `/api/ideas/${ideaId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Set state to show the evaluation screens
      setIdea(data.idea.raw_idea_text);
      setAnalysis(data.analysis);
      setEditedPhases(null);
      setExpandedPhases({});
      setSaveStatus("saved"); // already saved, don't show save button again
      setSavedIdeaId(ideaId);
      setCurrentIdeaId(ideaId);
      setCurrentEvaluationId(data.evaluation_id);
      setViewingFromSaved(true);

      // Reconstruct the full idea text including revisions (for re-evaluating alternatives)
      let fullIdeaText = data.idea.raw_idea_text;
      const revisionNotes = data.analysis?._meta?.revision_notes;
      if (revisionNotes && Array.isArray(revisionNotes) && revisionNotes.length > 0) {
        const changeLabel = (type) => {
          if (type === "target_user") return "Target user";
          if (type === "problem") return "Problem it solves";
          if (type === "core_idea") return "Core idea";
          return "";
        };
        revisionNotes.forEach((rev) => {
          if (rev.type && rev.text) {
            fullIdeaText += `\n\n[REVISION — ${changeLabel(rev.type)} changed to: ${rev.text}]`;
          }
        });
      }
      setLoadedIdeaText(fullIdeaText);

      // Fetch progress for this evaluation
      if (data.evaluation_id) {
        fetchProgress(data.evaluation_id, session.access_token);
      }

      setCurrentScreen("results1");
    } catch (err) {
      setMyIdeasError(err.message || "Failed to load idea.");
    } finally {
      setMyIdeasLoading(false);
    }
  };

  // Fetch progress data for a specific evaluation
  const fetchProgress = async (evaluationId, accessToken) => {
    setProgressLoading(true);
    try {
      let token = accessToken;
      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token;
      }
      if (!token) return;

      const res = await fetch(`/api/progress?evaluation_id=${evaluationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setPhaseProgress(data.progress || {});
      }
    } catch (err) {
      console.error("Failed to fetch progress:", err);
    } finally {
      setProgressLoading(false);
    }
  };

  // Fetch delta explanation for a branch idea
  const fetchDelta = async (ideaId) => {
    if (!user || !ideaId) return;
    setDeltaLoading(true);
    setDeltaError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/ideas/${ideaId}/delta`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load delta");
      setDeltaData(data.delta);
    } catch (err) {
      console.error("Delta fetch failed:", err);
      setDeltaError(err.message || "Failed to analyze changes");
    } finally {
      setDeltaLoading(false);
    }
  };

  // Toggle a phase checkbox
  const togglePhaseProgress = async (phaseKey) => {
    if (!currentEvaluationId || !currentIdeaId) return;

    const current = phaseProgress[phaseKey];
    const newCompleted = !(current?.completed);

    // Optimistic update
    setPhaseProgress((prev) => ({
      ...prev,
      [phaseKey]: {
        ...prev[phaseKey],
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      },
    }));
    setSavingProgress((prev) => ({ ...prev, [phaseKey]: true }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/progress", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          evaluation_id: currentEvaluationId,
          idea_id: currentIdeaId,
          phase_key: phaseKey,
          completed: newCompleted,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPhaseProgress((prev) => ({
          ...prev,
          [phaseKey]: {
            ...prev[phaseKey],
            ...data.progress,
          },
        }));
      }
    } catch (err) {
      // Revert optimistic update on failure
      setPhaseProgress((prev) => ({
        ...prev,
        [phaseKey]: current || { completed: false, note: "" },
      }));
      console.error("Failed to toggle progress:", err);
    } finally {
      setSavingProgress((prev) => ({ ...prev, [phaseKey]: false }));
    }
  };

  // Save a note for a phase
  const savePhaseNote = async (phaseKey, noteValue) => {
    if (!currentEvaluationId || !currentIdeaId) return;

    setSavingProgress((prev) => ({ ...prev, [phaseKey]: true }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/progress", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          evaluation_id: currentEvaluationId,
          idea_id: currentIdeaId,
          phase_key: phaseKey,
          note: noteValue,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPhaseProgress((prev) => ({
          ...prev,
          [phaseKey]: {
            ...prev[phaseKey],
            ...data.progress,
          },
        }));
      }
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setSavingProgress((prev) => ({ ...prev, [phaseKey]: false }));
    }
  };

  // Delete a saved idea
  const deleteSavedIdea = async (ideaId) => {
    if (!user) return;
    setDeletingIdeaId(ideaId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Remove from local list
      setMyIdeas((prev) => prev.filter((i) => i.id !== ideaId));
      setSavedIdeasCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setMyIdeasError(err.message || "Failed to delete idea.");
    } finally {
      setDeletingIdeaId(null);
    }
  };

  // Navigate to My Ideas Hub
  const goToMyIdeas = () => {
    setCurrentScreen("myideas");
    setCompareMode(false);
    setCompareSelecting(false);
    setCompareSelected([]);
    setCompareData(null);
    fetchMyIdeas();
  };

  // Toggle idea/evaluation selection for comparison
  // Each entry is { ideaId, evaluationId } — evaluationId null means "use latest"
  const toggleCompareSelect = (ideaId, evaluationId = null) => {
    setCompareSelected((prev) => {
      const existingIndex = prev.findIndex(
        (s) => s.ideaId === ideaId && s.evaluationId === evaluationId
      );
      if (existingIndex !== -1) return prev.filter((_, i) => i !== existingIndex);
      if (prev.length >= 2) return prev; // max 2
      return [...prev, { ideaId, evaluationId }];
    });
  };

  // Check if an idea/evaluation is selected for comparison
  const isCompareSelected = (ideaId, evaluationId = null) => {
    return compareSelected.some(
      (s) => s.ideaId === ideaId && s.evaluationId === evaluationId
    );
  };

  // Load two ideas/evaluations for comparison and enter compare mode
  const startComparison = async (selectionsOverride) => {
    const selections = selectionsOverride || compareSelected;
    if (selections.length !== 2 || !user) return;
    setCompareLoading(true);
    setMyIdeasError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Load both ideas in parallel, using evaluation_id when specified
      const [resA, resB] = await Promise.all(
        selections.map((sel) => {
          const url = sel.evaluationId
            ? `/api/ideas/${sel.ideaId}?evaluation_id=${sel.evaluationId}`
            : `/api/ideas/${sel.ideaId}`;
          return fetch(url, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).then((r) => r.json());
        })
      );

      if (resA.error) throw new Error(resA.error);
      if (resB.error) throw new Error(resB.error);

      // Find the idea objects from myIdeas for titles
      // For alternatives, try to find an alternative name from evaluation data
      const getTitleForSelection = (sel, resData) => {
        const ideaObj = myIdeas.find((i) => i.id === sel.ideaId);
        if (sel.evaluationId && ideaObj) {
          // Look for the specific evaluation in the idea's evaluations array
          const ev = (ideaObj.evaluations || []).find((e) => e.id === sel.evaluationId);
          if (ev?.alternative_name) return `${ideaObj.title} — ${ev.alternative_name}`;
        }
        return ideaObj?.title || "Idea";
      };

      setCompareData({
        ideaA: {
          id: selections[0].ideaId,
          title: getTitleForSelection(selections[0], resA),
          analysis: resA.analysis,
        },
        ideaB: {
          id: selections[1].ideaId,
          title: getTitleForSelection(selections[1], resB),
          analysis: resB.analysis,
        },
      });
      setCompareMode(true);
    } catch (err) {
      setMyIdeasError(err.message || "Failed to load ideas for comparison.");
    } finally {
      setCompareLoading(false);
    }
  };

  // Shared header style
  const headerStyle = {
    width: "100%",
    borderBottom: "1px solid rgba(38,38,38,0.8)",
  };

  const footerStyle = {
    width: "100%",
    borderTop: "1px solid rgba(38,38,38,0.8)",
    padding: "20px 0",
  };

  // ==========================================
  // SCREEN 0: PROFILE
  // ==========================================
  if (currentScreen === "profile") {
    const canContinue = profile.coding && profile.ai;

    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
        <header style={headerStyle}>
          <PageContainer>
            <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 onClick={() => setCurrentScreen(profile.coding && profile.ai ? "input" : "profile")} style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "#525252", margin: 0, cursor: "pointer" }}>
                IdeaLoop Core
              </h1>
              {!authLoading && (
                user ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={goToMyIdeas} style={{ fontSize: 12, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
                      My Ideas
                    </button>
                    <span style={{ color: "#262626" }}>|</span>
                    <span style={{ fontSize: 12, color: "#525252" }}>{user.email}</span>
                    <button onClick={handleLogout} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
                      Log out
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    style={{ fontSize: 12, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
                  >
                    Log in
                  </button>
                )
              )}
            </div>
          </PageContainer>
        </header>

        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onAuth={(u) => setUser(u)}
          />
        )}

        <StepProgress currentStep={getStepNumber()} savedMode={viewingFromSaved} branchMode={viewingFromSaved && isBranchIdea} />

        <main style={{ flex: 1, paddingBottom: 48 }}>
          <PageContainer>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 12px 0" }}>
                Tell us about yourself
              </h2>
              <p style={{ fontSize: 14, color: "#737373", lineHeight: 1.6, margin: 0 }}>
                We'll calibrate the analysis to your experience level<br />
                so the recommendations are relevant to you.
              </p>
            </div>

            <Card style={{ padding: 28, marginBottom: 32 }}>
              {/* Coding */}
              <div style={{ marginBottom: 28 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: "#d4d4d4", display: "block", marginBottom: 12 }}>
                  How familiar are you with coding?
                </label>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {["Beginner", "Intermediate", "Advanced"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setProfile((p) => ({ ...p, coding: opt }))}
                      style={{
                        flex: 1,
                        minWidth: 80,
                        padding: "10px 16px",
                        borderRadius: 12,
                        fontSize: 14,
                        fontWeight: 500,
                        border: "1px solid",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxSizing: "border-box",
                        ...(profile.coding === opt
                          ? { background: "#fff", color: "#0a0a0a", borderColor: "#fff" }
                          : { background: "rgba(23,23,23,0.8)", color: "#a3a3a3", borderColor: "rgba(64,64,64,0.6)" }),
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI */}
              <div style={{ marginBottom: 28 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: "#d4d4d4", display: "block", marginBottom: 12 }}>
                  How much experience do you have with AI tools?
                </label>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {["None", "Some", "Regular user"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setProfile((p) => ({ ...p, ai: opt }))}
                      style={{
                        flex: 1,
                        minWidth: 80,
                        padding: "10px 16px",
                        borderRadius: 12,
                        fontSize: 14,
                        fontWeight: 500,
                        border: "1px solid",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxSizing: "border-box",
                        ...(profile.ai === opt
                          ? { background: "#fff", color: "#0a0a0a", borderColor: "#fff" }
                          : { background: "rgba(23,23,23,0.8)", color: "#a3a3a3", borderColor: "rgba(64,64,64,0.6)" }),
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Education */}
              <div>
                <label style={{ fontSize: 14, fontWeight: 600, color: "#d4d4d4", display: "block", marginBottom: 12 }}>
                  What is your education or professional background?
                </label>
                <input
                  type="text"
                  value={profile.education}
                  onChange={(e) => setProfile((p) => ({ ...p, education: e.target.value }))}
                  placeholder="e.g., Software Engineer, Marketing Manager, Student..."
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
            </Card>

            <button
              onClick={() => {
                localStorage.setItem("iv_profile", JSON.stringify(profile));
                // Save to database via server-side API route (bypasses RLS)
                if (user) {
                  supabase.auth.getSession().then(({ data: { session } }) => {
                    if (!session) return;
                    fetch("/api/profile", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                      },
                      body: JSON.stringify({
                        coding_level: profile.coding,
                        ai_experience: profile.ai,
                        education: profile.education,
                      }),
                    }).then((res) => {
                      if (!res.ok) res.json().then((d) => console.error("Profile save to DB failed:", d.error));
                    });
                  });
                }
                setCurrentScreen("input");
              }}
              disabled={!canContinue}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                cursor: canContinue ? "pointer" : "not-allowed",
                transition: "all 0.2s",
                ...(canContinue
                  ? { background: "#fff", color: "#0a0a0a" }
                  : { background: "rgba(38,38,38,0.6)", color: "#525252" }),
              }}
            >
              Continue
            </button>
          </PageContainer>
        </main>

        <footer style={footerStyle}>
          <PageContainer>
            <p style={{ fontSize: 12, color: "#404040", margin: 0 }}>
              IdeaLoop Core — All analysis is AI-generated. Use as a guide, not a definitive assessment.
            </p>
          </PageContainer>
        </footer>
      </div>
    );
  }

  // ==========================================
  // SCREEN 1: IDEA INPUT
  // ==========================================
  if (currentScreen === "input") {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
        <header style={headerStyle}>
          <PageContainer>
            <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 onClick={() => setCurrentScreen(profile.coding && profile.ai ? "input" : "profile")} style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "#525252", margin: 0, cursor: "pointer" }}>
                IdeaLoop Core
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => setCurrentScreen("profile")} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
                  {profile.coding} · {profile.ai} AI · Edit ✎
                </button>
                {!authLoading && (
                  user ? (
                    <>
                      <span style={{ color: "#262626" }}>|</span>
                      <button onClick={goToMyIdeas} style={{ fontSize: 12, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
                        My Ideas
                      </button>
                      <span style={{ color: "#262626" }}>|</span>
                      <button onClick={handleLogout} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
                        Log out
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ color: "#262626" }}>|</span>
                      <button
                        onClick={() => setShowAuthModal(true)}
                        style={{ fontSize: 12, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
                      >
                        Log in
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
          />
        )}

        <StepProgress currentStep={getStepNumber()} savedMode={viewingFromSaved} branchMode={viewingFromSaved && isBranchIdea} />

        <main style={{ flex: 1, paddingBottom: 48 }}>
          <PageContainer>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 30, fontWeight: 600, margin: "0 0 12px 0" }}>
                Describe your AI product idea
              </h2>
              <p style={{ fontSize: 16, color: "#737373", lineHeight: 1.6, margin: 0 }}>
                Include what it does, who would use it, and what problem it solves.
                Specific ideas get sharper evaluations.
              </p>
            </div>

            <Card style={{ padding: 6, marginBottom: 24 }}>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Example: An AI-powered idea evaluation workflow that scores startup ideas against real competitor data from GitHub and Google. It's for founders and ambitious builders who waste weeks on ideas without knowing if there's real demand. The problem is that most people either ask friends who say 'great idea!' or use ChatGPT which gives generic encouragement instead of structured, honest analysis..."
                rows={8}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  padding: "16px 20px",
                  fontSize: 16,
                  color: "#f5f5f5",
                  lineHeight: 1.6,
                  resize: "none",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </Card>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 20px", marginBottom: 24 }}>
                <p style={{ fontSize: 14, color: "#f87171", margin: 0 }}>{error}</p>
              </div>
            )}

            {/* DEV TOGGLE: Pro mode — remove before launch */}
            {user && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 16,
                padding: "8px 16px",
                borderRadius: 8,
                background: proMode ? "rgba(139,92,246,0.1)" : "rgba(38,38,38,0.3)",
                border: `1px solid ${proMode ? "rgba(139,92,246,0.3)" : "rgba(64,64,64,0.2)"}`,
                transition: "all 0.2s ease",
              }}>
                <button
                  onClick={() => setProMode(!proMode)}
                  style={{
                    background: proMode ? "#8b5cf6" : "#404040",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    cursor: "pointer",
                    fontFamily: "monospace",
                    transition: "all 0.2s ease",
                  }}
                >
                  {proMode ? "PRO ✓" : "PRO"}
                </button>
                <span style={{ fontSize: 12, color: proMode ? "#a78bfa" : "#525252", fontFamily: "monospace" }}>
                  {proMode ? "3-stage chained pipeline (Discover → Judge → Act)" : "Standard single-call evaluation"}
                </span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <span style={{ fontSize: 14, color: "#525252", fontFamily: "monospace" }}>
                {idea.length > 0 ? `${idea.length} characters` : ""}
              </span>
              <button
                onClick={handleAnalyze}
                disabled={!idea.trim() || isAnalyzing || evalsRemaining <= 0}
                style={{
                  padding: "12px 32px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  cursor: !idea.trim() || isAnalyzing || evalsRemaining <= 0 ? "not-allowed" : "pointer",
                  ...(!idea.trim() || isAnalyzing || evalsRemaining <= 0
                    ? { background: "rgba(38,38,38,0.6)", color: "#525252" }
                    : proMode
                      ? { background: "#8b5cf6", color: "#fff" }
                      : { background: "#fff", color: "#0a0a0a" }),
                }}
              >
                {isAnalyzing ? "Analyzing..." : evalsRemaining <= 0 ? "Limit Reached" : proMode ? "Pro Analyze" : "Analyze Idea"}
              </button>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginBottom: 24,
              padding: "10px 16px",
              borderRadius: 12,
              background: evalsRemaining <= 0 ? "rgba(239,68,68,0.08)" : evalsRemaining === 1 ? "rgba(245,158,11,0.08)" : "rgba(38,38,38,0.4)",
              border: `1px solid ${evalsRemaining <= 0 ? "rgba(239,68,68,0.2)" : evalsRemaining === 1 ? "rgba(245,158,11,0.2)" : "rgba(64,64,64,0.3)"}`,
            }}>
              <span style={{
                fontSize: 13,
                color: evalsRemaining <= 0 ? "#f87171" : evalsRemaining === 1 ? "#fbbf24" : "#737373",
              }}>
                {evalsRemaining <= 0
                  ? `No evaluations remaining this week. Next slot opens in ${user && dbNextResetTime ? formatResetTime(dbNextResetTime) : getNextResetTime()}.`
                  : `${evalsRemaining} of ${EVAL_LIMIT} free evaluations remaining this week`}
              </span>
            </div>

            {isAnalyzing && (
              <div style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                background: "rgba(0,0,0,0.75)",
                animation: "overlayFadeIn 0.3s ease-out",
              }}>
                <div style={{
                  background: "#0d0d0d",
                  border: "1px solid #262626",
                  borderRadius: 12,
                  padding: "28px 32px",
                  fontFamily: "'Courier New', Courier, monospace",
                  fontSize: 13,
                  lineHeight: 1.8,
                  width: "90%",
                  maxWidth: 520,
                  boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid #1a1a1a" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: proMode ? "#8b5cf6" : "#10b981", boxShadow: proMode ? "0 0 8px rgba(139,92,246,0.5)" : "0 0 8px rgba(16,185,129,0.5)" }} />
                    <span style={{ color: "#525252", fontSize: 11, letterSpacing: "0.08em" }}>{proMode ? "PRO EVALUATION PIPELINE" : "EVALUATION PIPELINE"}</span>
                  </div>
                  {streamSteps.map((s, i) => (
                    <div key={i} style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      color: s.done ? "#a3a3a3" : "#e5e5e5",
                      opacity: s.done ? 0.8 : 1,
                      animation: "fadeInStep 0.3s ease-out",
                    }}>
                      <span style={{ color: s.done ? (proMode ? "#8b5cf6" : "#10b981") : "#f59e0b", flexShrink: 0, width: 16, textAlign: "center" }}>
                        {s.done ? "✓" : "›"}
                      </span>
                      <span style={{ wordBreak: "break-word" }}>{s.message}</span>
                    </div>
                  ))}
                  {streamSteps.length > 0 && !streamSteps.some(s => s.step === "complete") && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#525252", marginTop: 2 }}>
                      <span style={{ width: 16, textAlign: "center", animation: "blink 1s step-end infinite" }}>_</span>
                    </div>
                  )}
                  {streamSteps.length === 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#525252" }}>
                      <span style={{ width: 16, textAlign: "center", animation: "blink 1s step-end infinite" }}>_</span>
                      <span>Initializing...</span>
                    </div>
                  )}
                </div>
                <style>{`
                  @keyframes fadeInStep {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                  @keyframes blink {
                    50% { opacity: 0; }
                  }
                  @keyframes overlayFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                  }
                `}</style>
              </div>
            )}
          </PageContainer>
        </main>

        <footer style={footerStyle}>
          <PageContainer>
            <p style={{ fontSize: 12, color: "#404040", margin: 0 }}>
              IdeaLoop Core — All analysis is AI-generated. Use as a guide, not a definitive assessment.
            </p>
          </PageContainer>
        </footer>
      </div>
    );
  }

  // ==========================================
  // MY IDEAS HUB
  // ==========================================
  if (currentScreen === "myideas") {
    const getScoreColor = (s) => {
      if (s >= 8) return "#10b981";
      if (s >= 6) return "#3b82f6";
      if (s >= 4) return "#f59e0b";
      return "#ef4444";
    };

    // COMPARISON MODE: render ComparisonView instead of hub
    if (compareMode && compareData) {
      return (
        <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
          <header style={headerStyle}>
            <PageContainer wide>
              <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 onClick={() => setCurrentScreen(profile.coding && profile.ai ? "input" : "profile")} style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "#525252", margin: 0, cursor: "pointer" }}>
                  IdeaLoop Core
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {!authLoading && user && (
                    <>
                      <span style={{ fontSize: 12, color: "#525252" }}>{user.email}</span>
                      <button onClick={handleLogout} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
                        Log out
                      </button>
                    </>
                  )}
                </div>
              </div>
            </PageContainer>
          </header>

          <main style={{ flex: 1, paddingBottom: 48, paddingTop: 16 }}>
            <ComparisonView
              ideaA={compareData.ideaA}
              ideaB={compareData.ideaB}
              onBack={() => {
                setCompareMode(false);
                setCompareSelecting(false);
                setCompareData(null);
                setCompareSelected([]);
                fetchMyIdeas();
              }}
            />
          </main>

          <footer style={footerStyle}>
            <PageContainer>
              <p style={{ fontSize: 12, color: "#404040", margin: 0 }}>
                IdeaLoop Core — All analysis is AI-generated. Use as a guide, not a definitive assessment.
              </p>
            </PageContainer>
          </footer>
        </div>
      );
    }

    // LINEAGE MODE: render LineageView instead of hub
    if (lineageMode && lineageTargetId) {
      return (
        <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
          <header style={headerStyle}>
            <PageContainer wide>
              <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 onClick={() => setCurrentScreen(profile.coding && profile.ai ? "input" : "profile")} style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "#525252", margin: 0, cursor: "pointer" }}>
                  IdeaLoop Core
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {!authLoading && user && (
                    <>
                      <span style={{ fontSize: 12, color: "#525252" }}>{user.email}</span>
                      <button onClick={handleLogout} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
                        Log out
                      </button>
                    </>
                  )}
                </div>
              </div>
            </PageContainer>
          </header>

          <main style={{ flex: 1, paddingBottom: 48, paddingTop: 16 }}>
            <LineageView
              myIdeas={myIdeas}
              targetIdeaId={lineageTargetId}
              onBack={() => {
                setLineageMode(false);
                setLineageTargetId(null);
              }}
              onViewIdea={(ideaId) => {
                setLineageMode(false);
                setLineageTargetId(null);
                loadSavedIdea(ideaId);
              }}
              onStartComparison={(selectedPair) => {
                setLineageMode(false);
                setLineageTargetId(null);
                setCompareSelected(selectedPair);
                startComparison(selectedPair);
              }}
            />
          </main>

          <footer style={footerStyle}>
            <PageContainer>
              <p style={{ fontSize: 12, color: "#404040", margin: 0 }}>
                IdeaLoop Core — All analysis is AI-generated. Use as a guide, not a definitive assessment.
              </p>
            </PageContainer>
          </footer>
        </div>
      );
    }

    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
        <header style={headerStyle}>
          <PageContainer>
            <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 onClick={() => setCurrentScreen(profile.coding && profile.ai ? "input" : "profile")} style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "#525252", margin: 0, cursor: "pointer" }}>
                IdeaLoop Core
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => setCurrentScreen("input")} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
                  ← New Evaluation
                </button>
                {!authLoading && user && (
                  <>
                    <span style={{ color: "#262626" }}>|</span>
                    <span style={{ fontSize: 12, color: "#525252" }}>{user.email}</span>
                    <button onClick={handleLogout} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
                      Log out
                    </button>
                  </>
                )}
              </div>
            </div>
          </PageContainer>
        </header>

        <main style={{ flex: 1, paddingBottom: 48, paddingTop: 32 }}>
          {/* Alternatives popup */}
          {showAlternativesPopup && alternativesData && (
            <div
              onClick={() => { if (!compareSelecting) setShowAlternativesPopup(false); }}
              style={{
                position: "fixed",
                top: 0, left: 0, right: 0, bottom: 0,
                background: "rgba(0,0,0,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: 24,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid rgba(64,64,64,0.6)",
                  borderRadius: 16,
                  padding: "24px",
                  maxWidth: 420,
                  width: "100%",
                  maxHeight: "80vh",
                  overflowY: "auto",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f5f5f5", margin: 0 }}>
                      {alternativesData.title}
                    </h3>
                    <p style={{ fontSize: 12, color: "#737373", margin: "4px 0 0 0" }}>
                      {alternativesData.evaluations.length} version{alternativesData.evaluations.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAlternativesPopup(false)}
                    style={{ background: "none", border: "none", color: "#525252", fontSize: 18, cursor: "pointer", padding: 4 }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...alternativesData.evaluations].reverse().map((ev, index) => {
                    const evScore = ev.weighted_overall_score || 0;
                    const evDate = new Date(ev.created_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    });
                    const isOriginal = index === 0;
                    const altLabel = isOriginal ? "Original" : `Alternative ${index}`;
                    const evIsSelected = isCompareSelected(alternativesData.ideaId, ev.id);

                    return (
                      <button
                        key={ev.id}
                        onClick={() => {
                          if (compareSelecting) {
                            toggleCompareSelect(alternativesData.ideaId, ev.id);
                            return;
                          }
                          loadSavedIdea(alternativesData.ideaId, ev.id);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "14px 16px",
                          background: isOriginal ? "rgba(255,255,255,0.03)" : "rgba(108,99,255,0.04)",
                          border: `1px solid ${compareSelecting && evIsSelected ? "rgba(59,130,246,0.5)" : isOriginal ? "rgba(64,64,64,0.4)" : "rgba(108,99,255,0.15)"}`,
                          borderRadius: 12,
                          cursor: "pointer",
                          textAlign: "left",
                          width: "100%",
                          transition: "border-color 0.2s",
                        }}
                      >
                        {/* Compare checkbox in alternatives — only visible in selection mode */}
                        {compareSelecting && (
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 5,
                              border: evIsSelected ? "2px solid #60a5fa" : "2px solid rgba(64,64,64,0.6)",
                              background: evIsSelected ? "rgba(59,130,246,0.2)" : "transparent",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              transition: "all 0.2s",
                              fontSize: 11,
                              color: "#60a5fa",
                              fontWeight: 700,
                            }}
                          >
                            {evIsSelected ? "✓" : ""}
                          </div>
                        )}
                        {/* Score circle */}
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: `rgba(${evScore >= 7 ? "16,185,129" : evScore >= 5 ? "59,130,246" : evScore >= 3 ? "245,158,11" : "239,68,68"},0.15)`,
                          border: `2px solid ${getScoreColor(evScore)}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          fontSize: 13,
                          fontWeight: 700,
                          color: getScoreColor(evScore),
                        }}>
                          {evScore.toFixed(1)}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: isOriginal ? "#a3a3a3" : "#a78bfa" }}>
                            {altLabel}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                            <span style={{ fontSize: 11, color: "#525252" }}>{evDate}</span>
                            {ev.progress?.has_progress && (
                              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <div style={{ display: "flex", gap: 1 }}>
                                  {Array.from({ length: ev.progress.total_phases || 0 }).map((_, idx) => {
                                    const phaseKey = `phase_${idx + 1}`;
                                    const isCompleted = (ev.progress.completed_phases || []).includes(phaseKey);
                                    return (
                                      <div key={idx} style={{
                                        width: 10,
                                        height: 3,
                                        borderRadius: 1.5,
                                        background: isCompleted ? "#10b981" : "#262626",
                                      }} />
                                    );
                                  })}
                                </div>
                                <span style={{ fontSize: 9, color: "#525252" }}>
                                  {ev.progress.completed}/{ev.progress.total_phases}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Mini score bars */}
                        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                          {[
                            { label: "MD", score: ev.market_demand_score },
                            { label: "MO", score: ev.monetization_score },
                            { label: "OR", score: ev.originality_score },
                            { label: "TC", score: ev.technical_complexity_score },
                          ].map((m, i) => (
                            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                              <div style={{
                                width: 5,
                                height: 24,
                                background: "#1a1a1a",
                                borderRadius: 2,
                                overflow: "hidden",
                                display: "flex",
                                flexDirection: "column-reverse",
                              }}>
                                <div style={{
                                  width: "100%",
                                  height: `${((m.score || 0) / 10) * 100}%`,
                                  background: i === 3
                                    ? (m.score >= 8 ? "#ef4444" : m.score >= 6 ? "#f59e0b" : "#3b82f6")
                                    : getScoreColor(m.score || 0),
                                  borderRadius: 2,
                                }} />
                              </div>
                              <span style={{ fontSize: 7, color: "#404040", fontWeight: 500 }}>{m.label}</span>
                            </div>
                          ))}
                        </div>

                        <span style={{ fontSize: 14, color: "#404040" }}>→</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <PageContainer>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 8px 0" }}>My Ideas</h2>
              <p style={{ fontSize: 14, color: "#737373", margin: 0 }}>
                {savedIdeasCount > 0
                  ? `${savedIdeasCount} of ${SAVED_IDEA_LIMIT} ideas saved`
                  : "Your saved evaluations will appear here."}
              </p>
            </div>

            {myIdeasError && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 20px", marginBottom: 24 }}>
                <p style={{ fontSize: 14, color: "#f87171", margin: 0 }}>{myIdeasError}</p>
              </div>
            )}

            {myIdeasLoading && myIdeas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{
                  display: "inline-block",
                  width: 32,
                  height: 32,
                  border: "2px solid #404040",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <p style={{ fontSize: 14, color: "#737373", marginTop: 16 }}>Loading your ideas...</p>
              </div>
            ) : myIdeas.length === 0 ? (
              <Card style={{ padding: 48, textAlign: "center" }}>
                <p style={{ fontSize: 48, margin: "0 0 16px 0" }}>💡</p>
                <p style={{ fontSize: 16, color: "#a3a3a3", margin: "0 0 8px 0" }}>No saved ideas yet</p>
                <p style={{ fontSize: 14, color: "#525252", margin: "0 0 24px 0" }}>
                  Run an evaluation and click "Save to My Ideas" to keep it here.
                </p>
                <button
                  onClick={() => setCurrentScreen("input")}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    border: "none",
                    background: "#fff",
                    color: "#0a0a0a",
                    cursor: "pointer",
                  }}
                >
                  Evaluate an Idea
                </button>
              </Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{
                  padding: "14px 18px",
                  borderRadius: 12,
                  background: "rgba(108,99,255,0.06)",
                  border: "1px solid rgba(108,99,255,0.15)",
                  marginBottom: 4,
                }}>
                  <p style={{ fontSize: 13, color: "#a3a3a3", lineHeight: 1.6, margin: 0 }}>
                    Open any idea to review your evaluation, track your roadmap progress, check recommended tools — and re-evaluate with fresh market data or changed variables.
                  </p>
                </div>

                {/* Compare button — enters selection mode */}
                {myIdeas.filter(i => !i.parent_idea_id || i.is_main_version).length >= 2 && !compareSelecting && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                    <button
                      onClick={() => { setCompareSelecting(true); setCompareSelected([]); }}
                      style={{
                        padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                        border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.08)",
                        color: "#60a5fa", cursor: "pointer", transition: "all 0.2s",
                      }}
                    >
                      Compare Ideas
                    </button>
                  </div>
                )}

                {/* Selection bar — shows when in selection mode */}
                {compareSelecting && (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 18px", borderRadius: 12,
                    background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)",
                    marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 13, color: "#60a5fa" }}>
                      {compareSelected.length === 0
                        ? "Tap 2 ideas to compare"
                        : compareSelected.length === 1
                        ? "Tap 1 more idea"
                        : "2 ideas selected — ready to compare"}
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => { setCompareSelecting(false); setCompareSelected([]); }}
                        style={{
                          padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                          border: "1px solid rgba(64,64,64,0.4)", background: "transparent",
                          color: "#525252", cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={startComparison}
                        disabled={compareSelected.length !== 2 || compareLoading}
                        style={{
                          padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                          border: "none",
                          cursor: compareSelected.length !== 2 || compareLoading ? "not-allowed" : "pointer",
                          background: compareSelected.length === 2 && !compareLoading ? "#60a5fa" : "rgba(38,38,38,0.6)",
                          color: compareSelected.length === 2 && !compareLoading ? "#fff" : "#525252",
                          transition: "all 0.2s",
                        }}
                      >
                        {compareLoading ? "Loading..." : "Compare"}
                      </button>
                    </div>
                  </div>
                )}
                {myIdeas.filter(i => !i.parent_idea_id || i.is_main_version).map((savedIdea) => {
                  const evals = savedIdea.evaluations || [];
                  const eval_ = evals.length > 0 ? evals[evals.length - 1] : null;
                  const score = eval_?.weighted_overall_score || 0;
                  const date = new Date(savedIdea.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const isSelected = isCompareSelected(savedIdea.id, null);

                  return (
                    <div
                      key={savedIdea.id}
                      style={{
                        background: "rgba(23,23,23,0.6)",
                        border: compareSelecting && isSelected ? "1px solid rgba(59,130,246,0.5)" : "1px solid rgba(38,38,38,0.8)",
                        borderRadius: 16,
                        overflow: "hidden",
                        transition: "border-color 0.2s",
                      }}
                    >
                      <div
                        onClick={() => {
                          // In selection mode, toggle selection instead of opening idea
                          if (compareSelecting) {
                            toggleCompareSelect(savedIdea.id, null);
                            return;
                          }
                          const evalCount = savedIdea.evaluation_count || savedIdea.evaluations?.length || 1;
                          if (evalCount > 1) {
                            setAlternativesData({
                              ideaId: savedIdea.id,
                              title: savedIdea.title,
                              evaluations: savedIdea.evaluations || [],
                            });
                            setShowAlternativesPopup(true);
                          } else {
                            loadSavedIdea(savedIdea.id);
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          padding: "20px 24px",
                          cursor: "pointer",
                        }}
                      >
                        {/* Compare checkbox — only visible in selection mode */}
                        {compareSelecting && (
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              border: isSelected ? "2px solid #60a5fa" : "2px solid rgba(64,64,64,0.6)",
                              background: isSelected ? "rgba(59,130,246,0.2)" : "transparent",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              transition: "all 0.2s",
                              fontSize: 12,
                              color: "#60a5fa",
                              fontWeight: 700,
                            }}
                          >
                            {isSelected ? "✓" : ""}
                          </div>
                        )}
                        {/* Score circle */}
                        <div style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          background: `rgba(${score >= 7 ? "16,185,129" : score >= 5 ? "59,130,246" : score >= 3 ? "245,158,11" : "239,68,68"},0.15)`,
                          border: `2px solid ${getScoreColor(score)}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <span style={{
                            fontSize: 16,
                            fontWeight: 700,
                            fontFamily: "monospace",
                            color: getScoreColor(score),
                          }}>
                            {score.toFixed(1)}
                          </span>
                        </div>

                        {/* Title + meta */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#f5f5f5",
                            margin: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>
                            {savedIdea.title}
                          </h3>
                          {/* Branch origin label */}
                          {savedIdea.parent_idea_id && (() => {
                            const parentIdea = myIdeas.find(i => i.id === savedIdea.parent_idea_id);
                            return (
                              <p style={{ fontSize: 11, color: "#737373", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                ↳ from {parentIdea?.title || "parent idea"}
                                {savedIdea.branch_reason && <span style={{ color: "#525252" }}> — {savedIdea.branch_reason}</span>}
                              </p>
                            );
                          })()}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 12, color: "#525252" }}>{date}</span>
                            {/* Main version badge */}
                            {savedIdea.is_main_version && (
                              <>
                                <span style={{ fontSize: 12, color: "#333" }}>·</span>
                                <span style={{
                                  fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 9999,
                                  background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)",
                                }}>★ Main</span>
                              </>
                            )}
                            {/* Branch children count */}
                            {(() => {
                              const childCount = myIdeas.filter(i => i.parent_idea_id === savedIdea.id).length;
                              return childCount > 0 ? (
                                <>
                                  <span style={{ fontSize: 12, color: "#333" }}>·</span>
                                  <span style={{
                                    fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 9999,
                                    background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.25)",
                                  }}>
                                    {childCount} branch{childCount > 1 ? "es" : ""}
                                  </span>
                                </>
                              ) : null;
                            })()}
                            {eval_?.classification && (
                              <>
                                <span style={{ fontSize: 12, color: "#333" }}>·</span>
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: 9999,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                  ...(eval_.classification === "social_impact"
                                    ? { background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }
                                    : { background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }),
                                }}>
                                  {eval_.classification === "social_impact" ? "Social Impact" : "Commercial"}
                                </span>
                              </>
                            )}
                            {eval_?.data_source === "verified" && (
                              <>
                                <span style={{ fontSize: 12, color: "#333" }}>·</span>
                                <span style={{ fontSize: 10, color: "#34d399", fontWeight: 500, flexShrink: 0 }}>Verified</span>
                              </>
                            )}
                            {(savedIdea.evaluation_count || savedIdea.evaluations?.length || 1) > 1 && (
                              <>
                                <span style={{ fontSize: 12, color: "#333" }}>·</span>
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 500,
                                  padding: "2px 8px",
                                  borderRadius: 9999,
                                  background: "rgba(108,99,255,0.12)",
                                  color: "#a78bfa",
                                  border: "1px solid rgba(108,99,255,0.25)",
                                }}>
                                  {(savedIdea.evaluation_count || savedIdea.evaluations?.length) - 1} alt{(savedIdea.evaluation_count || savedIdea.evaluations?.length) - 1 > 1 ? "s" : ""}
                                </span>
                              </>
                            )}
                          </div>
                          {eval_?.summary_text && (
                            <p style={{
                              fontSize: 12,
                              color: "#525252",
                              margin: "6px 0 0 0",
                              lineHeight: 1.4,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}>
                              {eval_.summary_text}
                            </p>
                          )}
                        </div>

                        {/* Score bars mini */}
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          {[
                            { label: "MD", score: eval_?.market_demand_score },
                            { label: "MO", score: eval_?.monetization_score },
                            { label: "OR", score: eval_?.originality_score },
                            { label: "TC", score: eval_?.technical_complexity_score },
                          ].map((m, i) => (
                            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                              <div style={{
                                width: 6,
                                height: 32,
                                background: "#1a1a1a",
                                borderRadius: 3,
                                overflow: "hidden",
                                display: "flex",
                                flexDirection: "column-reverse",
                              }}>
                                <div style={{
                                  width: "100%",
                                  height: `${((m.score || 0) / 10) * 100}%`,
                                  background: i === 3
                                    ? (m.score >= 8 ? "#ef4444" : m.score >= 6 ? "#f59e0b" : "#3b82f6")
                                    : getScoreColor(m.score || 0),
                                  borderRadius: 3,
                                }} />
                              </div>
                              <span style={{ fontSize: 8, color: "#404040", fontWeight: 500 }}>{m.label}</span>
                            </div>
                          ))}
                        </div>

                        {/* Arrow */}
                        <span style={{ color: "#404040", fontSize: 16, flexShrink: 0 }}>→</span>
                      </div>

                      {/* Delete row */}
                      <div style={{
                        padding: "0 24px 12px 24px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}>
                        {/* Progress indicator */}
                        {savedIdea.progress?.has_progress ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ display: "flex", gap: 2 }}>
                              {Array.from({ length: savedIdea.progress.total_phases || 0 }).map((_, idx) => {
                                const phaseKey = `phase_${idx + 1}`;
                                const isCompleted = (savedIdea.progress.completed_phases || []).includes(phaseKey);
                                return (
                                  <div key={idx} style={{
                                    width: 16,
                                    height: 4,
                                    borderRadius: 2,
                                    background: isCompleted ? "#10b981" : "#262626",
                                  }} />
                                );
                              })}
                            </div>
                            <span style={{ fontSize: 11, color: "#737373" }}>
                              {savedIdea.progress.completed}/{savedIdea.progress.total_phases}
                            </span>
                          </div>
                        ) : savedIdea.progress?.total_phases > 0 ? (
                          <span style={{ fontSize: 11, color: "#404040" }}>
                            {savedIdea.progress.total_phases} phases · no progress yet
                          </span>
                        ) : (
                          <span />
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          {(savedIdea.parent_idea_id || myIdeas.some(i => i.parent_idea_id === savedIdea.id)) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLineageTargetId(savedIdea.id);
                                setLineageMode(true);
                              }}
                              style={{
                                fontSize: 11,
                                color: "#a78bfa",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                              }}
                            >
                              View lineage
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Delete this saved idea? This cannot be undone.")) {
                                deleteSavedIdea(savedIdea.id);
                              }
                            }}
                            disabled={deletingIdeaId === savedIdea.id}
                            style={{
                              fontSize: 11,
                              color: deletingIdeaId === savedIdea.id ? "#404040" : "#525252",
                              background: "none",
                              border: "none",
                              cursor: deletingIdeaId === savedIdea.id ? "not-allowed" : "pointer",
                            }}
                          >
                            {deletingIdeaId === savedIdea.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PageContainer>
        </main>

        <footer style={footerStyle}>
          <PageContainer>
            <p style={{ fontSize: 12, color: "#404040", margin: 0 }}>
              IdeaLoop Core — All analysis is AI-generated. Use as a guide, not a definitive assessment.
            </p>
          </PageContainer>
        </footer>
      </div>
    );
  }

  // ==========================================
  // EVOLVE THIS IDEA (Re-evaluation Screen)
  // ==========================================
  if (currentScreen === "reeval" && reEvalMode) {
    const hasAnyChange = reEvalTargetUser.trim() || reEvalProblem.trim() || reEvalCoreIdea.trim();

    // Find weakest metric from context snapshot
    const getWeakestMetric = () => {
      if (!reEvalContextSnapshot) return null;
      const metrics = [
        { key: "md", label: "Market Demand", score: reEvalContextSnapshot.md },
        { key: "mo", label: "Monetization", score: reEvalContextSnapshot.mo },
        { key: "or", label: "Originality", score: reEvalContextSnapshot.or },
      ];
      // For TC, lower is better (inverted in formula), so weakest = highest TC
      const tcEffective = reEvalContextSnapshot.tc ? (10 - reEvalContextSnapshot.tc) : 10;
      metrics.push({ key: "tc", label: "Technical Complexity", score: tcEffective, rawScore: reEvalContextSnapshot.tc });
      return metrics.reduce((min, m) => (m.score < min.score ? m : min), metrics[0]);
    };
    const weakest = getWeakestMetric();

    const getScoreColor = (s) => {
      if (s >= 8) return "#10b981";
      if (s >= 6) return "#3b82f6";
      if (s >= 4) return "#f59e0b";
      return "#ef4444";
    };

    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
        <header style={headerStyle}>
          <PageContainer>
            <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 onClick={() => setCurrentScreen(profile.coding && profile.ai ? "input" : "profile")} style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "#525252", margin: 0, cursor: "pointer" }}>
                IdeaLoop Core
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => {
                  setReEvalMode(false);
                  setCurrentScreen("results2");
                }} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
                  ← Back to evaluation
                </button>
                {!authLoading && user && (
                  <>
                    <span style={{ color: "#262626" }}>|</span>
                    <span style={{ fontSize: 12, color: "#525252" }}>{user.email}</span>
                    <button onClick={handleLogout} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
                      Log out
                    </button>
                  </>
                )}
              </div>
            </div>
          </PageContainer>
        </header>

        <StepProgress currentStep={getStepNumber()} savedMode={true} branchMode={isBranchIdea} />

        <main style={{ flex: 1, paddingBottom: 48 }}>
          <PageContainer>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 30, fontWeight: 600, margin: "0 0 12px 0" }}>
                Evolve This Idea
              </h2>
              <p style={{ fontSize: 14, color: "#737373", lineHeight: 1.5, margin: 0 }}>
                Review your current evaluation, then change one or more dimensions to test a different strategic angle.
              </p>
            </div>

            {/* SECTION 1: Context Snapshot */}
            {reEvalContextSnapshot && (
              <Card style={{ padding: 20, marginBottom: 24 }}>
                {/* Title row + score circle */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#525252", margin: "0 0 6px" }}>Current evaluation</p>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#f5f5f5", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reEvalContextSnapshot.title || "Untitled"}</p>
                  </div>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: `rgba(${(reEvalContextSnapshot.overall || 0) >= 7 ? "16,185,129" : (reEvalContextSnapshot.overall || 0) >= 5 ? "59,130,246" : (reEvalContextSnapshot.overall || 0) >= 3 ? "245,158,11" : "239,68,68"},0.15)`,
                    border: `2px solid ${getScoreColor(reEvalContextSnapshot.overall || 0)}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color: getScoreColor(reEvalContextSnapshot.overall || 0) }}>
                      {(reEvalContextSnapshot.overall || 0).toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Horizontal metric bars */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {[
                    { label: "MD", score: reEvalContextSnapshot.md },
                    { label: "MO", score: reEvalContextSnapshot.mo },
                    { label: "OR", score: reEvalContextSnapshot.or },
                    { label: "TC", score: reEvalContextSnapshot.tc, isTC: true },
                  ].map((m, i) => {
                    const s = m.score || 0;
                    const color = m.isTC
                      ? (s >= 8 ? "#ef4444" : s >= 6 ? "#f59e0b" : "#3b82f6")
                      : getScoreColor(s);
                    return (
                      <div key={i} style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: "#525252" }}>{m.label}</span>
                          <span style={{ fontSize: 11, fontFamily: "monospace", color }}>{s.toFixed(1)}</span>
                        </div>
                        <div style={{ height: 4, background: "#1a1a1a", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${(s / 10) * 100}%`, height: "100%", background: color, borderRadius: 4 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Weakest metric pill */}
                {weakest && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 500 }}>Weakest:</span>
                    <span style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 9999,
                      background: "rgba(245,158,11,0.12)",
                      border: "1px solid rgba(245,158,11,0.25)",
                      color: "#fbbf24",
                    }}>
                      {weakest.label} — {(weakest.key === "tc" ? weakest.rawScore : weakest.score)?.toFixed(1)}
                    </span>
                  </div>
                )}

                {/* Top risks — separated by border */}
                {reEvalContextSnapshot.failure_risks?.length > 0 && (
                  <div style={{ borderTop: "1px solid rgba(38,38,38,0.6)", paddingTop: 12 }}>
                    <p style={{ fontSize: 11, color: "#525252", fontWeight: 500, margin: "0 0 6px" }}>Top risks</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {reEvalContextSnapshot.failure_risks.slice(0, 2).map((risk, i) => (
                        <p key={i} style={{ fontSize: 12, color: "#737373", margin: 0, lineHeight: 1.4 }}>• {risk}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confidence level */}
                {reEvalContextSnapshot.confidence_level && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 9999,
                      fontWeight: 500,
                      ...(reEvalContextSnapshot.confidence_level.level === "HIGH"
                        ? { background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }
                        : reEvalContextSnapshot.confidence_level.level === "MEDIUM"
                        ? { background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.25)" }
                        : { background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }),
                    }}>
                      {reEvalContextSnapshot.confidence_level.level} confidence
                    </span>
                  </div>
                )}
              </Card>
            )}

            {/* Original idea — read-only */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#737373", marginBottom: 8 }}>
                Original idea
              </label>
              <Card style={{ padding: "16px 20px", maxHeight: 150, overflowY: "auto" }}>
                <p style={{ fontSize: 14, color: "#a3a3a3", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                  {reEvalOriginalIdea}
                </p>
              </Card>
            </div>

            {/* SECTION 2: What do you want to change? */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "#a3a3a3", margin: "0 0 12px" }}>What do you want to change?</p>

              {/* Target User */}
              <div style={{
                background: reEvalEditTarget ? "rgba(108,99,255,0.04)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${reEvalEditTarget ? "rgba(108,99,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 12,
                padding: 16,
                marginBottom: 8,
                transition: "all 0.2s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#a3a3a3" }}>Target user</span>
                  <button
                    onClick={() => { setReEvalEditTarget(!reEvalEditTarget); if (reEvalEditTarget) setReEvalTargetUser(""); }}
                    style={{ fontSize: 12, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
                  >
                    {reEvalEditTarget ? "Cancel" : "Edit"}
                  </button>
                </div>
                {reEvalEditTarget && (
                  <div style={{ marginTop: 10 }}>
                    <input
                      type="text"
                      value={reEvalTargetUser}
                      onChange={(e) => setReEvalTargetUser(e.target.value)}
                      placeholder="e.g. Busy professionals aged 30-45 tracking macros"
                      style={{
                        width: "100%",
                        background: "rgba(23,23,23,0.6)",
                        border: "1px solid rgba(64,64,64,0.4)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontSize: 13,
                        color: "#f5f5f5",
                        outline: "none",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Problem */}
              <div style={{
                background: reEvalEditProblem ? "rgba(108,99,255,0.04)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${reEvalEditProblem ? "rgba(108,99,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 12,
                padding: 16,
                marginBottom: 8,
                transition: "all 0.2s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#a3a3a3" }}>Problem it solves</span>
                  <button
                    onClick={() => { setReEvalEditProblem(!reEvalEditProblem); if (reEvalEditProblem) setReEvalProblem(""); }}
                    style={{ fontSize: 12, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
                  >
                    {reEvalEditProblem ? "Cancel" : "Edit"}
                  </button>
                </div>
                {reEvalEditProblem && (
                  <div style={{ marginTop: 10 }}>
                    <input
                      type="text"
                      value={reEvalProblem}
                      onChange={(e) => setReEvalProblem(e.target.value)}
                      placeholder="e.g. People waste money on meal plans they never follow"
                      style={{
                        width: "100%",
                        background: "rgba(23,23,23,0.6)",
                        border: "1px solid rgba(64,64,64,0.4)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontSize: 13,
                        color: "#f5f5f5",
                        outline: "none",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Core Idea */}
              <div style={{
                background: reEvalEditCore ? "rgba(108,99,255,0.04)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${reEvalEditCore ? "rgba(108,99,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 12,
                padding: 16,
                marginBottom: 0,
                transition: "all 0.2s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#a3a3a3" }}>Core idea</span>
                  <button
                    onClick={() => { setReEvalEditCore(!reEvalEditCore); if (reEvalEditCore) setReEvalCoreIdea(""); }}
                    style={{ fontSize: 12, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
                  >
                    {reEvalEditCore ? "Cancel" : "Edit"}
                  </button>
                </div>
                {reEvalEditCore && (
                  <div style={{ marginTop: 10 }}>
                    <input
                      type="text"
                      value={reEvalCoreIdea}
                      onChange={(e) => setReEvalCoreIdea(e.target.value)}
                      placeholder="e.g. Instead of general nutrition, focus on post-workout recovery meals"
                      style={{
                        width: "100%",
                        background: "rgba(23,23,23,0.6)",
                        border: "1px solid rgba(64,64,64,0.4)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontSize: 13,
                        color: "#f5f5f5",
                        outline: "none",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 20px", marginBottom: 24 }}>
                <p style={{ fontSize: 14, color: "#f87171", margin: 0 }}>{error}</p>
              </div>
            )}

            {/* Evaluate button */}
            <button
              onClick={handleReEvaluate}
              disabled={isReEvaluating || evalsRemaining <= 0}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                cursor: isReEvaluating || evalsRemaining <= 0 ? "not-allowed" : "pointer",
                background: isReEvaluating || evalsRemaining <= 0 ? "rgba(38,38,38,0.6)" : hasAnyChange ? "#8b5cf6" : "#fff",
                color: isReEvaluating || evalsRemaining <= 0 ? "#525252" : hasAnyChange ? "#fff" : "#0a0a0a",
                marginBottom: 12,
              }}
            >
              {isReEvaluating ? "Evaluating..." : evalsRemaining <= 0 ? "No evaluations remaining" : hasAnyChange ? "Evaluate new version" : "Re-evaluate with fresh data"}
            </button>

            {/* Eval limit indicator */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: 12,
              background: evalsRemaining <= 0 ? "rgba(239,68,68,0.08)" : evalsRemaining === 1 ? "rgba(245,158,11,0.08)" : "rgba(38,38,38,0.4)",
              border: `1px solid ${evalsRemaining <= 0 ? "rgba(239,68,68,0.2)" : evalsRemaining === 1 ? "rgba(245,158,11,0.2)" : "rgba(64,64,64,0.3)"}`,
            }}>
              <span style={{
                fontSize: 13,
                color: evalsRemaining <= 0 ? "#f87171" : evalsRemaining === 1 ? "#fbbf24" : "#737373",
              }}>
                {evalsRemaining <= 0
                  ? `No evaluations remaining this week.`
                  : `${evalsRemaining} of ${EVAL_LIMIT} free evaluations remaining this week`}
              </span>
            </div>

            {isReEvaluating && (
              <div style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                background: "rgba(0,0,0,0.75)",
                animation: "overlayFadeIn 0.3s ease-out",
              }}>
                <div style={{
                  background: "#0d0d0d",
                  border: "1px solid #262626",
                  borderRadius: 12,
                  padding: "28px 32px",
                  fontFamily: "'Courier New', Courier, monospace",
                  fontSize: 13,
                  lineHeight: 1.8,
                  width: "90%",
                  maxWidth: 520,
                  boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid #1a1a1a" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#8b5cf6", boxShadow: "0 0 8px rgba(139,92,246,0.5)" }} />
                    <span style={{ color: "#525252", fontSize: 11, letterSpacing: "0.08em" }}>EVOLUTION PIPELINE</span>
                  </div>
                  {streamSteps.map((s, i) => (
                    <div key={i} style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      color: s.done ? "#a3a3a3" : "#e5e5e5",
                      opacity: s.done ? 0.8 : 1,
                      animation: "fadeInStep 0.3s ease-out",
                    }}>
                      <span style={{ color: s.done ? "#8b5cf6" : "#f59e0b", flexShrink: 0, width: 16, textAlign: "center" }}>
                        {s.done ? "✓" : "›"}
                      </span>
                      <span style={{ wordBreak: "break-word" }}>{s.message}</span>
                    </div>
                  ))}
                  {streamSteps.length > 0 && !streamSteps.some(s => s.step === "complete") && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#525252", marginTop: 2 }}>
                      <span style={{ width: 16, textAlign: "center", animation: "blink 1s step-end infinite" }}>_</span>
                    </div>
                  )}
                  {streamSteps.length === 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#525252" }}>
                      <span style={{ width: 16, textAlign: "center", animation: "blink 1s step-end infinite" }}>_</span>
                      <span>Initializing...</span>
                    </div>
                  )}
                </div>
                <style>{`
                  @keyframes fadeInStep {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                  @keyframes blink {
                    50% { opacity: 0; }
                  }
                  @keyframes overlayFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                  }
                `}</style>
              </div>
            )}
          </PageContainer>
        </main>

        <footer style={footerStyle}>
          <PageContainer>
            <p style={{ fontSize: 12, color: "#404040", margin: 0 }}>
              IdeaLoop Core — All analysis is AI-generated. Use as a guide, not a definitive assessment.
            </p>
          </PageContainer>
        </footer>
      </div>
    );
  }

  // ==========================================
  // SCREEN 2: COMPETITION + EVALUATION
  // ==========================================
  if (currentScreen === "results1" && analysis) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
        <header style={headerStyle}>
          <PageContainer wide>
            <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 onClick={() => setCurrentScreen(profile.coding && profile.ai ? "input" : "profile")} style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "#525252", margin: 0, cursor: "pointer" }}>
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
                }} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
                  {viewingFromSaved ? "← Back to My Ideas" : "← Back to idea"}
                </button>
                {!authLoading && (
                  user ? (
                    <>
                      <span style={{ color: "#262626" }}>|</span>
                      {!viewingFromSaved && (
                        <>
                          <button onClick={goToMyIdeas} style={{ fontSize: 12, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
                            My Ideas
                          </button>
                          <span style={{ color: "#262626" }}>|</span>
                        </>
                      )}
                      <span style={{ fontSize: 12, color: "#525252" }}>{user.email}</span>
                      <button onClick={handleLogout} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
                        Log out
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ color: "#262626" }}>|</span>
                      <button
                        onClick={() => setShowAuthModal(true)}
                        style={{ fontSize: 12, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
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
          />
        )}

        <StepProgress currentStep={getStepNumber()} savedMode={viewingFromSaved} branchMode={viewingFromSaved && isBranchIdea} />

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
              <SectionHeader icon="🌐" title="Competition Landscape" subtitle="Similar existing products in the market" />

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
                  <span style={{ fontSize: 11, color: "#737373" }}>via GitHub & Google</span>
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
                  <span style={{ fontSize: 11, color: "#737373" }}>use as directional guide</span>
                </div>
              )}

              {(() => {
                const sourceColors = {
                  github: { bg: "rgba(110,84,148,0.15)", color: "#a78bfa", border: "rgba(110,84,148,0.3)", label: "GitHub" },
                  google: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "rgba(59,130,246,0.3)", label: "Google" },
                  llm: { bg: "rgba(115,115,115,0.15)", color: "#a3a3a3", border: "rgba(115,115,115,0.3)", label: "AI" },
                };
                const typeColors = {
                  direct: { label: "Direct", color: "#f87171", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.25)" },
                  adjacent: { label: "Adjacent", color: "#fbbf24", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)" },
                  substitute: { label: "Substitute", color: "#60a5fa", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.25)" },
                  internal_build: { label: "Internal Build", color: "#a78bfa", bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.25)" },
                };

                const renderCompCard = (comp, i) => {
                  const src = sourceColors[comp.source] || sourceColors.llm;
                  const tc = typeColors[comp.competitor_type] || null;
                  return (
                    <Card key={i} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", margin: "0 0 8px 0", wordBreak: "break-word" }}>{comp.name}</h3>
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
                      <p style={{ fontSize: 14, color: "#a3a3a3", lineHeight: 1.6, margin: 0, flex: 1 }}>
                        {comp.description}
                      </p>
                      <p style={{ fontSize: 12, color: "#34d399", fontWeight: 600, lineHeight: 1.5, margin: 0 }}>
                        {comp.outcome}
                      </p>
                      {comp.url && (
                        <a href={comp.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 12, color: "#60a5fa", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2 }}>
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
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#d4d4d4", letterSpacing: "0.01em" }}>Direct Competitors</span>
                            <span style={{ fontSize: 11, color: "#525252", fontWeight: 500, marginLeft: 2 }}>{directCompetitors.length}</span>
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
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#d4d4d4", letterSpacing: "0.01em" }}>Alternatives</span>
                            <span style={{ fontSize: 11, color: "#525252", fontWeight: 500, marginLeft: 2 }}>{alternatives.length}</span>
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
                <Card style={{ background: "rgba(23,23,23,0.4)", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#e5e5e5", margin: "0 0 8px 0" }}>
                    How your idea compares
                  </h3>
                  <p style={{ fontSize: 14, color: "#a3a3a3", lineHeight: 1.6, margin: 0 }}>
                    {analysis.competition.differentiation}
                  </p>
                </Card>
              )}
            </section>

            {/* Final Evaluation */}
            <section style={{ marginBottom: 48 }}>
              <SectionHeader icon="📊" title="Evaluation" subtitle="Scored analysis of your AI product idea" />

              {/* Overall score */}
              <Card style={{ padding: 32, textAlign: "center", marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: "#737373", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, margin: "0 0 4px 0" }}>
                  Overall Idea Potential
                </p>
                <p style={{ fontSize: 10, color: "#404040", margin: "0 0 12px 0" }}>
                  Weighted average · Higher is better
                </p>
                <p style={{ fontSize: 64, fontWeight: 700, color: "#f5f5f5", margin: 0, lineHeight: 1 }}>
                  {analysis.evaluation.overall_score.toFixed(1)}
                  <span style={{ fontSize: 20, fontWeight: 400, color: "#525252" }}>/10</span>
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
                    color: "#525252",
                    fontSize: 11,
                    fontWeight: 500,
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "#737373"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "#525252"}
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
                      background: "#171717",
                      border: "1px solid rgba(64,64,64,0.6)",
                      borderRadius: 16,
                      padding: 28,
                      maxWidth: 480,
                      width: "100%",
                      maxHeight: "80vh",
                      overflowY: "auto",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5", margin: 0 }}>
                        Score Guide
                      </h3>
                      <button
                        onClick={() => setShowScoreGuide(false)}
                        style={{
                          background: "rgba(38,38,38,0.6)",
                          border: "1px solid rgba(64,64,64,0.4)",
                          borderRadius: 8,
                          width: 28,
                          height: 28,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "#737373",
                          fontSize: 14,
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    <p style={{ fontSize: 13, color: "#737373", lineHeight: 1.6, margin: "0 0 20px 0" }}>
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
                        background: "rgba(23,23,23,0.6)",
                        border: "1px solid rgba(38,38,38,0.6)",
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
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e5e5" }}>
                            {tier.title}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: "#737373", lineHeight: 1.5, margin: 0 }}>
                          {tier.desc}
                        </p>
                      </div>
                    ))}

                    <p style={{ fontSize: 11, color: "#404040", lineHeight: 1.5, margin: "16px 0 0 0", textAlign: "center" }}>
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
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
                  <span style={{ fontSize: 13, color: "#a3a3a3", lineHeight: 1.5 }}>
                    {analysis.evaluation.confidence_level.reason}
                  </span>
                </div>
              )}

              {/* Metrics */}
              <Card style={{ padding: 32, marginBottom: 16 }}>
                <ScoreBar
                  name="Market Demand"
                  score={analysis.evaluation.market_demand.score}
                  explanation={analysis.evaluation.market_demand.explanation}
                  weight="30%"
                  notes={[
                    analysis.evaluation.market_demand.geographic_note,
                    analysis.evaluation.market_demand.trajectory_note,
                  ].filter(Boolean)}
                />
                <ScoreBar
                  name={analysis.evaluation.monetization.label || "Monetization Potential"}
                  score={analysis.evaluation.monetization.score}
                  explanation={analysis.evaluation.monetization.explanation}
                  weight="25%"
                />
                <ScoreBar
                  name="Originality"
                  score={analysis.evaluation.originality.score}
                  explanation={analysis.evaluation.originality.explanation}
                  weight="25%"
                />
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#e5e5e5" }}>
                      Technical Complexity
                      <span style={{ fontSize: 11, fontWeight: 400, color: "#525252", marginLeft: 8 }}>20% · inverted</span>
                    </span>
                    <span style={{
                      fontSize: 14,
                      fontFamily: "monospace",
                      fontWeight: 600,
                      color: analysis.evaluation.technical_complexity.score >= 8 ? "#ef4444"
                        : analysis.evaluation.technical_complexity.score >= 6 ? "#f59e0b"
                        : analysis.evaluation.technical_complexity.score >= 4 ? "#3b82f6"
                        : "#10b981",
                    }}>
                      {analysis.evaluation.technical_complexity.score.toFixed(1)}/10
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "#262626", borderRadius: 9999, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      borderRadius: 9999,
                      background: analysis.evaluation.technical_complexity.score >= 8 ? "#ef4444"
                        : analysis.evaluation.technical_complexity.score >= 6 ? "#f59e0b"
                        : analysis.evaluation.technical_complexity.score >= 4 ? "#3b82f6"
                        : "#10b981",
                      width: `${(analysis.evaluation.technical_complexity.score / 10) * 100}%`,
                      transition: "width 1s ease-out",
                    }} />
                  </div>
                  <p style={{ fontSize: 12, color: "#737373", marginTop: 8, lineHeight: 1.5 }}>
                    {analysis.evaluation.technical_complexity.base_score_explanation}
                    {" "}{analysis.evaluation.technical_complexity.adjustment_explanation}
                    {" "}{analysis.evaluation.technical_complexity.explanation}
                  </p>
                  {analysis.evaluation.technical_complexity.incremental_note && (
                    <p style={{ fontSize: 11, color: "#525252", marginTop: 4, lineHeight: 1.4, fontStyle: "italic" }}>
                      {analysis.evaluation.technical_complexity.incremental_note}
                    </p>
                  )}
                </div>
              </Card>

              {/* Marketplace Note */}
              {analysis.evaluation.marketplace_note && (
                <Card style={{ padding: 24, marginBottom: 16, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#60a5fa", margin: "0 0 6px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Marketplace Note
                  </p>
                  <p style={{ fontSize: 13, color: "#a3a3a3", lineHeight: 1.6, margin: 0 }}>
                    {analysis.evaluation.marketplace_note}
                  </p>
                </Card>
              )}

              {/* Summary */}
              <Card style={{ padding: 32 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#e5e5e5", margin: "0 0 12px 0" }}>Summary</h3>
                <p style={{ fontSize: 14, color: "#a3a3a3", lineHeight: 1.7, margin: 0 }}>
                  {analysis.evaluation.summary}
                </p>
              </Card>

              {/* Disclaimer */}
              <p style={{ fontSize: 12, color: "#404040", textAlign: "center", margin: "16px 0 24px 0", lineHeight: 1.5 }}>
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
                background: "#fff",
                color: "#0a0a0a",
                cursor: "pointer",
              }}
            >
              {viewingFromSaved ? "View Your Roadmap" : "Continue to Roadmap"}
            </button>
          </PageContainer>
        </main>

        <footer style={footerStyle}>
          <PageContainer wide>
            <p style={{ fontSize: 12, color: "#404040", margin: 0 }}>
              IdeaLoop Core — All analysis is AI-generated. Use as a guide, not a definitive assessment.
            </p>
          </PageContainer>
        </footer>
      </div>
    );
  }

  // ==========================================
  // SCREEN 3: EXECUTION PLAN + TOOLS + ESTIMATES
  // ==========================================
  if (currentScreen === "results2" && analysis) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
        <header style={headerStyle}>
          <PageContainer wide>
            <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 onClick={() => setCurrentScreen(profile.coding && profile.ai ? "input" : "profile")} style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "#525252", margin: 0, cursor: "pointer" }}>
                IdeaLoop Core
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => setCurrentScreen("results1")} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
                  ← Back to analysis
                </button>
                {!authLoading && user && (
                  <>
                    <span style={{ color: "#262626" }}>|</span>
                    {!viewingFromSaved && (
                      <>
                        <button onClick={goToMyIdeas} style={{ fontSize: 12, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
                          My Ideas
                        </button>
                        <span style={{ color: "#262626" }}>|</span>
                      </>
                    )}
                    <span style={{ fontSize: 12, color: "#525252" }}>{user.email}</span>
                    <button onClick={handleLogout} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
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
          />
        )}

        <StepProgress currentStep={getStepNumber()} savedMode={viewingFromSaved} branchMode={viewingFromSaved && isBranchIdea} />

        <main style={{ flex: 1, paddingBottom: 64 }}>
          <PageContainer wide>
            {/* Failure Risks */}
            {analysis.evaluation.failure_risks && analysis.evaluation.failure_risks.length > 0 && (
              <section style={{ marginBottom: 48 }}>
                <SectionHeader icon="⚠️" title="Key Risks" subtitle="Potential challenges to be aware of before building" />
                <Card style={{
                  padding: 24,
                  background: "rgba(239,68,68,0.04)",
                  border: "1px solid rgba(239,68,68,0.15)",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {analysis.evaluation.failure_risks.map((risk, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#f87171",
                          flexShrink: 0,
                          marginTop: 1,
                        }}>
                          {i + 1}.
                        </span>
                        <p style={{ fontSize: 14, color: "#a3a3a3", lineHeight: 1.6, margin: 0 }}>
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
              <SectionHeader icon="⚙" title="Execution Phases" subtitle={viewingFromSaved ? "Track your progress across each phase" : "Recommended roadmap for building your idea"} />

              {/* Progress summary bar — only show for saved ideas */}
              {viewingFromSaved && currentEvaluationId && currentPhases.length > 0 && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 16,
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "rgba(38,38,38,0.4)",
                  border: "1px solid rgba(64,64,64,0.3)",
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
                          background: isCompleted ? "#10b981" : "#262626",
                          transition: "background 0.3s",
                        }} />
                      );
                    })}
                  </div>
                  <span style={{ fontSize: 12, color: "#737373", flexShrink: 0 }}>
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
                      background: "rgba(23,23,23,0.6)",
                      border: `1px solid ${isCompleted ? "rgba(16,185,129,0.3)" : "rgba(38,38,38,0.8)"}`,
                      borderRadius: 16,
                      overflow: "hidden",
                      transition: "border-color 0.3s",
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
                            background: isCompleted ? "rgba(16,185,129,0.2)" : "rgba(59,130,246,0.15)",
                            border: `2px solid ${isCompleted ? "rgba(16,185,129,0.5)" : "rgba(59,130,246,0.3)"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: isCompleted ? 16 : 14,
                            fontWeight: 700,
                            color: isCompleted ? "#34d399" : "#60a5fa",
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
                          background: "rgba(59,130,246,0.15)",
                          border: "1px solid rgba(59,130,246,0.3)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#60a5fa",
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
                          color: isCompleted ? "#737373" : "#f5f5f5",
                          margin: 0,
                          textDecoration: isCompleted ? "line-through" : "none",
                          transition: "all 0.2s",
                        }}>
                          {phase.title}
                        </h3>
                        <p style={{
                          fontSize: 14,
                          color: isCompleted ? "#404040" : "#737373",
                          margin: "4px 0 0 0",
                          lineHeight: 1.5,
                        }}>
                          {phase.summary}
                        </p>
                      </div>
                      <span
                        onClick={() => togglePhase(i)}
                        style={{
                          color: "#525252",
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
                      <div style={{ padding: "0 24px 24px 24px", borderTop: "1px solid rgba(38,38,38,0.6)" }}>
                        {editingPhase === i ? (
                          <div style={{ paddingTop: 20 }}>
                            <input
                              type="text"
                              value={(editedPhases || analysis.phases)[i].title}
                              onChange={(e) => savePhaseEdit(i, "title", e.target.value)}
                              style={{
                                width: "100%",
                                background: "rgba(38,38,38,0.6)",
                                border: "1px solid rgba(64,64,64,0.6)",
                                borderRadius: 12,
                                padding: "10px 16px",
                                fontSize: 14,
                                color: "#f5f5f5",
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
                                background: "rgba(38,38,38,0.6)",
                                border: "1px solid rgba(64,64,64,0.6)",
                                borderRadius: 12,
                                padding: "12px 16px",
                                fontSize: 14,
                                color: "#f5f5f5",
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
                            <p style={{ fontSize: 14, color: "#a3a3a3", lineHeight: 1.7, margin: "0 0 16px 0", whiteSpace: "pre-line" }}>
                              {(editedPhases || analysis.phases)[i].details}
                            </p>

                            {/* Notes section — only for saved ideas */}
                            {canTrackProgress && (
                              <div style={{
                                marginTop: 16,
                                padding: "12px 16px",
                                borderRadius: 12,
                                background: "rgba(38,38,38,0.3)",
                                border: "1px solid rgba(64,64,64,0.3)",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Notes
                                  </span>
                                  {progress?.note && editingNotePhase !== phaseKey && (
                                    <button
                                      onClick={() => {
                                        setEditingNotePhase(phaseKey);
                                        setNoteText(progress.note);
                                      }}
                                      style={{ fontSize: 11, color: "#525252", background: "none", border: "none", cursor: "pointer" }}
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
                                        background: "rgba(23,23,23,0.8)",
                                        border: "1px solid rgba(64,64,64,0.6)",
                                        borderRadius: 8,
                                        padding: "10px 12px",
                                        fontSize: 13,
                                        color: "#d4d4d4",
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
                                        style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : progress?.note ? (
                                  <p style={{ fontSize: 13, color: "#a3a3a3", lineHeight: 1.5, margin: 0, whiteSpace: "pre-line" }}>
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
                                      color: "#525252",
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
                                style={{ fontSize: 12, fontWeight: 500, color: "#525252", background: "none", border: "none", cursor: "pointer" }}
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
                              <span style={{ fontSize: 14, fontWeight: 600, color: "#d4d4d4", letterSpacing: "0.01em" }}>{group.title}</span>
                              <span style={{ fontSize: 11, color: "#525252", fontWeight: 500, marginLeft: 2 }}>{groupPhases.length} phases</span>
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
              <SectionHeader icon="🔧" title="Tool Recommendations" subtitle="Platforms and tools to help you build" />

              {(() => {
                const toolCategories = ["Validate & Prototype", "Core Tech Stack", "Launch & Grow"];
                const hasNewCategories = analysis.tools?.some(t => toolCategories.includes(t.category));

                if (hasNewCategories) {
                  const groupIcons = {
                    "Validate & Prototype": "🔍",
                    "Core Tech Stack": "🛠",
                    "Launch & Grow": "🚀",
                  };
                  return (
                    <div>
                      {toolCategories.map(category => {
                        const groupTools = analysis.tools.filter(t => t.category === category);
                        if (groupTools.length === 0) return null;
                        return (
                          <div key={category}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 8 }}>
                              <span style={{ fontSize: 15 }}>{groupIcons[category]}</span>
                              <span style={{ fontSize: 14, fontWeight: 600, color: "#d4d4d4", letterSpacing: "0.01em" }}>{category}</span>
                              <span style={{ fontSize: 11, color: "#525252", fontWeight: 500, marginLeft: 2 }}>{groupTools.length} tools</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 24 }}>
                              {groupTools.map((tool, i) => (
                                <Card key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  <div>
                                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", margin: 0 }}>{tool.name}</h3>
                                  </div>
                                  <p style={{ fontSize: 14, color: "rgba(96,165,250,0.8)", lineHeight: 1.6, margin: 0 }}>
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
                        <Card key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div>
                            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", margin: 0 }}>{tool.name}</h3>
                            <p style={{ fontSize: 12, color: "#737373", margin: "4px 0 0 0", fontWeight: 500 }}>{tool.category}</p>
                          </div>
                          <p style={{ fontSize: 14, color: "rgba(96,165,250,0.8)", lineHeight: 1.6, margin: 0 }}>
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
              <SectionHeader icon="⏱" title="Time & Difficulty" subtitle="Calibrated to your experience level" />

              <Card style={{ padding: 32 }}>
                <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", marginBottom: 24 }}>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: "#737373", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, margin: "0 0 8px 0" }}>
                      Estimated Duration
                    </p>
                    <p style={{ fontSize: 24, fontWeight: 700, color: "#f5f5f5", margin: 0 }}>
                      {analysis.estimates.duration}
                    </p>
                  </div>
                  <div style={{ width: 1, height: 64, background: "#262626" }} />
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: "#737373", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, margin: "0 0 8px 0" }}>
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
                <p style={{ fontSize: 14, color: "#a3a3a3", textAlign: "center", lineHeight: 1.6, maxWidth: 560, margin: "0 auto" }}>
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
                          <p style={{ fontSize: 15, fontWeight: 600, color: "#f5f5f5", margin: 0 }}>
                            What do you want to do with this version?
                          </p>
                        </div>
                        {saveStatus === "naming" ? (
                          <div style={{
                            padding: "16px 20px",
                            borderRadius: 12,
                            background: "rgba(23,23,23,0.6)",
                            border: "1px solid rgba(108,99,255,0.3)",
                          }}>
                            {/* Branch name */}
                            <label style={{ fontSize: 13, fontWeight: 500, color: "#a3a3a3", display: "block", marginBottom: 8 }}>
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
                                background: "rgba(23,23,23,0.8)",
                                border: "1px solid rgba(64,64,64,0.6)",
                                borderRadius: 10,
                                padding: "10px 14px",
                                fontSize: 14,
                                color: "#f5f5f5",
                                outline: "none",
                                boxSizing: "border-box",
                                marginBottom: 14,
                              }}
                            />

                            {/* Branch reason */}
                            <label style={{ fontSize: 13, fontWeight: 500, color: "#a3a3a3", display: "block", marginBottom: 8 }}>
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
                                background: "rgba(23,23,23,0.8)",
                                border: "1px solid rgba(64,64,64,0.6)",
                                borderRadius: 10,
                                padding: "10px 14px",
                                fontSize: 14,
                                color: "#f5f5f5",
                                outline: "none",
                                boxSizing: "border-box",
                                marginBottom: 14,
                              }}
                            />

                            {/* Changed dimensions */}
                            <label style={{ fontSize: 13, fontWeight: 500, color: "#a3a3a3", display: "block", marginBottom: 8 }}>
                              What changed? <span style={{ fontWeight: 400, color: "#525252" }}>(select at least one)</span>
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
                                      border: selected ? "1px solid rgba(139,92,246,0.5)" : "1px solid rgba(64,64,64,0.4)",
                                      background: selected ? "rgba(139,92,246,0.15)" : "transparent",
                                      color: selected ? "#a78bfa" : "#737373",
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
                                  background: (!ideaName.trim() || !branchReason.trim() || branchDimensions.length === 0) ? "rgba(38,38,38,0.6)" : "rgba(139,92,246,0.2)",
                                  color: (!ideaName.trim() || !branchReason.trim() || branchDimensions.length === 0) ? "#525252" : "#a78bfa",
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
                                  border: "1px solid rgba(64,64,64,0.4)",
                                  background: "transparent",
                                  color: "#525252",
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
                                background: saveStatus === "saving" ? "rgba(38,38,38,0.6)" : "rgba(108,99,255,0.12)",
                                color: saveStatus === "saving" ? "#525252" : "#a78bfa",
                                textAlign: "left",
                                transition: "all 0.2s",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span>{saveStatus === "saving" ? "Saving..." : "Save as branch"}</span>
                                <span style={{ fontSize: 18, opacity: 0.5 }}>→</span>
                              </div>
                              <p style={{ fontSize: 12, color: "#737373", margin: "6px 0 0", fontWeight: 400 }}>
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
                              <p style={{ fontSize: 12, color: "#525252", margin: "6px 0 0", fontWeight: 400 }}>
                                Save as branch and promote it as your current best direction
                              </p>
                            </button>

                            <button
                              onClick={() => {
                                setIsReEvalResult(false);
                                setReEvalRevisionNotes(null);
                                setReEvalChangedFields(null);
                                setReEvalContextSnapshot(null);
                                setViewingFromSaved(true);
                                setSaveStatus("saved");
                                goToMyIdeas();
                              }}
                              style={{
                                width: "100%",
                                padding: "14px 16px",
                                borderRadius: 12,
                                fontSize: 14,
                                fontWeight: 500,
                                border: "1px solid rgba(64,64,64,0.4)",
                                background: "transparent",
                                color: "#737373",
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 0.2s",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span>Discard</span>
                                <span style={{ fontSize: 18, opacity: 0.3 }}>×</span>
                              </div>
                              <p style={{ fontSize: 12, color: "#525252", margin: "6px 0 0", fontWeight: 400 }}>
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
                      ✓ Saved to My Ideas ({savedIdeasCount}/{SAVED_IDEA_LIMIT})
                    </div>
                  ) : savedIdeasCount >= SAVED_IDEA_LIMIT ? (
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
                      Free tier limit reached ({SAVED_IDEA_LIMIT}/{SAVED_IDEA_LIMIT} ideas saved)
                    </div>
                  ) : saveStatus === "naming" ? (
                    <div style={{
                      padding: "16px 20px",
                      borderRadius: 12,
                      background: "rgba(23,23,23,0.6)",
                      border: "1px solid rgba(59,130,246,0.3)",
                    }}>
                      <label style={{ fontSize: 13, fontWeight: 500, color: "#a3a3a3", display: "block", marginBottom: 8 }}>
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
                          background: "rgba(23,23,23,0.8)",
                          border: "1px solid rgba(64,64,64,0.6)",
                          borderRadius: 10,
                          padding: "10px 14px",
                          fontSize: 14,
                          color: "#f5f5f5",
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
                            background: !ideaName.trim() ? "rgba(38,38,38,0.6)" : "rgba(59,130,246,0.15)",
                            color: !ideaName.trim() ? "#525252" : "#60a5fa",
                          }}
                        >
                          Save ({savedIdeasCount}/{SAVED_IDEA_LIMIT})
                        </button>
                        <button
                          onClick={() => { setSaveStatus("idle"); setIdeaName(""); }}
                          style={{
                            padding: "10px 16px",
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 500,
                            border: "1px solid rgba(64,64,64,0.4)",
                            background: "transparent",
                            color: "#525252",
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
                          background: saveStatus === "saving" ? "rgba(38,38,38,0.6)" : "rgba(59,130,246,0.12)",
                          color: saveStatus === "saving" ? "#525252" : "#60a5fa",
                          transition: "all 0.2s",
                        }}
                      >
                        {saveStatus === "saving" ? "Saving..." : `Save to My Ideas (${savedIdeasCount}/${SAVED_IDEA_LIMIT})`}
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
                      border: "1px solid rgba(64,64,64,0.6)",
                      background: "transparent",
                      color: "#737373",
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
                    <button
                      onClick={() => {
                        setCurrentScreen("delta");
                        if (!deltaData && !deltaLoading) {
                          fetchDelta(currentIdeaId);
                        }
                      }}
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
                    <button
                      onClick={() => {
                        setViewingFromSaved(false);
                        setPhaseProgress({});
                        setCurrentEvaluationId(null);
                        setCurrentIdeaId(null);
                        setEditingNotePhase(null);
                        setNoteText("");
                        setDeltaData(null);
                        setDeltaError("");
                        goToMyIdeas();
                      }}
                      style={{
                        width: "100%",
                        padding: "14px 0",
                        borderRadius: 12,
                        fontSize: 14,
                        fontWeight: 600,
                        border: "1px solid rgba(64,64,64,0.6)",
                        background: "transparent",
                        color: "#a3a3a3",
                        cursor: "pointer",
                      }}
                    >
                      ← Back to My Ideas
                    </button>
                  </>
                ) : (
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
                        background: evalsRemaining <= 0 ? "rgba(38,38,38,0.6)" : "rgba(108,99,255,0.12)",
                        color: evalsRemaining <= 0 ? "#525252" : "#a78bfa",
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
                          onClick={async () => {
                            try {
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session) return;
                              await fetch(`/api/ideas/${currentIdeaId}/set-main`, {
                                method: "PATCH",
                                headers: { Authorization: `Bearer ${session.access_token}` },
                              });
                              fetchMyIdeas();
                            } catch (e) {
                              console.error("Set-main failed:", e);
                            }
                          }}
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
                    <button
                      onClick={() => {
                        setViewingFromSaved(false);
                        setPhaseProgress({});
                        setCurrentEvaluationId(null);
                        setCurrentIdeaId(null);
                        setEditingNotePhase(null);
                        setNoteText("");
                        setDeltaData(null);
                        setDeltaError("");
                        goToMyIdeas();
                      }}
                      style={{
                        width: "100%",
                        padding: "14px 0",
                        borderRadius: 12,
                        fontSize: 14,
                        fontWeight: 600,
                        border: "1px solid rgba(64,64,64,0.6)",
                        background: "transparent",
                        color: "#a3a3a3",
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
                onClick={() => {
                  setCurrentScreen("input");
                  setAnalysis(null);
                  setIdea("");
                  setEditedPhases(null);
                  setExpandedPhases({});
                  setEvalsRemaining(user ? evalsRemaining : getEvalsRemaining());
                  setSaveStatus("idle");
                  setSaveError("");
                  setSavedIdeaId(null);
                  setIdeaName("");
                  setCurrentEvaluationId(null);
                  setCurrentIdeaId(null);
                  setPhaseProgress({});
                  setViewingFromSaved(false);
                  setEditingNotePhase(null);
                  setNoteText("");
                }}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  border: "1px solid rgba(64,64,64,0.6)",
                  background: "transparent",
                  color: "#a3a3a3",
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
            <p style={{ fontSize: 12, color: "#404040", margin: 0 }}>
              IdeaLoop Core — All analysis is AI-generated. Use as a guide, not a definitive assessment.
            </p>
          </PageContainer>
        </footer>
      </div>
    );
  }

  // ============================================
  // SCREEN: DELTA EXPLANATION (branches only)
  // ============================================
  if (currentScreen === "delta" && viewingFromSaved && isBranchIdea) {
    const currentIdea = myIdeas.find(i => i.id === currentIdeaId);
    const parentIdea = currentIdea ? myIdeas.find(i => i.id === currentIdea.parent_idea_id) : null;

    // Color helpers
    const deltaColor = (delta) => {
      if (delta > 0.3) return "#34d399"; // green
      if (delta < -0.3) return "#f87171"; // red
      return "#737373"; // gray — negligible
    };
    const deltaArrow = (delta) => {
      if (delta > 0.3) return "↑";
      if (delta < -0.3) return "↓";
      return "→";
    };

    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
        <header style={headerStyle}>
          <PageContainer wide>
            <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 onClick={() => setCurrentScreen(profile.coding && profile.ai ? "input" : "profile")} style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "#525252", margin: 0, cursor: "pointer" }}>
                IdeaLoop Core
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => setCurrentScreen("results2")} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
                  ← Back to roadmap
                </button>
                {!authLoading && user && (
                  <>
                    <span style={{ color: "#262626" }}>|</span>
                    <span style={{ fontSize: 12, color: "#525252" }}>{user.email}</span>
                    <button onClick={handleLogout} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
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
          />
        )}

        <StepProgress currentStep={getStepNumber()} savedMode={viewingFromSaved} branchMode={viewingFromSaved && isBranchIdea} />

        <main style={{ flex: 1, paddingBottom: 64 }}>
          <PageContainer wide>
            {/* Delta screen header */}
            <SectionHeader
              icon="△"
              title="What Changed"
              subtitle={parentIdea ? `Changes from "${parentIdea.title}" to "${currentIdea?.title}"` : "How this branch differs from its parent"}
            />

            {/* Loading state */}
            {deltaLoading && (
              <div style={{
                background: "rgba(23,23,23,0.6)",
                border: "1px solid rgba(38,38,38,0.8)",
                borderRadius: 16,
                padding: 40,
                textAlign: "center",
                marginBottom: 20,
              }}>
                <div style={{ fontSize: 14, color: "#737373", marginBottom: 8 }}>Analyzing changes...</div>
                <div style={{ fontSize: 12, color: "#525252" }}>Comparing evaluations and attributing score movements</div>
              </div>
            )}

            {/* Error state */}
            {deltaError && !deltaLoading && (
              <div style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 16,
                padding: 24,
                marginBottom: 20,
              }}>
                <div style={{ fontSize: 14, color: "#f87171", marginBottom: 8 }}>{deltaError}</div>
                <button
                  onClick={() => fetchDelta(currentIdeaId)}
                  style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    border: "1px solid rgba(239,68,68,0.3)", background: "transparent",
                    color: "#f87171", cursor: "pointer",
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            {/* Delta content */}
            {deltaData && !deltaLoading && (
              <>
                {/* Block 1: Change Summary */}
                <div style={{
                  background: "rgba(23,23,23,0.6)",
                  border: "1px solid rgba(38,38,38,0.8)",
                  borderRadius: 16,
                  padding: 24,
                  marginBottom: 16,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    What you changed
                  </div>
                  <div style={{ fontSize: 14, color: "#d4d4d4", lineHeight: 1.7 }}>
                    {deltaData.change_summary}
                  </div>
                </div>

                {/* Block 2: Improvements */}
                {deltaData.improvements && deltaData.improvements.length > 0 && (
                  <div style={{
                    background: "rgba(16,185,129,0.04)",
                    border: "1px solid rgba(16,185,129,0.2)",
                    borderRadius: 16,
                    padding: 24,
                    marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#34d399", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      What improved
                    </div>
                    {deltaData.improvements.map((item, idx) => (
                      <div key={idx} style={{
                        display: "flex",
                        gap: 12,
                        marginBottom: idx < deltaData.improvements.length - 1 ? 16 : 0,
                        alignItems: "flex-start",
                      }}>
                        <div style={{
                          flexShrink: 0,
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: "rgba(16,185,129,0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#34d399",
                        }}>
                          {item.delta != null ? `+${Math.abs(item.delta).toFixed(1)}` : "↑"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: "#34d399", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>
                            {(item.metric || "").replace(/_/g, " ")}
                          </div>
                          <div style={{ fontSize: 14, color: "#d4d4d4", lineHeight: 1.6 }}>
                            {item.shift}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Block 3: Worsenings */}
                {deltaData.worsenings && deltaData.worsenings.length > 0 && (
                  <div style={{
                    background: "rgba(239,68,68,0.04)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: 16,
                    padding: 24,
                    marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#f87171", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      What weakened
                    </div>
                    {deltaData.worsenings.map((item, idx) => (
                      <div key={idx} style={{
                        display: "flex",
                        gap: 12,
                        marginBottom: idx < deltaData.worsenings.length - 1 ? 16 : 0,
                        alignItems: "flex-start",
                      }}>
                        <div style={{
                          flexShrink: 0,
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: "rgba(239,68,68,0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#f87171",
                        }}>
                          {item.delta != null ? `-${Math.abs(item.delta).toFixed(1)}` : "↓"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: "#f87171", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>
                            {(item.metric || "").replace(/_/g, " ")}
                          </div>
                          <div style={{ fontSize: 14, color: "#d4d4d4", lineHeight: 1.6 }}>
                            {item.shift}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Block 4: Net Interpretation */}
                <div style={{
                  background: "rgba(23,23,23,0.6)",
                  border: "1px solid rgba(64,64,64,0.4)",
                  borderRadius: 16,
                  padding: 24,
                  marginBottom: 24,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e5e5", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Net assessment
                  </div>
                  <div style={{ fontSize: 14, color: "#a3a3a3", lineHeight: 1.7 }}>
                    {deltaData.net_interpretation}
                  </div>
                </div>

                {/* Score movement summary bar */}
                {deltaData.score_deltas && (
                  <div style={{
                    background: "rgba(23,23,23,0.6)",
                    border: "1px solid rgba(38,38,38,0.8)",
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 24,
                    display: "flex",
                    justifyContent: "space-around",
                    flexWrap: "wrap",
                    gap: 12,
                  }}>
                    {[
                      { key: "overall", label: "Overall" },
                      { key: "market_demand", label: "MD" },
                      { key: "monetization", label: "MO" },
                      { key: "originality", label: "OR" },
                      { key: "technical_complexity", label: "TC" },
                    ].map(({ key, label }) => {
                      const d = deltaData.score_deltas[key];
                      if (d == null) return null;
                      return (
                        <div key={key} style={{ textAlign: "center", minWidth: 50 }}>
                          <div style={{ fontSize: 11, color: "#525252", marginBottom: 4, fontWeight: 600 }}>{label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: deltaColor(key === "technical_complexity" ? -d : d) }}>
                            {deltaArrow(key === "technical_complexity" ? -d : d)} {d > 0 ? "+" : ""}{d.toFixed(1)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Action buttons — same as what was on results2 for non-branch ideas */}
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
                background: evalsRemaining <= 0 ? "rgba(38,38,38,0.6)" : "rgba(108,99,255,0.12)",
                color: evalsRemaining <= 0 ? "#525252" : "#a78bfa",
                marginBottom: 10,
              }}
            >
              {evalsRemaining <= 0 ? "No evaluations remaining" : "Evolve this idea"}
            </button>
            {/* Set as main version — only for branches that aren't already main */}
            {currentIdeaId && (() => {
              const ci = myIdeas.find(i => i.id === currentIdeaId);
              if (!ci?.parent_idea_id || ci?.is_main_version) return null;
              return (
                <button
                  onClick={async () => {
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session) return;
                      await fetch(`/api/ideas/${currentIdeaId}/set-main`, {
                        method: "PATCH",
                        headers: { Authorization: `Bearer ${session.access_token}` },
                      });
                      fetchMyIdeas();
                    } catch (e) {
                      console.error("Set-main failed:", e);
                    }
                  }}
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
            <button
              onClick={() => {
                setViewingFromSaved(false);
                setPhaseProgress({});
                setCurrentEvaluationId(null);
                setCurrentIdeaId(null);
                setEditingNotePhase(null);
                setNoteText("");
                setDeltaData(null);
                setDeltaError("");
                goToMyIdeas();
              }}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                border: "1px solid rgba(64,64,64,0.6)",
                background: "transparent",
                color: "#a3a3a3",
                cursor: "pointer",
              }}
            >
              ← Back to My Ideas
            </button>
          </PageContainer>
        </main>

        <footer style={footerStyle}>
          <PageContainer wide>
            <p style={{ fontSize: 12, color: "#404040", margin: 0 }}>
              IdeaLoop Core — All analysis is AI-generated. Use as a guide, not a definitive assessment.
            </p>
          </PageContainer>
        </footer>
      </div>
    );
  }

  return null;
}
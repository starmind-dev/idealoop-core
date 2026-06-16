"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import ComparisonView from "./ComparisonView";
import LineageView from "./LineageView";
import EvaluationView from "./EvaluationView";
import ExecutionBriefView from "./ExecutionBriefView";
import ExploreView from "./ExploreView.js";
import HubView from "./HubView";
import OverviewView from "./OverviewView";
import DashboardShell from "./DashboardShell";
import {
  StepProgress,
  StatusBadge,
  ScoreBar,
  SectionHeader,
  Card,
  PageContainer,
  AuthModal,
  SpecificityGate,
  getTheme,
  getScoreColor,
  getTcColor,
  recordLastIdea,
} from "./components";

// ============================================
// EVALUATION LIMIT HELPERS
// ============================================
const EVAL_LIMIT = 2;
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
// Live braille spinner for the in-progress pipeline step — the "thinking" signal.
// Self-contained interval so only this span re-renders, not the whole overlay.
const STREAM_SPINNER_FRAMES = ["\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f"];
function StreamSpinner({ color }) {
  const [f, setF] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setF((x) => (x + 1) % STREAM_SPINNER_FRAMES.length), 90);
    return () => clearInterval(id);
  }, []);
  return <span style={{ color, flexShrink: 0, width: 16, textAlign: "center" }}>{STREAM_SPINNER_FRAMES[f]}</span>;
}

// Retrieval source -> trust-dot colour, matching the competitor-card source badges
// (EvaluationView sourceColors) so the stream and the cards name the same sources.
const STREAM_SRC_DOT = { github: "#9a9aa2", tavily: "#2dd4bf", exa: "#a78bfa", google: "#6fa8f5" };

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState("profile");
  // Which view the Dashboard shell shows; the rail stays put, only this swaps.
  const [dashView, setDashView] = useState("overview"); // "overview" | "hub"
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
  const [loadingIdeaId, setLoadingIdeaId] = useState(null);

  // Evaluation cache — avoids re-fetching already-viewed ideas
  const evaluationCacheRef = useRef({});

  // Preview entry: ?view=overview -> Dashboard/Overview.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "overview") setCurrentScreen("dashboard");
  }, []);

  // Inline idea editing state (hub card rename)
  const [editingIdeaId, setEditingIdeaId] = useState(null);
  const [editingIdeaTitle, setEditingIdeaTitle] = useState("");

  // Evaluation / idea identity (persist targets)
  const [currentEvaluationId, setCurrentEvaluationId] = useState(null);
  const [currentIdeaId, setCurrentIdeaId] = useState(null);
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

  // V4S28 B7 — Specificity gate state. Set to { missing_elements, message,
  // trigger_type } when Haiku short-circuits the pipeline; null otherwise.
  // Cleared when user starts editing the textarea or clicks Evaluate again.
  const [specificityGate, setSpecificityGate] = useState(null);

  // Theme (launch: dark only — V4S23 entitlement/devMode system removed)
  const t = getTheme("dark");

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
      // Don't override a preview entry (?hub=new or ?view=overview — the mount effect above sets those).
      const previewParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const previewEntry = !!previewParams && (previewParams.get("hub") === "new" || previewParams.get("view") === "overview");
      if (!previewEntry) setCurrentScreen("input");
    }
    setEvalsRemaining(getEvalsRemaining());
  }, []);
  const [idea, setIdea] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [exploreAnalysis, setExploreAnalysis] = useState(null); // ll2_explore_v1 payload (Explore mode)
  // Rough room: the rough idea currently open in its two-door room.
  const [roughRoomIdea, setRoughRoomIdea] = useState(null); // { id, text, title }
  // Graduation intent: when set, the next deep save flips THIS idea forward in
  // place (rough -> deep) instead of creating a new idea. Declared per analysis
  // run via handleAnalyze, so a fresh (non-rough-room) run always clears it.
  const [graduatingIdeaId, setGraduatingIdeaId] = useState(null);
  // The id of an explored idea SAVED in this Explore session. Set on a
  // successful explore-result save; lets angles saved afterward branch under it
  // (orphan rule) and lets "take to Deep as it stands" graduate it in place.
  const [savedExploreIdeaId, setSavedExploreIdeaId] = useState(null);

  // ============================================
  // EXECUTION BRIEF STATE (Screen 3 / step-4 handoff)
  // ============================================
  // briefSections : dict of blocks received so far, keyed by block id
  //   (bet / prove_next / order / wont_count / gates / handoff) — the
  //   PROGRESSIVE render source; each block renders the moment its section
  //   event lands. Seeded whole from analysis.execution_brief on a saved load.
  // briefStatus   : "idle" | "streaming" | "complete" | "error"
  // briefError    : user-facing message when briefStatus === "error"
  // briefRetrying : soft transient-retry notice (route retries the open once
  //   before the first section) — distinct from error, never aborts.
  // briefData     : the assembled six-block object — set on `complete` (or
  //   seeded from a saved brief). This is the client-held copy threaded into
  //   the normal-save body so a fresh → generate → save persists the brief.
  const [briefSections, setBriefSections] = useState({});
  const [briefStatus, setBriefStatus] = useState("idle");
  const [briefError, setBriefError] = useState("");
  const [briefRetrying, setBriefRetrying] = useState(false);
  const [briefData, setBriefData] = useState(null);

  // Clear brief state when analysis switches to a fresh/different idea so a
  // stale brief never bleeds across ideas. (Saved loads seed instead, in
  // applyLoadedIdea.)
  const resetExecutionBrief = () => {
    setBriefSections({});
    setBriefStatus("idle");
    setBriefError("");
    setBriefRetrying(false);
    setBriefData(null);
  };

  const getStepNumber = () => {
    // brief reuses step 4 "Execution" — it's an execution-facing screen like
    // results2; not every screen needs to tick its own dot.
    const map = { profile: 1, input: 2, myideas: 2, reeval: 5, results1: 3, results2: 4, brief: 4, delta: 5 };
    return map[currentScreen] || 1;
  };

  // Check if the currently viewed idea is a branch (has a parent)
  const isBranchIdea = currentIdeaId ? !!myIdeas.find(i => i.id === currentIdeaId)?.parent_idea_id : false;

  // SSE streaming helper — streams events from the chosen analyze endpoint and returns the final analysis
  const analyzeWithStream = async (ideaText, profileData, endpoint = "/api/analyze-pro") => {
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

            // Beat model: each pipeline beat is ONE line that transitions in place
            // from a live spinner to a checkmark. baseOf() strips the _start/_done
            // suffix so a stage's start and done resolve to the same beat (this is
            // also what fixes the old stage2a/2b/2c desync — no hardcoded pairing
            // names). Retrieval sources have no _start, so they append as their own
            // checked sub-rows; evidence_ready closes the parent "search" beat.
            const baseOf = (step) => step.replace(/_(start|done)$/, "");
            const SOURCE_DONES = { github_done: "github", tavily_done: "tavily", exa_done: "exa", serper_done: "google" };

            if (event.step === "complete") {
              finalAnalysis = event.data;
              setStreamSteps((prev) => [
                ...prev.map((s) => (s.done ? s : { ...s, done: true })),
                { step: "complete", message: "Evaluation complete ✓", done: true },
              ]);
            } else if (event.step === "retry") {
              // F4/B+ — soft transient-failure notice. NOT an error: the run is
              // still going, a step stumbled and is being retried once. Append as an
              // in-progress line so the panel shows an honest "hit a snag — retrying"
              // beat during the extra wait. Resolves to a check in the final sweep;
              // if the retry also fails, an "error" event follows and aborts.
              setStreamSteps((prev) => [...prev, { step: "retry", message: event.message, done: false }]);
            } else if (event.step === "evidence_ready") {
              // Close the parent retrieval beat, then add the assembled-evidence line.
              setStreamSteps((prev) => [
                ...prev.map((s) => (s.base === "search" && !s.done ? { ...s, done: true, message: "Searched 4 sources" } : s)),
                { step: "evidence_ready", base: "evidence", message: event.message, done: true },
              ]);
            } else if (SOURCE_DONES[event.step]) {
              // A retrieved source — appears already-checked (the 8 calls resolve
              // together), carrying its trust-dot colour.
              setStreamSteps((prev) => [...prev, { step: event.step, base: baseOf(event.step), source: SOURCE_DONES[event.step], message: event.message, done: true }]);
            } else if (event.step === "scoring") {
              setStreamSteps((prev) => [...prev, { step: "scoring", base: "scoring", message: event.message, done: true }]);
            } else if (event.step.endsWith("_start")) {
              const base = baseOf(event.step);
              setStreamSteps((prev) =>
                prev.some((s) => s.base === base)
                  ? prev.map((s) => (s.base === base ? { ...s, done: false, message: event.message } : s))
                  : [...prev, { step: event.step, base, message: event.message, done: false }]
              );
            } else if (event.step.endsWith("_done")) {
              const base = baseOf(event.step);
              setStreamSteps((prev) =>
                prev.some((s) => s.base === base && !s.source)
                  ? prev.map((s) => (s.base === base && !s.source ? { ...s, done: true, message: event.message } : s))
                  : [...prev, { step: event.step, base, message: event.message, done: true }]
              );
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

    // Mark any remaining in-progress steps as done (the stages for deep/explore)
    setStreamSteps((prev) =>
      prev.map((s) => (s.done ? s : { ...s, done: true }))
    );

    // V4S28 B7 — Specificity gate check (mirror ethics_blocked pattern).
    // Haiku short-circuits the pipeline on underspecified inputs; route emits
    // a `complete` event with specificity_insufficient: true in the data.
    // No credit charged (parallel to ethics-blocked treatment) — handler
    // returns early without recording eval usage.
    if (finalAnalysis.specificity_insufficient) {
      return {
        specificityInsufficient: true,
        gate: {
          missing_elements: finalAnalysis.missing_elements || [],
          message: finalAnalysis.message || "",
          trigger_type: finalAnalysis.trigger_type || null,
        },
      };
    }

    // Check for ethics block
    if (finalAnalysis.ethics_blocked) {
      return { ethicsBlocked: true, message: finalAnalysis.ethics_message };
    }

    return { ethicsBlocked: false, analysis: finalAnalysis };
  };

  const handleAnalyze = async (mode = "deep", ideaTextOverride = null, graduateId = null) => {
    const ideaToUse = ideaTextOverride != null ? ideaTextOverride : idea;
    if (!ideaToUse.trim()) return;

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
            setError("You've used your free evaluations. Get credits to keep evaluating.");
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
        setError("You've used your free evaluations. Get credits to keep evaluating.");
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
    setViewingFromSaved(false);
    // This analysis run declares its graduation intent (or lack of one). A
    // fresh run from input/explore passes null, clearing any stale intent.
    setGraduatingIdeaId(graduateId);
    // A new run starts a clean Explore session — no saved explored idea yet.
    setSavedExploreIdeaId(null);
    setIsReEvalResult(false);
    setReEvalRevisionNotes(null);
    // V4S28 B7 — clear any previous gate result before retry
    setSpecificityGate(null);
    try {
      const endpoint = mode === "explore" ? "/api/analyze-explore" : "/api/analyze-pro";
      const result = await analyzeWithStream(ideaToUse, profile, endpoint);

      // V4S28 B7 — Specificity gate check (before ethics, before usage recording).
      // No credit charged on gate fire; user stays on input screen with panel shown.
      if (result.specificityInsufficient) {
        setSpecificityGate(result.gate);
        return;
      }

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

      if (mode === "explore") {
        setExploreAnalysis(result.analysis);
        setCurrentScreen("explore");
      } else {
        setAnalysis(result.analysis);
        resetExecutionBrief();
        setCurrentScreen("results1");
      }
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
          setError("You've used your free evaluations. Get credits to keep evaluating.");
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
      const reEvalEndpoint = "/api/analyze-pro";
      const result = await analyzeWithStream(modifiedIdea, profile, reEvalEndpoint);

      // V4S28 B7 — Specificity gate on re-eval: simple error string for now.
      // Full inline panel UI is deferred to B8 (frontend polish bundle).
      // No credit charged (early return before usage recording).
      if (result.specificityInsufficient) {
        setError("This revision needs more specificity to evaluate honestly. Edit the description to name who the product is for, the specific task or pain it addresses, and how the product intervenes — then try again.");
        return;
      }

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
      resetExecutionBrief();
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
      evidence_strength: analysis.evaluation?.evidence_strength || null,
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

        // Refresh hub data so lineage view and hub reflect the new branch + main status
        fetchMyIdeas();
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
            // fresh → generate → save: persist the client-held brief with the
            // new row (null when none was generated). Branch saves do NOT carry
            // it — a branch persists its brief via generate-from-hub later.
            execution_brief: briefData || null,
            // Graduation: when set, the save flips this existing idea forward in
            // place (rough -> deep) instead of creating a new idea. Absent on a
            // normal fresh save.
            ...(graduatingIdeaId ? { graduate_idea_id: graduatingIdeaId } : {}),
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
        if (typeof data.saved_count === "number") setSavedIdeasCount(data.saved_count);

        if (data.graduated) {
          // The rough card became a deep card in place. Intent is spent; drop
          // the stale cached rough read so reopening shows the deep room, and
          // refresh the hub so the card moves shelves.
          setGraduatingIdeaId(null);
          delete evaluationCacheRef.current[data.idea_id];
          fetchMyIdeas();
        }
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

  // Apply loaded evaluation data to state (shared by cache hit and fetch paths)
  const applyLoadedIdea = (data, ideaId) => {
    setIdea(data.idea.raw_idea_text);
    setAnalysis(data.analysis);
    setSaveStatus("saved");
    setSavedIdeaId(ideaId);
    setCurrentIdeaId(ideaId);
    setCurrentEvaluationId(data.evaluation_id);
    setViewingFromSaved(true);

    // Seed the execution-brief state from the loaded analysis. The [id] route
    // surfaces a persisted brief as analysis.execution_brief; when present we
    // mark it complete so opening the brief screen DISPLAYS it without a new
    // generation. When absent, reset to idle so a stale brief can't bleed across
    // ideas — the user can generate one fresh.
    const loadedBrief = data.analysis?.execution_brief;
    if (loadedBrief && Object.keys(loadedBrief).length > 0) {
      setBriefSections(loadedBrief);
      setBriefData(loadedBrief);
      setBriefStatus("complete");
    } else {
      setBriefSections({});
      setBriefData(null);
      setBriefStatus("idle");
    }
    setBriefError("");
    setBriefRetrying(false);

    // Reconstruct the full idea text including revisions
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
    setCurrentScreen("results1");
  };

  // Route a loaded idea to the right room based on its derived state. Deep ideas
  // carry an analysis and open the results room; rough ideas have none and open
  // the two-door rough room; explore ideas open the explore room.
  const routeLoadedIdea = (data, ideaId) => {
    const state = data && data.state;
    // Mark this as the family the user last opened — the Overview "continue
    // where you left off" resume target (per-browser; resolved to a hub card).
    recordLastIdea(ideaId);
    if (state === "rough") {
      const txt = data.idea?.raw_idea_text || "";
      setRoughRoomIdea({
        id: ideaId,
        text: txt,
        title: data.idea?.title || txt.split(/[.!?\n]/)[0].trim().slice(0, 80),
      });
      setCurrentScreen("roughroom");
      return;
    }
    if (state === "explore") {
      if (data.explore) {
        setExploreAnalysis(data.explore);
        // Reopened from the hub: this explored idea is already saved. Mark it so
        // the "Keep this explored idea" bar doesn't offer to save it again, and
        // remember its id so a new angle branches under it and "take to Deep as
        // it stands" graduates THIS idea rather than making a duplicate.
        setViewingFromSaved(true);
        setSavedExploreIdeaId(ideaId);
        setCurrentScreen("explore");
      } else {
        setMyIdeasError("This explored idea can't be opened yet.");
      }
      return;
    }
    // deep (default) — analysis present
    applyLoadedIdea(data, ideaId);
  };

  // Load a saved idea's full evaluation and show it
  const loadSavedIdea = async (ideaId, evaluationId) => {
    if (!user) return;
    setMyIdeasError("");
    setShowAlternativesPopup(false);
    setDeltaData(null); // Clear previous delta
    setDeltaError("");

    const cacheKey = evaluationId ? `${ideaId}-${evaluationId}` : ideaId;

    // Check cache first — instant load if available
    if (evaluationCacheRef.current[cacheKey]) {
      const cached = evaluationCacheRef.current[cacheKey];
      routeLoadedIdea(cached, ideaId);
      return;
    }

    setMyIdeasLoading(true);
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

      // Store in cache
      evaluationCacheRef.current[cacheKey] = data;

      routeLoadedIdea(data, ideaId);
    } catch (err) {
      setMyIdeasError(err.message || "Failed to load idea.");
    } finally {
      setMyIdeasLoading(false);
    }
  };

  // Fetch delta explanation for a branch idea
  const fetchDelta = async (ideaId) => {
    if (!user || !ideaId) return;

    // Check client-side cache first
    const cacheKey = `delta-${ideaId}`;
    if (evaluationCacheRef.current[cacheKey]) {
      setDeltaData(evaluationCacheRef.current[cacheKey]);
      return;
    }

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

      // Cache for instant revisits
      evaluationCacheRef.current[cacheKey] = data.delta;
    } catch (err) {
      console.error("Delta fetch failed:", err);
      setDeltaError(err.message || "Failed to analyze changes");
    } finally {
      setDeltaLoading(false);
    }
  };

  // ============================================
  // EXECUTION BRIEF — SSE consumer + entry
  // ============================================
  // Fresh consumer written against the brief route's OWN event contract
  // (start / section / retry / error / complete) — deliberately NOT forked from
  // analyzeWithStream, which switches on the pipeline's stage steps. Two hard
  // differences from analyze: the brief route REQUIRES `Authorization: Bearer`,
  // and sections are rendered PROGRESSIVELY (each `section` event paints its
  // block immediately; we never wait for `complete` to show content).
  //
  // evaluationId is passed ONLY when a saved row exists (currentEvaluationId).
  // Saved → the route persists to evaluations.execution_brief_json. Fresh/unsaved
  // → omitted; the brief rides back on `complete` into briefData and persists
  // later via the normal-save body. `currentEvaluationId || null` covers all
  // cases: it's null on a fresh unsaved eval and set after load or save.
  const streamExecutionBrief = async (evaluationId) => {
    if (!analysis) return;

    setBriefStatus("streaming");
    setBriefError("");
    setBriefRetrying(false);
    setBriefSections({});
    setBriefData(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setBriefStatus("error");
        setBriefError("Session expired. Please log in again.");
        return;
      }

      const res = await fetch("/api/execution-brief", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          analysis,
          ...(evaluationId ? { evaluation_id: evaluationId } : {}),
          devMode: "subscriber",
        }),
      });

      // Non-stream failures arrive as a JSON error (401/400/402/422/5xx).
      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        setBriefStatus("error");
        setBriefError(
          errData.error ||
            (res.status === 422
              ? "An execution brief isn't available for this analysis."
              : "Couldn't generate the execution brief.")
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // keep the incomplete trailing line

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;

          let event;
          try {
            event = JSON.parse(payload);
          } catch {
            continue; // ignore keepalives / non-JSON
          }

          if (event.step === "start") {
            // stream opened; nothing to paint yet (loading state shows)
          } else if (event.step === "section") {
            // progressive paint — render this block immediately
            setBriefRetrying(false);
            setBriefSections((prev) => ({ ...prev, [event.id]: event.data }));
          } else if (event.step === "retry") {
            // soft transient notice — the route is reopening before the first
            // section. NOT an error; the run is still alive.
            setBriefRetrying(true);
          } else if (event.step === "error") {
            setBriefStatus("error");
            setBriefError(event.message || "Brief generation failed.");
            return;
          } else if (event.step === "complete") {
            // authoritative assembled brief — store for save + mark done
            const brief = event.brief || {};
            setBriefSections(brief);
            setBriefData(brief);
            setBriefRetrying(false);
            setBriefStatus("complete");
          }
        }
      }

      // Stream ended without a terminal event (defensive): if we never reached
      // complete or error, treat a populated section set as done, else error.
      setBriefStatus((prev) => {
        if (prev === "complete" || prev === "error") return prev;
        return "error";
      });
    } catch (err) {
      setBriefStatus("error");
      setBriefError(err?.message || "Couldn't generate the execution brief.");
    }
  };

  // Navigate to the brief screen. If a brief is already attached (saved idea
  // loaded with execution_brief, or one generated this session), DISPLAY it —
  // don't regenerate (that wastes a call and overwrites the saved artifact).
  // Otherwise stream a fresh one, passing evaluation_id only when a row exists.
  const openExecutionBrief = ({ regenerate = false } = {}) => {
    if (!analysis) return;
    setCurrentScreen("brief");

    const hasBrief =
      briefData ||
      (analysis.execution_brief && Object.keys(analysis.execution_brief).length > 0);

    if (hasBrief && !regenerate) {
      // already have it — make sure state reflects the attached brief, no stream
      const existing = briefData || analysis.execution_brief;
      setBriefSections(existing);
      setBriefData(existing);
      setBriefStatus("complete");
      setBriefError("");
      setBriefRetrying(false);
      return;
    }

    streamExecutionBrief(currentEvaluationId || null);
  };

  // "Save this idea →" from the brief screen. The brief has no independent save —
  // it persists WITH the idea through the one canonical handleSaveIdea flow (the
  // normal-save body already carries `execution_brief: briefData`). So this does
  // NOT save here; it pre-opens results2's NORMAL naming form and routes there,
  // so the action the user clicked continues visibly into the naming step.
  // Only ever called on the fresh, non-re-eval path (the affordance is gated to
  // it in ExecutionBriefView) — so setting "naming" opens the normal variant,
  // never the branch form (which keys off isReEvalResult).
  const openSaveFromBrief = () => {
    if (saveStatus !== "saving" && saveStatus !== "saved" && saveStatus !== "naming") {
      setSaveStatus("naming");
      const firstLine = (idea || "").split(/[.!?\n]/)[0].trim();
      setIdeaName(firstLine.length <= 60 ? firstLine : firstLine.substring(0, 57) + "...");
    }
    setCurrentScreen("results2");
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

      // Cascade-aware: the server archives the idea + all of its descendant
      // branches and returns their ids, so remove the whole lineage locally.
      const removed = new Set(data.archived_ids || [ideaId]);
      setMyIdeas((prev) => prev.filter((i) => !removed.has(i.id)));
      setSavedIdeasCount((prev) => Math.max(0, prev - (data.archived_count || 1)));
    } catch (err) {
      setMyIdeasError(err.message || "Failed to delete idea.");
    } finally {
      setDeletingIdeaId(null);
    }
  };

  // Update idea fields (title, status_label) via PATCH
  const updateIdea = async (ideaId, fields) => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Optimistic local update
      setMyIdeas((prev) =>
        prev.map((i) => (i.id === ideaId ? { ...i, ...fields } : i))
      );
    } catch (err) {
      console.error("Failed to update idea:", err);
      setMyIdeasError(err.message || "Failed to update idea.");
    }
  };

  // Navigate to My Ideas Hub
  const goToMyIdeas = () => {
    // The hub IS the two-shelf HubView now (was the old flat list). Every "My
    // Ideas" link and every room's back-button lands here, so the new hub is
    // reachable and returnable without the ?hub=new URL or a page refresh.
    setCurrentScreen("dashboard");
    setDashView("hub");
    setLineageMode(false);
    setLineageTargetId(null);
    setCompareMode(false);
    setCompareSelecting(false);
    setCompareSelected([]);
    setCompareData(null);
    fetchMyIdeas();
  };

  // Shared rail navigation for the Dashboard shell. Every screen rendered inside
  // the shell wires its rail to this, so navigation behaves identically whether
  // you're on the Overview, the Hub, or a flow screen.
  const railNav = (key) => {
    // Any rail destination means leaving an open sub-view (a lineage tree or a
    // comparison). Clear those modes first so the outer hub/compare/lineage
    // guard below doesn't re-catch and trap us on the screen we're leaving.
    setLineageMode(false);
    setLineageTargetId(null);
    setCompareMode(false);
    setCompareSelecting(false);
    setCompareData(null);
    setCompareSelected([]);
    if (key === "overview") { setCurrentScreen("dashboard"); setDashView("overview"); }
    else if (key === "hub") goToMyIdeas();
    else if (key === "explore" || key === "deep") setCurrentScreen("input");
    // settings / plan / help: not wired yet
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
        authToken: session.access_token,
      });
      setCompareMode(true);
    } catch (err) {
      setMyIdeasError(err.message || "Failed to load ideas for comparison.");
    } finally {
      setCompareLoading(false);
    }
  };

  // ============================================
  // WRAPPER CALLBACKS FOR EvaluationView
  // ============================================
  const onResetAndNewIdea = () => {
    setCurrentScreen("input");
    setAnalysis(null);
    setIdea("");
    setEvalsRemaining(user ? evalsRemaining : getEvalsRemaining());
    setSaveStatus("idle");
    setSaveError("");
    setSavedIdeaId(null);
    setIdeaName("");
    setCurrentEvaluationId(null);
    setCurrentIdeaId(null);
    setViewingFromSaved(false);
    resetExecutionBrief();
  };

  const onBackToMyIdeasCleanup = () => {
    setViewingFromSaved(false);
    setCurrentEvaluationId(null);
    setCurrentIdeaId(null);
    setDeltaData(null);
    setDeltaError("");
    resetExecutionBrief();
    goToMyIdeas();
  };

  const onDiscardReEval = () => {
    setIsReEvalResult(false);
    setReEvalRevisionNotes(null);
    setReEvalChangedFields(null);
    setReEvalContextSnapshot(null);
    setViewingFromSaved(true);
    setSaveStatus("saved");
    goToMyIdeas();
  };

  const onSetAsMain = async (ideaId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(`/api/ideas/${ideaId}/set-main`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      fetchMyIdeas();
    } catch (e) {
      console.error("Set-main failed:", e);
    }
  };

  const onNavigateToDelta = () => {
    setCurrentScreen("delta");
    if (!deltaData && !deltaLoading) {
      fetchDelta(currentIdeaId);
    }
  };

  // ==========================================
  // AUTH LOADING GATE — prevent screen flash on refresh
  // ==========================================
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: t.mut, fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>IdeaLoop Core</p>
      </div>
    );
  }

  // ==========================================
  // SCREEN: DASHBOARD (persistent rail; content swaps between Overview and Hub).
  // The !lineageMode && !compareMode guard lets the dedicated lineage/compare
  // branch take over and then fall straight back here (currentScreen is still
  // "dashboard"), so returning from a tree or a compare lands back in the hub.
  // ==========================================
  if (currentScreen === "dashboard" && !lineageMode && !compareMode) {
    return (
      <DashboardShell
        t={t}
        active={dashView}
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >
        {showAuthModal && (
          <AuthModal onClose={() => setShowAuthModal(false)} onAuth={(u) => setUser(u)} t={t} />
        )}
        {dashView === "hub" ? (
          <HubView
            t={t}
            onOpenIdea={(id) => loadSavedIdea(id)}
            onOpenLineage={(id) => { setLineageTargetId(id); setLineageMode(true); }}
          />
        ) : (
          <OverviewView
            t={t}
            onStartExplore={() => setCurrentScreen("input")}
            onStartDeep={() => setCurrentScreen("input")}
            onContinue={(id) => loadSavedIdea(id)}
            onOpenIdea={(id) => loadSavedIdea(id)}
            onViewAll={goToMyIdeas}
          />
        )}
      </DashboardShell>
    );
  }

  // ==========================================
  // SCREEN 0: PROFILE
  // ==========================================
  if (currentScreen === "profile") {
    const canContinue = profile.coding && profile.ai;

    return (
      <DashboardShell
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >

        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onAuth={(u) => setUser(u)}
            t={t}
          />
        )}

        <StepProgress currentStep={getStepNumber()} savedMode={viewingFromSaved} branchMode={viewingFromSaved && isBranchIdea} t={t} />

        <main style={{ flex: 1, paddingBottom: 48 }}>
          <PageContainer>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 12px 0" }}>
                Tell us about yourself
              </h2>
              <p style={{ fontSize: 14, color: t.sec, lineHeight: 1.6, margin: 0 }}>
                We'll calibrate the analysis to your experience level<br />
                so the recommendations are relevant to you.
              </p>
            </div>

            <Card style={{ padding: 28, marginBottom: 32 }} t={t}>
              {/* Coding */}
              <div style={{ marginBottom: 28 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: t.text, display: "block", marginBottom: 12 }}>
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
                          ? { background: t.ctaBg, color: t.ctaText, borderColor: t.ctaBg }
                          : { background: t.inputBg, color: t.sec, borderColor: t.inputBorder }),
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI */}
              <div style={{ marginBottom: 28 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: t.text, display: "block", marginBottom: 12 }}>
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
                          ? { background: t.ctaBg, color: t.ctaText, borderColor: t.ctaBg }
                          : { background: t.inputBg, color: t.sec, borderColor: t.inputBorder }),
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Education */}
              <div>
                <label style={{ fontSize: 14, fontWeight: 600, color: t.text, display: "block", marginBottom: 12 }}>
                  What is your education or professional background?
                </label>
                <input
                  type="text"
                  value={profile.education}
                  onChange={(e) => setProfile((p) => ({ ...p, education: e.target.value }))}
                  placeholder="e.g., Software Engineer, Marketing Manager, Student..."
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
                  ? { background: t.ctaBg, color: t.ctaText }
                  : { background: t.surfAlt, color: t.mut }),
              }}
            >
              Continue
            </button>
          </PageContainer>
        </main>
      </DashboardShell>
    );
  }

  // ==========================================
  // SCREEN 1: IDEA INPUT
  // ==========================================
  if (currentScreen === "input") {
    return (
      <DashboardShell
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >

        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onAuth={(u) => setUser(u)}
            t={t}
          />
        )}

        {/* Profile summary — deep-flow only; relocated into content (the rail owns nav now). */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button onClick={() => setCurrentScreen("profile")} style={{ fontSize: 12, color: t.mut, background: "none", border: "none", cursor: "pointer" }}>
            {profile.coding} · {profile.ai} AI · Edit ✎
          </button>
        </div>

        <StepProgress currentStep={getStepNumber()} savedMode={viewingFromSaved} branchMode={viewingFromSaved && isBranchIdea} t={t} />

          <PageContainer>
            <div style={{ marginBottom: 32 }}>
              {specificityGate ? (() => {
                // V4S28 B9 — Progress-aware gate header. Slot count drives copy:
                //   3 missing → first-fire framing
                //   2 missing → "getting closer" warmth
                //   1 missing → "almost there" warmth
                // Subhead is shared across re-fire states (1 or 2 missing) and
                // reframed on first-fire to focus on evaluation integrity.
                const validKeys = ["target_user", "use_case", "mechanism"];
                const missingCount = Array.isArray(specificityGate.missing_elements)
                  ? specificityGate.missing_elements.filter((k) => validKeys.includes(k)).length
                  : 3;

                let headerText;
                let subheadText;
                if (missingCount >= 3 || missingCount === 0) {
                  // missingCount === 0 is defensive (gate fired with empty array);
                  // treat as first-fire framing per fallback in SpecificityGate.
                  headerText = "Let's sharpen this before we evaluate.";
                  subheadText = "To evaluate honestly, we need enough detail to know which product you mean.";
                } else if (missingCount === 2) {
                  headerText = "Getting closer — two more pieces, then we can evaluate this clearly.";
                  subheadText = "Each piece helps us ground the analysis in the product you actually mean.";
                } else {
                  headerText = "Almost there — one more piece, then we can evaluate this clearly.";
                  subheadText = "Each piece helps us ground the analysis in the product you actually mean.";
                }

                return (
                  <>
                    <h2 style={{ fontSize: 22, fontWeight: 500, margin: "0 0 6px 0", lineHeight: 1.3 }}>
                      {headerText}
                    </h2>
                    <p style={{ fontSize: 14, color: t.sec, lineHeight: 1.6, margin: 0 }}>
                      {subheadText}
                    </p>
                  </>
                );
              })() : (
                <>
                  <h2 style={{ fontSize: 30, fontWeight: 600, margin: "0 0 12px 0" }}>
                    Describe your AI product idea
                  </h2>
                  <p style={{ fontSize: 16, color: t.sec, lineHeight: 1.6, margin: 0 }}>
                    Include what it does, who would use it, and what problem it solves.
                    Specific ideas get sharper evaluations.
                  </p>
                </>
              )}
            </div>

            <Card style={{ padding: 6, marginBottom: 24 }} t={t}>
              <textarea
                value={idea}
                onChange={(e) => {
                  setIdea(e.target.value);
                  // V4S28 B9 — Gate state persists across keystrokes (was clearing
                  // mid-keystroke in B7, which made the suggestion vanish exactly
                  // when the user was acting on it). Gate only updates when a new
                  // gate result returns (Analyze press): replaces if FAIL with
                  // different missing slots, clears if PASS.
                }}
                placeholder="Example: An AI-powered idea evaluation workflow that scores startup ideas against real competitor data from GitHub and Google. It's for founders and ambitious builders who waste weeks on ideas without knowing if there's real demand. The problem is that most people either ask friends who say 'great idea!' or use ChatGPT which gives generic encouragement instead of structured, honest analysis..."
                rows={8}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  padding: "16px 20px",
                  fontSize: 16,
                  color: t.inputText,
                  lineHeight: 1.6,
                  resize: "none",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </Card>

            {/* V4S28 B7 — Specificity gate panel: appears between textarea and Analyze button */}
            {specificityGate && (
              <SpecificityGate gate={specificityGate} t={t} />
            )}

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 20px", marginBottom: 24 }}>
                <p style={{ fontSize: 14, color: "#f87171", margin: 0 }}>{error}</p>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <span style={{ fontSize: 14, color: t.mut, fontFamily: "monospace" }}>
                {idea.length > 0 ? `${idea.length} characters` : ""}
              </span>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {/* Explore mode entry — widens a rough idea (LL2). Dawn identity,
                    deliberately not the Deep purple/cta. Same gate + usage path. */}
                <button
                  onClick={() => handleAnalyze("explore")}
                  disabled={!idea.trim() || isAnalyzing || evalsRemaining <= 0}
                  style={{
                    padding: "12px 22px",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    background: "transparent",
                    cursor: !idea.trim() || isAnalyzing || evalsRemaining <= 0 ? "not-allowed" : "pointer",
                    color: !idea.trim() || isAnalyzing || evalsRemaining <= 0 ? t.mut : "#bcd2ff",
                    border: `1px solid ${!idea.trim() || isAnalyzing || evalsRemaining <= 0 ? t.border : "rgba(122,162,255,0.46)"}`,
                  }}
                >
                  {isAnalyzing ? "..." : "Explore"}
                </button>
                <button
                  onClick={() => handleAnalyze("deep")}
                  disabled={!idea.trim() || isAnalyzing || evalsRemaining <= 0}
                  style={{
                    padding: "12px 32px",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    border: "none",
                    cursor: !idea.trim() || isAnalyzing || evalsRemaining <= 0 ? "not-allowed" : "pointer",
                    ...(!idea.trim() || isAnalyzing || evalsRemaining <= 0
                      ? { background: t.surfAlt, color: t.mut }
                      : { background: t.ctaBg, color: t.ctaText }),
                  }}
                >
                  {isAnalyzing ? "Analyzing..." : evalsRemaining <= 0 ? "Limit Reached" : "Analyze Idea"}
                </button>
              </div>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginBottom: 24,
              padding: "10px 16px",
              borderRadius: 12,
              background: evalsRemaining <= 0 ? "rgba(239,68,68,0.08)" : evalsRemaining === 1 ? "rgba(245,158,11,0.08)" : t.surfAlt,
              border: `1px solid ${evalsRemaining <= 0 ? "rgba(239,68,68,0.2)" : evalsRemaining === 1 ? "rgba(245,158,11,0.2)" : t.border}`,
            }}>
              <span style={{
                fontSize: 13,
                color: evalsRemaining <= 0 ? "#f87171" : evalsRemaining === 1 ? "#fbbf24" : t.sec,
              }}>
                {evalsRemaining <= 0
                  ? "You've used your free evaluations. Get credits to keep going."
                  : `${evalsRemaining} of ${EVAL_LIMIT} free evaluations remaining`}
              </span>
            </div>

            {/* V4S28 B7 — No-credit reassurance, only shown while gate panel is active */}
            {specificityGate && (
              <div style={{
                textAlign: "center",
                fontSize: 13,
                color: t.sec,
                fontStyle: "italic",
                marginBottom: 24,
                marginTop: -8,
              }}>
                No credit used — analysis only starts once we can evaluate the idea clearly.
              </div>
            )}

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
                background: t.streamOverlay,
                animation: "overlayFadeIn 0.3s ease-out",
              }}>
                <div style={{
                  background: t.streamBg,
                  border: `1px solid ${t.streamBorder}`,
                  borderRadius: 12,
                  padding: "28px 32px",
                  fontFamily: "'Courier New', Courier, monospace",
                  fontSize: 13,
                  lineHeight: 1.8,
                  width: "90%",
                  maxWidth: 520,
                  boxShadow: t.streamShadow,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${t.streamDivider}` }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px rgba(16,185,129,0.5)" }} />
                    <span style={{ color: t.mut, fontSize: 11, letterSpacing: "0.08em" }}>EVALUATION PIPELINE</span>
                  </div>
                  {streamSteps.map((s, i) => (
                    <div key={i} style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      color: s.done ? t.sec : t.text,
                      opacity: s.done ? 0.8 : 1,
                      animation: "fadeInStep 0.3s ease-out",
                    }}>
                      {s.done ? (
                        <span style={{ color: "#10b981", flexShrink: 0, width: 16, textAlign: "center" }}>✓</span>
                      ) : (
                        <StreamSpinner color="#f59e0b" />
                      )}
                      <span style={{ wordBreak: "break-word" }}>
                        {s.source && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: STREAM_SRC_DOT[s.source] || "#9a9aa2", marginRight: 7, verticalAlign: "1px" }} />}
                        {s.message}
                      </span>
                    </div>
                  ))}
                  {streamSteps.length > 0 && !streamSteps.some(s => s.step === "complete") && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: t.mut, marginTop: 2 }}>
                      <span style={{ width: 16, textAlign: "center", animation: "blink 1s step-end infinite" }}>_</span>
                    </div>
                  )}
                  {streamSteps.length === 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: t.mut }}>
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
      </DashboardShell>
    );
  }

  // ROUGH ROOM: a rough idea's two-door room. Idea text + Explore/Deep doors.
  // Deep graduates the idea forward in place (no copy). Explore arrives with
  // the explore room. Serves both standalone rough ideas and saved angles.
  if (currentScreen === "roughroom") {
    return (
      <DashboardShell
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >

        <main style={{ flex: 1, paddingBottom: 48, paddingTop: 40 }}>
          <PageContainer>
            <button
              onClick={goToMyIdeas}
              style={{ background: "none", border: "none", color: t.mut, fontFamily: "monospace", fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 28, letterSpacing: "0.04em" }}
            >
              ← My Ideas
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span aria-hidden style={{ fontSize: 13 }}>✏️</span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: t.mut, fontFamily: "monospace" }}>
                Rough idea
              </span>
            </div>

            <h2 style={{ fontSize: 24, fontWeight: 600, color: t.text, margin: "0 0 18px", lineHeight: 1.25 }}>
              {roughRoomIdea?.title || "Untitled idea"}
            </h2>

            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: "20px 22px", color: t.text, fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 32 }}>
              {roughRoomIdea?.text}
            </div>

            <p style={{ fontSize: 12, color: t.mut, margin: "0 0 16px", fontFamily: "monospace", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Take it forward
            </p>

            {error && (
              <p style={{ fontSize: 13, color: "#f87171", margin: "0 0 16px" }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={() => handleAnalyze("explore", roughRoomIdea?.text, roughRoomIdea?.id)}
                disabled={isAnalyzing || !roughRoomIdea}
                style={{ padding: "14px 26px", borderRadius: 12, fontSize: 14, fontWeight: 600, background: "transparent", color: isAnalyzing || !roughRoomIdea ? t.mut : t.text, border: `1px solid ${t.border}`, cursor: isAnalyzing || !roughRoomIdea ? "not-allowed" : "pointer", opacity: isAnalyzing || !roughRoomIdea ? 0.55 : 1 }}
              >
                Explore
              </button>

              <button
                onClick={() => handleAnalyze("deep", roughRoomIdea?.text, roughRoomIdea?.id)}
                disabled={isAnalyzing || !roughRoomIdea}
                style={{ padding: "14px 34px", borderRadius: 12, fontSize: 14, fontWeight: 600, border: "none", cursor: isAnalyzing || !roughRoomIdea ? "not-allowed" : "pointer", background: isAnalyzing || !roughRoomIdea ? t.surfAlt : t.ctaBg, color: isAnalyzing || !roughRoomIdea ? t.mut : t.ctaText }}
              >
                {isAnalyzing ? "Analyzing..." : "Deep evaluate"}
              </button>
            </div>

            <p style={{ fontSize: 12, color: t.mut, margin: "18px 0 0", lineHeight: 1.5, maxWidth: 520 }}>
              Explore widens this idea; Deep scores it. Either way it stays the same idea and moves into Ideas — no copy left behind.
            </p>
          </PageContainer>
        </main>
      </DashboardShell>
    );
  }

  if ((lineageMode && lineageTargetId) || (compareMode && compareData)) {
    // COMPARISON MODE: render ComparisonView instead of hub (subscribers only)
    if (compareMode && compareData) {
      return (
        <DashboardShell
          t={t}
          active="hub"
          userEmail={user?.email}
          authLoading={authLoading}
          onLogin={() => setShowAuthModal(true)}
          onLogout={handleLogout}
          onNavigate={railNav}
        >
          {showAuthModal && (
            <AuthModal onClose={() => setShowAuthModal(false)} onAuth={(u) => setUser(u)} t={t} />
          )}
            <ComparisonView
              ideaA={compareData.ideaA}
              ideaB={compareData.ideaB}
              authToken={compareData.authToken}
              t={t}
              onBack={() => {
                setCompareMode(false);
                setCompareSelecting(false);
                setCompareData(null);
                setCompareSelected([]);
                fetchMyIdeas();
              }}
            />
        </DashboardShell>
      );
    }

    // LINEAGE MODE: render LineageView instead of hub (subscribers only)
    if (lineageMode && lineageTargetId) {
      return (
        <DashboardShell
          t={t}
          active="hub"
          userEmail={user?.email}
          authLoading={authLoading}
          onLogin={() => setShowAuthModal(true)}
          onLogout={handleLogout}
          onNavigate={railNav}
        >
          {showAuthModal && (
            <AuthModal onClose={() => setShowAuthModal(false)} onAuth={(u) => setUser(u)} t={t} />
          )}
            <LineageView
              myIdeas={myIdeas}
              targetIdeaId={lineageTargetId}
              t={t}
              onBack={() => {
                setLineageMode(false);
                setLineageTargetId(null);
              }}
              onViewIdea={async (ideaId) => {
                setLoadingIdeaId(ideaId);
                await loadSavedIdea(ideaId);
                setLoadingIdeaId(null);
                setLineageMode(false);
                setLineageTargetId(null);
              }}
              onStartComparison={async (selectedPair) => {
                setCompareSelected(selectedPair);
                await startComparison(selectedPair);
                setLineageMode(false);
                setLineageTargetId(null);
              }}
              onUpdateIdea={updateIdea}
              onDelete={async (ideaId) => {
                // Determine (from the current tree) whether the lineage node
                // we're focused on is inside the subtree about to be deleted.
                const willRemove = new Set([ideaId]);
                let frontier = [ideaId];
                while (frontier.length) {
                  const kids = myIdeas
                    .filter((i) => i.parent_idea_id && frontier.includes(i.parent_idea_id) && !willRemove.has(i.id))
                    .map((i) => i.id);
                  kids.forEach((id) => willRemove.add(id));
                  frontier = kids;
                }
                await deleteSavedIdea(ideaId);
                // If the lineage we're viewing is now gone, go back to the hub.
                if (willRemove.has(lineageTargetId)) {
                  setLineageMode(false);
                  setLineageTargetId(null);
                }
              }}
              loadingIdeaId={loadingIdeaId}
            />
        </DashboardShell>
      );
    }

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

    // getScoreColor imported from components.js

    return (
      <DashboardShell
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >
        <PageContainer>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "4px 0 0" }}>
            <button onClick={() => {
              setReEvalMode(false);
              setCurrentScreen("results2");
            }} style={{ fontSize: 12, color: t.mut, background: "none", border: "none", cursor: "pointer" }}>
              ← Back to evaluation
            </button>
          </div>
        </PageContainer>

        <StepProgress currentStep={getStepNumber()} savedMode={true} branchMode={isBranchIdea} t={t} />

        <main style={{ flex: 1, paddingBottom: 48 }}>
          <PageContainer>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 30, fontWeight: 600, margin: "0 0 12px 0" }}>
                Evolve This Idea
              </h2>
              <p style={{ fontSize: 14, color: t.sec, lineHeight: 1.5, margin: 0 }}>
                Review your current evaluation, then change one or more dimensions to test a different strategic angle.
              </p>
            </div>

            {/* SECTION 1: Context Snapshot */}
            {reEvalContextSnapshot && (
              <Card style={{ padding: 20, marginBottom: 24 }} t={t}>
                {/* Title row + score circle */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: t.mut, margin: "0 0 6px" }}>Current evaluation</p>
                    <p style={{ fontSize: 15, fontWeight: 600, color: t.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reEvalContextSnapshot.title || "Untitled"}</p>
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
                    // V4S28 B8: TC uses inverted+shifted boundaries via getTcColor
                    const color = m.isTC
                      ? getTcColor(s)
                      : getScoreColor(s);
                    return (
                      <div key={i} style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: t.mut }}>{m.label}</span>
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
                  <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
                    <p style={{ fontSize: 11, color: t.mut, fontWeight: 500, margin: "0 0 6px" }}>Top risks</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {reEvalContextSnapshot.failure_risks.slice(0, 2).map((risk, i) => (
                        <p key={i} style={{ fontSize: 12, color: t.sec, margin: 0, lineHeight: 1.4 }}>• {typeof risk === "string" ? risk : (risk?.text || "")}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evidence Strength — hidden when HIGH (asymmetric display rule, V4S28 B4) */}
                {reEvalContextSnapshot.evidence_strength && reEvalContextSnapshot.evidence_strength.level !== "HIGH" && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 9999,
                      fontWeight: 500,
                      ...(reEvalContextSnapshot.evidence_strength.level === "MEDIUM"
                        ? { background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.25)" }
                        : { background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }),
                    }}>
                      {reEvalContextSnapshot.evidence_strength.level} evidence strength
                    </span>
                  </div>
                )}
              </Card>
            )}

            {/* Original idea — read-only */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: t.sec, marginBottom: 8 }}>
                Original idea
              </label>
              <Card style={{ padding: "16px 20px", maxHeight: 150, overflowY: "auto" }} t={t}>
                <p style={{ fontSize: 14, color: t.sec, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                  {reEvalOriginalIdea}
                </p>
              </Card>
            </div>

            {/* SECTION 2: What do you want to change? */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: t.sec, margin: "0 0 12px" }}>What do you want to change?</p>

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
                  <span style={{ fontSize: 13, fontWeight: 500, color: t.sec }}>Target user</span>
                  <button
                    onClick={() => { setReEvalEditTarget(!reEvalEditTarget); if (reEvalEditTarget) setReEvalTargetUser(""); }}
                    style={{ fontSize: 12, color: t.link, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
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
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontSize: 13,
                        color: t.inputText,
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
                  <span style={{ fontSize: 13, fontWeight: 500, color: t.sec }}>Problem it solves</span>
                  <button
                    onClick={() => { setReEvalEditProblem(!reEvalEditProblem); if (reEvalEditProblem) setReEvalProblem(""); }}
                    style={{ fontSize: 12, color: t.link, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
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
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontSize: 13,
                        color: t.inputText,
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
                  <span style={{ fontSize: 13, fontWeight: 500, color: t.sec }}>Core idea</span>
                  <button
                    onClick={() => { setReEvalEditCore(!reEvalEditCore); if (reEvalEditCore) setReEvalCoreIdea(""); }}
                    style={{ fontSize: 12, color: t.link, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
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
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontSize: 13,
                        color: t.inputText,
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
                background: isReEvaluating || evalsRemaining <= 0 ? t.surfAlt : hasAnyChange ? "#8b5cf6" : t.ctaBg,
                color: isReEvaluating || evalsRemaining <= 0 ? t.mut : hasAnyChange ? "#fff" : t.ctaText,
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
              background: evalsRemaining <= 0 ? "rgba(239,68,68,0.08)" : evalsRemaining === 1 ? "rgba(245,158,11,0.08)" : t.surfAlt,
              border: `1px solid ${evalsRemaining <= 0 ? "rgba(239,68,68,0.2)" : evalsRemaining === 1 ? "rgba(245,158,11,0.2)" : t.border}`,
            }}>
              <span style={{
                fontSize: 13,
                color: evalsRemaining <= 0 ? "#f87171" : evalsRemaining === 1 ? "#fbbf24" : t.sec,
              }}>
                {evalsRemaining <= 0
                  ? "You've used your free evaluations. Get credits to keep going."
                  : `${evalsRemaining} of ${EVAL_LIMIT} free evaluations remaining`}
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
                background: t.streamOverlay,
                animation: "overlayFadeIn 0.3s ease-out",
              }}>
                <div style={{
                  background: t.streamBg,
                  border: `1px solid ${t.streamBorder}`,
                  borderRadius: 12,
                  padding: "28px 32px",
                  fontFamily: "'Courier New', Courier, monospace",
                  fontSize: 13,
                  lineHeight: 1.8,
                  width: "90%",
                  maxWidth: 520,
                  boxShadow: t.streamShadow,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${t.streamDivider}` }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#8b5cf6", boxShadow: "0 0 8px rgba(139,92,246,0.5)" }} />
                    <span style={{ color: t.mut, fontSize: 11, letterSpacing: "0.08em" }}>EVOLUTION PIPELINE</span>
                  </div>
                  {streamSteps.map((s, i) => (
                    <div key={i} style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      color: s.done ? t.sec : t.text,
                      opacity: s.done ? 0.8 : 1,
                      animation: "fadeInStep 0.3s ease-out",
                    }}>
                      {s.done ? (
                        <span style={{ color: "#8b5cf6", flexShrink: 0, width: 16, textAlign: "center" }}>✓</span>
                      ) : (
                        <StreamSpinner color="#f59e0b" />
                      )}
                      <span style={{ wordBreak: "break-word" }}>
                        {s.source && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: STREAM_SRC_DOT[s.source] || "#9a9aa2", marginRight: 7, verticalAlign: "1px" }} />}
                        {s.message}
                      </span>
                    </div>
                  ))}
                  {streamSteps.length > 0 && !streamSteps.some(s => s.step === "complete") && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: t.mut, marginTop: 2 }}>
                      <span style={{ width: 16, textAlign: "center", animation: "blink 1s step-end infinite" }}>_</span>
                    </div>
                  )}
                  {streamSteps.length === 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: t.mut }}>
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
      </DashboardShell>
    );
  }

  // ==========================================
  // SCREEN: EXPLORE (delegated to ExploreView)
  // ==========================================
  if (currentScreen === "explore" && exploreAnalysis) {
    return (
      <DashboardShell
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >
      <ExploreView
        screen="explore"
        t={t}
        analysis={exploreAnalysis}
        user={user}
        viewingFromSaved={viewingFromSaved}
        showAuthModal={showAuthModal}
        setCurrentScreen={setCurrentScreen}
        setShowAuthModal={setShowAuthModal}
        setUser={setUser}
        setViewingFromSaved={setViewingFromSaved}
        goToMyIdeas={goToMyIdeas}
        onSaveBranch={async (ids) => {
          // Persist each selected angle's branch_idea_text as a saved idea
          // (eval-less) via the additive Explore route. Returns a promise so
          // ExploreView's save-state can reflect saving → saved/error.
          const list = (ids || [])
            .map((id) => (exploreAnalysis.angles || []).find((a) => a.id === id))
            .filter(Boolean);
          if (!list.length) return;
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) { setShowAuthModal(true); throw new Error("Log in to save"); }
          for (const angle of list) {
            const res = await fetch("/api/ideas/save", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({
                mode: "explore",
                idea_text: angle.branch_idea_text,
                idea_name: angle.title,
                basis: angle.basis?.primary || null,
                profile,
                origin_idea_text: exploreAnalysis.idea,
                // If the explored idea was saved this session, branch the angle
                // under it (orphan rule); the route verifies it's explored.
                ...(savedExploreIdeaId ? { parent_idea_id: savedExploreIdeaId } : {}),
              }),
            });
            if (!res.ok) {
              const e = await res.json().catch(() => ({}));
              throw new Error(e.error || "Save failed");
            }
          }
        }}
        onTakeToDeep={(angleId, opts) => {
          // Hand a branch (or the original idea) to Deep. Resolve the text first
          // and pass it explicitly — setIdea is async, handleAnalyze must not read
          // stale state. Deep handoff runs the pro pipeline.
          const o = opts || {};
          let text = exploreAnalysis.idea;
          let graduateId = null;
          if (!o.useOriginalIdea && angleId) {
            const a = (exploreAnalysis.angles || []).find((x) => x.id === angleId);
            if (a && a.branch_idea_text) text = a.branch_idea_text;
            // A specific angle is its OWN idea — a fresh deep root, no graduation.
          } else {
            // Taking the original idea to Deep AS IT STANDS: graduate the node it
            // already is — the explored idea if it was saved this session, else
            // the rough idea this Explore came from — forward in place. No copy.
            graduateId = savedExploreIdeaId || graduatingIdeaId || null;
          }
          setIdea(text);
          handleAnalyze("deep", text, graduateId);
        }}
        onSaveExplore={async (ideaName) => {
          // Save the explored idea itself. With a graduating id (this came from
          // a rough idea), flip that idea forward IN PLACE (rough -> explored,
          // no copy). Without one (fresh from the input screen), create a new
          // explored idea. Symmetric with a Deep save. Returns a promise so
          // ExploreView's save state can reflect saving -> saved / error.
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) { setShowAuthModal(true); throw new Error("Log in to save"); }
          const res = await fetch("/api/ideas/save", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              mode: "explore",
              explore_result: exploreAnalysis,
              idea_text: exploreAnalysis.idea,
              idea_name: ideaName || undefined,
              profile,
              ...(graduatingIdeaId ? { graduate_idea_id: graduatingIdeaId } : {}),
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Save failed");
          // The explored idea now exists (graduated in place OR freshly created).
          // Remember it so angles saved next branch under it, and so "take to
          // Deep as it stands" graduates it instead of making a duplicate.
          if (data.idea_id) setSavedExploreIdeaId(data.idea_id);
          if (data.graduated) {
            // The rough card became an explore card in place; intent is spent.
            // Drop the stale cached rough read so reopening shows the explore
            // room, and refresh the hub so the card moves shelves.
            setGraduatingIdeaId(null);
            delete evaluationCacheRef.current[data.idea_id];
          }
          fetchMyIdeas();
          return data;
        }}
        onExploreVariation={() => handleAnalyze("explore", exploreAnalysis.idea)}
        onEditRead={() => setCurrentScreen("input")}
      />
      </DashboardShell>
    );
  }

  // ==========================================
  // SCREENS: ANALYSIS + EXECUTION PLAN (delegated to EvaluationView)
  // ==========================================
  if ((currentScreen === "results1" || currentScreen === "results2") && analysis) {
    // A brief is "already attached" if one was generated this session (briefData)
    // or persisted on a saved load (analysis.execution_brief). Drives the CTA
    // label; openExecutionBrief decides display-vs-generate.
    const hasExistingBrief = !!(
      briefData ||
      (analysis.execution_brief && Object.keys(analysis.execution_brief).length > 0)
    );
    return (
      <DashboardShell
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >
      <EvaluationView
        screen={currentScreen}
        t={t}
        analysis={analysis}
        profile={profile}
        user={user}
        viewingFromSaved={viewingFromSaved}
        isBranchIdea={isBranchIdea}
        showScoreGuide={showScoreGuide}
        showAuthModal={showAuthModal}
        saveStatus={saveStatus}
        saveError={saveError}
        savedIdeasCount={savedIdeasCount}
        ideaName={ideaName}
        openExecutionBrief={openExecutionBrief}
        hasExecutionBrief={hasExistingBrief}
        currentEvaluationId={currentEvaluationId}
        currentIdeaId={currentIdeaId}
        myIdeas={myIdeas}
        branchReason={branchReason}
        branchDimensions={branchDimensions}
        isReEvalResult={isReEvalResult}
        evalsRemaining={evalsRemaining}
        deltaData={deltaData}
        deltaLoading={deltaLoading}
        setCurrentScreen={setCurrentScreen}
        setShowAuthModal={setShowAuthModal}
        setShowScoreGuide={setShowScoreGuide}
        setUser={setUser}
        setViewingFromSaved={setViewingFromSaved}
        setIdeaName={setIdeaName}
        setSaveStatus={setSaveStatus}
        setSaveError={setSaveError}
        setBranchReason={setBranchReason}
        setBranchDimensions={setBranchDimensions}
        setBranchSetAsMain={setBranchSetAsMain}
        setIsReEvalResult={setIsReEvalResult}
        goToMyIdeas={goToMyIdeas}
        handleSaveIdea={handleSaveIdea}
        startReEvaluation={startReEvaluation}
        getStepNumber={getStepNumber}
        onResetAndNewIdea={onResetAndNewIdea}
        onBackToMyIdeasCleanup={onBackToMyIdeasCleanup}
        onDiscardReEval={onDiscardReEval}
        onSetAsMain={onSetAsMain}
        onNavigateToDelta={onNavigateToDelta}
      />
      </DashboardShell>
    );
  }

  // ============================================
  // SCREEN: EXECUTION BRIEF (results3 / step-4 handoff)
  // ============================================
  if (currentScreen === "brief" && analysis) {
    return (
      <DashboardShell
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >
        {showAuthModal && (
          <AuthModal onClose={() => setShowAuthModal(false)} onAuth={(u) => setUser(u)} t={t} />
        )}
        <ExecutionBriefView
          t={t}
          analysis={analysis}
          sections={briefSections}
          status={briefStatus}
          error={briefError}
          retrying={briefRetrying}
          viewingFromSaved={viewingFromSaved}
          isBranchIdea={isBranchIdea}
          isReEvalResult={isReEvalResult}
          saveStatus={saveStatus}
          savedIdeaId={savedIdeaId}
          getStepNumber={getStepNumber}
          setCurrentScreen={setCurrentScreen}
          goToMyIdeas={goToMyIdeas}
          onRegenerate={() => openExecutionBrief({ regenerate: true })}
          onSaveIdea={openSaveFromBrief}
          onNewIdea={onResetAndNewIdea}
        />
      </DashboardShell>
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
      return t.sec; // gray — negligible
    };
    const deltaArrow = (delta) => {
      if (delta > 0.3) return "↑";
      if (delta < -0.3) return "↓";
      return "→";
    };

    return (
      <DashboardShell
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >
        <PageContainer wide>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "4px 0 0" }}>
            <button onClick={() => setCurrentScreen("results2")} style={{ fontSize: 12, color: t.mut, background: "none", border: "none", cursor: "pointer" }}>
              ← Back to execution
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
            {/* Delta screen header */}
            <SectionHeader
              icon="△"
              title="What Changed"
              subtitle={parentIdea ? `Changes from "${parentIdea.title}" to "${currentIdea?.title}"` : "How this branch differs from its parent"}
              t={t}
            />

            {/* Loading state */}
            {deltaLoading && (
              <div style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 16,
                padding: 40,
                textAlign: "center",
                marginBottom: 20,
              }}>
                <div style={{ fontSize: 14, color: t.sec, marginBottom: 8 }}>Analyzing changes...</div>
                <div style={{ fontSize: 12, color: t.mut }}>Comparing evaluations and attributing score movements</div>
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
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 16,
                  padding: 24,
                  marginBottom: 16,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    What you changed
                  </div>
                  <div style={{ fontSize: 14, color: t.text, lineHeight: 1.7 }}>
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
                          <div style={{ fontSize: 14, color: t.text, lineHeight: 1.6 }}>
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
                          <div style={{ fontSize: 14, color: t.text, lineHeight: 1.6 }}>
                            {item.shift}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Block 4: Net Interpretation */}
                <div style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 16,
                  padding: 24,
                  marginBottom: 24,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Net assessment
                  </div>
                  <div style={{ fontSize: 14, color: t.sec, lineHeight: 1.7 }}>
                    {deltaData.net_interpretation}
                  </div>
                </div>

                {/* Score movement summary bar */}
                {deltaData.score_deltas && (
                  <div style={{
                    background: t.surface,
                    border: `1px solid ${t.border}`,
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
                          <div style={{ fontSize: 11, color: t.mut, marginBottom: 4, fontWeight: 600 }}>{label}</div>
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
                background: evalsRemaining <= 0 ? t.surfAlt : "rgba(108,99,255,0.12)",
                color: evalsRemaining <= 0 ? t.mut : "#a78bfa",
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
                setCurrentEvaluationId(null);
                setCurrentIdeaId(null);
                setDeltaData(null);
                setDeltaError("");
                resetExecutionBrief();
                goToMyIdeas();
              }}
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
          </PageContainer>
        </main>
      </DashboardShell>
    );
  }

  return null;
}
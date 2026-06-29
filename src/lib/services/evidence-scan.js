// src/lib/services/evidence-scan.js
//
// THE EVIDENCE WATCH — the engine behind "Needs Your Move".
//
// scanEvidence(userId, ideaId) runs the two-stage diff for ONE deep idea:
//
//   STAGE 1 (cheap, no LLM): load the idea's latest deep eval, read its STORED
//   queries, replay them across the same four sources, and structurally diff the
//   fresh result URLs against the eval's baseline URL set. If nothing new appeared,
//   STOP — no signal, no model call, a few cents of search at most.
//
//   STAGE 2 (only when Stage 1 found new URLs): hand the idea + the prior verdict +
//   the known landscape + the NEW candidates to a calibrated Haiku classifier that
//   decides whether the change is MATERIAL. Only a material verdict writes an OPEN
//   signal row; everything else returns quietly.
//
// WHY REPLAY STORED QUERIES (not re-derive): keyword extraction is a Haiku call and
// is non-deterministic, so re-deriving queries would make every scan diff drift, not
// the world. The analyze route persists the exact queries into evidence_json.queries
// (and meta_json.queries); we replay those verbatim, so a diff reflects the world
// changing, not our retrieval changing.
//
// THE BASELINE is built from whatever the eval stored: the raw_results URL set when
// present (newer evals, post evidence_signals_v1), unioned with every competitors_json
// URL (which is always present and represents the landscape that was actually judged).
// A union keeps the baseline as COMPLETE as possible so a known entity reappearing
// never reads as "new". scanEvidence ALSO folds in the URLs from this idea's already-
// RESOLVED signals (dismissed or acted) — a competitor the founder has already seen and
// adjudicated must never re-fire as "new" on the next cadence, even if they never saved
// a re-eval. That is what makes Dismiss actually dismiss, not snooze for one cycle.
//
// v1 SCOPE: competitor-landscape only (kind 'new_competitor'). The schema reserves
// 'competitor_shift' and the nullable dimension for v2.
//
// SERVER ONLY (service-role client + search API keys). Never import from a client
// component. The deep scoring engine is untouched — this reads stored evals and
// runs ITS OWN retrieval + a separate Haiku call; it never re-scores.

import { supabaseAdmin } from "../supabase-admin";
import client from "./anthropic-client";
import { getIdea } from "./ideas";
import { searchGitHub } from "./github";
import { searchSerper } from "./serper";
import { searchTavily } from "./tavily";
import { searchExa } from "./exa";
import { EVIDENCE_SCAN_SYSTEM_PROMPT } from "./prompt-evidence-scan";

const CLASSIFIER_MODEL = "claude-haiku-4-5-20251001";

// Per-idea watch cadence -> minimum days between scans. Drives the cron's
// "what's due" filter (off = never auto-scanned).
const CADENCE_DAYS = { weekly: 7, biweekly: 14, monthly: 30, quarterly: 90, semiannual: 182, annual: 365 };

// Normalize a URL for set-membership: drop protocol + leading www, lowercase the
// host+path, strip a trailing slash and any query/hash. Two URLs that point at the
// same page should collapse to the same key so trivial format differences in the
// replay don't read as "new".
function normUrl(u) {
  if (!u || typeof u !== "string") return null;
  let s = u.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split(/[?#]/)[0];
  s = s.replace(/\/+$/, "");
  return s || null;
}

// The latest deep eval that actually carries replayable queries. Explore evals carry
// explore_json (no queries), so this naturally selects the most recent deep verdict.
function pickWatchableEval(idea) {
  const evals = idea?.evaluations || [];
  return (
    evals.find((e) => {
      const q = e?.evidence_json?.queries || e?.meta_json?.queries;
      return q && (q.serperQuery1 || q.githubQuery1);
    }) || null
  );
}

// The four stored query strings (evidence_json is the natural home; meta_json is the
// equivalent fallback for older rows — the analyze route writes both today).
function storedQueries(evalRow) {
  return evalRow?.evidence_json?.queries || evalRow?.meta_json?.queries || {};
}

// Build the baseline normalized-URL Set from the eval: raw_results (when present) +
// every competitors_json URL. The more complete, the fewer false "new" hits.
function baselineUrlSet(evalRow) {
  const set = new Set();
  const add = (u) => { const n = normUrl(u); if (n) set.add(n); };

  const raw = evalRow?.evidence_json?.raw_results || null;
  if (raw && typeof raw === "object") {
    for (const arr of Object.values(raw)) {
      (arr || []).forEach((r) => add(r?.url));
    }
  }
  (evalRow?.competitors_json || []).forEach((c) => add(c?.url));
  return set;
}

// Replay the stored queries across the same four sources the analyze route uses
// (web sources share the two serper queries; github uses its own two). Returns a
// flat, deduped list of fresh results with their full {title/name,url,snippet,source}.
async function replay(queries) {
  const { githubQuery1, githubQuery2, serperQuery1, serperQuery2 } = queries || {};
  const jobs = [];
  if (githubQuery1) jobs.push(searchGitHub(githubQuery1));
  if (githubQuery2) jobs.push(searchGitHub(githubQuery2));
  if (serperQuery1) jobs.push(searchSerper(serperQuery1), searchTavily(serperQuery1), searchExa(serperQuery1));
  if (serperQuery2) jobs.push(searchSerper(serperQuery2), searchTavily(serperQuery2), searchExa(serperQuery2));

  const settled = await Promise.allSettled(jobs);
  const out = [];
  const seen = new Set();
  for (const s of settled) {
    if (s.status !== "fulfilled" || !Array.isArray(s.value)) continue;
    for (const r of s.value) {
      const key = normUrl(r?.url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        name: r?.name || r?.title || null,
        url: r?.url || null,
        snippet: r?.snippet || r?.description || "",
        source: r?.source || null,
        _key: key,
      });
    }
  }
  return out;
}

function safeParseJson(text) {
  if (!text || typeof text !== "string") return null;
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a === -1 || b === -1 || b < a) return null;
  try { return JSON.parse(text.slice(a, b + 1)); } catch { return null; }
}

// Compact the prior landscape for the classifier prompt — names + type + importance,
// not the full prose, to keep the call lean.
function landscapeDigest(evalRow) {
  return (evalRow?.competitors_json || [])
    .filter((c) => c && c.name)
    .map((c) => ({
      name: c.name,
      type: c.competitor_type || null,
      importance: c.importance || null,
    }));
}

async function classify({ ideaText, evalRow, candidates }) {
  const verdict = {
    overall: evalRow?.weighted_overall_score ?? null,
    market_demand: evalRow?.market_demand_score ?? null,
    monetization: evalRow?.monetization_score ?? null,
    originality: evalRow?.originality_score ?? null,
    technical_complexity: evalRow?.technical_complexity_score ?? null,
  };

  const userMessage =
    `THE IDEA:\n${ideaText || "(no text)"}\n\n` +
    `THE PRIOR VERDICT (0-10):\n${JSON.stringify(verdict)}\n\n` +
    `THE KNOWN LANDSCAPE (already accounted for at judging time):\n` +
    `${JSON.stringify(landscapeDigest(evalRow))}\n\n` +
    `THE NEW CANDIDATES (appeared in the replay, NOT in the baseline):\n` +
    `${JSON.stringify(candidates.map((c) => ({ name: c.name, url: c.url, snippet: c.snippet, source: c.source })))}`;

  const resp = await client.messages.create({
    model: CLASSIFIER_MODEL,
    max_tokens: 700,
    temperature: 0,
    system: EVIDENCE_SCAN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = (resp?.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return safeParseJson(text);
}

// ============================================================================
// PUBLIC: scan one idea
// ============================================================================
// Returns a small status object (never throws on a "nothing changed" path):
//   { changed:false, reason:'not_deep' | 'no_queries' | 'no_new' | 'not_material' }
//   { changed:true, signal_id, signal }
export async function scanEvidence(userId, ideaId) {
  const idea = await getIdea(userId, ideaId);
  if (!idea || idea.status === "archived") throw new Error("Idea not found.");
  if (idea.state !== "deep") return { changed: false, reason: "not_deep" };

  const evalRow = pickWatchableEval(idea);
  if (!evalRow) return { changed: false, reason: "no_queries" };

  const queries = storedQueries(evalRow);
  if (!queries.serperQuery1 && !queries.githubQuery1) {
    return { changed: false, reason: "no_queries" };
  }

  // STAGE 1 — replay + structural diff (no LLM).
  const baseline = baselineUrlSet(evalRow);

  // Fold in URLs the founder has already adjudicated for THIS idea (dismissed or
  // acted). Without this, Dismiss only snoozes: the same competitor URL is still
  // absent from the eval baseline next cycle, so it re-fires the identical signal.
  // The signal row already stores its triggering competitor URLs, so no schema is
  // needed — we just union them in. Genuinely-new competitors still surface; only
  // the ones the user already saw are silenced.
  try {
    const { data: resolved } = await supabaseAdmin
      .from("signals")
      .select("evidence_json")
      .eq("user_id", userId)
      .eq("idea_id", ideaId)
      .in("status", ["dismissed", "acted"]);
    for (const r of resolved || []) {
      (r?.evidence_json?.competitors || []).forEach((c) => {
        const n = normUrl(c?.url);
        if (n) baseline.add(n);
      });
    }
  } catch (e) {
    console.error("scanEvidence: resolved-signal baseline union failed (non-fatal):", e?.message || e);
  }

  const fresh = await replay(queries);
  // A real replay happened — advance the scan clock so cadence due-logic moves
  // forward whether or not anything was found (manual scans count too).
  await supabaseAdmin.from("ideas")
    .update({ last_scanned_at: new Date().toISOString() })
    .eq("user_id", userId).eq("id", ideaId);
  const candidates = fresh.filter((r) => r._key && !baseline.has(r._key));

  if (candidates.length === 0) {
    return { changed: false, reason: "no_new", new_count: 0 };
  }

  // STAGE 2 — calibrated classifier (only because Stage 1 found new URLs).
  const verdict = await classify({
    ideaText: idea.raw_idea_text,
    evalRow,
    candidates,
  });

  const material =
    verdict && verdict.material === true && verdict.severity === "material";

  if (!material) {
    return { changed: false, reason: "not_material", new_count: candidates.length };
  }

  // Write the OPEN signal. evidence_json carries the triggering competitors so the
  // re-judge screen can seed itself ("evidence moved: X appeared") without a re-scan.
  const row = {
    user_id: userId,
    idea_id: ideaId,
    evaluation_id: evalRow.id || null,
    kind: "new_competitor",
    status: "open",
    dimension: verdict.dimension || null,
    direction: verdict.direction || null,
    severity: "material",
    message: verdict.message || "A new competitor may have moved your verdict.",
    evidence_json: {
      competitors: Array.isArray(verdict.competitors) ? verdict.competitors : [],
      new_count: candidates.length,
    },
  };

  const { data, error } = await supabaseAdmin
    .from("signals")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;

  return { changed: true, signal_id: data.id, signal: { ...row, id: data.id } };
}

// ============================================================================
// PUBLIC: read + resolve (for the Overview card, P3)
// ============================================================================

// Open signals for the hub, newest first, with the bare idea title for the card.
export async function listOpenSignals(userId, limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("signals")
    .select("id, idea_id, evaluation_id, kind, dimension, direction, severity, message, evidence_json, created_at, ideas(title)")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((s) => ({
    id: s.id,
    idea_id: s.idea_id,
    evaluation_id: s.evaluation_id,
    kind: s.kind,
    dimension: s.dimension,
    direction: s.direction,
    severity: s.severity,
    message: s.message,
    competitors: s.evidence_json?.competitors || [],
    title: s.ideas?.title || "An idea",
    created_at: s.created_at,
  }));
}

// Dismiss (user judged it noise) or mark acted (a re-judge happened). Sets resolved_at.
export async function resolveSignal(userId, signalId, status) {
  if (status !== "dismissed" && status !== "acted") {
    throw new Error("status must be 'dismissed' or 'acted'.");
  }
  const { error } = await supabaseAdmin
    .from("signals")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", signalId);
  if (error) throw error;
  return { ok: true };
}

// ============================================================================
// PUBLIC: batch worker for the cron — scan every watched idea that's due
// ============================================================================
// Service-role, cross-user (the cron is a system caller). Selects active ideas
// with a cadence set, keeps the ones whose last_scanned_at is older than their
// cadence interval (or never scanned), skips any that already carry an OPEN signal
// (so alerts never pile up), and runs scanEvidence on up to `limit` of them. Each
// scan is isolated in try/catch so one failure can't abort the batch.
export async function scanDueIdeas({ limit = 10 } = {}) {
  const { data: watched, error } = await supabaseAdmin
    .from("ideas")
    .select("id, user_id, watch_cadence, last_scanned_at")
    .eq("status", "active")
    .neq("watch_cadence", "off");
  if (error) throw error;

  const now = Date.now();
  const due = (watched || []).filter((w) => {
    const days = CADENCE_DAYS[w.watch_cadence];
    if (!days) return false;
    if (!w.last_scanned_at) return true;
    return now - new Date(w.last_scanned_at).getTime() >= days * 86400000;
  });
  if (due.length === 0) return { due: 0, scanned: 0, signals: 0, muted: 0 };

  // Don't re-scan an idea that already has an unresolved signal.
  const dueIds = due.map((d) => d.id);
  const { data: openSig } = await supabaseAdmin
    .from("signals").select("idea_id").eq("status", "open").in("idea_id", dueIds);
  const muted = new Set((openSig || []).map((r) => r.idea_id));

  const targets = due.filter((d) => !muted.has(d.id)).slice(0, limit);

  let scanned = 0, signals = 0;
  for (const t of targets) {
    try {
      const r = await scanEvidence(t.user_id, t.id);
      scanned += 1;
      if (r && r.changed) signals += 1;
    } catch (e) {
      console.error("scanDueIdeas: idea", t.id, e?.message || e);
    }
  }
  return { due: due.length, scanned, signals, muted: muted.size };
}
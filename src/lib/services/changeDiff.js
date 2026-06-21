// src/lib/services/changeDiff.js
//
// THE DIFF SPINE — code computes what changed; the model only narrates it.
//
// Given a PRIOR deep evaluation and a NEW one (plus the founder's changed_fields),
// this returns, per result-screen anchor, whether it moved and WHICH causal path
// the data proves — never a guess. The walkthrough Sonnet pass receives these
// bundles and narrates ONLY the paths lit here; it cannot invent a cause the diff
// doesn't show. That structural guarantee is the entire point of doing the diff in
// code: the number is fixed, the marker set is deterministic, and "the read
// changed" is always backed by a real enum/score/evidence movement.
//
// THE FOUR SHAPES (+ arithmetic), resolved from four certain signals:
//   inputDirect  — a touched PART maps to THIS anchor's metric        (certain)
//   inputAny     — the founder edited anything at all                  (certain)
//   evidenceMoved— this metric's evidence SET changed                  (certain set-diff)
//   readMoved    — the score or a committed _internal enum moved       (certain)
//
//   direct        inputDirect && readMoved              edit → read        (ev dim)
//   by-path       !inputDirect && inputAny && evMoved   edit → evidence → read
//   evidence-only !inputDirect && !inputAny && evMoved  evidence → read    (you caused none)
//   read-only     readMoved && !evMoved && !inputDirect read alone, re-weighed
//   arithmetic    (overall only)                        sum follows its inputs
//
// SOURCE-AGNOSTIC: toEvalView() normalizes EITHER a live `analysis` object (the
// fresh V_next, carrying _pro.evidence_packets) OR a stored evaluation row (the
// parent V_prev: scoring_json / estimates_json / evidence_json). When a parent
// predates evidence-packet persistence (Stage 3), the evidence lane degrades to
// "unknown" — by-path / evidence-only simply can't be claimed, and the shape
// honestly falls back to direct (you touched it) or read-only (you didn't). It
// never fabricates an evidence path it can't see.
//
// PURE. No I/O, no model call, no mutation. Engine byte-locked.

import { PARTS, ANCHORS, ONESHOT_ANCHORS, metricsTouched, partOfField } from "./ideaParts";

const METRICS = ["market_demand", "monetization", "originality", "technical_complexity"];
const EPS = 0.05;

// ── tiny utils ────────────────────────────────────────────────────────────────
function get(obj, path) {
  if (!obj || !path) return undefined;
  return String(path).split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const numMoved = (a, b) => isNum(a) && isNum(b) && Math.abs(a - b) >= EPS;
const txt = (v) => (typeof v === "string" ? v.trim() : "");
const txtMoved = (a, b) => txt(a) !== txt(b);

// ── evidence signature: a stable Set of keys from an evidence packet ───────────
// Packets vary in shape (array of items, or {sources|items|results:[...]}); each
// item keys on url || id || title. Defensive: anything unrecognised → JSON atom.
function evidenceKeySet(packet) {
  const set = new Set();
  if (!packet) return null; // null = lane UNKNOWN (degrade), distinct from empty
  let items = [];
  if (Array.isArray(packet)) items = packet;
  else if (Array.isArray(packet.sources)) items = packet.sources;
  else if (Array.isArray(packet.items)) items = packet.items;
  else if (Array.isArray(packet.results)) items = packet.results;
  else if (Array.isArray(packet.evidence)) items = packet.evidence;
  else items = [packet];
  for (const it of items) {
    if (it == null) continue;
    if (typeof it === "string") { set.add(it.trim()); continue; }
    const k = it.url || it.id || it.source_url || it.title || it.name;
    set.add(k ? String(k).trim() : JSON.stringify(it));
  }
  return set;
}
function setDelta(prevSet, nextSet) {
  if (!prevSet || !nextSet) return { moved: false, unknown: true, added: [], removed: [] };
  const added = [...nextSet].filter((x) => !prevSet.has(x));
  const removed = [...prevSet].filter((x) => !nextSet.has(x));
  return { moved: added.length > 0 || removed.length > 0, unknown: false, added, removed };
}

// ── NORMALIZE any source into one uniform eval view ────────────────────────────
function pickEvaluation(source) {
  if (!source) return null;
  if (source.evaluation) return { ev: source.evaluation, estimates: source.estimates, root: source, kind: "live" };
  if (source.scoring_json) return { ev: source.scoring_json, estimates: source.estimates_json, row: source, kind: "row" };
  // an idea object with evaluations attached (latest-first)
  const e0 = source.evaluations && source.evaluations[0];
  if (e0 && e0.scoring_json) return { ev: e0.scoring_json, estimates: e0.estimates_json, row: e0, kind: "row" };
  return null;
}

function evidencePackets(source, picked) {
  // live: analysis._pro.evidence_packets ; row: scoring_json._pro?... or evidence_json
  const live = get(source, "_pro.evidence_packets");
  if (live) return live;
  const inScoring = picked && get(picked.ev, "_pro.evidence_packets");
  if (inScoring) return inScoring;
  const inRow = picked && picked.row && (get(picked.row, "evidence_json.evidence_packets") || get(picked.row, "meta_json.evidence_packets"));
  return inRow || null; // null → lanes UNKNOWN, degrade
}

export function toEvalView(source) {
  const picked = pickEvaluation(source);
  if (!picked) return null;
  const ev = picked.ev || {};
  const est = picked.estimates || ev.estimates || {};
  const packets = evidencePackets(source, picked);

  const moScore = isNum(get(ev, "monetization.display_score")) ? ev.monetization.display_score : get(ev, "monetization.score");

  const view = {
    kind: picked.kind,
    scores: {
      market_demand: get(ev, "market_demand.score"),
      monetization: moScore,
      originality: get(ev, "originality.score"),
      technical_complexity: get(ev, "technical_complexity.score"),
      overall: isNum(ev.overall_score) ? ev.overall_score : ev.weighted_overall,
    },
    internal: {
      market_demand: get(ev, "market_demand._internal") || {},
      monetization: get(ev, "monetization._internal") || {},
      originality: get(ev, "originality._internal") || {},
    },
    metric: { market_demand: ev.market_demand || {}, monetization: ev.monetization || {}, originality: ev.originality || {}, technical_complexity: ev.technical_complexity || {} },
    verdict: { verdict_headline: ev.verdict_headline, verdict_lead: ev.verdict_lead, summary: ev.summary, verdict_detail: ev.verdict_detail },
    competitive_position: ev.competitive_position || {},
    failure_risks: ev.failure_risks || [],
    estimates: est || {},
    evidence: {
      market_demand: evidenceKeySet(packets && packets.market_demand),
      monetization: evidenceKeySet(packets && packets.monetization),
      originality: evidenceKeySet(packets && packets.originality),
    },
    _ev: ev, // raw, for the route to pull prose slices
  };
  return view;
}

// ── per-metric evidence movement across the relevant lanes ─────────────────────
function evidenceForLanes(prev, next, lanes) {
  if (!lanes || lanes.length === 0) return { moved: false, unknown: true, added: [], removed: [] };
  let moved = false, unknown = true, added = [], removed = [];
  for (const lane of lanes) {
    const d = setDelta(prev.evidence[lane], next.evidence[lane]);
    if (!d.unknown) unknown = false;
    if (d.moved) { moved = true; added = added.concat(d.added); removed = removed.concat(d.removed); }
  }
  return { moved, unknown, added, removed };
}

// ── enum movement for a metric anchor ──────────────────────────────────────────
function enumDelta(prev, next, metric, fields = []) {
  const pI = prev.internal[metric] || {}, nI = next.internal[metric] || {};
  const out = {};
  let moved = false;
  for (const f of fields) {
    const pv = get(pI, f), nv = get(nI, f);
    if (pv !== nv) { moved = true; }
    out[f] = { prev: pv, next: nv, moved: pv !== nv };
  }
  return { moved, fields: out };
}

// ── shape resolver (the heart) ─────────────────────────────────────────────────
const PATHS = {
  direct: { in: 1, ev: 0, rd: 1 },
  "by-path": { in: 1, ev: 1, rd: 1 },
  "evidence-only": { in: 0, ev: 1, rd: 1 },
  "read-only": { in: 0, ev: 0, rd: 1 },
};
function resolveShape({ inputDirect, inputAny, evidenceMoved }) {
  if (inputDirect) return "direct";
  if (inputAny && evidenceMoved) return "by-path";
  if (!inputAny && evidenceMoved) return "evidence-only";
  return "read-only";
}
// qualitative anchors inherit a lane's shape but one notch "less direct" (you
// didn't edit the words themselves): direct → by-path, everything else unchanged.
function inheritShape(s) {
  if (!s) return "read-only";
  return s === "direct" ? "by-path" : s;
}

// ============================================================================
// PUBLIC: diff(prevSource, nextSource, { changedFields }) → { anchors, meta }
// ============================================================================
export function diff(prevSource, nextSource, opts = {}) {
  const prev = toEvalView(prevSource);
  const next = toEvalView(nextSource);
  if (!prev || !next) return { anchors: {}, meta: { ok: false, reason: "missing_evaluation" }, prev, next };

  const changedFields = opts.changedFields || [];
  const touchedMetrics = metricsTouched(changedFields);
  const inputAny = (changedFields && changedFields.length > 0) || false;
  // The parts the founder actually edited, as part KEYS. Resolve through
  // partOfField so legacy input-field names (problem → use_case, core_idea →
  // mechanism) count, not only literal part keys; dedupe so two fields mapping to
  // one part don't double it. This is the list the by-path narration names.
  const changedParts = [...new Set(
    (changedFields || []).map((f) => { const p = partOfField(f); return p ? p.key : null; }).filter(Boolean)
  )];

  // per-metric resolution, reused by metric + qualitative anchors
  const metricResult = {};
  for (const m of METRICS) {
    const a = ANCHORS[m];
    const prevScore = prev.scores[m], nextScore = next.scores[m];
    const scoreMoved = numMoved(prevScore, nextScore);
    const en = a.internalFields ? enumDelta(prev, next, m, a.internalFields) : { moved: false, fields: {} };
    const readMoved = scoreMoved || en.moved;
    const evd = evidenceForLanes(prev, next, a.evidenceLane);
    const inputDirect = touchedMetrics.has(m);
    const shape = readMoved ? resolveShape({ inputDirect, inputAny, evidenceMoved: evd.moved }) : null;
    metricResult[m] = { prevScore, nextScore, scoreMoved, readMoved, enums: en.fields, evidence: evd, inputDirect, shape };
  }

  const anchors = {};

  // ---- numeric metric anchors (md/mo/or/tc) ----
  for (const m of METRICS) {
    const r = metricResult[m];
    if (!r.readMoved) { anchors[m] = null; continue; }
    const a = ANCHORS[m];
    anchors[m] = {
      anchor: m, label: a.label, metric: m, kind: "numeric", color: a.color,
      moved: true, shape: r.shape, paths: PATHS[r.shape],
      from: round(r.prevScore), to: round(r.nextScore),
      enums: r.enums,
      evidence: { moved: r.evidence.moved, unknown: r.evidence.unknown, added: r.evidence.added, removed: r.evidence.removed },
      inputDirect: r.inputDirect, changedParts,
      branch: branchForMetric(m, changedFields),
    };
  }

  // ---- overall (arithmetic) ----
  {
    const a = ANCHORS.overall;
    const movedAny = a.contributors.some((c) => metricResult[c.metric].scoreMoved);
    if (movedAny) {
      const contributions = a.contributors.map((c) => ({
        metric: c.metric, weight: c.weight, score: round(next.scores[c.metric]),
        product: round((next.scores[c.metric] || 0) * c.weight),
      }));
      anchors.overall = {
        anchor: "overall", label: a.label, metric: null, kind: "arithmetic", color: a.color,
        moved: true, shape: "arithmetic", paths: null,
        from: round(prev.scores.overall), to: round(next.scores.overall),
        contributions, note: "Technical Complexity is execution context — excluded by design.",
      };
    } else anchors.overall = null;
  }

  // ---- verdict (qualitative rollup of the contributing metric shapes) ----
  {
    const a = ANCHORS.verdict;
    const moved = a.textFields.some((f) => txtMoved(get(prev.verdict, leaf(f)), get(next.verdict, leaf(f))));
    if (moved) {
      const contributing = ["market_demand", "monetization", "originality"].map((m) => metricResult[m].shape).filter(Boolean);
      const shape = rollupShape(contributing);
      anchors.verdict = {
        anchor: "verdict", label: a.label, metric: null, kind: "qualitative", color: a.color,
        moved: true, shape, paths: PATHS[shape] || PATHS["read-only"],
        before: txt(prev.verdict.verdict_headline), after: txt(next.verdict.verdict_headline),
        drivenBy: contributing, inputDirect: false, changedParts,
      };
    } else anchors.verdict = null;
  }

  // ---- compare (qualitative, originality lane) ----
  {
    const a = ANCHORS.compare;
    const moved = a.textFields.some((f) => txtMoved(get(prev.competitive_position, leaf(f)), get(next.competitive_position, leaf(f))));
    if (moved) {
      const shape = inheritShape(metricResult.originality.shape || resolveShape({ inputDirect: touchedMetrics.has("originality"), inputAny, evidenceMoved: metricResult.originality.evidence.moved }));
      anchors.compare = {
        anchor: "compare", label: a.label, metric: "originality", kind: "qualitative", color: a.color,
        moved: true, shape, paths: PATHS[shape],
        before: txt(prev.competitive_position.headline), after: txt(next.competitive_position.headline),
        inputDirect: false, changedParts,
      };
    } else anchors.compare = null;
  }

  // ---- risks (qualitative, per changed slot) ----
  {
    const a = ANCHORS.risks;
    const byPrev = indexBy(prev.failure_risks, "slot");
    const byNext = indexBy(next.failure_risks, "slot");
    const slots = new Set([...Object.keys(byPrev), ...Object.keys(byNext)]);
    const changedSlots = [];
    for (const s of slots) {
      const before = byPrev[s] && byPrev[s].text, after = byNext[s] && byNext[s].text;
      if (txtMoved(before, after)) {
        const lane = a.slotLane[s];
        const laneShape = lane && metricResult[lane] ? metricResult[lane].shape : null;
        changedSlots.push({ slot: s, before: txt(before), after: txt(after), shape: inheritShape(laneShape) });
      }
    }
    if (changedSlots.length) {
      const dominant = changedSlots[0].shape;
      anchors.risks = {
        anchor: "risks", label: a.label, metric: null, kind: "qualitative", color: a.color,
        moved: true, shape: dominant, paths: PATHS[dominant], changedSlots, inputDirect: false, changedParts,
      };
    } else anchors.risks = null;
  }

  // ---- mb (binding constraint, estimates) ----
  {
    const a = ANCHORS.mb;
    const pv = get(prev.estimates, a.valueField), nv = get(next.estimates, a.valueField);
    const valueMoved = txt(pv) !== txt(nv);
    const diagMoved = a.textFields.some((f) => txtMoved(get(prev.estimates, f), get(next.estimates, f)));
    const moved = valueMoved || diagMoved;
    if (moved) {
      const inputDirect = changedFields.includes("build_profile");
      const shape = inputDirect ? "direct" : "read-only"; // estimates have no evidence lane
      anchors.mb = {
        anchor: "mb", label: a.label, metric: null, kind: "qualitative", color: a.color,
        moved: true, shape, paths: PATHS[shape],
        before: txt(pv), after: txt(nv), valueMoved, diagMoved, inputDirect, changedParts,
      };
    } else anchors.mb = null;
  }

  // ---- commitment (duration/difficulty, estimates) ----
  {
    const a = ANCHORS.commitment;
    const moved = txtMoved(get(prev.estimates, a.valueField), get(next.estimates, a.valueField)) ||
      txtMoved(get(prev.estimates, a.extraValueField), get(next.estimates, a.extraValueField));
    if (moved) {
      const inputDirect = changedFields.includes("build_profile");
      const shape = inputDirect ? "direct" : "read-only";
      anchors.commitment = {
        anchor: "commitment", label: a.label, metric: null, kind: "qualitative", color: a.color,
        moved: true, shape, paths: PATHS[shape],
        before: txt(get(prev.estimates, a.valueField)), after: txt(get(next.estimates, a.valueField)),
        inputDirect, changedParts,
      };
    } else anchors.commitment = null;
  }

  // execution_brief is lazy — never emitted here.
  anchors.execution_brief = null;

  const markers = ONESHOT_ANCHORS.filter((k) => anchors[k]);
  return {
    anchors,
    meta: {
      ok: true,
      markers,
      changedFields, changedParts, inputAny,
      evidenceUnknown: METRICS.some((m) => metricResult[m].evidence.unknown),
    },
    prev, next,
  };
}

// ── small helpers ───────────────────────────────────────────────────────────
function round(v) { return isNum(v) ? Math.round(v * 10) / 10 : v; }
function leaf(path) { const p = String(path).split("."); return p[p.length - 1]; } // textFields like "competitive_position.headline" → "headline"
function branchForMetric(metric, changedFields) {
  for (const f of changedFields || []) { const p = PARTS[f]; if (p && p.metric === metric) return p.branch; }
  return null;
}
function indexBy(arr, key) {
  const out = {};
  for (const x of arr || []) { const k = x && x[key]; if (k != null) out[k] = x; }
  return out;
}
// verdict rollup: most-direct cause among contributors wins (direct/by-path > evidence-only > read-only)
function rollupShape(shapes) {
  const order = ["direct", "by-path", "evidence-only", "read-only"];
  // verdict integrates → a direct contributor reads as by-path at the verdict level
  let best = null;
  for (const s of shapes) { if (!s) continue; if (best == null || order.indexOf(s) < order.indexOf(best)) best = s; }
  if (!best) return "read-only";
  return best === "direct" ? "by-path" : best;
}
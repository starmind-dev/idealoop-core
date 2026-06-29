// src/lib/services/ideas.js
//
// THE IDEAS ORCHESTRATOR
// One module owns the cognitive-mode model and every verb that acts on it.
// HTTP routes stay thin: they authenticate, resolve a userId, and delegate here.
// SERVER ONLY — never import from a client component (uses the service-role client).
//
// REQUIRES migration `hub_model_v1` (folders, ideas.folder_id, ideas.source,
// evaluations.mode, evaluations.explore_json). The queries below select those
// columns; run the migration first.
//
// THE MODEL (locked this session) ------------------------------------------------
//   An idea row is ONE NODE in a family tree. parent_idea_id is the edge; a null
//   parent is a root. A node's STATE is DERIVED from its single live evaluation:
//       0 evals             -> 'rough'    (pencil,     no number)
//       eval mode 'explore' -> 'explore'  (telescope,  no number)
//       eval mode 'deep'    -> 'deep'     (microscope, weighted score)
//   ONE LIVE EVAL PER IDEA. Moving forward REPLACES the eval — "explore leaves
//   for good" when deep takes over. Branches and re-evals are SEPARATE rows.
//   ONE CARD PER FAMILY = its ROOT (fixed identity); the rest live in lineage.
//   'main'/Lead (is_main_version) is a VISUAL marker in the lineage only — it does
//   NOT pick the hub card. Root and Lead are decoupled.
//   FORWARD-ONLY: rough -> explore, rough -> deep, explore -> deep. Never back.
//   BRANCHING IS EXPLORE-ONLY: a saved angle (rough child) may only sit under an
//   explored parent. Deep ideas have no angle room.
//   RE-EVAL grows the tree, mode-locked (explore->explore child, deep->deep child),
//   as a candidate the user steers: save-as-branch / discard / set-as-main.
//   SET-MAIN is pure user choice, fully decoupled from mode.

import { supabaseAdmin } from "../supabase-admin";
import { logActivity, listActivity } from "./activity";

const FORWARD_RANK = { rough: 0, explore: 1, deep: 2 };

// Light select for hub/canvas reads — never leaks heavy eval payloads.
// The four per-metric scores are plain numeric columns (cheap) so the hub's deep
// hover-preview can paint MD/MO/OR bars + the TC ladder INSTANTLY off the list,
// with no per-card [id] round-trip. The heavy payloads (scoring_json / explore_json)
// are still omitted — the verdict line and explore fan lazy-load on hover.
const IDEA_LIGHT_SELECT = `
  id, title, raw_idea_text, parent_idea_id, branch_reason, changed_dimensions,
  is_main_version, is_favorite, disposition, status, source, folder_id, created_at, updated_at,
  watch_cadence, last_scanned_at,
  evaluations ( id, mode, evaluation_mode, weighted_overall_score,
    market_demand_score, monetization_score, originality_score, technical_complexity_score,
    execution_brief_json, created_at )
`;

// ============================================================================
// STATE RESOLUTION
// ============================================================================

// Idea row (with .evaluations attached, latest-first) -> its derived state.
export function resolveState(idea) {
  const evals = idea.evaluations || [];
  if (evals.length === 0) return { mode: "rough", score: null };
  const latest = evals[0];
  const m = String(latest.mode || latest.evaluation_mode || "").toLowerCase();
  const raw = latest.weighted_overall_score;
  const hasScore = raw !== null && raw !== undefined && Number(raw) > 0;
  if (m.includes("explore")) return { mode: "explore", score: null };
  if (m === "deep" || hasScore) return { mode: "deep", score: hasScore ? Number(raw) : null };
  // an eval exists, carries no score, isn't deep-tagged -> an explore read, no verdict
  return { mode: "explore", score: null };
}

// Hub/canvas-ready node. Heavy payloads stay server-side; only a has_brief flag leaks.
function shapeNode(idea, { isRoot } = {}) {
  const state = resolveState(idea);
  const latest = (idea.evaluations || [])[0] || null;
  const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
  return {
    id: idea.id,
    parent_id: idea.parent_idea_id || null,
    title: idea.title,
    mode: state.mode,                 // 'rough' | 'explore' | 'deep'
    score: state.score,               // number | null (deep only)
    // Per-metric scores for the hub deep-hover bars/ladder (deep cards only; null
    // for rough/explore). Composite stays code-derived — these are display inputs.
    md: num(latest && latest.market_demand_score),
    mo: num(latest && latest.monetization_score),
    or: num(latest && latest.originality_score),
    tc: num(latest && latest.technical_complexity_score),
    is_root: isRoot ?? (idea.parent_idea_id == null),
    is_main: !!idea.is_main_version,
    branch_reason: idea.branch_reason || null,
    changed_dimensions: idea.changed_dimensions || null,  // jsonb: what moved between this node and its parent
    is_favorite: !!idea.is_favorite,                      // explore's "best" = user favorite
    disposition: idea.disposition || null,                // null | 'parked' | 'killed'
    folder_id: idea.folder_id || null,
    source: idea.source || null,
    has_brief: !!(latest && latest.execution_brief_json),
    created_at: idea.created_at,
  };
}

function attachSortedEvals(rows) {
  return (rows || []).map((i) => ({
    ...i,
    evaluations: (i.evaluations || []).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    ),
  }));
}

function deriveTitle(text) {
  const first = String(text || "").split(/[.!?\n]/)[0].trim();
  if (!first) return "Untitled idea";
  return first.length <= 80 ? first : first.slice(0, 77) + "...";
}

// Walk parent_idea_id to the family root (cycle-guarded).
function rootIdOf(id, byId) {
  let cur = byId[id];
  let hops = 0;
  while (cur && cur.parent_idea_id && byId[cur.parent_idea_id] && hops++ < 50) {
    cur = byId[cur.parent_idea_id];
  }
  return cur ? cur.id : id;
}

// ============================================================================
// READS
// ============================================================================

// FAMILY-LEVEL ROLLUP for the Overview board / loop-strip / stats. ADDITIVE: it
// reads the SAME light eval data already loaded (no extra query, no heavy payload)
// and reports, per family, the FURTHEST point reached in the loop + a few flags.
// The hub card stays the ROOT (identity never moves); these fields describe the
// whole family that lives one click away in the lineage.
//
// loop_bucket is a SINGLE, mutually-exclusive lifecycle bucket per family (the six
// buckets sum to the family count → they drive the "across the loop" strip). The
// priority order below is the one tunable knob: it picks the furthest meaningful
// point in loop order. evolve (a kept re-eval) > handoff (a brief) > branched
// (angle children) > the furthest plain stage (deep|explore|rough).
function familyAggregate(members) {
  const rank = { rough: 0, explore: 1, deep: 2 };
  const nodes = (members || []).map((m) => {
    const st = resolveState(m);
    const latest = (m.evaluations || [])[0] || null;
    return {
      id: m.id,
      parent_id: m.parent_idea_id || null,
      mode: st.mode,                                  // rough | explore | deep
      score: st.score,                                // deep only
      has_brief: !!(latest && latest.execution_brief_json),
      eval_at: latest ? latest.created_at : null,
      updated_at: m.updated_at || m.created_at || null,
      created_at: m.created_at || null,
    };
  });

  // furthest plain stage in the family
  let stageRank = 0;
  nodes.forEach((n) => { stageRank = Math.max(stageRank, rank[n.mode] ?? 0); });
  const stage = stageRank === 2 ? "deep" : stageRank === 1 ? "explore" : "rough";

  const hasBrief = nodes.some((n) => n.has_brief);

  // latest deep verdict in the family (most recent deep eval that carries a score)
  const deeps = nodes
    .filter((n) => n.mode === "deep" && n.score != null)
    .sort((a, b) => new Date(b.eval_at || 0) - new Date(a.eval_at || 0));
  const familyScore = deeps.length ? deeps[0].score : null;

  // RESUME TARGET — the node "Continue where you left off" must actually open.
  // The hub card's IDENTITY is the family root (fixed, never moves), but the card's
  // displayed rollup (stage / score / brief) describes the furthest-progressed
  // descendant. Opening the root would land on the root's own room (e.g. Explore)
  // and contradict a card that reads "Deep · brief ready". So resume_id points at
  // the node the rollup actually came from, in display-priority order:
  //   1. the node that owns a brief (matches "Execution Brief ready")
  //   2. else the most-recent scored deep (matches the shown verdict)
  //   3. else the furthest-stage node (deep > explore > rough)
  //   4. else the root / first member
  // resume_stage lets the Overview route precisely (brief intent only when deep).
  const briefNode = nodes.find((n) => n.has_brief) || null;
  const deepNode = deeps.length ? deeps[0] : null;
  const rootNodeForResume = nodes.find((n) => n.parent_id == null) || nodes[0] || null;
  let furthestNode = rootNodeForResume;
  let furthestRank = -1;
  nodes.forEach((n) => {
    const r = rank[n.mode] ?? 0;
    if (r > furthestRank) { furthestRank = r; furthestNode = n; }
  });
  const resumeNode = briefNode || deepNode || furthestNode || rootNodeForResume;
  const resumeId = resumeNode ? resumeNode.id : null;
  const resumeStage = resumeNode ? resumeNode.mode : null;

  // A kept RE-EVAL grows a SAME-MODE child (deep->deep, explore->explore). Angle
  // branching instead drops rough/explore children under an explore parent (a
  // DIFFERENT kind) — those fall under "branched". This distinguishes the two.
  const modeOf = {};
  nodes.forEach((n) => { modeOf[n.id] = n.mode; });
  const hasReEval = nodes.some(
    (n) => n.parent_id && modeOf[n.parent_id] &&
      n.mode === modeOf[n.parent_id] && (n.mode === "deep" || n.mode === "explore")
  );
  const branched = nodes.length > 1;

  let bucket;
  if (hasReEval) bucket = "evolve";
  else if (hasBrief) bucket = "handoff";
  else if (branched) bucket = "branched";
  else bucket = stage; // deep | explore | rough

  // generation span = max depth of the family tree (root = generation 1)
  const childrenOf = {};
  nodes.forEach((n) => { (childrenOf[n.parent_id] = childrenOf[n.parent_id] || []).push(n.id); });
  let generation = 1;
  const rootNode = nodes.find((n) => n.parent_id == null) || nodes[0];
  const walkDepth = (id, d) => {
    generation = Math.max(generation, d);
    (childrenOf[id] || []).forEach((cid) => walkDepth(cid, d + 1));
  };
  if (rootNode) walkDepth(rootNode.id, 1);

  // newest touch anywhere in the family (node edit OR eval landing) — powers the
  // resume "last edited" line, recents ordering, and the derived-lite ledger.
  let lastActivity = null;
  nodes.forEach((n) => {
    [n.updated_at, n.eval_at, n.created_at].forEach((ts) => {
      if (ts && (!lastActivity || new Date(ts) > new Date(lastActivity))) lastActivity = ts;
    });
  });

  return {
    family_stage: stage,            // 'rough' | 'explore' | 'deep' (furthest plain stage)
    family_score: familyScore,      // number | null (family's latest deep verdict)
    family_has_brief: hasBrief,     // any node handed off to an execution brief
    resume_id: resumeId,            // node "Continue where you left off" should open
    resume_stage: resumeStage,      // that node's mode — route precisely (brief if deep)
    loop_bucket: bucket,            // single lifecycle bucket (strip)
    generation,                     // max tree depth (lineage "G{n}")
    last_activity_at: lastActivity, // newest touch in the family
  };
}

// The hub: one card per family, split into two shelves by the card's state.
// Returns { folders, rough: [card], ideas: [card] }. A card = the family's ROOT,
// always — never its Lead. (Lead is a visual-only marker in the lineage view.)
// Rough cards are quarantined to their shelf; every card in `ideas` is explore/deep
// BY ITS ROOT'S state — a family rooted in explore stays on the explored shelf even
// if it has deep branches; those live in its lineage.
//
// Each card now ALSO carries the additive family rollup (family_stage / family_score
// / family_has_brief / loop_bucket / generation / last_activity_at) for the Overview
// board, loop-strip, and stats. These are additive — existing consumers (HubView)
// ignore them; the root fields (mode/score/has_brief) are unchanged.
export async function listHub(userId) {
  // Open evidence-watch signals ride the same hub payload the Overview already
  // consumes (the "Needs Your Move" card reads them). Queried inline here rather
  // than importing the scanner service, which imports back from this module —
  // inlining keeps the dependency one-directional (no ideas <-> scanner cycle).
  const [ideaRes, folderRes, activity, signalRes] = await Promise.all([
    supabaseAdmin.from("ideas").select(IDEA_LIGHT_SELECT)
      .eq("user_id", userId).eq("status", "active"),
    supabaseAdmin.from("folders").select("id, name, sort_order")
      .eq("user_id", userId).order("sort_order", { ascending: true }),
    listActivity(userId, 12),
    supabaseAdmin.from("signals")
      .select("id, idea_id, evaluation_id, kind, dimension, direction, severity, message, evidence_json, created_at, ideas(title)")
      .eq("user_id", userId).eq("status", "open")
      .order("created_at", { ascending: false }).limit(20),
  ]);
  if (ideaRes.error) throw ideaRes.error;

  const ideas = attachSortedEvals(ideaRes.data);
  const byId = {};
  ideas.forEach((i) => (byId[i.id] = i));

  const families = {};
  ideas.forEach((i) => {
    const r = rootIdOf(i.id, byId);
    (families[r] = families[r] || []).push(i);
  });

  const cards = Object.entries(families).map(([rootId, members]) => {
    // The hub ALWAYS shows the family by its ROOT — a fixed identity that never
    // moves. "Lead" (is_main_version) is a purely visual marker in the lineage view
    // and deliberately does NOT change which card the hub shows. Root and Lead are
    // decoupled: re-eval / branch / set-lead can never reshuffle the hub.
    const root = byId[rootId] || members[0];
    const node = shapeNode(root, { isRoot: true });
    return { ...node, family_size: members.length, ...familyAggregate(members) };
  });

  return {
    folders: folderRes.data || [],
    rough: cards.filter((c) => c.mode === "rough"),
    ideas: cards.filter((c) => c.mode !== "rough"),
    activity: activity || [],
    // "Needs Your Move" — open evidence-watch signals, newest first, each shaped
    // with its idea title + triggering competitors for the card + the re-judge seed.
    signals: (signalRes?.data || []).map((sig) => ({
      id: sig.id,
      idea_id: sig.idea_id,
      evaluation_id: sig.evaluation_id,
      kind: sig.kind,
      dimension: sig.dimension,
      direction: sig.direction,
      severity: sig.severity,
      message: sig.message,
      competitors: sig.evidence_json?.competitors || [],
      title: sig.ideas?.title || "An idea",
      created_at: sig.created_at,
    })),
  };
}

// One family's tree for the genealogy canvas. Returns flat, shaped nodes (the
// client builds the layout). No verdicts on the wire beyond a deep node's score.
export async function getLineageByIdea(userId, ideaId) {
  const { data, error } = await supabaseAdmin.from("ideas").select(IDEA_LIGHT_SELECT)
    .eq("user_id", userId).eq("status", "active");
  if (error) throw error;

  const ideas = attachSortedEvals(data);
  const byId = {};
  ideas.forEach((i) => (byId[i.id] = i));
  if (!byId[ideaId]) return null;

  const rootId = rootIdOf(ideaId, byId);

  const family = [];
  const visit = (id) => {
    const n = byId[id];
    if (!n) return;
    family.push(n);
    ideas.filter((x) => x.parent_idea_id === id).forEach((c) => visit(c.id));
  };
  visit(rootId);

  return {
    root_id: rootId,
    target_id: ideaId,
    nodes: family.map((i) => shapeNode(i, { isRoot: i.id === rootId })),
  };
}

// Full idea for opening its room (carries the live eval payload incl. explore_json).
export async function getIdea(userId, ideaId) {
  const { data, error } = await supabaseAdmin.from("ideas")
    .select(`*, evaluations ( * )`)
    .eq("user_id", userId).eq("id", ideaId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const evals = (data.evaluations || []).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  const state = resolveState({ evaluations: evals });
  return { ...data, evaluations: evals, state: state.mode, score: state.score };
}

// ============================================================================
// FOLDERS — pure organization
// ============================================================================

export async function listFolders(userId) {
  const { data, error } = await supabaseAdmin.from("folders")
    .select("id, name, sort_order, created_at")
    .eq("user_id", userId).order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createFolder(userId, { name, sort_order = 0 } = {}) {
  const { data, error } = await supabaseAdmin.from("folders")
    .insert({ user_id: userId, name: String(name || "Untitled").slice(0, 60), sort_order })
    .select("id, name, sort_order").single();
  if (error) throw error;
  return data;
}

export async function updateFolder(userId, folderId, patch = {}) {
  const set = { updated_at: new Date().toISOString() };
  if (typeof patch.name === "string") set.name = patch.name.slice(0, 60);
  if (typeof patch.sort_order === "number") set.sort_order = patch.sort_order;
  const { data, error } = await supabaseAdmin.from("folders")
    .update(set).eq("user_id", userId).eq("id", folderId)
    .select("id, name, sort_order").single();
  if (error) throw error;
  return data;
}

export async function deleteFolder(userId, folderId) {
  // ideas.folder_id is ON DELETE SET NULL — deleting a folder un-files its cards,
  // it never deletes ideas.
  const { error } = await supabaseAdmin.from("folders")
    .delete().eq("user_id", userId).eq("id", folderId);
  if (error) throw error;
  return { ok: true };
}

// ============================================================================
// IDEA VERBS
// ============================================================================

// Internal insert — no guards. Used by createIdea (guarded) and saveBranch (re-eval).
async function createIdeaInternal(userId, f = {}) {
  const insert = {
    user_id: userId,
    title: f.title && f.title.trim() ? f.title.trim().slice(0, 80) : deriveTitle(f.raw_idea_text),
    raw_idea_text: f.raw_idea_text || "",
    profile_context_json: f.profile || {},
    status: "active",
    source: f.source || "manual",
    parent_idea_id: f.parent_idea_id || null,
    branch_reason: f.branch_reason || null,
    changed_dimensions: f.changed_dimensions || null,
    folder_id: f.folder_id || null,
  };
  const { data, error } = await supabaseAdmin.from("ideas").insert(insert).select("id").single();
  if (error) throw error;
  return { id: data.id };
}

// PUBLIC create — a ROUGH idea: the "+ rough idea" button, the future inspiration
// app, or a saved explore angle. If a parent is given it MUST be an explored idea
// (angles are an explore thing; branching is explore-only).
export async function createIdea(userId, opts = {}) {
  if (opts.parent_idea_id) {
    const parent = await getIdea(userId, opts.parent_idea_id);
    if (!parent) throw new Error("Parent idea not found.");
    if (parent.state !== "explore") {
      throw new Error("Angles branch under an explored idea only (branching is explore-only).");
    }
  }
  const created = await createIdeaInternal(userId, opts);
  // Ledger: a new rough idea entered the loop. (Angle-saves go through the save
  // route, which logs its own CAPTURED — these two entry points never overlap.)
  const title = opts.title?.trim() || deriveTitle(opts.raw_idea_text || "");
  await logActivity(userId, {
    kind: "captured", idea_id: created.id,
    summary: `${title} — captured as a rough idea.`,
  });
  return created;
}

// Rename, move-to-folder, edit branch note. Whitelisted fields only.
export async function updateIdea(userId, ideaId, patch = {}) {
  // Lead promotion is a family-wide move (clear siblings, set this one) — delegate
  // to setMain so the rule lives in one place; reuses the existing PATCH route.
  if (patch.is_main === true) await setMain(userId, ideaId);

  const set = {};
  if (typeof patch.title === "string") set.title = patch.title.trim().slice(0, 80);
  // Editable idea body (rough-idea room). Stored as given; the title stays
  // independently editable via the title path above.
  if (typeof patch.raw_idea_text === "string") set.raw_idea_text = patch.raw_idea_text;
  if ("folder_id" in patch) set.folder_id = patch.folder_id || null;
  if ("branch_reason" in patch) set.branch_reason = patch.branch_reason || null;
  if ("is_favorite" in patch) set.is_favorite = !!patch.is_favorite;
  if ("disposition" in patch)
    set.disposition = patch.disposition === "parked" || patch.disposition === "killed" ? patch.disposition : null;
  // Evidence-watch cadence (per-idea). The picker writes one of the enum values;
  // anything else falls back to "off". Setting/changing cadence never touches the
  // scan clock — last_scanned_at advances only on a real replay (manual or cron).
  if ("watch_cadence" in patch) {
    const CAD = ["off", "weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual"];
    set.watch_cadence = CAD.includes(patch.watch_cadence) ? patch.watch_cadence : "off";
  }
  if (Object.keys(set).length === 0) return { ok: true };
  set.updated_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from("ideas").update(set)
    .eq("user_id", userId).eq("id", ideaId);
  if (error) throw error;

  // Ledger: parking / killing is a lifecycle moment. Only fires when disposition
  // was actually set to parked|killed (not on un-park/clear). One light title read.
  if (set.disposition === "parked" || set.disposition === "killed") {
    const { data: row } = await supabaseAdmin.from("ideas")
      .select("title").eq("user_id", userId).eq("id", ideaId).maybeSingle();
    const title = row?.title || "An idea";
    await logActivity(userId, {
      kind: set.disposition, idea_id: ideaId,
      summary: set.disposition === "parked"
        ? `${title} — parked, kept revivable.`
        : `${title} — set aside as killed.`,
    });
  }
  return { ok: true };
}

// Make a node the family's main. Decoupled from mode — an explored main may sit
// over deep branches and vice-versa. Just moves the flag inside the family.
export async function setMain(userId, ideaId) {
  const lineage = await getLineageByIdea(userId, ideaId);
  if (!lineage) throw new Error("Idea not found.");
  const ids = lineage.nodes.map((n) => n.id);
  const clr = await supabaseAdmin.from("ideas")
    .update({ is_main_version: false }).eq("user_id", userId).in("id", ids);
  if (clr.error) throw clr.error;
  const set = await supabaseAdmin.from("ideas")
    .update({ is_main_version: true }).eq("user_id", userId).eq("id", ideaId);
  if (set.error) throw set.error;
  return { ok: true, main_id: ideaId };
}

// Archive an idea AND its branches (soft-delete: status='archived', matching the
// rest of the system — nothing is hard-removed). If the family survives but lost
// its main, the root is promoted so a family always has exactly one main.
export async function deleteIdea(userId, ideaId) {
  const lineage = await getLineageByIdea(userId, ideaId);
  if (!lineage) throw new Error("Idea not found.");

  const childrenOf = {};
  lineage.nodes.forEach((n) => { (childrenOf[n.parent_id] = childrenOf[n.parent_id] || []).push(n.id); });
  const subtree = [];
  const walk = (id) => { subtree.push(id); (childrenOf[id] || []).forEach(walk); };
  walk(ideaId);

  const wasMain = !!lineage.nodes.find((n) => n.id === ideaId)?.is_main;
  const rootId = lineage.root_id;

  const { error } = await supabaseAdmin.from("ideas")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("user_id", userId).in("id", subtree);
  if (error) throw error;

  if (wasMain && !subtree.includes(rootId)) {
    await supabaseAdmin.from("ideas").update({ is_main_version: true })
      .eq("user_id", userId).eq("id", rootId);
    return { ok: true, archived_ids: subtree, archived_count: subtree.length, new_main: rootId };
  }
  return { ok: true, archived_ids: subtree, archived_count: subtree.length };
}

// Detach an idea (and its branch) from its lineage: clear parent_idea_id so the
// node becomes its own ROOT, surfacing in the hub as an independent card. The node
// and everything below it travel together (no orphans) — one new family, one new
// card. One-main invariant on BOTH sides: the detached node becomes the main of
// its new family (any main among its descendants is cleared); and if the subtree
// carried away the OLD family's main, the old root is promoted (mirrors deleteIdea).
export async function detachIdea(userId, ideaId) {
  const lineage = await getLineageByIdea(userId, ideaId);
  if (!lineage) throw new Error("Idea not found.");
  const self = lineage.nodes.find((n) => n.id === ideaId);
  if (!self) throw new Error("Idea not found.");
  if (self.is_root || self.parent_id == null) {
    // Already a root — nothing to detach.
    return { ok: true, idea_id: ideaId, already_root: true };
  }

  const childrenOf = {};
  lineage.nodes.forEach((n) => { (childrenOf[n.parent_id] = childrenOf[n.parent_id] || []).push(n.id); });
  const subtree = [];
  const walk = (id) => { subtree.push(id); (childrenOf[id] || []).forEach(walk); };
  walk(ideaId);

  const oldMain = lineage.nodes.find((n) => n.is_main);
  const oldMainId = oldMain ? oldMain.id : null;
  const oldRootId = lineage.root_id;
  const now = new Date().toISOString();

  // 1) Cut the edge → the node becomes a new root.
  const cut = await supabaseAdmin.from("ideas")
    .update({ parent_idea_id: null, updated_at: now })
    .eq("user_id", userId).eq("id", ideaId);
  if (cut.error) throw cut.error;

  // 2) New family gets exactly one main = the detached node. Clear any main that
  //    travelled along in the descendants, then flag the new root.
  const descendants = subtree.filter((id) => id !== ideaId);
  if (descendants.length) {
    const clr = await supabaseAdmin.from("ideas")
      .update({ is_main_version: false }).eq("user_id", userId).in("id", descendants);
    if (clr.error) throw clr.error;
  }
  const sm = await supabaseAdmin.from("ideas")
    .update({ is_main_version: true }).eq("user_id", userId).eq("id", ideaId);
  if (sm.error) throw sm.error;

  // 3) Old family lost its main to the subtree → promote the old root.
  let new_old_main = null;
  if (oldMainId && subtree.includes(oldMainId) && oldRootId && !subtree.includes(oldRootId)) {
    const pr = await supabaseAdmin.from("ideas")
      .update({ is_main_version: true }).eq("user_id", userId).eq("id", oldRootId);
    if (pr.error) throw pr.error;
    new_old_main = oldRootId;
  }

  return { ok: true, idea_id: ideaId, moved_ids: subtree, moved_count: subtree.length, new_old_main };
}

// ============================================================================
// EVALUATION VERBS
// ============================================================================

// FORWARD, IN-PLACE evaluation: rough->explore, rough->deep, explore->deep.
// Enforces forward-only and the one-live-eval invariant (replaces any existing
// eval — explore leaves for good). `payload` is the already-mapped evaluations-row
// columns; the route maps raw analysis -> columns, the service owns the WRITE rule.
export async function writeEvaluation(userId, ideaId, mode, payload = {}) {
  if (mode !== "explore" && mode !== "deep") throw new Error("mode must be 'explore' or 'deep'.");
  const current = await getIdea(userId, ideaId);
  if (!current) throw new Error("Idea not found.");
  if ((FORWARD_RANK[mode] ?? 0) < (FORWARD_RANK[current.state] ?? 0)) {
    throw new Error(`Forward-only: cannot move ${current.state} -> ${mode}.`);
  }
  await supabaseAdmin.from("evaluations").delete().eq("user_id", userId).eq("idea_id", ideaId);
  const row = { ...payload, idea_id: ideaId, user_id: userId, mode };
  const { data, error } = await supabaseAdmin.from("evaluations").insert(row).select("id").single();
  if (error) throw error;
  return { ok: true, evaluation_id: data.id, mode };
}

// A re-evaluation the user chose to KEEP becomes a child node with its own eval.
// Mode-locked to the parent's kind (apples & bananas). makeMain promotes it.
// This is the only path that may place a child under a deep idea — re-eval growth,
// not angle-branching.
export async function saveBranch(userId, parentIdeaId, mode, opts = {}) {
  const parent = await getIdea(userId, parentIdeaId);
  if (!parent) throw new Error("Parent idea not found.");
  if (parent.state !== "explore" && parent.state !== "deep") {
    throw new Error("Only an explored or deep idea can be re-evaluated into a branch.");
  }
  if (mode !== parent.state) {
    throw new Error(`Mode-locked: a ${parent.state} idea re-evaluates with ${parent.state} only.`);
  }
  const { id: childId } = await createIdeaInternal(userId, {
    title: opts.title || parent.title,
    raw_idea_text: opts.raw_idea_text != null ? opts.raw_idea_text : parent.raw_idea_text,
    source: "manual",
    parent_idea_id: parentIdeaId,
    branch_reason: opts.branch_reason || null,
    changed_dimensions: opts.changed_dimensions || null,
    profile: parent.profile_context_json || {},
    folder_id: parent.folder_id || null,
  });
  await writeEvaluation(userId, childId, mode, opts.payload || {});
  if (opts.makeMain) await setMain(userId, childId);

  // Ledger: a kept re-evaluation — the loop came back around. Carry the new deep
  // verdict (and the prior one, if handed in) so the row can read "re-judged 4.2 → 4.7".
  const newScore = mode === "deep"
    ? (opts.payload?.weighted_overall_score ?? null)
    : null;
  const title = opts.title || parent.title || "An idea";
  await logActivity(userId, {
    kind: "rejudged", idea_id: childId,
    summary: `${title} — re‑judged${newScore != null ? ` at ${Number(newScore).toFixed(1)}` : ""}.`,
    meta: { mode, new_score: newScore, prev_score: opts.prev_score ?? null },
  });
  return { ok: true, idea_id: childId, mode, main: !!opts.makeMain };
}
// ───────────────────────────────────────────────────────────────────────────
// READ HISTORY — superseded reads of an idea whose TEXT never changed (an
// evidence re-read replaced the live eval in place; the prior eval was snapshot
// into read_history by the save route's recheck branch). This is NOT lineage:
// the idea didn't fork, so a previous read lives ON the idea, not in the tree.
//
// buildDeepAnalysis is the SINGLE eval-row → render `analysis` mapper, shared by
// the idea-open route and the history route so a previous read renders through
// the exact same shape as the current one (no drift, no field list to maintain).
// Lifted verbatim from api/ideas/[id]/route.js, which now imports it from here.
// ───────────────────────────────────────────────────────────────────────────
export function buildDeepAnalysis(evaluation) {
  const sj = (evaluation && evaluation.scoring_json) || {};
  return {
    evaluation: {
      ...sj,
      overall_score: evaluation.weighted_overall_score,
      market_demand: sj.market_demand || { score: evaluation.market_demand_score, explanation: "" },
      monetization: sj.monetization || { score: evaluation.monetization_score, explanation: "" },
      originality: sj.originality || { score: evaluation.originality_score, explanation: "" },
      technical_complexity: sj.technical_complexity || { score: evaluation.technical_complexity_score, explanation: "" },
      marketplace_note: sj.marketplace_note || null,
      failure_risks: sj.failure_risks || [],
      evidence_strength: sj.evidence_strength || null,
      summary: evaluation.summary_text || sj.summary || "",
    },
    competition: {
      competitors: evaluation.competitors_json || [],
      differentiation: evaluation.competition_summary || "",
      data_source: evaluation.data_source || "llm_generated",
    },
    estimates: evaluation.estimates_json || {},
    classification: evaluation.classification || "commercial",
    scope_warning: evaluation.scope_warning || false,
    _meta: evaluation.meta_json || {},
    execution_brief: evaluation.execution_brief_json || null,
  };
}

// Every superseded read for an idea, newest-supersede first. Each item carries
// BOTH a compact summary (for the "Previous reads" list) and the full mapped
// `analysis` (so the read-only viewer renders the real read with no second call).
export async function listReadHistory(userId, ideaId) {
  const { data, error } = await supabaseAdmin
    .from("read_history")
    .select("id, evaluation_snapshot, original_created_at, superseded_at, superseded_reason, signal_id")
    .eq("user_id", userId)
    .eq("idea_id", ideaId)
    .order("superseded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => {
    const snap = row.evaluation_snapshot || {};
    const analysis = buildDeepAnalysis(snap);
    const ev = analysis.evaluation || {};
    return {
      id: row.id,
      superseded_at: row.superseded_at,
      superseded_reason: row.superseded_reason,
      original_created_at: row.original_created_at || snap.created_at || null,
      score: ev.overall_score ?? null,
      headline: ev.verdict_headline || ev.verdict_lead || null,
      summary: ev.summary || null,
      analysis,
    };
  });
}
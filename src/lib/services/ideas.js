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
//   ONE CARD PER FAMILY = its main (is_main_version); the rest live in lineage.
//   FORWARD-ONLY: rough -> explore, rough -> deep, explore -> deep. Never back.
//   BRANCHING IS EXPLORE-ONLY: a saved angle (rough child) may only sit under an
//   explored parent. Deep ideas have no angle room.
//   RE-EVAL grows the tree, mode-locked (explore->explore child, deep->deep child),
//   as a candidate the user steers: save-as-branch / discard / set-as-main.
//   SET-MAIN is pure user choice, fully decoupled from mode.

import { supabaseAdmin } from "../supabase-admin";

const FORWARD_RANK = { rough: 0, explore: 1, deep: 2 };

// Light select for hub/canvas reads — never leaks heavy eval payloads.
const IDEA_LIGHT_SELECT = `
  id, title, raw_idea_text, parent_idea_id, branch_reason, changed_dimensions,
  is_main_version, status, source, folder_id, created_at, updated_at,
  evaluations ( id, mode, evaluation_mode, weighted_overall_score, execution_brief_json, created_at )
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
  return {
    id: idea.id,
    parent_id: idea.parent_idea_id || null,
    title: idea.title,
    mode: state.mode,                 // 'rough' | 'explore' | 'deep'
    score: state.score,               // number | null (deep only)
    is_root: isRoot ?? (idea.parent_idea_id == null),
    is_main: !!idea.is_main_version,
    branch_reason: idea.branch_reason || null,
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

// The hub: one card per family, split into two shelves by the card's state.
// Returns { folders, rough: [card], ideas: [card] }. A card = the family's main
// (is_main_version), else its root. Rough cards are quarantined to their shelf;
// every card in `ideas` is already explore or deep.
export async function listHub(userId) {
  const [ideaRes, folderRes] = await Promise.all([
    supabaseAdmin.from("ideas").select(IDEA_LIGHT_SELECT)
      .eq("user_id", userId).eq("status", "active"),
    supabaseAdmin.from("folders").select("id, name, sort_order")
      .eq("user_id", userId).order("sort_order", { ascending: true }),
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
    const main = members.find((m) => m.is_main_version) || byId[rootId] || members[0];
    const node = shapeNode(main, { isRoot: main.id === rootId });
    return { ...node, family_size: members.length };
  });

  return {
    folders: folderRes.data || [],
    rough: cards.filter((c) => c.mode === "rough"),
    ideas: cards.filter((c) => c.mode !== "rough"),
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
  return createIdeaInternal(userId, opts);
}

// Rename, move-to-folder, edit branch note. Whitelisted fields only.
export async function updateIdea(userId, ideaId, patch = {}) {
  const set = {};
  if (typeof patch.title === "string") set.title = patch.title.trim().slice(0, 80);
  if ("folder_id" in patch) set.folder_id = patch.folder_id || null;
  if ("branch_reason" in patch) set.branch_reason = patch.branch_reason || null;
  if (Object.keys(set).length === 0) return { ok: true };
  set.updated_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from("ideas").update(set)
    .eq("user_id", userId).eq("id", ideaId);
  if (error) throw error;
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
  return { ok: true, idea_id: childId, mode, main: !!opts.makeMain };
}

// ============================================================================
// COMPARE — quiet same-state side-by-side (behavior unchanged this session).
// Exposed for completeness + the apples-&-bananas guard; not yet wired to UI.
// ============================================================================
export async function getComparePair(userId, ideaIdA, ideaIdB) {
  const [a, b] = await Promise.all([getIdea(userId, ideaIdA), getIdea(userId, ideaIdB)]);
  if (!a || !b) throw new Error("Both ideas must exist.");
  if (a.state !== b.state) {
    throw new Error("Compare is same-state only — explore with explore, deep with deep.");
  }
  return { mode: a.state, a, b };
}
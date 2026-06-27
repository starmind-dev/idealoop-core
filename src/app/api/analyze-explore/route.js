import { NextResponse } from "next/server";
import client from "../../../lib/services/anthropic-client";
import { extractKeywords } from "../../../lib/services/keywords";
import { searchGitHub } from "../../../lib/services/github";
import { searchSerper } from "../../../lib/services/serper";
import { searchTavily } from "../../../lib/services/tavily";
import { searchExa } from "../../../lib/services/exa";
import { buildCompetitorContext, buildCompetitorInstructions } from "../../../lib/services/competitors";
import { STAGE1_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage1";
import { STAGE2A_EXPLORE_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage2a-explore";
import { EXPLORE_SYSTEM_PROMPT } from "../../../lib/services/prompt-explore";

// ============================================
// EXPLORE ROUTE — LL2 (base, V1.2 four-surface shape)
// ============================================
// Cognitive mode: Explore (widen). Front half is SPINE-IDENTICAL to the Deep
// route (analyze-pro): keywords -> same four-source search
// -> same dedup/slice(7)/sort -> same buildCompetitorContext/Instructions ->
// the SAME hardened Stage 1 call (temp 0, top_k 1, top_p 0.1). Then it DIVERGES:
// instead of Stage 2a -> scorers -> 2c -> 3 (Deep's eight calls), it makes ONE
// open Explore synthesis call and streams the four surfaces. Two model calls
// total (~20s) vs Deep's eight (~80s) — the moat is call count, not retrieval.
//
// SPINE: both modes read the SAME evidence (idea + Stage 1's competition object).
// Stage 1 stays clamped (deterministic structuring = identical spine across
// modes); only the Explore synthesis call is open (un-hardened) so it can FAN.
// PROFILE-BLIND: this route never reads or injects profile — Explore reasons
// about what the IDEA could become, not what a founder could build.
// NO PERSISTENCE: this route streams and returns; saving an angle as a branch
// reuses the existing idea-agnostic branch route. Nothing is charged here.
//
// VALIDATION HARNESS (base-run instrument, NON-BLOCKING): the route derives
// fan_state and runs the contract's route-side lints, but attaches the results
// as a `_validation` report on the streamed payload rather than hard-rejecting.
// Hard-rejecting would HIDE the distribution we are testing for. The three gates
// the cross-case run must watch — branch_idea_text neutrality leak, evidence_ref
// grounding, branchability<->fan_state agreement — surface as warnings to be
// aggregated across ~20 ideas. Tighten to reject once the distribution is known.

const EXPLORE_MODEL = "claude-sonnet-4-6";
// Stage 2a is a temp-0 structured TRANSFORM, not a reasoning call: the route
// owns every number and re-derives the density label deterministically, and the
// firewall ("sorter, never analyst") keeps it from generating directions. So it
// does not need Sonnet — Haiku does the clerical sort 3-4x faster at the same
// fidelity. Stage 1 (shared spine) and synthesis (the creative fan) stay Sonnet.
const STAGE2A_MODEL = "claude-haiku-4-5-20251001";
const RETRY_BACKOFF_MS = 1200;

// ============================================================================
// LABEL DERIVATION (route-owned, deterministic)
// ============================================================================
// fan_state / readiness / branchability are GRADED here from atoms the synthesis
// emits — never self-reported by the model (which only ever stamped the top
// value). Each angle carries disconfirmer_kind + demand_evidenced (the honest
// content of the kill); the route assigns the labels so the model can't inflate
// them. Pre-atom payloads fall back to the model's self-reported readiness, so
// this is safe to ship ahead of the prompt change. The frontend already renders
// every value below (empty/thin/rich · ready_for_deep/worth_shaping/probably_thin
// · branchable/partially_branchable/not_branchable) — no frontend change.
const DISCONFIRMER_KINDS = new Set([
  "direct_incumbent_holds", "free_substitute_floor", "demand_unproven",
  "structural_barrier", "closeable_gap",
]);

function deriveReadiness(a) {
  const trust = a?.justification?.opening?.trust || "moderate";
  const kind = a?.disconfirmer_kind;
  const demandEvidenced = a?.demand_evidenced === true;
  if (!DISCONFIRMER_KINDS.has(kind)) return a?.readiness || "worth_shaping"; // pre-atom fallback
  if (kind === "direct_incumbent_holds") return "probably_thin";             // a strong direct incumbent already holds it
  if (kind === "demand_unproven" && trust !== "strong") return "probably_thin";
  if (kind === "structural_barrier" && trust === "weak") return "probably_thin";
  if (trust === "strong" && kind === "closeable_gap" && demandEvidenced) return "ready_for_deep";
  return "worth_shaping";
}

function deriveFanState(angles) {
  if (!angles.length) return "empty";
  const viable = angles.filter((a) => a.readiness === "worth_shaping" || a.readiness === "ready_for_deep");
  const distinctBasis = new Set(viable.map((a) => a?.basis?.primary)).size;
  const distinctRests = new Set(viable.map((a) => a?.justification?.bet?.rests_on)).size;
  // rich = at least three live directions that genuinely diverge; otherwise thin.
  if (viable.length >= 3 && distinctBasis >= 2 && distinctRests >= 2) return "rich";
  return "thin";
}

// Mutates explore in place: overwrites each angle.readiness, reconciles
// read.branchability to the frontend's label set, stashes the model's originals
// under _*_model for the probe's A/B, and returns the derived fan_state.
function applyDerivedLabels(explore) {
  const angles = Array.isArray(explore.angles) ? explore.angles : [];
  for (const a of angles) {
    a._readiness_model = a.readiness ?? null;
    a.readiness = deriveReadiness(a);
  }
  const fan_state = deriveFanState(angles);
  const read = explore.read || (explore.read = {});
  const br = read.branchability || (read.branchability = {});
  br._state_model = br.state ?? null;
  br.state = fan_state === "empty" ? "not_branchable"
    : fan_state === "thin" ? "partially_branchable" : "branchable";
  br.reason_type = br.state === "branchable" ? null : (br.reason_type || "evidence_too_thin");
  return fan_state;
}

// ============================================================================
// LEAK SCRUB (deterministic backstop) — internal evidence ids (signal_N /
// field_N / coverage.*) are plumbing and must NEVER reach a reader. The prompt
// is told not to emit them; this guarantees it even if it slips. Targets tokens
// that are never legitimate user-facing content, so a blanket recursive string
// pass is safe. Best-effort: drops parentheticals, rewrites bare ids to plain
// words. The prompt rule is the real fix; this just makes a leak impossible.
function scrubString(t) {
  if (typeof t !== "string") return t;
  let x = t
    .replace(/\s*\((?:signal|field)_\d+\)/gi, "")        // " (signal_3)" -> ""
    .replace(/\s*\(coverage\.\w+\)/gi, "")              // " (coverage.evidence_limit)" -> ""
    .replace(/\b(?:signal|field)_\d+\b/gi, "the evidence")// "signal_3 shows" -> "the evidence shows"
    .replace(/\bcoverage\.\w+\b/gi, "the evidence base")
    .replace(/\bevidence_limit\b/gi, "evidence limit")
    .replace(/\s{2,}/g, " ").replace(/\s+([.,;:)])/g, "$1");
  // re-capitalize if a rewrite left a lowercased sentence start
  return x.replace(/(^|[.!?]\s+)the evidence/g, (m, p1) => p1 + "The evidence");
}
function scrubLeaks(o) {
  if (Array.isArray(o)) return o.map(scrubLeaks);
  if (o && typeof o === "object") { for (const k of Object.keys(o)) o[k] = scrubLeaks(o[k]); return o; }
  return scrubString(o);
}

// Obvious "open => wanted" leak tokens for the branch_idea_text neutrality probe
// (the #1 gate, which no lint can fully verify — this is a mechanical pre-filter
// for human review, not a hard check). Broadened past the first costume
// (geography): the model paraphrases "underserved" into "uncovered / overlooked
// / neglected / regions no one serves yet" — same smuggled demand-verdict, new
// words. The regex can never catch every paraphrase; the structural prompt rule
// is the real guard and this stays a pre-filter, not proof.
const NEUTRALITY_LEAK = /\b(under-?served|unmet (?:need|demand|want|gap)s?|untapped|under-?explored|uncovered|overlooked|neglected|under-?penetrated|open space|blue ocean|wide open|whitespace|white space|gap in the market|(?:regions?|markets?|areas?|segments?|verticals?|platforms?)\s+(?:that\s+)?(?:no one|nobody|that aren't|not yet|few)\b|nobody (?:serves|is serving)|no one (?:serves|is serving|else))\b/i;

// Verdict-language banned words (scanned across emitted prose, flag-only).
const BANNED_VERDICT = /\b(promising|best|good idea|bad idea|will work|won't work|clear winner|no-brainer|slam dunk)\b/i;

// ============================
// EXPLORE EVIDENCE COUNTS (code-authoritative)
// The model is bad at clerical counting (P29 — the reverted MO fine-table),
// so the route counts over Stage 1's competitor objects and hands the totals
// to Stage 2a-Explore as authoritative input; the sorter only classifies
// MEANING from them and emits no number. At assembly the same block is
// attached to the evidence object's `coverage`, so the figures are code's.
// Reads ONLY Stage 1 output. Adds nothing, retrieves nothing.
// ============================
const COUNT_TYPE_KEYS = ["direct", "adjacent", "substitute", "internal_build"];
const COUNT_TRUST_KEYS = ["strong", "moderate", "weak"];

function countBucket(value, keys, fallback) {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return keys.includes(v) ? v : fallback;
}

function computeExploreEvidenceCounts(stage1Result) {
  const competition = (stage1Result && stage1Result.competition) || {};
  const competitors = Array.isArray(competition.competitors) ? competition.competitors : [];

  const counts_by_type = { direct: 0, adjacent: 0, substitute: 0, internal_build: 0, other: 0 };
  const trust_distribution = { strong: 0, moderate: 0, weak: 0, unspecified: 0 };
  const provenance = { verified: 0, llm_generated: 0 };

  for (const c of competitors) {
    counts_by_type[countBucket(c && c.competitor_type, COUNT_TYPE_KEYS, "other")] += 1;
    trust_distribution[countBucket(c && c.evidence_strength, COUNT_TRUST_KEYS, "unspecified")] += 1;
    const src = typeof (c && c.source) === "string" ? c.source.trim().toLowerCase() : "";
    const hasUrl = !!(c && c.url);
    if (src === "llm" || !hasUrl) provenance.llm_generated += 1;
    else provenance.verified += 1;
  }

  const total = competitors.length;
  const llmShare = total > 0 ? provenance.llm_generated / total : 0;
  const dataSource = countBucket(competition.data_source, ["verified", "llm_generated"], "");

  let retrieval_condition;
  if (dataSource === "llm_generated" || (total > 0 && llmShare >= 0.6)) {
    retrieval_condition = "fallback_heavy";
  } else if (total < 3) {
    retrieval_condition = "thin";
  } else {
    retrieval_condition = "adequate";
  }

  return { total, counts_by_type, trust_distribution, provenance, retrieval_condition };
}

function renderExploreCountsBlock(counts) {
  const t = counts.counts_by_type;
  const d = counts.trust_distribution;
  const p = counts.provenance;
  return [
    "=== COUNTS (system-computed, authoritative — classify from these, do not recount) ===",
    "Total named items: " + counts.total,
    "By type: direct " + t.direct + ", adjacent " + t.adjacent + ", substitute " + t.substitute + ", internal_build " + t.internal_build + (t.other ? ", other " + t.other : ""),
    "By evidence strength: strong " + d.strong + ", moderate " + d.moderate + ", weak " + d.weak + (d.unspecified ? ", unspecified " + d.unspecified : ""),
    "Provenance: verified (retrieved) " + p.verified + ", model-generated " + p.llm_generated,
    "Retrieval condition: " + counts.retrieval_condition,
  ].join("\n");
}

// Code owns the classification THRESHOLD, not just the counts: the sorter
// clusters each field (semantic) and lists its members; the route assigns the
// final label deterministically from those members, so "mostly" is a pinned
// fraction, never the model's feel. This is the one classification the whole
// stage exists to produce — it must not ride on a soft word.
function classifyDensityLane(members) {
  const m = Array.isArray(members) ? members : [];
  const n = m.length;
  if (n < 2) return "sparse";

  let direct = 0, strongAny = 0, strongVerified = 0;
  for (const it of m) {
    const type = typeof (it && it.type) === "string" ? it.type.trim().toLowerCase() : "";
    const trust = typeof (it && it.trust) === "string" ? it.trust.trim().toLowerCase() : "";
    const llm =
      (typeof (it && it.data_source) === "string" && it.data_source.trim().toLowerCase() === "llm_generated") ||
      (typeof (it && it.source) === "string" && it.source.trim().toLowerCase() === "llm");
    if (type === "direct") direct += 1;
    if (trust === "strong") {
      strongAny += 1;                 // a famous URL-less incumbent (CodeRabbit, Otter) counts toward the crowd
      if (!llm) strongVerified += 1;  // ...but a URL-anchored strong member must exist to call a field crowded
    }
  }

  // Precedence is fixed. A real strong-direct core earns crowded/mixed: >=2 direct
  // AND >=2 strong members, with at least ONE of those strong members URL-verified
  // (the anchor). The anchor preserves the cure — a purely model-imagined crowd has
  // zero verified anchors and stays unverified — while no longer discarding real,
  // well-known incumbents that retrieval surfaced from model knowledge without a url.
  // The crowd ratio counts ALL strong members, so a famous llm-sourced incumbent is
  // not erased from the field it genuinely populates.
  if (direct >= 2 && strongAny >= 2 && strongVerified >= 1) {
    return strongAny / n >= 0.5 ? "verified_crowded" : "mixed";
  }
  return "emerging_unverified";
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { idea } = body;

    if (!idea || !idea.trim()) {
      return NextResponse.json({ error: "No idea provided" }, { status: 400 });
    }

    const evaluationId = crypto.randomUUID();
    const encoder = new TextEncoder();

    // ── NO SPECIFICITY GATE IN EXPLORE ──
    // Explore's whole job is to WIDEN a rough/vague seed, so the Haiku
    // specificity gate (which is tuned for Deep and halts before search on
    // under-specified ideas) is intentionally NOT run here. A vague seed like
    // "something with AI for small businesses" is a valid Explore input — the
    // fan is supposed to give it shape, not refuse it. Deep keeps its gate; only
    // Explore skips it. The query fallback below covers the case where the
    // extractor short-circuited on a vague idea without building search queries.

    const stream = new ReadableStream({
      async start(controller) {
        function sendEvent(data) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        // Shared JSON cleaner (same behavior as the Deep route's helper):
        // slice from the first { to the last } so bare / fenced / preamble-
        // wrapped JSON all parse; non-JSON returns trimmed so JSON.parse fails
        // with the same shape it always did.
        function cleanJsonResponse(text) {
          if (!text || typeof text !== "string") return text;
          const trimmed = text.trim();
          const firstBrace = trimmed.indexOf("{");
          const lastBrace = trimmed.lastIndexOf("}");
          if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
            return trimmed;
          }
          return trimmed.slice(firstBrace, lastBrace + 1);
        }

        // Retry-once wrapper for transient model-call faults (network/5xx/rate
        // limit). One quiet second attempt after a short backoff; a calm,
        // non-error "retry" progress event for the live panel; a second failure
        // propagates unchanged. Wraps the CALL only — never retries a parse
        // failure (at temp 0 a re-call reproduces the same malformed output).
        async function callWithRetry(callConfig, label) {
          try {
            return await client.messages.create(callConfig);
          } catch (firstError) {
            console.error(
              `${label} model call failed (attempt 1 of 2), retrying:`,
              firstError?.message || firstError
            );
            sendEvent({
              step: "retry",
              message: `${label} hit a snag — retrying, thanks for your patience.`,
            });
            await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
            return await client.messages.create(callConfig);
          }
        }

        try {
          // ── STAGE TIMING (additive, non-blocking) ──
          // Wall-clock per phase + per-call token usage, attached to the final
          // payload as `_timing`. The probe runner aggregates this across ideas
          // to find which stage owns the latency. usage.output_tokens is the
          // real tell: these are generation-bound, not network-bound, calls.
          const __t0 = Date.now();
          const __timing = {
            keywords_ms: 0, retrieval_ms: 0, stage1_ms: 0, stage2a_ms: 0, synthesis_ms: 0, total_ms: 0,
            usage: { stage1: null, stage2a: null, synthesis: null },
          };

          // ============================
          // PHASE 1: EVIDENCE GATHERING  (spine-identical to Deep)
          // ============================
          sendEvent({ step: "keywords_start", message: "Reading your idea..." });

          const __kwStart = Date.now();
          const keywordsResult = await extractKeywords(idea);
          __timing.keywords_ms = Date.now() - __kwStart;

          // No specificity gate in Explore (see note above): a vague seed is a
          // valid input to widen, never a halt. Proceed straight to search.

          // Query resolution with fallback. A vague idea the extractor flagged
          // insufficient may not have built search queries (it short-circuits).
          // Fall back to the keywords, then the raw idea text, so search still
          // runs on any input. On a well-formed idea these fallbacks never
          // trigger — the extractor populated the queries.
          const kw = Array.isArray(keywordsResult.keywords) ? keywordsResult.keywords : [];
          const fallbackQuery = kw.length ? kw.join(" ") : idea;
          const keywords = kw;
          const githubQuery1 = keywordsResult.githubQuery1 || fallbackQuery;
          const githubQuery2 = keywordsResult.githubQuery2 || githubQuery1;
          const serperQuery1 = keywordsResult.serperQuery1 || fallbackQuery;
          const serperQuery2 = keywordsResult.serperQuery2 || serperQuery1;

          sendEvent({
            step: "keywords_done",
            message: `Keywords: ${keywords.join(", ")}`,
            data: { keywords },
          });

          sendEvent({ step: "search_start", message: "Scanning what already exists..." });

          const __retrStart = Date.now();
          const [
            githubResults1, githubResults2,
            serperResults1, serperResults2,
            tavilyResults1, tavilyResults2,
            exaResults1, exaResults2,
          ] = await Promise.all([
            searchGitHub(githubQuery1),
            searchGitHub(githubQuery2),
            searchSerper(serperQuery1),
            searchSerper(serperQuery2),
            searchTavily(serperQuery1),
            searchTavily(serperQuery2),
            searchExa(serperQuery1),
            searchExa(serperQuery2),
          ]);
          __timing.retrieval_ms = Date.now() - __retrStart;

          // Dedup by URL, cap each source at 7, sort by URL — same input
          // discipline as Deep so the shared Stage 1 reads an identical-shaped
          // evidence set (stable input order; drift is synthesis, not retrieval).
          const seenUrls = new Set();
          function dedup(results) {
            const unique = [];
            for (const item of results) {
              if (!seenUrls.has(item.url)) {
                seenUrls.add(item.url);
                unique.push(item);
              }
            }
            return unique;
          }

          const githubResults = dedup([...githubResults1, ...githubResults2]).slice(0, 7);
          const tavilyResults = dedup([...tavilyResults1, ...tavilyResults2]).slice(0, 7);
          const exaResults = dedup([...exaResults1, ...exaResults2]).slice(0, 7);
          const serperResults = dedup([...serperResults1, ...serperResults2]).slice(0, 7);

          githubResults.sort((a, b) => (a.url || "").localeCompare(b.url || ""));
          tavilyResults.sort((a, b) => (a.url || "").localeCompare(b.url || ""));
          exaResults.sort((a, b) => (a.url || "").localeCompare(b.url || ""));
          serperResults.sort((a, b) => (a.url || "").localeCompare(b.url || ""));

          sendEvent({ step: "github_done", message: `GitHub: ${githubResults.length} repositories`, data: { count: githubResults.length } });
          sendEvent({ step: "tavily_done", message: `Tavily: ${tavilyResults.length} results`, data: { count: tavilyResults.length } });
          sendEvent({ step: "exa_done", message: `Exa: ${exaResults.length} results`, data: { count: exaResults.length } });
          sendEvent({ step: "serper_done", message: `Google: ${serperResults.length} results`, data: { count: serperResults.length } });

          // SAME sources array shape as Deep -> SAME buildCompetitorContext ->
          // SAME competitor object Stage 1 reads. The one place evidence
          // enrichment would enter for both modes (per the spine doctrine).
          const { context: competitorContext, hasRealData } = buildCompetitorContext([
            { type: "github", header: "REAL COMPETITOR DATA FROM GITHUB", intro: "These are real, verified GitHub repositories related to this idea:", items: githubResults },
            { type: "web", header: "REAL COMPETITOR DATA FROM WEB SEARCH (TAVILY)", intro: "These are real products and companies found via AI-native web search:", items: tavilyResults },
            { type: "web", header: "REAL COMPETITOR DATA FROM SEMANTIC SEARCH (EXA)", intro: "These are real products and companies found via neural/semantic search — conceptually similar to the idea even if they use different wording:", items: exaResults },
            { type: "web", header: "REAL COMPETITOR DATA FROM GOOGLE SEARCH", intro: "These are real products and companies found via Google:", items: serperResults },
          ]);
          const competitorInstructions = buildCompetitorInstructions(hasRealData);

          sendEvent({
            step: "evidence_ready",
            message: hasRealData ? "Evidence assembled \u00b7 real market data" : "No verified data found — using AI knowledge base",
            data: { hasRealData },
          });

          // ============================
          // STAGE 1: DISCOVER  (REUSED VERBATIM — the shared spine)
          // Same prompt, same assembly, same hardened sampler as Deep. This is
          // what keeps the two modes reading the SAME evidence. Profile-blind by
          // construction (Stage 1 takes no profile).
          // ============================
          sendEvent({ step: "landscape_start", message: "Mapping the landscape..." });

          const stage1SystemPrompt = STAGE1_SYSTEM_PROMPT + competitorContext + competitorInstructions;
          const stage1UserMessage = `USER'S AI PRODUCT IDEA:\n${idea}`;

          const __s1Start = Date.now();
          const stage1Response = await callWithRetry({
            model: EXPLORE_MODEL,
            max_tokens: 8000,
            temperature: 0,
            top_k: 1,
            system: stage1SystemPrompt,
            messages: [{ role: "user", content: stage1UserMessage }],
          }, "Landscape mapping");
          __timing.stage1_ms = Date.now() - __s1Start;
          __timing.usage.stage1 = stage1Response.usage || null;

          const stage1Text = stage1Response.content[0].text;

          let stage1Result;
          try {
            stage1Result = JSON.parse(cleanJsonResponse(stage1Text));
          } catch (parseError) {
            console.error("Stage 1 parse failed:", stage1Text);
            sendEvent({ step: "error", message: "Landscape mapping failed to parse. Please try again." });
            controller.close();
            return;
          }

          sendEvent({ step: "landscape_done", message: "Landscape mapped." });

          // ============================
          // STAGE 2a-EXPLORE  (the outward evidence sorter)
          // The middle-man Deep has and Explore was missing: it re-shapes the
          // SAME Stage 1 competition object into outward signals + density reads
          // + coverage, so synthesis no longer eats raw, verdict-shaped landscape
          // (which is what made it read cautious). Sorter, not analyst — it never
          // writes an angle. Code owns the numbers: we count over Stage 1 here and
          // hand the sorter the totals; it classifies meaning, emits no number.
          // Clamped (temp 0 / top_k 1 / top_p 0.1) — a structured transform.
          // ============================
          sendEvent({ step: "shape_start", message: "Sorting the evidence..." });

          const evidenceCounts = computeExploreEvidenceCounts(stage1Result);

          // Pass the SAME evidence the synthesis used to read: the competition
          // object (competitors + entry_barriers + landscape_analysis) PLUS the
          // top-level domain_risk_flags (llm-substitution + relationship-
          // displacement) — those are prime barrier/disconfirmer material and
          // would be lost if we passed competition alone.
          const sorterEvidence = {
            competition: stage1Result.competition,
            domain_risk_flags: stage1Result.domain_risk_flags,
          };

          const sorterUserMessage =
            `IDEA:\n${idea}\n\n` +
            `LANDSCAPE (the structured discovery object to sort):\n` +
            `${JSON.stringify(sorterEvidence, null, 2)}\n\n` +
            `${renderExploreCountsBlock(evidenceCounts)}`;

          const __s2aStart = Date.now();
          const sorterResponse = await callWithRetry({
            model: STAGE2A_MODEL,
            max_tokens: 6000,
            temperature: 0,
            top_k: 1,
            system: STAGE2A_EXPLORE_SYSTEM_PROMPT,
            messages: [{ role: "user", content: sorterUserMessage }],
          }, "Evidence sorting");
          __timing.stage2a_ms = Date.now() - __s2aStart;
          __timing.usage.stage2a = sorterResponse.usage || null;

          const sorterText = sorterResponse.content[0].text;

          let exploreEvidence;
          try {
            exploreEvidence = JSON.parse(cleanJsonResponse(sorterText));
          } catch (parseError) {
            console.error("Stage 2a-Explore parse failed:", sorterText);
            sendEvent({ step: "error", message: "Evidence sorting failed to parse. Please try again." });
            controller.close();
            return;
          }

          // Code owns the classification THRESHOLD: re-derive each field's label
          // deterministically from the members the sorter listed, overwriting the
          // model's provisional guess so "mostly" is a pinned fraction, not feel.
          if (Array.isArray(exploreEvidence.density_reads)) {
            for (const lane of exploreEvidence.density_reads) {
              if (lane && typeof lane === "object") {
                lane.classification = classifyDensityLane(lane.members);
              }
            }
          }

          // Code owns the numbers: attach the computed counts onto coverage so the
          // figures in the object are authoritative, never the model's tally.
          exploreEvidence.coverage = {
            ...(exploreEvidence.coverage || {}),
            total: evidenceCounts.total,
            counts_by_type: evidenceCounts.counts_by_type,
            trust_distribution: evidenceCounts.trust_distribution,
            provenance: evidenceCounts.provenance,
            retrieval_condition: evidenceCounts.retrieval_condition,
            distinct_signal_count: Array.isArray(exploreEvidence.outward_signals)
              ? exploreEvidence.outward_signals.length
              : 0,
          };

          sendEvent({ step: "shape_done", message: "Evidence sorted." });

          // ============================
          // EXPLORE SYNTHESIS  (the analyst — the ONE OPEN call)
          // Reads the SORTED evidence object, NOT raw Stage 1. Open sampler (no
          // top_k / top_p clamp) so it can FAN — variety comes from the prompt's
          // distinct-basis discipline, not from temperature (temp stays 0).
          // ============================
          sendEvent({ step: "explore_start", message: "Mapping where it could go..." });

          const exploreUserMessage =
            `IDEA:\n${idea}\n\n` +
            `EXPLORE EVIDENCE (outward-sorted signals, density reads, and coverage to reason from):\n` +
            `${JSON.stringify(exploreEvidence, null, 2)}`;

          const __synStart = Date.now();
          const exploreResponse = await callWithRetry({
            model: EXPLORE_MODEL,
            max_tokens: 8000,
            temperature: 0,
            // NO top_k / top_p — the synthesis stays open so it can fan.
            system: EXPLORE_SYSTEM_PROMPT,
            messages: [{ role: "user", content: exploreUserMessage }],
          }, "Exploration");
          __timing.synthesis_ms = Date.now() - __synStart;
          __timing.usage.synthesis = exploreResponse.usage || null;

          const exploreText = exploreResponse.content[0].text;

          let explore;
          try {
            explore = JSON.parse(cleanJsonResponse(exploreText));
          } catch (parseError) {
            console.error("Explore parse failed:", exploreText);
            sendEvent({ step: "error", message: "Exploration failed to parse. Please try again." });
            controller.close();
            return;
          }

          // ============================
          // ROUTE-SIDE: derive fan_state + run the validation harness
          // (the model emits the four surfaces; mode / schema_version / idea /
          // fan_state are set or derived here)
          // ============================
          const angles = Array.isArray(explore.angles) ? explore.angles : [];
          // GRADE the honesty labels from the synthesis's atoms (disconfirmer_kind
          // + demand_evidenced), not the model's self-report or the raw angle
          // count. Mutates angle.readiness + read.branchability in place (stashing
          // the model's originals as _*_model); returns the derived fan_state.
          const fan_state = applyDerivedLabels(explore);
          scrubLeaks(explore); // strip any leaked internal evidence id before it reaches the reader
          // demand_question is incoherent on a lane with paying incumbents
          // (lane_type crowded_with_gap): their payment already proves demand. Null it.
          for (const lane of explore?.terrain?.lanes || []) {
            if (lane && lane.lane_type === "crowded_with_gap") lane.demand_question = null;
          }

          // Validate synthesis refs against the ORIGINAL Stage 1 named items
          // (not the sorted object) — grounding must trace to real retrieval.
          const validation = buildValidation(explore, stage1Result, fan_state);

          __timing.total_ms = Date.now() - __t0;

          const payload = {
            mode: "explore",
            schema_version: "ll2_explore_v1",
            idea,
            fan_state,
            read: explore.read || null,
            angles,
            terrain: explore.terrain || null,
            next_move: explore.next_move || null,
            evaluationId,
            _timing: __timing,
            _validation: validation,
            _evidence: exploreEvidence,
          };

          sendEvent({ step: "explore_done", message: "Exploration ready." });
          sendEvent({ step: "complete", data: payload });
          controller.close();
        } catch (error) {
          console.error("Explore pipeline failed:", error);
          sendEvent({ step: "error", message: "Exploration failed. Please try again." });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Explore route error:", error);
    return NextResponse.json({ error: "Exploration failed" }, { status: 500 });
  }
}

// ============================================
// VALIDATION HARNESS  (non-blocking; the base-run instrument)
// ============================================
// Runs the contract's route-side lints and the three watch-gates, returning a
// { warnings, leak_candidates, fan_state } report rather than rejecting. Each
// warning is a string the cross-case run can aggregate into violation RATES.
function buildValidation(explore, evidence, fan_state) {
  const warnings = [];
  const leakCandidates = [];

  const read = explore.read || {};
  const branchability = read.branchability || {};
  const angles = Array.isArray(explore.angles) ? explore.angles : [];
  const terrain = explore.terrain || {};
  const lanes = Array.isArray(terrain.lanes) ? terrain.lanes : [];
  const nextMove = explore.next_move || {};

  // Collect the named-item labels Stage 1 actually emitted, for ref grounding.
  const namedLabels = new Set();
  const competitors = (evidence?.competition?.competitors) || [];
  for (const c of competitors) {
    if (c && typeof c.name === "string") namedLabels.add(c.name.toLowerCase());
  }
  function labelKnown(label) {
    if (!label || typeof label !== "string") return false;
    const l = label.toLowerCase();
    for (const name of namedLabels) {
      if (l.includes(name) || name.includes(l)) return true;
    }
    return false;
  }

  // GATE: branchability <-> fan_state (strict 1:1) and reason_type coherence.
  const state = branchability.state;
  const reasonType = branchability.reason_type ?? null;
  const expectedState =
    fan_state === "empty" ? "not_branchable" : fan_state === "thin" ? "partially_branchable" : "branchable";
  if (state && state !== expectedState) {
    warnings.push(`branchability.state "${state}" disagrees with fan_state "${fan_state}" (expected "${expectedState}")`);
  }
  if (state === "branchable" && reasonType !== null) {
    warnings.push(`branchable should have null reason_type; got "${reasonType}"`);
  }
  if ((state === "partially_branchable" || state === "not_branchable") && !reasonType) {
    warnings.push(`${state} requires a reason_type; none set`);
  }
  // reason_type enum membership (the harness gap the review caught — was only
  // checking null-ness, not membership).
  const REASON_ENUM = new Set(["too_vague", "already_specific", "evidence_too_thin", "too_broad", "unclear_buyer"]);
  if (reasonType !== null && !REASON_ENUM.has(reasonType)) {
    warnings.push(`reason_type "${reasonType}" not in enum`);
  }
  // state<->reason_type pairing flag (Issue 10, surfaced not hard-rejected):
  // the "fix the read" reasons (too_vague/too_broad/unclear_buyer) pairing with
  // partially_branchable is worth an eyeball — it usually means not_branchable.
  const FIX_THE_READ = new Set(["too_vague", "too_broad", "unclear_buyer"]);
  if (state === "partially_branchable" && FIX_THE_READ.has(reasonType)) {
    warnings.push(`pairing: partially_branchable + "${reasonType}" (a fix-the-read reason) — confirm by eye`);
  }

  // Angles: evidence_refs non-empty + grounded, disconfirmer present,
  // branch_idea_text present + neutrality probe, readiness enum.
  const angleIds = new Set(angles.map((a) => a?.id).filter(Boolean));
  const READINESS = new Set(["ready_for_deep", "worth_shaping", "probably_thin"]);
  angles.forEach((a, i) => {
    const tag = `angle[${i}]${a?.id ? ` (${a.id})` : ""}`;
    const refs = a?.justification?.opening?.evidence_refs;
    if (!Array.isArray(refs) || refs.length === 0) {
      warnings.push(`${tag}: opening.evidence_refs empty (no opening, no angle)`);
    } else {
      refs.forEach((r, j) => {
        if (r?.type === "competitor" || r?.type === "substitute") {
          if (!labelKnown(r?.label)) warnings.push(`${tag}: evidence_ref[${j}] label "${r?.label}" not found among named items`);
        }
      });
    }
    if (!a?.justification?.disconfirmer) warnings.push(`${tag}: missing disconfirmer`);
    if (!a?.branch_idea_text) {
      warnings.push(`${tag}: missing branch_idea_text`);
    } else if (NEUTRALITY_LEAK.test(a.branch_idea_text)) {
      const m = a.branch_idea_text.match(NEUTRALITY_LEAK);
      leakCandidates.push(`${tag}: branch_idea_text contains "${m[0]}" — possible open=>wanted leak`);
    }
    if (!READINESS.has(a?.readiness)) warnings.push(`${tag}: readiness "${a?.readiness}" not in enum`);
    if (a?.lane_ref && !lanes.some((l) => l?.id === a.lane_ref)) {
      warnings.push(`${tag}: lane_ref "${a.lane_ref}" does not resolve to a lane`);
    }
    // Banned verdict language anywhere in the angle's visible prose.
    for (const field of [a?.title, a?.concept, a?.justification?.opening?.text, a?.justification?.bet?.text, a?.justification?.disconfirmer]) {
      if (typeof field === "string" && BANNED_VERDICT.test(field)) {
        warnings.push(`${tag}: banned verdict word in prose ("${field.match(BANNED_VERDICT)[0]}")`);
      }
    }
  });

  // Terrain lanes: substitute_tell present; demand_question rules.
  lanes.forEach((l, i) => {
    const tag = `lane[${i}]${l?.id ? ` (${l.id})` : ""}`;
    if (!l?.substitute_tell) warnings.push(`${tag}: missing substitute_tell`);
    const dq = l?.demand_question ?? null;
    const needsDq = l?.status === "open" || l?.status === "lightly_served" || l?.lane_type === "crowded_free_tools";
    const dqNullOk = l?.lane_type === "crowded_with_gap";
    if (needsDq && !dq) warnings.push(`${tag}: demand_question required for status/lane_type "${l?.status}/${l?.lane_type}" but null`);
    if (dq && dqNullOk) warnings.push(`${tag}: demand_question present on crowded_with_gap (expected null — paying incumbents)`);
  });

  // Next Move: id resolution on targets + actions.
  const tIds = nextMove?.targets?.angle_ids;
  if (Array.isArray(tIds)) {
    tIds.forEach((id) => { if (!angleIds.has(id)) warnings.push(`next_move.targets references unknown angle "${id}"`); });
  }
  const actions = Array.isArray(nextMove?.actions) ? nextMove.actions : [];
  actions.forEach((act, i) => {
    const ids = Array.isArray(act?.target_angle_ids) ? act.target_angle_ids : [];
    ids.forEach((id) => { if (!angleIds.has(id)) warnings.push(`next_move.actions[${i}] references unknown angle "${id}"`); });
    if (act?.type === "compare_selected" && act?.enabled && ids.length < 2) {
      warnings.push(`next_move.actions[${i}] compare_selected enabled with <2 targets`);
    }
  });

  // Forbidden field: the model must NOT emit fan_state.
  if (Object.prototype.hasOwnProperty.call(explore, "fan_state")) {
    warnings.push(`model emitted fan_state (route-derived only — must not be emitted)`);
  }

  // Optimism leak in USER-FACING prose (dominant_uncertainty.text + recommendation).
  // Distinct severity from the branch_idea_text leak: Deep never ingests these,
  // so it is a tone flag (warning), not a spine break (leak_candidate). But the
  // same word reaching into the open-space read makes "honest fork" sound like a
  // verdict that the space is wanted — caught here so the next prose pass sees it.
  const duText = nextMove?.dominant_uncertainty?.text;
  if (typeof duText === "string" && NEUTRALITY_LEAK.test(duText)) {
    warnings.push(`next_move.dominant_uncertainty.text uses "${duText.match(NEUTRALITY_LEAK)[0]}" — confirm by eye: a two-sided fork ("open because X, or because unwanted?") is fine; asserting the space IS underserved is the leak`);
  }
  const rec = nextMove?.recommendation;
  if (typeof rec === "string" && NEUTRALITY_LEAK.test(rec)) {
    warnings.push(`next_move.recommendation uses "${rec.match(NEUTRALITY_LEAK)[0]}" — confirm by eye: describing where to test is fine; asserting the target is underserved is the leak`);
  }

  return {
    fan_state,
    angle_count: angles.length,
    facet_count: 0, // V1.2 base shape has no facet band yet
    clean: warnings.length === 0 && leakCandidates.length === 0,
    warnings,
    leak_candidates: leakCandidates,
  };
}
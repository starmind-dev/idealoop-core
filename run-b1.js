// ============================================
// IDEALOOP CORE — V4S28 BUNDLE B1 VERIFICATION
// Stage 2c creation (S1+S2+S3) targeted re-run set
// ============================================
//
// V4S28 B1 PATCH (2026-04-25, post-B1-verification): tightened auto-detection
// after the first B1 verification revealed two false-negative issues:
//   - Templating regex was too narrow (caught 0/19 actual templated openers
//     because the patterns "Clio dominates...", "Existing GPOs already serve...",
//     "Habit AI is already live..." didn't match the originals).
//   - Profile-attribution scanner used substring match against profile.education,
//     which let "healthcare background" pass when the profile said "healthtech
//     startup" (substring match found "health" inside "healthtech").
// Both detectors are now stricter; the run set itself is unchanged.
//
// Goal: structurally verify the new failure_risks shape and Stage 2c synthesis
// behavior shipped in commit 8711364, plus the post-verification patch.
// This is NOT the full 34-run regression — that runs at B10 as the launch gate.
//
// 22 runs across 7 verification dimensions:
//   D1 — failure_risks shape (every run validates structure)
//   D2 — Archetype A-E coverage (5 cases hand-picked to trigger each)
//   D3 — Null-Risk-3 (profile-fit) cases (founder_fit slot dropped)
//   D4 — Templating breakdown (P2-S2 — M1 ×3 reruns)
//   D5 — Lead rotation (MAT1-int ×2, MAT2-beg ×2)
//   D6 — Sparse-input LOW handling (SP1 ×2, MD1 ×1)
//   D7 — Profile inference (P1-S1 — MAT3-tech-no-access ×2)
//
// Outputs (timestamped — does not overwrite prior runs):
//   b1-{TIMESTAMP}-raw.json          — every field from every run
//   b1-{TIMESTAMP}-streaming.json    — SSE events per run
//   b1-{TIMESTAMP}-report.md         — verification report (top) + per-run sections
//
// Usage:
//   node run-b1.js
//   (server must be running at localhost:3000)
//
// ============================================

const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = __dirname;

// ============================================
// IDEA + PROFILE DEFINITIONS
// (copied verbatim from run-audit.js so this script is standalone)
// ============================================

const MAT1_IDEA =
  "AI-powered document automation tool for small law firms (under 20 attorneys). Ingests client intake forms, generates draft engagement letters, retainer agreements, and client memos based on firm templates. Integrates with Clio. $299/month per firm.";

const MAT1_PROFILES = {
  beginner: { coding: "No coding experience", ai: "Some AI experience", education: "Paralegal (6 years), Airtable builder" },
  intermediate: { coding: "Intermediate", ai: "Regular AI user", education: "Paralegal (6 years), bootcamp grad, shipped personal project" },
  senior: { coding: "Advanced", ai: "Advanced AI user (fine-tuning LLMs)", education: "Staff engineer at LegalTech company (5 years, doc automation features)" },
};

const MAT2_IDEA =
  "Concierge service that handles all insurance claim disputes for small businesses (under 50 employees). Success fee of 25% on recovered claims. Starting with denied health insurance claims for employee medical expenses. Done-with-you model: we handle paperwork, customer provides documents.";

const MAT2_PROFILES = {
  beginner: { coding: "No coding experience", ai: "Some AI experience", education: "Former small-business owner (dealt with claim denials personally)" },
  intermediate: { coding: "Beginner", ai: "Regular AI user", education: "Insurance claims adjuster (10 years), learning to code" },
  senior: { coding: "Advanced", ai: "Advanced AI user", education: "Senior PM at healthtech company, built internal tools" },
};

const MAT3_IDEA =
  "Platform that helps rural hospitals (under 100 beds) negotiate better rates with medical device suppliers by aggregating purchasing data across member hospitals. Members pay $24,000/year. Value prop: average 12% reduction in device spend, which pays for membership 10x over. Requires buy-in from hospital CFOs and procurement directors.";

const MAT3_PROFILES = {
  insider: { coding: "No coding experience", ai: "Some AI experience", education: "Former rural hospital CFO (15 years), 80+ exec relationships" },
  "tech-no-access": { coding: "Advanced", ai: "Advanced AI user", education: "Staff engineer at healthtech startup (8 years), built procurement tools for enterprise" },
};

const H1_TEST = {
  idea: "A platform that matches rare disease patients with active clinical trials based on their genetic markers, medical history, and geographic constraints. Patients upload their records (with consent), and the system surfaces trials they qualify for with automated outreach to coordinators. Revenue: $15-25K per enrolled patient paid by pharma sponsors struggling with recruitment costs. Built-in EHR integration via SMART on FHIR. Initial focus on oncology rare diseases where trial fill rates are under 30%.",
  profile: { coding: "Intermediate", ai: "Regular AI user", education: "Former clinical operations lead (pharma, 8 years)" },
};

const H2_TEST = {
  idea: "Tool that integrates with Toast/Square POS to auto-calculate food costs per dish in real-time as vendor prices change, flags dishes that fell below margin, and suggests menu price adjustments or ingredient swaps. $99/month per location. Starts with independent restaurants (under 5 locations) where owners do menu pricing themselves.",
  profile: { coding: "Intermediate", ai: "Some AI experience", education: "Restaurant consultant (6 years), bootcamp grad" },
};

const M1_TEST = {
  idea: "habit tracker app with an AI that talks to you about your progress and helps you figure out why you fell off. gamified. freemium with $9/mo for the AI coach.",
  profile: { coding: "Intermediate", ai: "Regular AI user", education: "Solo indie hacker, no shipped products" },
};

const SP1_TEST = {
  idea: "tool for dentists to save time",
  profile: { coding: "Beginner", ai: "No AI experience", education: "Dentist" },
};

const MD1_TEST = {
  idea: "ok so i've been thinking about this for a while. i'm a freelance ux designer and everyone i know has the same problem where you do work, the client loves it, then payment takes forever. i want to build something that fixes this but also maybe could be a full platform for freelancers to manage everything. like invoices, contracts, tracking hours, maybe client portals too. i'm not sure if i should focus on just the payment thing or build the whole platform. i know there are other freelancer tools out there but they all suck honestly or they're way too expensive for solo people. maybe pricing it at like $15/month? i could probably get some of my designer friends to try it. the AI angle could be that it automates the annoying parts like writing payment reminders and contracts. tbh i haven't fully figured out what the MVP should be, i just know the problem is real.",
  profile: { coding: "Intermediate", ai: "Some AI experience", education: "Freelance UX designer (4 years)" },
};

// ============================================
// B1 TEST SET — 22 runs targeted at Stage 2c verification
// ============================================
// Each entry: { id, dimension, purpose, pipeline, idea, profile, runIndex }
// dimension tags: D1 (shape — implicit on every run), D2-D7 explicit

const TESTS = [
  // ─────────────────────────────────────────
  // D2 — ARCHETYPE A-E COVERAGE
  // ─────────────────────────────────────────

  { id: "MAT1-beginner-r1", dimension: "D2-archetypeA", expectArchetype: "A",
    purpose: "Archetype A (technical execution gap): paralegal + no coding building doc automation. TC should be high; A should fire.",
    pipeline: "PRO", idea: MAT1_IDEA, profile: MAT1_PROFILES.beginner, runIndex: 1 },

  { id: "MAT3-tech-no-access-r1", dimension: "D2-archetypeB", expectArchetype: "B",
    purpose: "Archetype B (buyer access gap): senior engineer building rural hospital tool — needs CFO relationships, doesn't have them. P1-S1 also tested here.",
    pipeline: "PRO", idea: MAT3_IDEA, profile: MAT3_PROFILES["tech-no-access"], runIndex: 1 },

  { id: "MAT2-senior-r1", dimension: "D2-archetypeC", expectArchetype: "C",
    purpose: "Archetype C (domain credibility gap): healthtech PM building insurance claim disputes service — high-trust, no insurance credential.",
    pipeline: "PRO", idea: MAT2_IDEA, profile: MAT2_PROFILES.senior, runIndex: 1 },

  { id: "H1-r1", dimension: "D2-archetypeD-or-null", expectArchetype: null,
    purpose: "Archetype D candidate (capital/runway): clinical trials platform requires substantial pre-revenue investment. Profile (clinical ops) may produce null instead.",
    pipeline: "PRO", idea: H1_TEST.idea, profile: H1_TEST.profile, runIndex: 1 },

  { id: "MAT1-senior-r1", dimension: "D2-archetypeE-or-null", expectArchetype: null,
    purpose: "Archetype E candidate (sales/conversion gap): staff engineer at LegalTech, $299/mo law firm sales — engineer profile may not indicate sales capability. Or profile fit triggers null.",
    pipeline: "PRO", idea: MAT1_IDEA, profile: MAT1_PROFILES.senior, runIndex: 1 },

  // ─────────────────────────────────────────
  // D3 — NULL-RISK-3 CASES (founder_fit dropped)
  // ─────────────────────────────────────────

  { id: "MAT3-insider-r1", dimension: "D3-null", expectArchetype: null,
    purpose: "Null Risk 3: hospital CFO building hospital tool — perfect domain fit. founder_fit should be DROPPED.",
    pipeline: "PRO", idea: MAT3_IDEA, profile: MAT3_PROFILES.insider, runIndex: 1 },

  { id: "MAT2-intermediate-r1", dimension: "D3-null", expectArchetype: null,
    purpose: "Null Risk 3: 10-year insurance adjuster building insurance claim service. founder_fit should be DROPPED.",
    pipeline: "PRO", idea: MAT2_IDEA, profile: MAT2_PROFILES.intermediate, runIndex: 1 },

  { id: "H2-r1", dimension: "D3-null", expectArchetype: null,
    purpose: "Null Risk 3: restaurant consultant building restaurant POS tool. founder_fit should be DROPPED.",
    pipeline: "PRO", idea: H2_TEST.idea, profile: H2_TEST.profile, runIndex: 1 },

  // ─────────────────────────────────────────
  // D4 — TEMPLATING BREAKDOWN (M1 ×3)
  // ─────────────────────────────────────────

  { id: "M1-r1", dimension: "D4-templating", expectArchetype: null,
    purpose: "Templating stability: solo indie hacker + crowded habit tracker category. M1 historically produces templated three-beat skeleton. Lead rotation should kill that.",
    pipeline: "PRO", idea: M1_TEST.idea, profile: M1_TEST.profile, runIndex: 1 },

  { id: "M1-r2", dimension: "D4-templating", expectArchetype: null,
    purpose: "M1 rerun #2 — checks Risk 1 opening variety across reruns of same input.",
    pipeline: "PRO", idea: M1_TEST.idea, profile: M1_TEST.profile, runIndex: 2 },

  { id: "M1-r3", dimension: "D4-templating", expectArchetype: null,
    purpose: "M1 rerun #3 — completes M1 templating stability sample.",
    pipeline: "PRO", idea: M1_TEST.idea, profile: M1_TEST.profile, runIndex: 3 },

  // ─────────────────────────────────────────
  // D5 — LEAD ROTATION (mid-band cases × 2 reruns each)
  // ─────────────────────────────────────────

  { id: "MAT1-intermediate-r1", dimension: "D5-leadrot", expectArchetype: null,
    purpose: "Lead rotation: legal doc tool + bootcamp paralegal. Profile-fit so likely null Risk 3, idea-level risks lead.",
    pipeline: "PRO", idea: MAT1_IDEA, profile: MAT1_PROFILES.intermediate, runIndex: 1 },

  { id: "MAT1-intermediate-r2", dimension: "D5-leadrot", expectArchetype: null,
    purpose: "Lead rotation rerun — checks Risk 1/Risk 2 lens diversity across reruns of same input.",
    pipeline: "PRO", idea: MAT1_IDEA, profile: MAT1_PROFILES.intermediate, runIndex: 2 },

  { id: "MAT2-beginner-r1", dimension: "D5-leadrot", expectArchetype: null,
    purpose: "Lead rotation: insurance claim service + small biz owner. Tests trust_adoption lens variety.",
    pipeline: "PRO", idea: MAT2_IDEA, profile: MAT2_PROFILES.beginner, runIndex: 1 },

  { id: "MAT2-beginner-r2", dimension: "D5-leadrot", expectArchetype: null,
    purpose: "Lead rotation rerun.",
    pipeline: "PRO", idea: MAT2_IDEA, profile: MAT2_PROFILES.beginner, runIndex: 2 },

  // ─────────────────────────────────────────
  // D6 — SPARSE-INPUT LOW HANDLING
  // ─────────────────────────────────────────

  { id: "SP1-r1", dimension: "D6-sparse", expectArchetype: null,
    purpose: "Sparse-input LOW: 'tool for dentists to save time' (5 words). Summary should open with spec gap; failure_risks should drop founder_fit, anchor on spec gaps.",
    pipeline: "PRO", idea: SP1_TEST.idea, profile: SP1_TEST.profile, runIndex: 1 },

  { id: "SP1-r2", dimension: "D6-sparse", expectArchetype: null,
    purpose: "SP1 rerun — checks LOW handling stability.",
    pipeline: "PRO", idea: SP1_TEST.idea, profile: SP1_TEST.profile, runIndex: 2 },

  { id: "MD1-r1", dimension: "D6-sparse", expectArchetype: null,
    purpose: "Messy founder dump: self-contradicting scope. Stage 2c should not fabricate coherence; if confidence resolves to LOW, spec-gap rule fires.",
    pipeline: "PRO", idea: MD1_TEST.idea, profile: MD1_TEST.profile, runIndex: 1 },

  // ─────────────────────────────────────────
  // D7 — PROFILE INFERENCE (P1-S1 fix)
  // ─────────────────────────────────────────

  { id: "MAT3-tech-no-access-r2", dimension: "D7-profile-inference", expectArchetype: "B",
    purpose: "P1-S1: rerun of MAT3-tech-no-access. Summary must NOT attribute hospital procurement expertise. Profile says 'built procurement tools for enterprise' — that's enterprise tooling, NOT hospital procurement.",
    pipeline: "PRO", idea: MAT3_IDEA, profile: MAT3_PROFILES["tech-no-access"], runIndex: 2 },

  // ─────────────────────────────────────────
  // BONUS — Standard/Deep depth pair + mid-band
  // ─────────────────────────────────────────

  { id: "M1-std-r1", dimension: "D-bonus-stdpair", expectArchetype: null,
    purpose: "Free pair for M1 — Standard's Risk 3 slot system (no archetype machinery) renders correctly.",
    pipeline: "FREE", idea: M1_TEST.idea, profile: M1_TEST.profile, runIndex: 1 },

  { id: "MAT3-partial-r1", dimension: "D-bonus-midband", expectArchetype: null,
    purpose: "Mid-band coverage: hospital purchasing consultant — partial domain fit, partial tech. Tests intermediate profile-fit decision.",
    pipeline: "PRO", idea: MAT3_IDEA, profile: { coding: "Intermediate", ai: "Regular AI user", education: "Former consultant at hospital purchasing group (3 years), now building SaaS" }, runIndex: 1 },
];

// ============================================
// SSE RUNNER — captures all events, returns final result
// ============================================

async function runEval(test) {
  const ep = test.pipeline === "PRO" ? "/api/analyze-pro" : "/api/analyze";
  const res = await fetch(BASE_URL + ep, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea: test.idea, profile: test.profile }),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const text = await res.text();

  const allEvents = [];
  let result = null;
  let error = null;

  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const d = JSON.parse(line.slice(6));
      allEvents.push(d);
      if (d.step === "complete" && d.data) result = d.data;
      else if (d.step === "error") error = d.message;
    } catch (e) { /* skip malformed */ }
  }

  if (error) throw new Error(error);
  if (!result) throw new Error("No result");
  return { result, allEvents };
}

// ============================================
// B1 STRUCTURAL CHECKS — TIGHTENED post-first-verification
// ============================================

const VALID_SLOTS = ["market_category", "trust_adoption", "founder_fit"];
const VALID_ARCHETYPES = ["A", "B", "C", "D", "E"];

// PATCH: tighter templating detection — catches the patterns we actually saw
// in B1 verification. The original regex caught 0/19 because it was looking
// for "[Word] is already adding" but the actual openers were "Clio dominates",
// "Existing GPOs already serve", "Habit AI is already live", "Multiple direct
// competitors like X and Y already...", etc.
//
// Heuristic: Risk 1 is "templated" if it begins with a proper noun (capital
// letter, possibly multi-word like "Habit AI" or "Counterforce Health"),
// OR with category-leader nouns ("Existing/Traditional/Major X"), OR with
// "Multiple [direct] competitors". The lead rotation rule explicitly forbids
// proper-noun openers; this detector enforces the same rule.
const TEMPLATED_OPENERS = [
  // "[ProperNoun] [verb]..." — single-word company name (Clio, Gavel, MarginEdge)
  /^[A-Z][a-z]+\s+(?:already|is\s+already|has\s+already|provides|offers|delivers|automates|dominates|serves|includes|adds|could|is|enables|allows)\b/,
  // "[ProperNoun ProperNoun] [verb]..." — multi-word (Habit AI, Counterforce Health, Habit Coach)
  /^[A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?\s+(?:already|is\s+already|has\s+already|provides|offers|delivers|automates|dominates|serves|includes|adds|could|is|live|on\s+the)\b/,
  // "Existing/Traditional/Major X already..." (category-leader phrasing)
  /^(?:Existing|Traditional|Established|Major|Leading|Top)\s+[A-Z]?\w+/,
  // "Multiple [direct] competitors..."
  /^Multiple\s+(?:direct\s+)?competitors/i,
  // "[Name1, Name2[, Name3]] could/already..."
  /^[A-Z]\w+(?:,\s+[A-Z][\w-]+){1,3}\s+(?:could|already|are|have|may|might)/,
];

// PATCH: tighter profile-attribution detection.
// Original regex looked for "your X experience/expertise/background/relationships/network"
// and cross-checked X against profile.education via SUBSTRING match. That allowed
// "your healthcare background" to pass when profile said "healthtech startup"
// (because "health" is a substring of "healthtech"). Two changes:
//   1) Capture group is wider (allows multi-word X like "healthcare and procurement").
//   2) Cross-check uses WORD-BOUNDARY tokenization on profile.education, not substring.
//      "healthtech" tokenizes to {"healthtech"}, NOT to {"health", "tech"}.
const ATTRIBUTION_TRIGGER = /\byour\s+([\w\s,&/-]+?)\s+(background|experience|expertise|knowledge|insight|relationships|network|domain expertise|industry expertise)\b/gi;

// Domain words we look for inside the captured X. If any of these appear
// in X but NOT as a stem-match in profile.education, it's a P1-S1 violation.
//
// Scope: P1-S1 cares about IDEA-APPLICATION-DOMAIN attribution (claiming
// healthcare/legal/insurance/etc. expertise without basis). Generic
// professional descriptors (software, engineering, design, sales, marketing,
// operations) are NOT P1-S1 violations — when the model says "your software
// engineering experience" for a profile saying "Staff engineer at [tech
// startup]", that's a faithful description of the profile, not a fabricated
// domain claim. Those words are intentionally excluded from this list.
const DOMAIN_WORDS = [
  "healthcare", "clinical", "medical", "hospital", "hospitals",
  "legal", "law", "judicial",
  "financial", "finance", "banking", "investment",
  "insurance", "claims",
  "procurement", "purchasing",
  "restaurant", "food", "hospitality",
  "real estate", "property",
  "construction", "hvac", "plumbing", "electrical",
  "education",
  "government", "regulatory",
];

function tokenizeProfile(profileEducation) {
  if (!profileEducation) return new Set();
  return new Set((profileEducation.toLowerCase().match(/[a-z]+/g) || []));
}

// Stem-match: returns true if `word` is a morphological variant of any token in
// `profileTokens`. Match condition: word.startsWith(token) OR token.startsWith(word),
// with both sides >= 4 chars to avoid short-word collisions (e.g. "law" inside
// "lawn"). This handles engineer↔engineering, design↔designer, claim↔claims,
// finance↔financial, hospital↔hospitals, etc., without false positives like
// "health" inside "healthtech" — neither is a prefix of the other at >=4-char
// boundaries (healthtech doesn't break to {health, tech} under tokenization,
// and "health" is not a prefix of any 4+-char standalone profile token).
function stemMatchesProfile(word, profileTokens) {
  if (!word || word.length < 4) return false;
  for (const token of profileTokens) {
    if (token.length < 4) continue;
    if (word === token) return true;
    if (word.startsWith(token) || token.startsWith(word)) return true;
  }
  return false;
}

function checkProfileAttribution(summary, profileEducation) {
  const issues = [];
  if (typeof summary !== "string" || summary.length === 0) return issues;
  const profileTokens = tokenizeProfile(profileEducation);

  let m;
  ATTRIBUTION_TRIGGER.lastIndex = 0;
  while ((m = ATTRIBUTION_TRIGGER.exec(summary)) !== null) {
    const phrase = m[1].toLowerCase().trim();
    const attributionType = m[2].toLowerCase().trim();
    // Find domain words that appear in the captured phrase
    const phraseTokens = new Set(phrase.match(/[a-z]+/g) || []);
    for (const dw of DOMAIN_WORDS) {
      const dwTokens = dw.split(/\s+/);
      const allInPhrase = dwTokens.every(t => phraseTokens.has(t));
      if (!allInPhrase) continue;
      // Domain word IS in the phrase — check via stem-match whether profile
      // contains a morphological variant of each component.
      const allStemMatchInProfile = dwTokens.every(t => stemMatchesProfile(t, profileTokens));
      if (!allStemMatchInProfile) {
        issues.push(`P1-S1: summary says "your ${phrase} ${attributionType}" but profile.education does not contain "${dw}" (or stem variant) as a standalone word`);
      }
    }
  }
  return issues;
}

function isTemplatedOpener(text) {
  if (typeof text !== "string" || text.length === 0) return false;
  const trimmed = text.trim();
  for (const pattern of TEMPLATED_OPENERS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

function checkB1Structure(failureRisks, confidenceLevel, summary, profileEducation) {
  const issues = [];
  const observations = {};

  // D1.1 — array shape
  if (!Array.isArray(failureRisks)) {
    issues.push("CRITICAL: failure_risks is not an array");
    return { issues, observations };
  }

  // D1.2 — count rule (2-4)
  observations.riskCount = failureRisks.length;
  if (failureRisks.length < 2) issues.push(`failure_risks length ${failureRisks.length} < 2 (count rule violation)`);
  if (failureRisks.length > 4) issues.push(`failure_risks length ${failureRisks.length} > 4 (count rule violation)`);

  const slotCounts = { market_category: 0, trust_adoption: 0, founder_fit: 0, _other: 0 };
  const archetypesPresent = [];
  let stringRiskFound = false;
  let missingFieldFound = false;

  for (let i = 0; i < failureRisks.length; i++) {
    const r = failureRisks[i];
    if (typeof r === "string") {
      issues.push(`Risk[${i}] is a string (old shape) — failure_risks must be objects`);
      stringRiskFound = true;
      continue;
    }
    if (typeof r !== "object" || r === null) {
      issues.push(`Risk[${i}] is not an object (got ${typeof r})`);
      continue;
    }
    if (!("slot" in r)) { issues.push(`Risk[${i}] missing slot field`); missingFieldFound = true; }
    if (!("archetype" in r)) { issues.push(`Risk[${i}] missing archetype field`); missingFieldFound = true; }
    if (!("text" in r)) { issues.push(`Risk[${i}] missing text field`); missingFieldFound = true; }

    if (r.slot !== undefined) {
      if (VALID_SLOTS.includes(r.slot)) slotCounts[r.slot]++;
      else { slotCounts._other++; issues.push(`Risk[${i}] invalid slot "${r.slot}"`); }
    }

    if ("archetype" in r) {
      if (r.slot === "founder_fit") {
        if (r.archetype === null) {
          observations.founderFitNullArchetype = true;
        } else if (!VALID_ARCHETYPES.includes(r.archetype)) {
          issues.push(`Risk[${i}] founder_fit archetype "${r.archetype}" not in A-E`);
        } else {
          archetypesPresent.push(r.archetype);
        }
      } else {
        if (r.archetype !== null) {
          issues.push(`Risk[${i}] non-founder_fit slot "${r.slot}" has non-null archetype "${r.archetype}"`);
        }
      }
    }

    if ("text" in r && (typeof r.text !== "string" || r.text.trim().length === 0)) {
      issues.push(`Risk[${i}] text empty or non-string`);
    }

    if (typeof r.text === "string") {
      if (/\b(?:slot|archetype)\b/i.test(r.text)) {
        issues.push(`Risk[${i}] text leaks internal label "slot" or "archetype": "${r.text.substring(0, 80)}..."`);
      }
      if (/\b(?:risk\s*[123])\b/i.test(r.text)) {
        issues.push(`Risk[${i}] text references "Risk 1/2/3": "${r.text.substring(0, 80)}..."`);
      }
      if (/\bSTEP\s*[12]\b/.test(r.text)) {
        issues.push(`Risk[${i}] text leaks internal label "STEP 1/2": "${r.text.substring(0, 80)}..."`);
      }
    }
  }

  observations.slotCounts = slotCounts;
  observations.archetypesPresent = archetypesPresent;
  observations.stringRiskFound = stringRiskFound;
  observations.missingFieldFound = missingFieldFound;
  observations.founderFitCount = slotCounts.founder_fit;

  // D6 — LOW handling
  if (confidenceLevel === "LOW") {
    if (slotCounts.founder_fit > 0) {
      issues.push(`LOW confidence but founder_fit slot present (${slotCounts.founder_fit} count) — sparse-input rule violation`);
    }
    if (failureRisks.length > 2) {
      issues.push(`LOW confidence but ${failureRisks.length} risks — should be 2`);
    }
    if (typeof summary === "string" && summary.length > 0) {
      const opening = summary.substring(0, 200).toLowerCase();
      const hasSpecGapOpening = /\b(without|don't|doesn't|didn't|hasn't|specify|specification|specified|unclear|missing|not (?:described|defined|stated)|too thin)\b/.test(opening);
      observations.lowSummaryOpensWithSpecGap = hasSpecGapOpening;
      if (!hasSpecGapOpening) {
        issues.push("LOW summary does not open with specification-gap framing");
      }
    }
  }

  // D7 — profile attribution scan (TIGHTENED — word-boundary, not substring)
  const profIssues = checkProfileAttribution(summary, profileEducation);
  for (const pi of profIssues) issues.push(pi);

  // D4 — templating opener detection (TIGHTENED — catches actual patterns)
  if (failureRisks.length > 0 && typeof failureRisks[0].text === "string") {
    const r1 = failureRisks[0].text.trim();
    const templated = isTemplatedOpener(r1);
    observations.risk1Templated = templated;
    observations.risk1Opening = r1.substring(0, 100);
    // ALSO flag as an issue, not just an observation — lead rotation is a hard rule
    if (templated) {
      issues.push(`Risk 1 (market_category) opens with proper noun / category-leader template: "${r1.substring(0, 80)}..."`);
    }
  }

  return { issues, observations };
}

function extractAll(result, events, test) {
  const ev = result.evaluation || {};
  const comp = result.competition || {};
  const pro = result._pro || {};

  const failureRisks = ev.failure_risks ?? [];
  const summary = ev.summary ?? "";
  const confidenceLevel = ev.confidence_level?.level ?? null;
  const profileEducation = test.profile?.education ?? "";

  const b1 = checkB1Structure(failureRisks, confidenceLevel, summary, profileEducation);

  return {
    id: test.id,
    dimension: test.dimension,
    expectArchetype: test.expectArchetype,
    purpose: test.purpose,
    pipeline: test.pipeline,
    runIndex: test.runIndex,
    idea: test.idea,
    wordCount: test.idea.trim().split(/\s+/).length,
    profile: test.profile,

    scores: {
      md: ev.market_demand?.score ?? null,
      mo: ev.monetization?.score ?? null,
      or: ev.originality?.score ?? null,
      tc: ev.technical_complexity?.score ?? null,
      overall: ev.overall_score ?? null,
    },

    confidence: {
      level: confidenceLevel,
      reason: ev.confidence_level?.reason ?? "",
    },

    summary,
    failureRisks,

    b1Issues: b1.issues,
    b1Observations: b1.observations,

    competition: {
      landscape: comp.summary ?? "",
      differentiation: comp.differentiation ?? "",
      competitors: (comp.competitors ?? []).map(c => ({
        name: c.name ?? "",
        type: c.competitor_type ?? "",
        source: c.source ?? "",
      })),
    },

    phasesCount: Array.isArray(result.phases) ? result.phases.length : 0,
    toolsCount: Array.isArray(result.tools) ? result.tools.length : 0,

    streamSteps: events
      .filter(e => e.step && (e.step.endsWith("_start") || e.step.endsWith("_done")))
      .map(e => ({ step: e.step, message: e.message ?? null })),

    _rawResult: result,
  };
}

// ============================================
// AGGREGATE ANALYSIS
// ============================================

function aggregate(results) {
  const succeeded = results.filter(r => !r.error);
  const total = results.length;
  const failed = total - succeeded.length;

  const archetypeCount = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  let totalFounderFitFires = 0;
  let totalNullCases = 0;
  let totalLowCases = 0;

  const m1Risk1Openings = [];
  let templatedCount = 0;
  let totalRisk1Checked = 0;

  const slotTotal = { market_category: 0, trust_adoption: 0, founder_fit: 0 };
  const riskCountDist = { 2: 0, 3: 0, 4: 0, other: 0 };

  const issuesByCategory = new Map();

  let profileAttributionIssues = 0;
  let lowSummarySpecGapHits = 0;

  for (const r of succeeded) {
    const obs = r.b1Observations || {};

    for (const a of (obs.archetypesPresent || [])) {
      if (a in archetypeCount) {
        archetypeCount[a]++;
        totalFounderFitFires++;
      }
    }
    if (obs.founderFitCount === 0 && r.confidence?.level !== "LOW") totalNullCases++;
    if (r.confidence?.level === "LOW") totalLowCases++;

    if (obs.slotCounts) {
      slotTotal.market_category += obs.slotCounts.market_category || 0;
      slotTotal.trust_adoption += obs.slotCounts.trust_adoption || 0;
      slotTotal.founder_fit += obs.slotCounts.founder_fit || 0;
    }

    const c = obs.riskCount;
    if (c === 2 || c === 3 || c === 4) riskCountDist[c]++;
    else riskCountDist.other++;

    if (typeof obs.risk1Templated === "boolean") {
      totalRisk1Checked++;
      if (obs.risk1Templated) templatedCount++;
    }

    if (r.id.startsWith("M1-r")) {
      m1Risk1Openings.push({ id: r.id, opening: obs.risk1Opening ?? "" });
    }

    for (const issue of (r.b1Issues || [])) {
      const cat = issue.split(":")[0] || issue.substring(0, 30);
      issuesByCategory.set(cat, (issuesByCategory.get(cat) || 0) + 1);
      if (/^P1-S1/.test(issue)) profileAttributionIssues++;
    }

    if (obs.lowSummaryOpensWithSpecGap === true) lowSummarySpecGapHits++;
  }

  const archetypeMatches = [];
  for (const r of succeeded) {
    if (!r.expectArchetype) continue;
    const observed = (r.b1Observations?.archetypesPresent || [])[0] || null;
    archetypeMatches.push({
      id: r.id,
      expected: r.expectArchetype,
      observed,
      match: observed === r.expectArchetype,
    });
  }

  const matIntRuns = succeeded.filter(r => r.id.startsWith("MAT1-intermediate-r"));
  const mat2BegRuns = succeeded.filter(r => r.id.startsWith("MAT2-beginner-r"));
  const sp1Runs = succeeded.filter(r => r.id.startsWith("SP1-r"));

  return {
    total, succeeded: succeeded.length, failed,
    archetypeCount,
    archetypesNeverFired: Object.keys(archetypeCount).filter(a => archetypeCount[a] === 0),
    totalFounderFitFires,
    totalNullCases,
    totalLowCases,
    slotTotal,
    riskCountDist,
    templatedCount,
    totalRisk1Checked,
    templatedPct: totalRisk1Checked > 0 ? (100 * templatedCount / totalRisk1Checked).toFixed(1) : "n/a",
    m1Risk1Openings,
    archetypeMatches,
    profileAttributionIssues,
    lowSummarySpecGapHits,
    issuesByCategory: [...issuesByCategory.entries()].sort((a, b) => b[1] - a[1]),
    matIntRuns: matIntRuns.map(r => ({ id: r.id, risk1: r.b1Observations?.risk1Opening, slots: (r.failureRisks || []).map(x => x.slot).join(",") })),
    mat2BegRuns: mat2BegRuns.map(r => ({ id: r.id, risk1: r.b1Observations?.risk1Opening, slots: (r.failureRisks || []).map(x => x.slot).join(",") })),
    sp1Runs: sp1Runs.map(r => ({ id: r.id, summaryOpens: r.b1Observations?.lowSummaryOpensWithSpecGap, riskCount: r.b1Observations?.riskCount, summary100: (r.summary || "").substring(0, 200) })),
  };
}

// ============================================
// MARKDOWN REPORT
// ============================================

function generateReport(results, agg) {
  const lines = [];
  const L = (s = "") => lines.push(s);

  L("# B1 Verification Report — V4S28 Bundle B1 (post-patch)");
  L("");
  L(`Generated: ${new Date().toISOString()}`);
  L(`Detector version: tightened (post-first-verification)`);
  L("");

  L("## Verification Summary");
  L("");
  L(`- Total runs: ${agg.total}`);
  L(`- Succeeded: ${agg.succeeded}`);
  L(`- Failed: ${agg.failed}`);
  L("");

  const criticalCount = agg.issuesByCategory.find(([cat]) => /CRITICAL/i.test(cat))?.[1] ?? 0;
  L(`### D1 — failure_risks shape (every run)`);
  L("");
  if (criticalCount === 0 && agg.issuesByCategory.length === 0) {
    L("**PASS** — every run produced structurally valid failure_risks with no detected issues.");
  } else if (criticalCount > 0) {
    L(`**CRITICAL FAIL** — ${criticalCount} runs had array-shape or fundamental schema failures. Review per-run details.`);
  } else {
    L(`**PARTIAL** — ${agg.issuesByCategory.length} issue categories observed across runs. Details below.`);
  }
  L("");

  L("**Issue counts by category:**");
  L("");
  if (agg.issuesByCategory.length === 0) {
    L("(none)");
  } else {
    L("| Category | Count |");
    L("| --- | --- |");
    for (const [cat, count] of agg.issuesByCategory) {
      L(`| ${cat} | ${count} |`);
    }
  }
  L("");

  L(`**Slot distribution:** market_category=${agg.slotTotal.market_category}, trust_adoption=${agg.slotTotal.trust_adoption}, founder_fit=${agg.slotTotal.founder_fit}`);
  L("");
  L(`**Risk count distribution:** 2-risk=${agg.riskCountDist[2]}, 3-risk=${agg.riskCountDist[3]}, 4-risk=${agg.riskCountDist[4]}, other=${agg.riskCountDist.other}`);
  L("");

  L("### D2 — Archetype A-E Coverage");
  L("");
  L("| Archetype | Times fired |");
  L("| --- | --- |");
  for (const a of ["A", "B", "C", "D", "E"]) {
    L(`| ${a} | ${agg.archetypeCount[a]} |`);
  }
  L("");
  L(`Total founder_fit fires: **${agg.totalFounderFitFires}**`);
  L(`Null-Risk-3 (founder_fit dropped) cases: **${agg.totalNullCases}**`);
  L(`LOW-confidence cases: **${agg.totalLowCases}**`);
  L("");

  if (agg.archetypesNeverFired.length > 0) {
    L(`**COVERAGE GAP** — these archetypes never fired: ${agg.archetypesNeverFired.join(", ")}`);
    L(`These need authored test pairs in a future bundle. Existing seed bank does not cleanly trigger them.`);
    L("");
  }

  L("**Per-archetype expectations vs observed:**");
  L("");
  L("| Test ID | Expected | Observed | Match |");
  L("| --- | --- | --- | --- |");
  for (const m of agg.archetypeMatches) {
    L(`| ${m.id} | ${m.expected ?? "(any)"} | ${m.observed ?? "null"} | ${m.match ? "yes" : "no"} |`);
  }
  L("");

  L("### D3 — Null-Risk-3 (Profile-Fit) Cases");
  L("");
  L("Expected behavior: founder_fit slot dropped, output 2 risks total without founder_fit entries. STEP 1 PROFILE-DOMAIN MATCH should fire.");
  L("");
  const nullCases = results.filter(r => !r.error && r.dimension === "D3-null");
  L("| Test | Risks | founder_fit count | Pass |");
  L("| --- | --- | --- | --- |");
  for (const r of nullCases) {
    const ff = r.b1Observations?.founderFitCount ?? "?";
    const pass = ff === 0 ? "yes" : "no";
    L(`| ${r.id} | ${r.b1Observations?.riskCount ?? "?"} | ${ff} | ${pass} |`);
  }
  L("");

  L("### D4 — Templating Breakdown (M1 ×3)");
  L("");
  L(`Templated openers detected (tightened detector): **${agg.templatedCount} / ${agg.totalRisk1Checked}** (${agg.templatedPct}%)`);
  L(`Audit baseline ~70%. Patch target: significant reduction. Hard-rule violation if proper-noun openers persist.`);
  L("");
  L("**M1 Risk 1 openings across reruns:**");
  L("");
  for (const m of agg.m1Risk1Openings) {
    L(`- **${m.id}**: ${m.opening || "(empty)"}`);
  }
  L("");
  L("Eyeball check: are the three openings using DIFFERENT structural lenses (saturation / cold-start / retention dynamics), and avoiding proper-noun first words?");
  L("");

  L("### D5 — Lead Rotation Across Reruns");
  L("");
  L("**MAT1-intermediate (×2):**");
  L("");
  for (const r of agg.matIntRuns) {
    L(`- **${r.id}** [slots: ${r.slots}]`);
    L(`  Risk 1: ${r.risk1 || "(empty)"}`);
  }
  L("");
  L("**MAT2-beginner (×2):**");
  L("");
  for (const r of agg.mat2BegRuns) {
    L(`- **${r.id}** [slots: ${r.slots}]`);
    L(`  Risk 1: ${r.risk1 || "(empty)"}`);
  }
  L("");

  L("### D6 — Sparse-Input LOW Handling");
  L("");
  L("Expected: founder_fit dropped, 2 risks, summary opens with spec-gap framing.");
  L("");
  L(`LOW summaries opening with spec-gap framing: ${agg.lowSummarySpecGapHits} / ${agg.totalLowCases}`);
  L("");
  L("**SP1 runs:**");
  L("");
  for (const r of agg.sp1Runs) {
    L(`- **${r.id}**: risks=${r.riskCount}, opens-with-spec-gap=${r.summaryOpens}`);
    L(`  Summary[:200]: ${r.summary100}`);
  }
  L("");

  L("### D7 — Profile Inference (P1-S1, tightened detector)");
  L("");
  L(`Profile attribution issues detected (word-boundary tokenization): **${agg.profileAttributionIssues}**`);
  L("");
  L("Per-run summary excerpts for D7-tagged runs:");
  L("");
  for (const r of results.filter(r => !r.error && r.dimension === "D7-profile-inference")) {
    L(`- **${r.id}**`);
    L(`  Profile.education: "${r.profile.education}"`);
    L(`  Summary[:300]: ${(r.summary || "").substring(0, 300)}`);
    L("");
  }

  L("---");
  L("");

  L("## Per-Run Details");
  L("");

  for (const r of results) {
    L(`### ${r.id} — ${r.dimension}`);
    L("");
    if (r.error) {
      L(`**FAILED:** ${r.error}`);
      L("");
      continue;
    }

    L(`**Pipeline:** ${r.pipeline}  |  **Run #:** ${r.runIndex}  |  **Confidence:** ${r.confidence.level}`);
    L(`**Purpose:** ${r.purpose}`);
    L("");
    L(`**Profile:**`);
    L(`- coding: ${r.profile.coding}`);
    L(`- ai: ${r.profile.ai}`);
    L(`- education: ${r.profile.education}`);
    L("");
    L(`**Scores:** MD=${r.scores.md}, MO=${r.scores.mo}, OR=${r.scores.or}, TC=${r.scores.tc}, Overall=${r.scores.overall}`);
    L("");

    L("**B1 issues:**");
    if (r.b1Issues.length === 0) {
      L("(none — structurally clean)");
    } else {
      for (const issue of r.b1Issues) L(`- ${issue}`);
    }
    L("");

    L("**B1 observations:**");
    L("```json");
    L(JSON.stringify(r.b1Observations, null, 2));
    L("```");
    L("");

    L("**Summary:**");
    L("");
    L(r.summary || "(empty)");
    L("");

    L("**Failure risks:**");
    L("```json");
    L(JSON.stringify(r.failureRisks, null, 2));
    L("```");
    L("");

    L("---");
    L("");
  }

  return lines.join("\n");
}

// ============================================
// PREFLIGHT
// ============================================

async function preflight() {
  process.stdout.write("Preflight: pinging server… ");
  try {
    const res = await fetch(BASE_URL + "/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: "ping", profile: { coding: "Beginner", ai: "Some AI experience", education: "Test" } }),
    });
    if (res.ok || res.status === 400 || res.status === 500) {
      console.log("server reachable.");
      return true;
    }
    console.log(`unexpected status ${res.status}.`);
    return false;
  } catch (e) {
    console.log(`UNREACHABLE — ${e.message}`);
    console.log("Make sure 'npm run dev' is running on localhost:3000 before launching this script.");
    return false;
  }
}

// ============================================
// MAIN
// ============================================

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function main() {
  const total = TESTS.length;
  let done = 0;
  const results = [];
  const rawStreaming = [];

  console.log("=".repeat(80));
  console.log("V4S28 BUNDLE B1 — TARGETED VERIFICATION RUN (post-patch)");
  console.log(`${total} runs (${TESTS.filter(t => t.pipeline === "PRO").length} Deep, ${TESTS.filter(t => t.pipeline === "FREE").length} Standard)`);
  console.log(`Estimated wall time: ~${Math.round(total * 50 / 60)}-${Math.round(total * 75 / 60)} minutes`);
  console.log("=".repeat(80) + "\n");

  if (!(await preflight())) process.exit(1);

  const runStart = Date.now();

  for (const test of TESTS) {
    done++;
    const t0 = Date.now();
    process.stdout.write(`[${String(done).padStart(2, " ")}/${total}] ${test.id.padEnd(34)} `);

    try {
      const { result, allEvents } = await runEval(test);
      const data = extractAll(result, allEvents, test);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      results.push(data);
      rawStreaming.push({ id: test.id, events: allEvents });

      const s = data.scores;
      const issueCount = data.b1Issues.length;
      const issueTag = issueCount === 0 ? "✓" : `⚠ ${issueCount}`;
      console.log(`${elapsed}s  MD${s.md} MO${s.mo} OR${s.or} TC${s.tc} [${data.confidence.level}] risks=${data.failureRisks.length} ${issueTag}`);
    } catch (e) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`FAILED (${elapsed}s) — ${e.message}`);
      results.push({ id: test.id, dimension: test.dimension, pipeline: test.pipeline, error: e.message });
    }
  }

  const totalElapsed = ((Date.now() - runStart) / 60000).toFixed(1);

  console.log("\n" + "=".repeat(80));
  console.log(`All runs complete in ${totalElapsed} minutes. Aggregating + writing outputs…`);
  console.log("=".repeat(80));

  const agg = aggregate(results);
  const stamp = timestamp();

  const rawPath = path.join(OUTPUT_DIR, `b1-${stamp}-raw.json`);
  fs.writeFileSync(rawPath, JSON.stringify(results, null, 2));
  console.log(`  ✓ ${rawPath} (${Math.round(fs.statSync(rawPath).size / 1024)} KB)`);

  const streamPath = path.join(OUTPUT_DIR, `b1-${stamp}-streaming.json`);
  fs.writeFileSync(streamPath, JSON.stringify(rawStreaming, null, 2));
  console.log(`  ✓ ${streamPath} (${Math.round(fs.statSync(streamPath).size / 1024)} KB)`);

  const reportPath = path.join(OUTPUT_DIR, `b1-${stamp}-report.md`);
  fs.writeFileSync(reportPath, generateReport(results, agg));
  console.log(`  ✓ ${reportPath} (${Math.round(fs.statSync(reportPath).size / 1024)} KB)`);

  console.log("\n" + "=".repeat(80));
  console.log("B1 VERIFICATION VERDICT");
  console.log("=".repeat(80));

  const totalIssues = agg.issuesByCategory.reduce((s, [, n]) => s + n, 0);
  console.log(`  Total runs: ${agg.total}`);
  console.log(`  Succeeded: ${agg.succeeded}`);
  console.log(`  Failed: ${agg.failed}`);
  console.log(`  Total B1 structural issues: ${totalIssues}`);
  console.log(`  Archetypes that fired: ${Object.entries(agg.archetypeCount).filter(([, n]) => n > 0).map(([a, n]) => `${a}=${n}`).join(", ") || "none"}`);
  if (agg.archetypesNeverFired.length > 0) {
    console.log(`  Archetypes that never fired: ${agg.archetypesNeverFired.join(", ")}`);
  }
  console.log(`  Templating rate: ${agg.templatedPct}% (${agg.templatedCount}/${agg.totalRisk1Checked})`);
  console.log(`  Profile attribution issues (P1-S1): ${agg.profileAttributionIssues}`);
  console.log(`  LOW summaries opening with spec-gap: ${agg.lowSummarySpecGapHits}/${agg.totalLowCases}`);
  console.log(`\n  Open ${reportPath} for full details.`);
}

main().catch(err => {
  console.error("\nFATAL:", err.message);
  console.error(err.stack);
  process.exit(1);
});
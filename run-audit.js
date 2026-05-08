// ============================================
// IDEALOOP CORE — CONTENT AUDIT TEST HARNESS
// V4 Session 27 (April 16, 2026)
// ============================================
//
// 35 runs across 7 audit lanes:
//   Lane A — Score-band spread (highs 4, mids 4, lows 2, structural 1)    = 11
//   Lane B — Archetype stressors (wrapper, marketplace, regulated)          = 3
//   Lane C — Boundary cases (genuinely ambiguous)                           = 3
//   Lane D — Repetition cluster (pro-services AI, divergent domains)       = 3
//   Lane E — Profile matrices (3 ideas x 3 profiles)                        = 9
//   Lane F — Free/Pro side check (4 Deep ideas re-run through Standard)    = 4
//   Lane G — Trust-surface tests (sparse + messy dump)                     = 2
//
// Captures full raw JSON per run + pre-organized section-by-section markdown
// for audit workflow.
//
// Usage:
//   node run-audit.js
//   (server must be running at localhost:3000)
//
// Output:
//   audit-raw.json           — every field from every run, nothing truncated
//   audit-sections.md        — organized section-by-section across all runs
//   audit-streaming.json     — SSE stream events (for keyword-expansion trust test)
//
// ============================================

const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = __dirname;

// ============================================
// IDEA SET — 35 RUNS
// ============================================
// Each entry: { id, lane, purpose, pipeline, idea, profile, matrixGroup? }

const TESTS = [
  // ─────────────────────────────────────────
  // LANE A — SCORE-BAND SPREAD (Deep)
  // ─────────────────────────────────────────

  // HIGHS (target 7-9)
  { id: "H1", lane: "A-high", pipeline: "PRO",
    purpose: "High-value, regulated, domain-native founder. Tests 'best case' output.",
    profile: { coding: "Intermediate", ai: "Regular AI user", education: "Former clinical operations lead (pharma, 8 years)" },
    idea: "A platform that matches rare disease patients with active clinical trials based on their genetic markers, medical history, and geographic constraints. Patients upload their records (with consent), and the system surfaces trials they qualify for with automated outreach to coordinators. Revenue: $15-25K per enrolled patient paid by pharma sponsors struggling with recruitment costs. Built-in EHR integration via SMART on FHIR. Initial focus on oncology rare diseases where trial fill rates are under 30%." },

  { id: "H2", lane: "A-high", pipeline: "PRO",
    purpose: "Practical B2B with strong domain expert, non-elite technical. Operational/unglamorous.",
    profile: { coding: "Intermediate", ai: "Some AI experience", education: "Restaurant consultant (6 years), bootcamp grad" },
    idea: "Tool that integrates with Toast/Square POS to auto-calculate food costs per dish in real-time as vendor prices change, flags dishes that fell below margin, and suggests menu price adjustments or ingredient swaps. $99/month per location. Starts with independent restaurants (under 5 locations) where owners do menu pricing themselves." },

  { id: "H3", lane: "A-high", pipeline: "PRO",
    purpose: "Narrow-but-deep vertical. Tests specialized-niche handling.",
    profile: { coding: "Intermediate", ai: "Advanced AI user (Claude + Copilot daily)", education: "Patent attorney (10 years)" },
    idea: "AI transcription service for legal depositions specifically — handles multiple speakers with attorney/witness role labeling, flags objections automatically, produces exhibits-compliant transcripts. Integrates with court reporter platforms. B2B sales to law firms at $500/deposition, replacing stenographers in jurisdictions where electronic transcription is now admitted." },

  { id: "H4", lane: "A-high", pipeline: "PRO",
    purpose: "Non-coder with deep domain. Tests TC explanation for 'smart but no code' founder.",
    profile: { coding: "No coding experience", ai: "Regular AI user", education: "Former HVAC estimator (12 years), runs consulting shop" },
    idea: "Tool for electrical/HVAC/plumbing subcontractors bidding on commercial jobs. Upload the RFP and drawings, the system estimates material costs from current distributor prices, flags scope gaps, and compares against the sub's historical win rate at that bid level. Usage-based pricing ($50/bid analyzed). Sub market with subs who currently bid 3-10 jobs/week and spend 4-8 hours per bid." },

  // MIDS (target 5-7)
  { id: "M1", lane: "A-mid", pipeline: "PRO",
    purpose: "Crowded category, LLM-wrapper concern, classic real-user submission.",
    profile: { coding: "Intermediate", ai: "Regular AI user", education: "Solo indie hacker, no shipped products" },
    idea: "habit tracker app with an AI that talks to you about your progress and helps you figure out why you fell off. gamified. freemium with $9/mo for the AI coach." },

  { id: "M2", lane: "A-mid", pipeline: "PRO",
    purpose: "Real niche, specific ICP, unclear pace to scale.",
    profile: { coding: "Beginner", ai: "Some AI experience", education: "Trade association marketing director (5 years)" },
    idea: "Purpose-built newsletter platform specifically for trade associations (plumbing contractors, ag equipment dealers, etc). Native member directory integration, sponsor management, CAN-SPAM compliance built-in. $500/month flat. There are ~7,000 US trade associations and most are on Mailchimp plus duct tape." },

  { id: "M3", lane: "A-mid", pipeline: "PRO",
    purpose: "Narrow market with strong LLM-substitution risk. Tests MO calibration.",
    profile: { coding: "Intermediate", ai: "Regular AI user", education: "PhD in computational biology, non-native English" },
    idea: "AI tool specifically for non-native-English PhD students and postdocs editing their manuscripts before journal submission. Not just grammar — catches discipline-specific conventions (e.g., passive voice rules in bio papers vs active in CS). $29/month student pricing. Integration with Overleaf." },

  { id: "M4", lane: "A-mid", pipeline: "PRO",
    purpose: "Crowded marketplace ecosystem, strong domain expert.",
    profile: { coding: "Intermediate", ai: "Regular AI user", education: "Former Shopify store owner ($2M/yr, sold)" },
    idea: "Shopify app that uses sales history + seasonal patterns + lead times to tell small-to-mid sellers exactly when to reorder each SKU and how many units. Prevents stockouts and over-ordering. $49-199/month tiered by SKU count." },

  // LOWS (target 3-5)
  { id: "L1", lane: "A-low", pipeline: "PRO",
    purpose: "LLM wrapper, commoditized pattern, free substitutes. Tests honest hard-news delivery.",
    profile: { coding: "Beginner", ai: "Regular AI user", education: "MBA student, first-time founder" },
    idea: "Text an AI nutrition coach every day with what you ate and it tells you if you're on track with your goals. Subscription $19/month. Think of it like having a dietitian in your pocket." },

  { id: "L2", lane: "A-low", pipeline: "PRO",
    purpose: "Two-sided marketplace cold-start, commoditized alternative.",
    profile: { coding: "No coding experience", ai: "Some AI experience", education: "Former elementary school principal" },
    idea: "Marketplace app where retired teachers list themselves as tutors and parents book hourly sessions. Take 15% commission. Starting in Boston where there's a big retired-teacher population." },

  // STRUCTURAL FLAWS (target <3)
  { id: "S2", lane: "A-struct", pipeline: "PRO",
    purpose: "Gig-marketplace unit economics failure, known category graveyard.",
    profile: { coding: "Beginner", ai: "Regular AI user", education: "Finance analyst looking to leave banking" },
    idea: "Like Uber but for laundry. Drivers pick up your clothes, take to a partner laundromat, return the same day. $12/load. Start in NYC." },

  // ─────────────────────────────────────────
  // LANE B — ARCHETYPE STRESSORS (Deep)
  // ─────────────────────────────────────────

  { id: "A1", lane: "B-wrapper", pipeline: "PRO",
    purpose: "Thin LLM wrapper. Tests archetype identification + Risks/Roadmap specificity.",
    profile: { coding: "Beginner", ai: "Regular AI user", education: "Career coach" },
    idea: "Upload your resume, AI reviews it and gives feedback specific to the role you're targeting. $12 per review or $29/month unlimited." },

  { id: "A2", lane: "B-marketplace", pipeline: "PRO",
    purpose: "Marketplace done right — tests 'tailwind + verification wedge' vs generic cold-start reflex.",
    profile: { coding: "Intermediate", ai: "Some AI experience", education: "Former home care agency operator, Bubble/Airtable builder" },
    idea: "Marketplace for seniors (and their adult children) to book verified, background-checked handymen for small home repairs. Verification includes insurance and references. Take 20% commission. Focus on suburban markets where Angi has weak coverage." },

  { id: "A3", lane: "B-regulated", pipeline: "PRO",
    purpose: "Regulated domain, controlled substance, payer complexity. Tests regulatory risk surfacing.",
    profile: { coding: "Beginner", ai: "Some AI experience", education: "Harm reduction researcher, MPH, 4 years state public health" },
    idea: "Telehealth platform for medication-assisted treatment (MAT) for opioid use disorder. Licensed physicians prescribe buprenorphine via video visits. Accepts Medicaid in states that cover MAT telehealth. $250/visit billed to insurance." },

  // ─────────────────────────────────────────
  // LANE C — BOUNDARY CASES (Deep)
  // ─────────────────────────────────────────

  { id: "B1", lane: "C-boundary", pipeline: "PRO",
    purpose: "Genuinely ambiguous — real niche, unclear urgency. Tests nuance vs mushiness in Summary.",
    profile: { coding: "No coding experience", ai: "Some AI experience", education: "Line producer (indie film, 8 years), Notion power user" },
    idea: "Project management for indie film productions (budget $500K-$5M). Tracks shoot schedules, location releases, SAG compliance, crew call sheets, all in one tool. Existing solutions are enterprise (Movie Magic) or generic (Asana). $199/month per active production." },

  { id: "B2", lane: "C-boundary", pipeline: "PRO",
    purpose: "Real pain, proven willingness, brutal sales cycle + commoditization pressure.",
    profile: { coding: "Intermediate", ai: "Regular AI user", education: "Former city councilmember (2 terms), now digital transformation consultant" },
    idea: "Small cities (under 100K population) deploy an AI chatbot on their city website that answers resident questions by ingesting the city's own documents. $8K/year flat fee. Sales cycle 6-9 months, $5K in services to onboard. 19,500 US cities in this size range." },

  { id: "B3", lane: "C-boundary", pipeline: "PRO",
    purpose: "Ego-loaded founder-dogfoods-own-idea case. Small audience, free alternatives.",
    profile: { coding: "Intermediate", ai: "Regular AI user", education: "Twice-failed founder, active in indie hacker communities" },
    idea: "App for indie hackers building their first startup. You're matched into accountability pods of 3-5 people shipping similar-stage projects. Weekly video check-ins, shared milestones, peer critique. $15/month." },

  // ─────────────────────────────────────────
  // LANE D — REPETITION CLUSTER (Deep)
  // Structurally similar (AI tool + professional services + integration + niche buyer)
  // but divergent in domain, pricing model, and integration story.
  // ─────────────────────────────────────────

  { id: "R1", lane: "D-cluster", pipeline: "PRO",
    purpose: "Cluster 1/3: dental vertical, flat subscription, practice management software integration.",
    profile: { coding: "Beginner", ai: "Regular AI user", education: "Dental office manager (9 years)" },
    idea: "AI tool that handles dental patient intake — pre-appointment forms, insurance verification, dental history collection. Integrates with Dentrix and Open Dental. Reduces front-desk workload by 40%. $199/month per practice." },

  { id: "R2", lane: "D-cluster", pipeline: "PRO",
    purpose: "Cluster 2/3: legal vertical, per-transaction pricing, document storage integration.",
    profile: { coding: "Intermediate", ai: "Some AI experience", education: "BD director at mid-size law firm (7 years), Airtable power user" },
    idea: "AI-powered bid response assistant for law firms pitching on corporate RFPs. Drafts initial proposal responses by analyzing the RFP document against firm capabilities and case history. $400 per bid processed or $2K/month unlimited. Integrates with Clio document storage." },

  { id: "R3", lane: "D-cluster", pipeline: "PRO",
    purpose: "Cluster 3/3: accounting vertical, usage-based pricing, tax software integration.",
    profile: { coding: "No coding experience", ai: "Some AI experience", education: "Senior accountant at 15-person firm (9 years), Excel/Zapier builder" },
    idea: "AI review assistant for small accounting firms during tax season. Auto-reviews completed 1040s flagging likely errors (math, schedule inconsistencies, common missed deductions) before senior CPA review. Usage-based: $2 per return reviewed. Integrates with Drake, UltraTax, and Lacerte." },

  // ─────────────────────────────────────────
  // LANE E — PROFILE MATRICES (Deep)
  // ─────────────────────────────────────────

  // MATRIX 1 — Technically-buildable workflow, profile should matter a LOT
  { id: "MAT1-beginner", lane: "E-matrix", matrixGroup: "MAT1", pipeline: "PRO",
    purpose: "Matrix 1 / beginner. TC should be HIGH. Roadmap Phase 1 should be no-code-first.",
    profile: { coding: "No coding experience", ai: "Some AI experience", education: "Paralegal (6 years), Airtable builder" },
    idea: "AI-powered document automation tool for small law firms (under 20 attorneys). Ingests client intake forms, generates draft engagement letters, retainer agreements, and client memos based on firm templates. Integrates with Clio. $299/month per firm." },

  { id: "MAT1-intermediate", lane: "E-matrix", matrixGroup: "MAT1", pipeline: "PRO",
    purpose: "Matrix 1 / intermediate. TC should be MEDIUM. Roadmap should assume bootcamp-level build.",
    profile: { coding: "Intermediate", ai: "Regular AI user", education: "Paralegal (6 years), bootcamp grad, shipped personal project" },
    idea: "AI-powered document automation tool for small law firms (under 20 attorneys). Ingests client intake forms, generates draft engagement letters, retainer agreements, and client memos based on firm templates. Integrates with Clio. $299/month per firm." },

  { id: "MAT1-senior", lane: "E-matrix", matrixGroup: "MAT1", pipeline: "PRO",
    purpose: "Matrix 1 / senior. TC should be LOW. Roadmap should architect-first.",
    profile: { coding: "Advanced", ai: "Advanced AI user (fine-tuning LLMs)", education: "Staff engineer at LegalTech company (5 years, doc automation features)" },
    idea: "AI-powered document automation tool for small law firms (under 20 attorneys). Ingests client intake forms, generates draft engagement letters, retainer agreements, and client memos based on firm templates. Integrates with Clio. $299/month per firm." },

  // MATRIX 2 — Services-heavy, tests anti-overweighting (profile should matter LESS for execution)
  { id: "MAT2-beginner", lane: "E-matrix", matrixGroup: "MAT2", pipeline: "PRO",
    purpose: "Matrix 2 / beginner. Services-heavy — tech skill isn't the bottleneck.",
    profile: { coding: "No coding experience", ai: "Some AI experience", education: "Former small-business owner (dealt with claim denials personally)" },
    idea: "Concierge service that handles all insurance claim disputes for small businesses (under 50 employees). Success fee of 25% on recovered claims. Starting with denied health insurance claims for employee medical expenses. Done-with-you model: we handle paperwork, customer provides documents." },

  { id: "MAT2-intermediate", lane: "E-matrix", matrixGroup: "MAT2", pipeline: "PRO",
    purpose: "Matrix 2 / intermediate. Domain-heavy background dominates profile.",
    profile: { coding: "Beginner", ai: "Regular AI user", education: "Insurance claims adjuster (10 years), learning to code" },
    idea: "Concierge service that handles all insurance claim disputes for small businesses (under 50 employees). Success fee of 25% on recovered claims. Starting with denied health insurance claims for employee medical expenses. Done-with-you model: we handle paperwork, customer provides documents." },

  { id: "MAT2-senior", lane: "E-matrix", matrixGroup: "MAT2", pipeline: "PRO",
    purpose: "Matrix 2 / senior tech. TEST: does TC drop too much? Tech isn't the real bottleneck here.",
    profile: { coding: "Advanced", ai: "Advanced AI user", education: "Senior PM at healthtech company, built internal tools" },
    idea: "Concierge service that handles all insurance claim disputes for small businesses (under 50 employees). Success fee of 25% on recovered claims. Starting with denied health insurance claims for employee medical expenses. Done-with-you model: we handle paperwork, customer provides documents." },

  // MATRIX 3 — Trust/distribution-dominant (senior engineer should NOT be advantaged without domain access)
  { id: "MAT3-insider", lane: "E-matrix", matrixGroup: "MAT3", pipeline: "PRO",
    purpose: "Matrix 3 / domain insider. Has the critical asset (relationships) even without coding.",
    profile: { coding: "No coding experience", ai: "Some AI experience", education: "Former rural hospital CFO (15 years), 80+ exec relationships" },
    idea: "Platform that helps rural hospitals (under 100 beds) negotiate better rates with medical device suppliers by aggregating purchasing data across member hospitals. Members pay $24,000/year. Value prop: average 12% reduction in device spend, which pays for membership 10x over. Requires buy-in from hospital CFOs and procurement directors." },

  { id: "MAT3-tech-no-access", lane: "E-matrix", matrixGroup: "MAT3", pipeline: "PRO",
    purpose: "Matrix 3 / senior tech no access. TEST: does the system correctly flag distribution as the gap, not the build?",
    profile: { coding: "Advanced", ai: "Advanced AI user", education: "Staff engineer at healthtech startup (8 years), built procurement tools for enterprise" },
    idea: "Platform that helps rural hospitals (under 100 beds) negotiate better rates with medical device suppliers by aggregating purchasing data across member hospitals. Members pay $24,000/year. Value prop: average 12% reduction in device spend, which pays for membership 10x over. Requires buy-in from hospital CFOs and procurement directors." },

  { id: "MAT3-partial", lane: "E-matrix", matrixGroup: "MAT3", pipeline: "PRO",
    purpose: "Matrix 3 / partial domain + partial tech. Middle ground.",
    profile: { coding: "Intermediate", ai: "Regular AI user", education: "Former consultant at hospital purchasing group (3 years), now building SaaS" },
    idea: "Platform that helps rural hospitals (under 100 beds) negotiate better rates with medical device suppliers by aggregating purchasing data across member hospitals. Members pay $24,000/year. Value prop: average 12% reduction in device spend, which pays for membership 10x over. Requires buy-in from hospital CFOs and procurement directors." },

  // ─────────────────────────────────────────
  // LANE F — FREE/PRO SIDE CHECK (Standard)
  // Same idea text + profile as the Deep version, re-run through Standard.
  // IDs use "-std" suffix for easy pairing.
  // ─────────────────────────────────────────

  { id: "H2-std", lane: "F-freepro", pipeline: "FREE",
    purpose: "Pair with H2 (Deep). Check if Standard downgrades high-score confidence appropriately.",
    profile: { coding: "Intermediate", ai: "Some AI experience", education: "Restaurant consultant (6 years), bootcamp grad" },
    idea: "Tool that integrates with Toast/Square POS to auto-calculate food costs per dish in real-time as vendor prices change, flags dishes that fell below margin, and suggests menu price adjustments or ingredient swaps. $99/month per location. Starts with independent restaurants (under 5 locations) where owners do menu pricing themselves." },

  { id: "M1-std", lane: "F-freepro", pipeline: "FREE",
    purpose: "Pair with M1 (Deep). Check if Standard surfaces crowded-market risk without packet evidence.",
    profile: { coding: "Intermediate", ai: "Regular AI user", education: "Solo indie hacker, no shipped products" },
    idea: "habit tracker app with an AI that talks to you about your progress and helps you figure out why you fell off. gamified. freemium with $9/mo for the AI coach." },

  { id: "S2-std", lane: "F-freepro", pipeline: "FREE",
    purpose: "Pair with S2 (Deep). Check if Standard delivers hard news as honestly as Deep does.",
    profile: { coding: "Beginner", ai: "Regular AI user", education: "Finance analyst looking to leave banking" },
    idea: "Like Uber but for laundry. Drivers pick up your clothes, take to a partner laundromat, return the same day. $12/load. Start in NYC." },

  { id: "A1-std", lane: "F-freepro", pipeline: "FREE",
    purpose: "Pair with A1 (Deep). Check if Standard correctly identifies wrapper pattern.",
    profile: { coding: "Beginner", ai: "Regular AI user", education: "Career coach" },
    idea: "Upload your resume, AI reviews it and gives feedback specific to the role you're targeting. $12 per review or $29/month unlimited." },

  // ─────────────────────────────────────────
  // LANE G — TRUST-SURFACE TESTS (Deep)
  // ─────────────────────────────────────────

  { id: "SP1", lane: "G-trust", pipeline: "PRO",
    purpose: "SPARSE INPUT. Watch streaming keyword expansion. Check for fabricated specifics in Roadmap/Risks.",
    profile: { coding: "Beginner", ai: "No AI experience", education: "Dentist" },
    idea: "tool for dentists to save time" },

  { id: "MD1", lane: "G-trust", pipeline: "PRO",
    purpose: "MESSY FOUNDER DUMP. Self-contradicting scope. Tests Summary nuance vs fake coherence; Roadmap wedge discipline.",
    profile: { coding: "Intermediate", ai: "Some AI experience", education: "Freelance UX designer (4 years)" },
    idea: "ok so i've been thinking about this for a while. i'm a freelance ux designer and everyone i know has the same problem where you do work, the client loves it, then payment takes forever. i want to build something that fixes this but also maybe could be a full platform for freelancers to manage everything. like invoices, contracts, tracking hours, maybe client portals too. i'm not sure if i should focus on just the payment thing or build the whole platform. i know there are other freelancer tools out there but they all suck honestly or they're way too expensive for solo people. maybe pricing it at like $15/month? i could probably get some of my designer friends to try it. the AI angle could be that it automates the annoying parts like writing payment reminders and contracts. tbh i haven't fully figured out what the MVP should be, i just know the problem is real." },
];

// ============================================
// SSE RUNNER — captures ALL events, not just "complete"
// ============================================

async function runEval(idea, profile, pipeline) {
  const ep = pipeline === "PRO" ? "/api/analyze-pro" : "/api/analyze";
  const res = await fetch(BASE_URL + ep, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea, profile }),
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
// EXTRACTION — capture everything, leave nothing behind
// ============================================

function extractAll(result, events, test) {
  const ev = result.evaluation || {};
  const comp = result.competition || {};
  const pro = result._pro || {};

  // Liberal extraction — grab everything, let the audit decide what matters
  return {
    // Meta
    id: test.id,
    lane: test.lane,
    matrixGroup: test.matrixGroup || null,
    pipeline: test.pipeline,
    purpose: test.purpose,
    idea: test.idea,
    wordCount: test.idea.trim().split(/\s+/).length,
    profile: test.profile,

    // Scores
    scores: {
      md: ev.market_demand?.score ?? null,
      mo: ev.monetization?.score ?? null,
      or: ev.originality?.score ?? null,
      tc: ev.technical_complexity?.score ?? null,
      overall: ev.overall_score ?? null,
    },

    // Confidence
    confidence: {
      level: ev.confidence_level?.level ?? null,
      reason: ev.confidence_level?.reason ?? "",
    },

    // Metric explanations (full text)
    metricExplanations: {
      md: ev.market_demand?.explanation ?? "",
      mo: ev.monetization?.explanation ?? "",
      or: ev.originality?.explanation ?? "",
      tc: ev.technical_complexity?.explanation ?? "",
      tcBase: ev.technical_complexity?.base_score_explanation ?? "",
      tcAdjustment: ev.technical_complexity?.adjustment_explanation ?? "",
      tcIncrementalNote: ev.technical_complexity?.incremental_note ?? "",
    },

    // Metric side-notes (may or may not exist depending on prompt version)
    metricNotes: {
      mdGeographic: ev.market_demand?.geographic_note ?? "",
      mdTrajectory: ev.market_demand?.trajectory_note ?? "",
      marketplaceNote: ev.marketplace_note ?? "",
    },

    // Classification / flags
    classification: result.classification ?? "",
    scopeWarning: result.scope_warning ?? false,
    domainFlags: pro.domain_risk_flags ?? {},

    // Summary + risks
    summary: ev.summary ?? "",
    failureRisks: ev.failure_risks ?? [],

    // Competition + landscape
    competition: {
      landscape: comp.landscape_analysis ?? comp.summary ?? "",
      differentiation: comp.differentiation ?? "",
      entryBarriers: comp.entry_barriers ?? "",
      competitors: (comp.competitors ?? []).map(c => ({
        name: c.name ?? "",
        type: c.competitor_type ?? "",
        source: c.source ?? "",
        evidenceStrength: c.evidence_strength ?? "",
        description: c.description ?? "",
        url: c.url ?? "",
      })),
    },

    // Roadmap / phases — try multiple field locations since the API may vary
    phases: result.phases ?? result.roadmap ?? ev.phases ?? [],

    // Tools
    tools: result.tools ?? ev.tools ?? [],

    // Estimates / Execution Reality
    estimates: result.estimates ?? ev.estimates ?? {
      duration: ev.duration ?? result.duration ?? "",
      difficulty: ev.difficulty ?? result.difficulty ?? "",
      explanation: ev.execution_explanation ?? result.execution_explanation ?? "",
    },

    // Evidence packets (PRO only — Deep Analysis)
    evidencePackets: pro.evidence_packets ?? null,

    // SSE streaming events — all of them, for trust-surface / keyword-expansion analysis
    streamEvents: events.map(e => ({
      step: e.step ?? null,
      message: e.message ?? null,
      keywords: e.keywords ?? e.data?.keywords ?? null,
      searchTerms: e.search_terms ?? e.data?.search_terms ?? null,
      // Anything else that comes through — keep the whole event for forensic analysis
      raw: JSON.stringify(e).length < 5000 ? e : "(truncated — too large)",
    })),

    // Full raw response (safety net — if anything was missed above, it's still here)
    _rawResult: result,
  };
}

// ============================================
// MARKDOWN GENERATION — pre-organized by SECTION across ideas
// This is the main audit artifact — organized for section-by-section review
// ============================================

function generateMarkdown(results) {
  const lines = [];

  const header = (n, txt) => lines.push("\n" + "#".repeat(n) + " " + txt + "\n");
  const para = (txt) => lines.push(txt);
  const hr = () => lines.push("\n---\n");

  const ideaHeader = (r) => {
    const pVals = [r.profile.coding, r.profile.ai, r.profile.education].filter(Boolean).join(" / ");
    return `**${r.id}** (${r.lane}, ${r.pipeline}) — MD ${r.scores.md} / MO ${r.scores.mo} / OR ${r.scores.or} / TC ${r.scores.tc} / **Overall ${r.scores.overall}** — Conf: ${r.confidence.level}\n\n*Profile: ${pVals}*\n\n*Idea:* ${r.idea.length > 200 ? r.idea.substring(0, 200) + "…" : r.idea}\n\n*Purpose:* ${r.purpose}`;
  };

  // Report header
  lines.push("# IdeaLoop Core — Content Audit Raw Output");
  lines.push(`\nGenerated: ${new Date().toISOString()}\nRuns: ${results.length}\n`);
  lines.push("\nThis file is organized **by section across all ideas** so the audit can walk through one section at a time. For per-idea full output, see `audit-raw.json`.\n");

  // ═══════════════════════════════════════
  // LANE INDEX
  // ═══════════════════════════════════════
  header(2, "Test Index");
  lines.push("| ID | Lane | Pipeline | MD | MO | OR | TC | Overall | Conf |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    lines.push(`| ${r.id} | ${r.lane} | ${r.pipeline} | ${r.scores.md} | ${r.scores.mo} | ${r.scores.or} | ${r.scores.tc} | **${r.scores.overall}** | ${r.confidence.level} |`);
  }

  hr();

  // ═══════════════════════════════════════
  // SECTION 1 — SUMMARY (the verdict)
  // ═══════════════════════════════════════
  header(2, "Section 1 — Summary (the verdict)");
  para("**Audit lens:** A Purpose, B Differentiation, C Actionability, D Score-band sensitivity, E Sparse input, F Free/Pro, G Length, H Repetitiveness, I Profile (subtle shift), J Promise alignment.\n");
  para("**Decision:** Keep / compress / rewrite / merge / split / remove.\n");
  for (const r of results) {
    hr();
    para(ideaHeader(r));
    para("\n**Summary:**\n\n" + (r.summary || "(empty)"));
  }

  hr();

  // ═══════════════════════════════════════
  // SECTION 2 — MD explanation
  // ═══════════════════════════════════════
  header(2, "Section 2 — Market Demand (MD) explanation");
  para("**Audit lens:** should STAY CONSTANT across profiles (I = negative control).\n");
  for (const r of results) {
    hr();
    para(ideaHeader(r));
    para("\n**MD explanation:**\n\n" + (r.metricExplanations.md || "(empty)"));
    if (r.metricNotes.mdGeographic) para("\n*Geographic note:* " + r.metricNotes.mdGeographic);
    if (r.metricNotes.mdTrajectory) para("\n*Trajectory note:* " + r.metricNotes.mdTrajectory);
  }

  hr();

  // ═══════════════════════════════════════
  // SECTION 3 — MO explanation
  // ═══════════════════════════════════════
  header(2, "Section 3 — Monetization (MO) explanation");
  para("**Audit lens:** should STAY CONSTANT across profiles.\n");
  for (const r of results) {
    hr();
    para(ideaHeader(r));
    para("\n**MO explanation:**\n\n" + (r.metricExplanations.mo || "(empty)"));
  }

  hr();

  // ═══════════════════════════════════════
  // SECTION 4 — OR explanation
  // ═══════════════════════════════════════
  header(2, "Section 4 — Originality (OR) explanation");
  para("**Audit lens:** should STAY CONSTANT across profiles.\n");
  for (const r of results) {
    hr();
    para(ideaHeader(r));
    para("\n**OR explanation:**\n\n" + (r.metricExplanations.or || "(empty)"));
  }

  hr();

  // ═══════════════════════════════════════
  // SECTION 5 — TC explanation (profile-sensitive)
  // ═══════════════════════════════════════
  header(2, "Section 5 — Technical Complexity (TC) explanation");
  para("**Audit lens:** should SHIFT STRONGLY with profile. Matrix runs (MAT1-*, MAT2-*, MAT3-*) are the primary evidence.\n");
  for (const r of results) {
    hr();
    para(ideaHeader(r));
    para("\n**TC explanation:** " + (r.metricExplanations.tc || "(empty)"));
    if (r.metricExplanations.tcBase) para("\n**TC base:** " + r.metricExplanations.tcBase);
    if (r.metricExplanations.tcAdjustment) para("\n**TC adjustment:** " + r.metricExplanations.tcAdjustment);
    if (r.metricExplanations.tcIncrementalNote) para("\n**TC incremental note:** " + r.metricExplanations.tcIncrementalNote);
  }

  hr();

  // ═══════════════════════════════════════
  // SECTION 6 — Confidence level
  // ═══════════════════════════════════════
  header(2, "Section 6 — Confidence Level");
  para("**Audit lens:** Earns-its-place candidate. Does visible confidence add decision value or is it decorative?\n");
  for (const r of results) {
    hr();
    para(ideaHeader(r));
    para(`\n**Level:** ${r.confidence.level}\n\n**Reason:** ${r.confidence.reason || "(empty)"}`);
  }

  hr();

  // ═══════════════════════════════════════
  // SECTION 7 — Key Risks
  // ═══════════════════════════════════════
  header(2, "Section 7 — Key Risks");
  para("**Audit lens:** actionability, sharpness vs hedging, profile-sensitivity (mixed: execution risks should shift, market risks should stay).\n");
  for (const r of results) {
    hr();
    para(ideaHeader(r));
    const risks = r.failureRisks.length ? r.failureRisks : [];
    if (risks.length === 0) {
      para("\n(no risks)");
    } else {
      para("");
      risks.forEach((risk, i) => para(`${i + 1}. ${risk}`));
    }
  }

  hr();

  // ═══════════════════════════════════════
  // SECTION 8 — Roadmap / Phases
  // ═══════════════════════════════════════
  header(2, "Section 8 — Roadmap / Phases");
  para("**Audit lens:** structure, actionability, score-band sensitivity, profile-sensitivity (strong shift expected in matrix groups).\n");
  for (const r of results) {
    hr();
    para(ideaHeader(r));
    const phases = Array.isArray(r.phases) ? r.phases : [];
    if (phases.length === 0) {
      para("\n(no phases captured — check _rawResult in JSON)");
    } else {
      phases.forEach((p, i) => {
        const phaseNum = p.phase ?? p.number ?? i + 1;
        const phaseTitle = p.title ?? p.name ?? "Phase " + phaseNum;
        para(`\n**Phase ${phaseNum} — ${phaseTitle}**\n`);
        if (p.description) para(p.description);
        if (p.summary) para(p.summary);
        if (p.details) para(p.details);
        if (Array.isArray(p.tasks)) p.tasks.forEach(t => para(`- ${typeof t === "string" ? t : JSON.stringify(t)}`));
        if (Array.isArray(p.steps)) p.steps.forEach(t => para(`- ${typeof t === "string" ? t : JSON.stringify(t)}`));
        // Fallback — dump the phase object raw so nothing is missed
        if (!p.description && !p.summary && !p.details && !p.tasks && !p.steps) {
          para("```json\n" + JSON.stringify(p, null, 2) + "\n```");
        }
      });
    }
  }

  hr();

  // ═══════════════════════════════════════
  // SECTION 9 — Tools
  // ═══════════════════════════════════════
  header(2, "Section 9 — Tools");
  para("**Audit lens:** actionability, profile-sensitivity, rationale-per-pick, free-vs-paid indication.\n");
  for (const r of results) {
    hr();
    para(ideaHeader(r));
    const tools = Array.isArray(r.tools) ? r.tools : [];
    if (tools.length === 0) {
      para("\n(no tools captured — check _rawResult in JSON)");
    } else {
      tools.forEach((t) => {
        const name = t.name ?? t.tool ?? "";
        const desc = t.description ?? t.reason ?? t.why ?? "";
        const category = t.category ?? "";
        para(`- **${name}**${category ? ` (${category})` : ""}: ${desc}`);
        if (!desc && typeof t === "object") {
          para("  ```json\n  " + JSON.stringify(t, null, 2) + "\n  ```");
        }
      });
    }
  }

  hr();

  // ═══════════════════════════════════════
  // SECTION 10 — Execution Reality
  // ═══════════════════════════════════════
  header(2, "Section 10 — Execution Reality (Time + Difficulty)");
  para("**Audit lens:** 'Calibrated to your background' promise (J). Profile matrices are primary evidence. Strong shift expected.\n");
  for (const r of results) {
    hr();
    para(ideaHeader(r));
    const est = r.estimates || {};
    para(`\n**Duration:** ${est.duration ?? "(missing)"}\n\n**Difficulty:** ${est.difficulty ?? "(missing)"}\n\n**Explanation:**\n\n${est.explanation ?? "(missing)"}`);
    // If there are other fields on estimates, dump them
    const knownFields = ["duration", "difficulty", "explanation"];
    const extraFields = Object.keys(est).filter(k => !knownFields.includes(k));
    if (extraFields.length > 0) {
      para("\n*Other estimate fields:*\n```json\n" + JSON.stringify(Object.fromEntries(extraFields.map(k => [k, est[k]])), null, 2) + "\n```");
    }
  }

  hr();

  // ═══════════════════════════════════════
  // SECTION 11 — How it compares + Competition landscape
  // ═══════════════════════════════════════
  header(2, "Section 11 — 'How it compares' (landscape)");
  para("**Audit lens:** evidence-grounded, profile-agnostic (negative control in matrix runs).\n");
  for (const r of results) {
    hr();
    para(ideaHeader(r));
    para(`\n**Landscape:**\n\n${r.competition.landscape || "(empty)"}`);
    if (r.competition.differentiation) para(`\n**Differentiation:**\n\n${r.competition.differentiation}`);
    if (r.competition.entryBarriers) para(`\n**Entry barriers:**\n\n${r.competition.entryBarriers}`);
  }

  hr();

  // ═══════════════════════════════════════
  // SECTION 12 — Competitors list
  // ═══════════════════════════════════════
  header(2, "Section 12 — Competitors list");
  para("**Audit lens:** source/type badge mix, count, what's shown per competitor.\n");
  for (const r of results) {
    hr();
    para(ideaHeader(r));
    const comps = r.competition.competitors || [];
    if (comps.length === 0) {
      para("\n(no competitors)");
    } else {
      para(`\nCount: ${comps.length}\n`);
      lines.push("| Name | Type | Source | Evidence | URL |");
      lines.push("|---|---|---|---|---|");
      comps.forEach(c => {
        lines.push(`| ${c.name} | ${c.type} | ${c.source} | ${c.evidenceStrength} | ${c.url ? "yes" : "no"} |`);
      });
      comps.forEach(c => {
        if (c.description) para(`\n**${c.name}:** ${c.description}`);
      });
    }
  }

  hr();

  // ═══════════════════════════════════════
  // SECTION 13 — Streaming keyword / search-term surfacing
  // (Trust-surface test — Lane G primary evidence)
  // ═══════════════════════════════════════
  header(2, "Section 13 — Streaming events (trust-surface test)");
  para("**Audit lens:** does the system display keywords/search-terms the user didn't say? Lane G (SP1, MD1) is primary evidence. Check for claims of user-input fidelity vs actual generated/expanded terms.\n");
  for (const r of results) {
    hr();
    para(ideaHeader(r));
    para(`\nTotal SSE events: ${r.streamEvents.length}\n`);
    // Pull out any event that mentions keywords or search_terms
    const kwEvents = r.streamEvents.filter(e => e.keywords || e.searchTerms);
    if (kwEvents.length === 0) {
      para("*(no keyword/search-term events surfaced in SSE stream)*");
    } else {
      kwEvents.forEach(e => {
        para(`- step: \`${e.step}\` — keywords: ${e.keywords ? JSON.stringify(e.keywords) : "—"} — search terms: ${e.searchTerms ? JSON.stringify(e.searchTerms) : "—"}`);
      });
    }
    // Also list all event steps as a sequence to see what the streaming reveals
    const stepSequence = r.streamEvents.map(e => e.step).filter(Boolean);
    if (stepSequence.length > 0) {
      para(`\n*Step sequence:* \`${stepSequence.join(" → ")}\``);
    }
  }

  hr();

  // ═══════════════════════════════════════
  // LANE-SPECIFIC VIEWS
  // ═══════════════════════════════════════

  header(2, "Lane D — Repetition cluster side-by-side");
  para("**Audit question:** do R1/R2/R3 produce templated or genuinely differentiated output on Summary, Risks, Roadmap?\n");
  const cluster = results.filter(r => r.lane === "D-cluster");
  cluster.forEach(r => {
    hr();
    para(`**${r.id}** (${r.idea.substring(0, 80)}…)\n`);
    para(`*Scores:* MD ${r.scores.md} / MO ${r.scores.mo} / OR ${r.scores.or} / TC ${r.scores.tc} / Overall ${r.scores.overall}\n`);
    para(`*Summary:* ${r.summary}\n`);
    para(`*Risks (${r.failureRisks.length}):*`);
    r.failureRisks.forEach(x => para(`- ${x}`));
  });

  hr();

  header(2, "Lane E — Profile matrix groupings");
  const matrixGroups = ["MAT1", "MAT2", "MAT3"];
  matrixGroups.forEach(mg => {
    hr();
    header(3, `${mg} — same idea across profiles`);
    const mgRuns = results.filter(r => r.matrixGroup === mg);
    if (mgRuns.length === 0) return;
    para(`*Idea:* ${mgRuns[0].idea.substring(0, 200)}…\n`);
    lines.push("| ID | Profile | MD | MO | OR | TC | Overall | Conf |");
    lines.push("|---|---|---|---|---|---|---|---|");
    mgRuns.forEach(r => {
      const p = [r.profile.coding, r.profile.ai, r.profile.education].filter(Boolean).join(" / ");
      lines.push(`| ${r.id} | ${p.substring(0, 60)} | ${r.scores.md} | ${r.scores.mo} | ${r.scores.or} | ${r.scores.tc} | ${r.scores.overall} | ${r.confidence.level} |`);
    });
    para("\n*Shift checks:* MD/MO/OR should stay roughly constant (negative control). TC + Roadmap + Tools + Execution should shift.\n");
    para("*TC explanations across the matrix:*\n");
    mgRuns.forEach(r => {
      para(`\n**${r.id}:** ${r.metricExplanations.tc}`);
    });
  });

  hr();

  header(2, "Lane F — Standard vs Deep pair-ups");
  para("**Audit question:** does Standard earn its place, or differ only cosmetically from Deep?\n");
  const freepro = results.filter(r => r.lane === "F-freepro");
  freepro.forEach(r => {
    const deepId = r.id.replace("-std", "");
    const deep = results.find(x => x.id === deepId);
    hr();
    header(3, `${deepId} (Deep) vs ${r.id} (Standard)`);
    lines.push("| | Deep | Standard |");
    lines.push("|---|---|---|");
    if (deep) {
      lines.push(`| MD | ${deep.scores.md} | ${r.scores.md} |`);
      lines.push(`| MO | ${deep.scores.mo} | ${r.scores.mo} |`);
      lines.push(`| OR | ${deep.scores.or} | ${r.scores.or} |`);
      lines.push(`| TC | ${deep.scores.tc} | ${r.scores.tc} |`);
      lines.push(`| Overall | **${deep.scores.overall}** | **${r.scores.overall}** |`);
      lines.push(`| Confidence | ${deep.confidence.level} | ${r.confidence.level} |`);
      para("\n**Deep summary:** " + (deep.summary || "(empty)"));
      para("\n**Standard summary:** " + (r.summary || "(empty)"));
    } else {
      para("*(no matching Deep run found — check IDs)*");
    }
  });

  return lines.join("\n");
}

// ============================================
// MAIN
// ============================================

async function main() {
  const total = TESTS.length;
  let done = 0;
  const results = [];
  const rawStreaming = [];

  console.log("=".repeat(80));
  console.log("IDEALOOP CORE — CONTENT AUDIT TEST HARNESS");
  console.log(`${total} runs (${TESTS.filter(t => t.pipeline === "PRO").length} Deep, ${TESTS.filter(t => t.pipeline === "FREE").length} Standard)`);
  console.log(`Estimated: ${Math.round(total * 40 / 60)}-${Math.round(total * 60 / 60)} minutes`);
  console.log("=".repeat(80) + "\n");

  const runStart = Date.now();

  for (const test of TESTS) {
    done++;
    const t0 = Date.now();
    console.log(`\n[${done}/${total}] ${test.id} (${test.lane}, ${test.pipeline}) — ${test.purpose.substring(0, 70)}`);

    try {
      const { result, allEvents } = await runEval(test.idea, test.profile, test.pipeline);
      const data = extractAll(result, allEvents, test);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      results.push(data);
      rawStreaming.push({ id: test.id, events: allEvents });

      const s = data.scores;
      console.log(`  ✅ ${elapsed}s — MD:${s.md} MO:${s.mo} OR:${s.or} TC:${s.tc} Overall:${s.overall} [${data.confidence.level}]`);

      // Warn if sections look suspiciously empty
      const warnings = [];
      if (!data.summary) warnings.push("no summary");
      if (!data.failureRisks || data.failureRisks.length === 0) warnings.push("no risks");
      if (!Array.isArray(data.phases) || data.phases.length === 0) warnings.push("no phases");
      if (!Array.isArray(data.tools) || data.tools.length === 0) warnings.push("no tools");
      if (warnings.length > 0) console.log(`  ⚠️  ${warnings.join(", ")}`);

    } catch (e) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  ❌ FAILED (${elapsed}s) — ${e.message}`);
      results.push({ id: test.id, lane: test.lane, pipeline: test.pipeline, error: e.message });
    }
  }

  const totalElapsed = ((Date.now() - runStart) / 60000).toFixed(1);

  // ─────────────────────────────────────────
  // WRITE OUTPUTS
  // ─────────────────────────────────────────

  console.log("\n" + "=".repeat(80));
  console.log(`All runs complete in ${totalElapsed} minutes. Writing outputs…`);
  console.log("=".repeat(80));

  const rawPath = path.join(OUTPUT_DIR, "audit-raw.json");
  fs.writeFileSync(rawPath, JSON.stringify(results, null, 2));
  console.log(`  ✓ ${rawPath} (${Math.round(fs.statSync(rawPath).size / 1024)} KB)`);

  const streamPath = path.join(OUTPUT_DIR, "audit-streaming.json");
  fs.writeFileSync(streamPath, JSON.stringify(rawStreaming, null, 2));
  console.log(`  ✓ ${streamPath} (${Math.round(fs.statSync(streamPath).size / 1024)} KB)`);

  const md = generateMarkdown(results.filter(r => !r.error));
  const mdPath = path.join(OUTPUT_DIR, "audit-sections.md");
  fs.writeFileSync(mdPath, md);
  console.log(`  ✓ ${mdPath} (${Math.round(fs.statSync(mdPath).size / 1024)} KB)`);

  // Summary
  const failed = results.filter(r => r.error);
  console.log("\n" + "=".repeat(80));
  console.log("AUDIT DATA READY");
  console.log("=".repeat(80));
  console.log(`  Total runs: ${results.length}`);
  console.log(`  Succeeded: ${results.length - failed.length}`);
  console.log(`  Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log(`\n  Failed runs:`);
    failed.forEach(f => console.log(`    - ${f.id}: ${f.error}`));
  }
  console.log("\nNext: review audit-sections.md section-by-section for the audit.");
}

main().catch(err => {
  console.error("\nFATAL:", err.message);
  console.error(err.stack);
  process.exit(1);
});

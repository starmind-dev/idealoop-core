// ============================================
// B10A LAUNCH GATE — CASE BANK
// V4S28 (May 5, 2026)
// ============================================
//
// 46 cases organized into 3 layers:
//   Layer 1 — Original V4S27 audit baseline (34 cases, regression core)
//   Layer 2 — V4S28-specific additions (12 cases)
//   Layer 3 — Variance reruns (handled by runner, not in this file)
//
// Naming convention:
//   AUDIT-* — original V4S27 audit case (carries V4S27 baseline scores)
//   ARC-*   — archetype seeds from B9 archetype-cases.js
//   GATE-*  — V8.1 specificity gate anchors
//   OPTZ-*  — Option-Z MEDIUM evidence_strength anchor
//   SPARSE-LOW* — sparse-but-passes-gate LOW evidence anchor (Pro + Free pair)
//   DOGFOOD — IdeaLoop Core itself (sanity, NOT HIGH gate)
//
// Each case carries:
//   id, lane, pipeline, purpose, profile, idea
//   v4s27_baseline (where applicable — for delta_vs_v4s27.md construction)
//   gates_targeted (list of gate names this case contributes to)
// ============================================

// ============================================
// LAYER 1 — ORIGINAL V4S27 AUDIT BASELINE
// Source: run-audit.js (April 16, 2026)
// V4S27 scores pulled from audit-sections.md test index
// ============================================

// ─────────────────────────────────────────
// LANE A — SCORE-BAND SPREAD (Deep)
// ─────────────────────────────────────────

// HIGHS (V4S27 target 7-9)
const AUDIT_H1 = {
  id: "AUDIT-H1", lane: "A-high", pipeline: "PRO",
  purpose: "High-value, regulated, domain-native founder. Tests 'best case' output. Lens A/B/D/I/J primary.",
  profile: { coding: "Intermediate", ai: "Regular AI user", education: "Former clinical operations lead (pharma, 8 years)" },
  idea: "A platform that matches rare disease patients with active clinical trials based on their genetic markers, medical history, and geographic constraints. Patients upload their records (with consent), and the system surfaces trials they qualify for with automated outreach to coordinators. Revenue: $15-25K per enrolled patient paid by pharma sponsors struggling with recruitment costs. Built-in EHR integration via SMART on FHIR. Initial focus on oncology rare diseases where trial fill rates are under 30%.",
  v4s27_baseline: { md: 6, mo: 6.5, or: 4.5, tc: 8.5, overall: 4.9, conf: "MEDIUM" },
  gates_targeted: ["G_REQUIRED_SECTIONS_PRESENT", "G_ALPHA_ARITHMETIC", "S_OR_ACTIONABILITY_HOOK"],
};

const AUDIT_H2 = {
  id: "AUDIT-H2", lane: "A-high", pipeline: "PRO",
  purpose: "Practical B2B with strong domain expert, non-elite technical. Operational/unglamorous. STEP 1 PROFILE-DOMAIN MATCH candidate (restaurant consultant + restaurant idea). Variance pair anchor.",
  profile: { coding: "Intermediate", ai: "Some AI experience", education: "Restaurant consultant (6 years), bootcamp grad" },
  idea: "Tool that integrates with Toast/Square POS to auto-calculate food costs per dish in real-time as vendor prices change, flags dishes that fell below margin, and suggests menu price adjustments or ingredient swaps. $99/month per location. Starts with independent restaurants (under 5 locations) where owners do menu pricing themselves.",
  v4s27_baseline: { md: 6, mo: 5, or: 4.5, tc: 7, overall: 4.8, conf: "MEDIUM" },
  gates_targeted: ["G_VARIANCE_EVIDENCE_NO_FLIP", "S_EVIDENCE_HIGH_MED_STABLE", "G_REQUIRED_SECTIONS_PRESENT"],
};

const AUDIT_H3 = {
  id: "AUDIT-H3", lane: "A-high", pipeline: "PRO",
  purpose: "Narrow-but-deep vertical. Tests specialized-niche handling.",
  profile: { coding: "Intermediate", ai: "Advanced AI user (Claude + Copilot daily)", education: "Patent attorney (10 years)" },
  idea: "AI transcription service for legal depositions specifically — handles multiple speakers with attorney/witness role labeling, flags objections automatically, produces exhibits-compliant transcripts. Integrates with court reporter platforms. B2B sales to law firms at $500/deposition, replacing stenographers in jurisdictions where electronic transcription is now admitted.",
  v4s27_baseline: { md: 6.5, mo: 7, or: 4.5, tc: 7.5, overall: 5.3, conf: "HIGH" },
  gates_targeted: ["G_REQUIRED_SECTIONS_PRESENT", "G_ALPHA_ARITHMETIC"],
};

const AUDIT_H4 = {
  id: "AUDIT-H4", lane: "A-high", pipeline: "PRO",
  purpose: "Non-coder with deep domain. Tests TC explanation for 'smart but no code' founder. Lens I (TC profile-sensitivity).",
  profile: { coding: "No coding experience", ai: "Regular AI user", education: "Former HVAC estimator (12 years), runs consulting shop" },
  idea: "Tool for electrical/HVAC/plumbing subcontractors bidding on commercial jobs. Upload the RFP and drawings, the system estimates material costs from current distributor prices, flags scope gaps, and compares against the sub's historical win rate at that bid level. Usage-based pricing ($50/bid analyzed). Sub market with subs who currently bid 3-10 jobs/week and spend 4-8 hours per bid.",
  v4s27_baseline: { md: 6.5, mo: 5.5, or: 4.5, tc: 7.5, overall: 5.0, conf: "MEDIUM" },
  gates_targeted: ["G_REQUIRED_SECTIONS_PRESENT"],
};

// MIDS (V4S27 target 5-7)
const AUDIT_M1 = {
  id: "AUDIT-M1", lane: "A-mid", pipeline: "PRO",
  purpose: "Crowded category, LLM-wrapper concern, classic real-user submission. Variance pair anchor.",
  profile: { coding: "Intermediate", ai: "Regular AI user", education: "Solo indie hacker, no shipped products" },
  idea: "habit tracker app with an AI that talks to you about your progress and helps you figure out why you fell off. gamified. freemium with $9/mo for the AI coach.",
  v4s27_baseline: { md: 5.5, mo: 4, or: 4.5, tc: 6, overall: 4.6, conf: "HIGH" },
  gates_targeted: ["G_VARIANCE_EVIDENCE_NO_FLIP", "S_EVIDENCE_HIGH_MED_STABLE"],
};

const AUDIT_M2 = {
  id: "AUDIT-M2", lane: "A-mid", pipeline: "PRO",
  purpose: "Real niche, specific ICP, unclear pace to scale.",
  profile: { coding: "Beginner", ai: "Some AI experience", education: "Trade association marketing director (5 years)" },
  idea: "Purpose-built newsletter platform specifically for trade associations (plumbing contractors, ag equipment dealers, etc). Native member directory integration, sponsor management, CAN-SPAM compliance built-in. $500/month flat. There are ~7,000 US trade associations and most are on Mailchimp plus duct tape.",
  v4s27_baseline: { md: 6, mo: 4.5, or: 4, tc: 7.5, overall: 4.4, conf: "MEDIUM" },
  gates_targeted: ["G_REQUIRED_SECTIONS_PRESENT"],
};

const AUDIT_M3 = {
  id: "AUDIT-M3", lane: "A-mid", pipeline: "PRO",
  purpose: "Narrow market with strong LLM-substitution risk. Tests MO calibration.",
  profile: { coding: "Intermediate", ai: "Regular AI user", education: "PhD in computational biology, non-native English" },
  idea: "AI tool specifically for non-native-English PhD students and postdocs editing their manuscripts before journal submission. Not just grammar — catches discipline-specific conventions (e.g., passive voice rules in bio papers vs active in CS). $29/month student pricing. Integration with Overleaf.",
  v4s27_baseline: { md: 6.5, mo: 5, or: 6, tc: 7, overall: 5.3, conf: "MEDIUM" },
  gates_targeted: ["G_REQUIRED_SECTIONS_PRESENT"],
};

const AUDIT_M4 = {
  id: "AUDIT-M4", lane: "A-mid", pipeline: "PRO",
  purpose: "Crowded marketplace ecosystem, strong domain expert.",
  profile: { coding: "Intermediate", ai: "Regular AI user", education: "Former Shopify store owner ($2M/yr, sold)" },
  idea: "Shopify app that uses sales history + seasonal patterns + lead times to tell small-to-mid sellers exactly when to reorder each SKU and how many units. Prevents stockouts and over-ordering. $49-199/month tiered by SKU count.",
  v4s27_baseline: { md: 6, mo: 5.5, or: 4.5, tc: 7, overall: 4.9, conf: "HIGH" },
  gates_targeted: ["G_REQUIRED_SECTIONS_PRESENT"],
};

// LOWS (V4S27 target 3-5)
const AUDIT_L1 = {
  id: "AUDIT-L1", lane: "A-low", pipeline: "PRO",
  purpose: "LLM wrapper, commoditized pattern, free substitutes. Tests honest hard-news delivery.",
  profile: { coding: "Beginner", ai: "Regular AI user", education: "MBA student, first-time founder" },
  idea: "Text an AI nutrition coach every day with what you ate and it tells you if you're on track with your goals. Subscription $19/month. Think of it like having a dietitian in your pocket.",
  v4s27_baseline: { md: 6, mo: 4.5, or: 3.5, tc: 6.5, overall: 4.5, conf: "MEDIUM" },
  gates_targeted: ["G_REQUIRED_SECTIONS_PRESENT"],
};

const AUDIT_L2 = {
  id: "AUDIT-L2", lane: "A-low", pipeline: "PRO",
  purpose: "Two-sided marketplace cold-start, commoditized alternative.",
  profile: { coding: "No coding experience", ai: "Some AI experience", education: "Former elementary school principal" },
  idea: "Marketplace app where retired teachers list themselves as tutors and parents book hourly sessions. Take 15% commission. Starting in Boston where there's a big retired-teacher population.",
  v4s27_baseline: { md: 5.5, mo: 4.5, or: 3.5, tc: 7.5, overall: 4.2, conf: "HIGH" },
  gates_targeted: ["G_REQUIRED_SECTIONS_PRESENT"],
};

// STRUCTURAL FLAW (V4S27 target <3)
const AUDIT_S2 = {
  id: "AUDIT-S2", lane: "A-struct", pipeline: "PRO",
  purpose: "Gig-marketplace unit economics failure, known category graveyard. Tests honest hard-news delivery + structural-flaw archetype A or B.",
  profile: { coding: "Beginner", ai: "Regular AI user", education: "Finance analyst looking to leave banking" },
  idea: "Like Uber but for laundry. Drivers pick up your clothes, take to a partner laundromat, return the same day. $12/load. Start in NYC.",
  v4s27_baseline: { md: 5.5, mo: 4.5, or: 3.5, tc: 7.5, overall: 4.2, conf: "HIGH" },
  gates_targeted: ["G_REQUIRED_SECTIONS_PRESENT"],
};

// ─────────────────────────────────────────
// LANE B — ARCHETYPE STRESSORS (V4S27)
// ─────────────────────────────────────────

const AUDIT_A1 = {
  id: "AUDIT-A1", lane: "B-wrapper", pipeline: "PRO",
  purpose: "Thin LLM wrapper. Tests archetype identification + Risks/Roadmap specificity. NOTE: NOT the same as GATE-A1 (V8.1 restaurant case).",
  profile: { coding: "Beginner", ai: "Regular AI user", education: "Career coach" },
  idea: "Upload your resume, AI reviews it and gives feedback specific to the role you're targeting. $12 per review or $29/month unlimited.",
  v4s27_baseline: { md: 6, mo: 4, or: 3.5, tc: 6.5, overall: 4.4, conf: "HIGH" },
  gates_targeted: ["G_REQUIRED_SECTIONS_PRESENT"],
};

const AUDIT_A2 = {
  id: "AUDIT-A2", lane: "B-marketplace", pipeline: "PRO",
  purpose: "Marketplace done right — tests 'tailwind + verification wedge' vs generic cold-start reflex. Risk 3 archetype B (buyer access) candidate.",
  profile: { coding: "Intermediate", ai: "Some AI experience", education: "Former home care agency operator, Bubble/Airtable builder" },
  idea: "Marketplace for seniors (and their adult children) to book verified, background-checked handymen for small home repairs. Verification includes insurance and references. Take 20% commission. Focus on suburban markets where Angi has weak coverage.",
  v4s27_baseline: { md: 5.5, mo: 4.5, or: 4, tc: 7, overall: 4.4, conf: "MEDIUM" },
  gates_targeted: ["G_MB_REACHABILITY"],
};

const AUDIT_A3 = {
  id: "AUDIT-A3", lane: "B-regulated", pipeline: "PRO",
  purpose: "Regulated domain, controlled substance, payer complexity. Tests regulatory risk surfacing. Risk 3 archetype C (trust/credibility) + Main Bottleneck Compliance candidate.",
  profile: { coding: "Beginner", ai: "Some AI experience", education: "Harm reduction researcher, MPH, 4 years state public health" },
  idea: "Telehealth platform for medication-assisted treatment (MAT) for opioid use disorder. Licensed physicians prescribe buprenorphine via video visits. Accepts Medicaid in states that cover MAT telehealth. $250/visit billed to insurance.",
  v4s27_baseline: { md: 6.5, mo: 6, or: 3, tc: 9, overall: 4.4, conf: "HIGH" },
  gates_targeted: ["G_MB_REACHABILITY"],
};

// ─────────────────────────────────────────
// LANE C — BOUNDARY CASES (V4S27)
// ─────────────────────────────────────────

const AUDIT_B1 = {
  id: "AUDIT-B1", lane: "C-boundary", pipeline: "PRO",
  purpose: "Genuinely ambiguous — real niche, unclear urgency. Tests nuance vs mushiness in Summary. NOTE: NOT the same as GATE-B1 (V8.1 sparse-FAIL anchor SP1).",
  profile: { coding: "No coding experience", ai: "Some AI experience", education: "Line producer (indie film, 8 years), Notion power user" },
  idea: "Project management for indie film productions (budget $500K-$5M). Tracks shoot schedules, location releases, SAG compliance, crew call sheets, all in one tool. Existing solutions are enterprise (Movie Magic) or generic (Asana). $199/month per active production.",
  v4s27_baseline: { md: 6, mo: 5, or: 4.5, tc: 7.5, overall: 4.7, conf: "MEDIUM" },
  gates_targeted: ["G_REQUIRED_SECTIONS_PRESENT"],
};

const AUDIT_B2 = {
  id: "AUDIT-B2", lane: "C-boundary", pipeline: "PRO",
  purpose: "Real pain, proven willingness, brutal sales cycle + commoditization pressure. Risk 3 archetype B (buyer access) candidate.",
  profile: { coding: "Intermediate", ai: "Regular AI user", education: "Former city councilmember (2 terms), now digital transformation consultant" },
  idea: "Small cities (under 100K population) deploy an AI chatbot on their city website that answers resident questions by ingesting the city's own documents. $8K/year flat fee. Sales cycle 6-9 months, $5K in services to onboard. 19,500 US cities in this size range.",
  v4s27_baseline: { md: 6, mo: 6.5, or: 4.5, tc: 6.5, overall: 5.3, conf: "MEDIUM" },
  gates_targeted: ["G_MB_REACHABILITY"],
};

const AUDIT_B3 = {
  id: "AUDIT-B3", lane: "C-boundary", pipeline: "PRO",
  purpose: "Ego-loaded founder-dogfoods-own-idea case. Small audience, free alternatives.",
  profile: { coding: "Intermediate", ai: "Regular AI user", education: "Twice-failed founder, active in indie hacker communities" },
  idea: "App for indie hackers building their first startup. You're matched into accountability pods of 3-5 people shipping similar-stage projects. Weekly video check-ins, shared milestones, peer critique. $15/month.",
  v4s27_baseline: { md: 6.5, mo: 6, or: 5.5, tc: 6.5, overall: 5.5, conf: "MEDIUM" },
  gates_targeted: ["G_REQUIRED_SECTIONS_PRESENT"],
};

// ─────────────────────────────────────────
// LANE D — REPETITION CLUSTER (V4S27)
// ─────────────────────────────────────────

const AUDIT_R1 = {
  id: "AUDIT-R1", lane: "D-cluster", pipeline: "PRO",
  purpose: "Cluster 1/3: dental vertical, flat subscription, practice management software integration. Lens H (templating) primary — compare summary openings across R1+R2+R3.",
  profile: { coding: "Beginner", ai: "Regular AI user", education: "Dental office manager (9 years)" },
  idea: "AI tool that handles dental patient intake — pre-appointment forms, insurance verification, dental history collection. Integrates with Dentrix and Open Dental. Reduces front-desk workload by 40%. $199/month per practice.",
  v4s27_baseline: { md: 6, mo: 5.5, or: 4, tc: 7.5, overall: 4.7, conf: "MEDIUM" },
  gates_targeted: ["S_TEMPLATE_LEAD_VARIATION"],
};

const AUDIT_R2 = {
  id: "AUDIT-R2", lane: "D-cluster", pipeline: "PRO",
  purpose: "Cluster 2/3: legal vertical, per-transaction pricing, document storage integration.",
  profile: { coding: "Intermediate", ai: "Some AI experience", education: "BD director at mid-size law firm (7 years), Airtable power user" },
  idea: "AI-powered bid response assistant for law firms pitching on corporate RFPs. Drafts initial proposal responses by analyzing the RFP document against firm capabilities and case history. $400 per bid processed or $2K/month unlimited. Integrates with Clio document storage.",
  v4s27_baseline: { md: 5.5, mo: 4.5, or: 4, tc: 7, overall: 4.4, conf: "MEDIUM" },
  gates_targeted: ["S_TEMPLATE_LEAD_VARIATION"],
};

const AUDIT_R3 = {
  id: "AUDIT-R3", lane: "D-cluster", pipeline: "PRO",
  purpose: "Cluster 3/3: accounting vertical, usage-based pricing, tax software integration.",
  profile: { coding: "No coding experience", ai: "Some AI experience", education: "Senior accountant at 15-person firm (9 years), Excel/Zapier builder" },
  idea: "AI review assistant for small accounting firms during tax season. Auto-reviews completed 1040s flagging likely errors (math, schedule inconsistencies, common missed deductions) before senior CPA review. Usage-based: $2 per return reviewed. Integrates with Drake, UltraTax, and Lacerte.",
  v4s27_baseline: null, // R3 not in V4S27 audit-sections.md test index — possibly excluded or failed
  gates_targeted: ["S_TEMPLATE_LEAD_VARIATION"],
};

// ─────────────────────────────────────────
// LANE E — PROFILE MATRICES (V4S27)
// MAT1 + MAT2 + MAT3, all 3×3 = 9 cases
// ─────────────────────────────────────────

// MATRIX 1 — Technically-buildable workflow, profile should matter a LOT
const AUDIT_MAT1_BEG = {
  id: "AUDIT-MAT1-beginner", lane: "E-matrix", matrixGroup: "MAT1", pipeline: "PRO",
  purpose: "Matrix 1 / beginner. TC should be HIGH. Roadmap Phase 1 should be no-code-first. CANONICAL TC=7.5 anchor for G_TC_MAT1 gate.",
  profile: { coding: "No coding experience", ai: "Some AI experience", education: "Paralegal (6 years), Airtable builder" },
  idea: "AI-powered document automation tool for small law firms (under 20 attorneys). Ingests client intake forms, generates draft engagement letters, retainer agreements, and client memos based on firm templates. Integrates with Clio. $299/month per firm.",
  v4s27_baseline: { md: 6, mo: 4.5, or: 3.5, tc: 7.5, overall: 4.3, conf: "MEDIUM" },
  gates_targeted: ["G_TC_MAT1", "G_STAGE1_BLINDNESS"],
};

const AUDIT_MAT1_INT = {
  id: "AUDIT-MAT1-intermediate", lane: "E-matrix", matrixGroup: "MAT1", pipeline: "PRO",
  purpose: "Matrix 1 / intermediate. TC should be MEDIUM. Roadmap should assume bootcamp-level build. CANONICAL TC=7.0 anchor for G_TC_MAT1 gate.",
  profile: { coding: "Intermediate", ai: "Regular AI user", education: "Paralegal (6 years), bootcamp grad, shipped personal project" },
  idea: "AI-powered document automation tool for small law firms (under 20 attorneys). Ingests client intake forms, generates draft engagement letters, retainer agreements, and client memos based on firm templates. Integrates with Clio. $299/month per firm.",
  v4s27_baseline: { md: 6, mo: 4.5, or: 4, tc: 7, overall: 4.5, conf: "HIGH" },
  gates_targeted: ["G_TC_MAT1", "G_STAGE1_BLINDNESS"],
};

const AUDIT_MAT1_SEN = {
  id: "AUDIT-MAT1-senior", lane: "E-matrix", matrixGroup: "MAT1", pipeline: "PRO",
  purpose: "Matrix 1 / senior. TC should be LOW. Roadmap should architect-first. CANONICAL TC=6.0 anchor for G_TC_MAT1 gate.",
  profile: { coding: "Advanced", ai: "Advanced AI user (fine-tuning LLMs)", education: "Staff engineer at LegalTech company (5 years, doc automation features)" },
  idea: "AI-powered document automation tool for small law firms (under 20 attorneys). Ingests client intake forms, generates draft engagement letters, retainer agreements, and client memos based on firm templates. Integrates with Clio. $299/month per firm.",
  v4s27_baseline: { md: 6, mo: 5, or: 4.5, tc: 6, overall: 5.0, conf: "MEDIUM" },
  gates_targeted: ["G_TC_MAT1", "G_STAGE1_BLINDNESS"],
};

// MATRIX 2 — Services-heavy, anti-overweighting test
const AUDIT_MAT2_BEG = {
  id: "AUDIT-MAT2-beginner", lane: "E-matrix", matrixGroup: "MAT2", pipeline: "PRO",
  purpose: "Matrix 2 / beginner. Services-heavy — tech skill isn't the bottleneck.",
  profile: { coding: "No coding experience", ai: "Some AI experience", education: "Former small-business owner (dealt with claim denials personally)" },
  idea: "Concierge service that handles all insurance claim disputes for small businesses (under 50 employees). Success fee of 25% on recovered claims. Starting with denied health insurance claims for employee medical expenses. Done-with-you model: we handle paperwork, customer provides documents.",
  v4s27_baseline: { md: 6.5, mo: 6, or: 5.5, tc: 7.5, overall: 5.3, conf: "MEDIUM" },
  gates_targeted: ["G_STAGE1_BLINDNESS"],
};

const AUDIT_MAT2_INT = {
  id: "AUDIT-MAT2-intermediate", lane: "E-matrix", matrixGroup: "MAT2", pipeline: "PRO",
  purpose: "Matrix 2 / intermediate. Domain-heavy background dominates profile. P6-S1 MO contamination regression check.",
  profile: { coding: "Beginner", ai: "Regular AI user", education: "Insurance claims adjuster (10 years), learning to code" },
  idea: "Concierge service that handles all insurance claim disputes for small businesses (under 50 employees). Success fee of 25% on recovered claims. Starting with denied health insurance claims for employee medical expenses. Done-with-you model: we handle paperwork, customer provides documents.",
  v4s27_baseline: { md: 6, mo: 5, or: 6.5, tc: 7, overall: 5.3, conf: "MEDIUM" },
  gates_targeted: ["G_STAGE1_BLINDNESS"],
};

const AUDIT_MAT2_SEN = {
  id: "AUDIT-MAT2-senior", lane: "E-matrix", matrixGroup: "MAT2", pipeline: "PRO",
  purpose: "Matrix 2 / senior tech. TEST: does TC drop too much? Tech isn't the real bottleneck here.",
  profile: { coding: "Advanced", ai: "Advanced AI user", education: "Senior PM at healthtech company, built internal tools" },
  idea: "Concierge service that handles all insurance claim disputes for small businesses (under 50 employees). Success fee of 25% on recovered claims. Starting with denied health insurance claims for employee medical expenses. Done-with-you model: we handle paperwork, customer provides documents.",
  v4s27_baseline: { md: 6, mo: 6.5, or: 5.5, tc: 7.5, overall: 5.3, conf: "MEDIUM" },
  gates_targeted: ["G_STAGE1_BLINDNESS"],
};

// MATRIX 3 — Trust/distribution-dominant
const AUDIT_MAT3_INSIDER = {
  id: "AUDIT-MAT3-insider", lane: "E-matrix", matrixGroup: "MAT3", pipeline: "PRO",
  purpose: "Matrix 3 / domain insider. Has the critical asset (relationships) even without coding. STEP 1 PROFILE-DOMAIN MATCH candidate.",
  profile: { coding: "No coding experience", ai: "Some AI experience", education: "Former rural hospital CFO (15 years), 80+ exec relationships" },
  idea: "Platform that helps rural hospitals (under 100 beds) negotiate better rates with medical device suppliers by aggregating purchasing data across member hospitals. Members pay $24,000/year. Value prop: average 12% reduction in device spend, which pays for membership 10x over. Requires buy-in from hospital CFOs and procurement directors.",
  v4s27_baseline: { md: 6, mo: 5.5, or: 4.5, tc: 7.5, overall: 4.8, conf: "MEDIUM" },
  gates_targeted: ["G_STAGE1_BLINDNESS"],
};

const AUDIT_MAT3_TECHNOACCESS = {
  id: "AUDIT-MAT3-tech-no-access", lane: "E-matrix", matrixGroup: "MAT3", pipeline: "PRO",
  purpose: "Matrix 3 / senior tech no access. CRITICAL TEST: does the system correctly flag distribution as the gap, not the build? G_MAT3_NO_FABRICATION primary anchor — V4S27 found fabricated procurement/healthcare expertise.",
  profile: { coding: "Advanced", ai: "Advanced AI user", education: "Staff engineer at healthtech startup (8 years), built procurement tools for enterprise" },
  idea: "Platform that helps rural hospitals (under 100 beds) negotiate better rates with medical device suppliers by aggregating purchasing data across member hospitals. Members pay $24,000/year. Value prop: average 12% reduction in device spend, which pays for membership 10x over. Requires buy-in from hospital CFOs and procurement directors.",
  v4s27_baseline: { md: 6.5, mo: 6, or: 4.5, tc: 7.5, overall: 5.1, conf: "MEDIUM" },
  gates_targeted: ["G_MAT3_NO_FABRICATION", "G_STAGE1_BLINDNESS", "G_MB_REACHABILITY"],
};

const AUDIT_MAT3_PARTIAL = {
  id: "AUDIT-MAT3-partial", lane: "E-matrix", matrixGroup: "MAT3", pipeline: "PRO",
  purpose: "Matrix 3 / partial domain + partial tech. Middle ground.",
  profile: { coding: "Intermediate", ai: "Regular AI user", education: "Former consultant at hospital purchasing group (3 years), now building SaaS" },
  idea: "Platform that helps rural hospitals (under 100 beds) negotiate better rates with medical device suppliers by aggregating purchasing data across member hospitals. Members pay $24,000/year. Value prop: average 12% reduction in device spend, which pays for membership 10x over. Requires buy-in from hospital CFOs and procurement directors.",
  v4s27_baseline: { md: 6.5, mo: 5, or: 4.5, tc: 7, overall: 4.9, conf: "MEDIUM" },
  gates_targeted: ["G_STAGE1_BLINDNESS"],
};

// ─────────────────────────────────────────
// LANE F — FREE/PRO SIDE CHECK (V4S27)
// ─────────────────────────────────────────

const AUDIT_H2_STD = {
  id: "AUDIT-H2-std", lane: "F-freepro", pipeline: "FREE",
  purpose: "Pair with H2 (Deep). Pipeline parity check. Lens F primary.",
  profile: { coding: "Intermediate", ai: "Some AI experience", education: "Restaurant consultant (6 years), bootcamp grad" },
  idea: "Tool that integrates with Toast/Square POS to auto-calculate food costs per dish in real-time as vendor prices change, flags dishes that fell below margin, and suggests menu price adjustments or ingredient swaps. $99/month per location. Starts with independent restaurants (under 5 locations) where owners do menu pricing themselves.",
  v4s27_baseline: { md: 7, mo: 6.5, or: 4, tc: 7.5, overall: 5.2, conf: "HIGH" },
  gates_targeted: [],
};

const AUDIT_M1_STD = {
  id: "AUDIT-M1-std", lane: "F-freepro", pipeline: "FREE",
  purpose: "Pair with M1 (Deep). Pipeline parity check.",
  profile: { coding: "Intermediate", ai: "Regular AI user", education: "Solo indie hacker, no shipped products" },
  idea: "habit tracker app with an AI that talks to you about your progress and helps you figure out why you fell off. gamified. freemium with $9/mo for the AI coach.",
  v4s27_baseline: { md: 6, mo: 4.5, or: 3.5, tc: 6.5, overall: 4.5, conf: "HIGH" },
  gates_targeted: [],
};

const AUDIT_S2_STD = {
  id: "AUDIT-S2-std", lane: "F-freepro", pipeline: "FREE",
  purpose: "Pair with S2 (Deep). Pipeline parity on hard-news delivery.",
  profile: { coding: "Beginner", ai: "Regular AI user", education: "Finance analyst looking to leave banking" },
  idea: "Like Uber but for laundry. Drivers pick up your clothes, take to a partner laundromat, return the same day. $12/load. Start in NYC.",
  v4s27_baseline: { md: 4.5, mo: 3.5, or: 2.5, tc: 7.5, overall: 3.4, conf: "HIGH" },
  gates_targeted: [],
};

const AUDIT_A1_STD = {
  id: "AUDIT-A1-std", lane: "F-freepro", pipeline: "FREE",
  purpose: "Pair with AUDIT-A1 (Deep). Pipeline parity on wrapper detection.",
  profile: { coding: "Beginner", ai: "Regular AI user", education: "Career coach" },
  idea: "Upload your resume, AI reviews it and gives feedback specific to the role you're targeting. $12 per review or $29/month unlimited.",
  v4s27_baseline: { md: 6, mo: 4.5, or: 3.5, tc: 6, overall: 4.6, conf: "HIGH" },
  gates_targeted: [],
};

// ─────────────────────────────────────────
// LANE G — TRUST-SURFACE TESTS (V4S27)
// ─────────────────────────────────────────

const AUDIT_SP1 = {
  id: "AUDIT-SP1", lane: "G-trust", pipeline: "PRO",
  purpose: "SPARSE INPUT. In V4S27 scored a fabricated dental SaaS landscape. POST-V4S28: should gate at Haiku Specificity layer (B7 + V8.1 floor anchor — same input as GATE-B1). G_GATE_B1_FAIL primary anchor. G_SPARSE_NO_IMAGINATION verifies disease cured.",
  profile: { coding: "Beginner", ai: "No AI experience", education: "Dentist" },
  idea: "tool for dentists to save time",
  v4s27_baseline: { md: 4.5, mo: 5, or: 3.5, tc: 3, overall: 4.9, conf: "LOW" },
  gates_targeted: ["G_GATE_B1_FAIL", "G_SPARSE_NO_IMAGINATION"],
  expectedGateBehavior: "FAIL", // Haiku gate fires; no scoring
};

const AUDIT_MD1 = {
  id: "AUDIT-MD1", lane: "G-trust", pipeline: "PRO",
  purpose: "MESSY FOUNDER DUMP. Self-contradicting scope. Tests Summary nuance vs fake coherence; Roadmap wedge discipline.",
  profile: { coding: "Intermediate", ai: "Some AI experience", education: "Freelance UX designer (4 years)" },
  idea: "ok so i've been thinking about this for a while. i'm a freelance ux designer and everyone i know has the same problem where you do work, the client loves it, then payment takes forever. i want to build something that fixes this but also maybe could be a full platform for freelancers to manage everything. like invoices, contracts, tracking hours, maybe client portals too. i'm not sure if i should focus on just the payment thing or build the whole platform. i know there are other freelancer tools out there but they all suck honestly or they're way too expensive for solo people. maybe pricing it at like $15/month? i could probably get some of my designer friends to try it. the AI angle could be that it automates the annoying parts like writing payment reminders and contracts. tbh i haven't fully figured out what the MVP should be, i just know the problem is real.",
  v4s27_baseline: { md: 5.5, mo: 4.5, or: 4, tc: 7, overall: 4.4, conf: "MEDIUM" },
  gates_targeted: ["G_REQUIRED_SECTIONS_PRESENT"],
};

// ============================================
// LAYER 2 — V4S28-SPECIFIC ADDITIONS
// ============================================

// ─────────────────────────────────────────
// ARCHETYPE SEEDS (from B9 archetype-cases.js)
// ─────────────────────────────────────────

const ARC_C1 = {
  id: "ARC-C1", lane: "Arc-C", pipeline: "PRO",
  purpose: "Archetype C (trust/credibility) stress test — high-trust medical domain. HARDEST test of C — if C fires here, C fires anywhere. Lens L primary.",
  profile: { coding: "Advanced", ai: "Advanced AI user (fine-tuning LLMs)", education: "Senior ML engineer at consumer e-commerce recommendation platform (8 years) — no clinical, healthcare, or medical training" },
  idea: "An AI clinical decision support tool for rural primary care physicians. Doctors enter patient symptoms, vitals, medication history, and basic labs; the tool returns differential diagnoses ranked by probability with citations to current clinical guidelines (UpToDate-equivalent), flags potential drug interactions, and suggests next-step diagnostic workups. Targets clinics in towns under 50,000 population without nearby specialists. Validated against board-certified physician review on common-presentation cases (chest pain, abdominal pain, undifferentiated dyspnea). Pricing: $400/month per physician seat. Goal: reduce specialist referrals and patient travel for rural populations.",
  v4s27_baseline: null, // not in V4S27
  gates_targeted: ["G_MB_REACHABILITY"],
};

const ARC_D1 = {
  id: "ARC-D1", lane: "Arc-D", pipeline: "PRO",
  purpose: "Archetype D (capital/runway) clean candidate — pure capital arithmetic, no FDA, no enterprise compliance. G_ARC_D_RISK3 primary anchor. Lens L primary.",
  profile: { coding: "Intermediate", ai: "Regular AI user", education: "Solo founder, bootstrapped, $35k personal savings, no prior fundraising experience or VC network, never raised institutional capital" },
  idea: "A smart home water-quality monitoring device for households on private well water. Continuous in-line sensor measures contaminants (lead, nitrates, bacteria, hardness) and pushes readings to a mobile app with EPA-threshold alerts and quarterly trend reports. Hardware unit cost ~$140, sells direct-to-consumer at $249 device + $12/month subscription for the analytics dashboard and replacement filter alerts. No FDA, no medical clearance — sold as consumer water-quality monitoring, not medical. Initial inventory order minimum is 5,000 units ($700k); custom plastics tooling is $180k upfront, non-refundable; first 12 months pre-launch involves prototyping iterations + EPA-NSF lab certification (~$200k for accredited testing). Direct-to-consumer go-to-market via Facebook/Instagram ads + Amazon presence — estimated $300k initial CAC budget to validate paid-channel economics. Total pre-revenue runway required: ~$1.4M.",
  v4s27_baseline: null,
  gates_targeted: ["G_ARC_D_RISK3", "G_MB_REACHABILITY"],
};

const ARC_D2 = {
  id: "ARC-D2", lane: "Arc-D", pipeline: "PRO",
  purpose: "Archetype D Layered stress test — capital constraint compounded by Compliance gate. Tests whether D fires AS RISK 3 when Main Bottleneck legitimately fires Compliance. Per Stage 3 prompt's Layered case rule, both should fire (different surfaces). Lens M primary.",
  profile: { coding: "Advanced", ai: "Advanced AI user", education: "Self-taught full-stack developer (4 years), shipped two consumer apps, $20k personal savings, no enterprise SaaS experience, never raised institutional capital, no banking-industry network" },
  idea: "An AI underwriting tool for community banks ($500M-$5B in assets). Replaces manual loan-file review with AI-driven risk scoring on commercial loans (real estate, equipment, working capital). Requires SOC2 Type II certification + state bank regulator approval before any pilot can run. Estimated 18 months pre-revenue: SOC2 audit ($150k), bank regulator legal navigation ($600k), security infrastructure for handling regulated financial data ($400k), three senior engineers for 18 months ($1.2M loaded), design-partner pilot subsidies ($450k). Total ~$2.8M pre-revenue. Banks will not pay until certifications complete and regulatory sign-off granted.",
  v4s27_baseline: null,
  gates_targeted: ["S_LAYERED_MB_COMPLIANCE", "G_MB_REACHABILITY"],
};

const ARC_E1 = {
  id: "ARC-E1", lane: "Arc-E", pipeline: "PRO",
  purpose: "Archetype E (sales/conversion) clean candidate — high-ACV enterprise B2B with explicit reachability granted. Buyers are publicly listed; the gap is the multi-stakeholder consultative sales motion, not access. Defends against B (buyer access) drift.",
  profile: { coding: "Advanced", ai: "Advanced AI user", education: "Staff backend engineer (10 years), built internal data pipelines, never customer-facing, never run discovery calls, never managed pilots, no procurement-negotiation experience, no enterprise-sales process exposure" },
  idea: "An AI-powered procurement risk monitoring platform for Fortune 500 supply chain teams. Continuously ingests supplier financial filings, OSHA records, sanctions lists, ESG ratings, and news; flags emerging risk signals (insolvency indicators, regulatory exposure, geopolitical concentration) on tier-1 and tier-2 suppliers. Custom dashboard per buying organization. Pricing: $180,000/year per enterprise contract, 18-month average sales cycle, requires CPO-level executive sponsor + procurement, IT, and legal stakeholder sign-off. No self-serve tier; sales motion is exclusively outbound enterprise field sales with multi-stakeholder pilots. Fortune 500 procurement contacts are publicly available via ZoomInfo, LinkedIn Sales Navigator, and the ISM/CPO conference circuit; access is not the gap — running the 18-month consultative sales motion to close them is.",
  v4s27_baseline: null,
  gates_targeted: ["G_MB_REACHABILITY"],
};

// ─────────────────────────────────────────
// SHERPA PARSER STRESS (B9 Stage TC parse hardening)
// ─────────────────────────────────────────

const SHERPA = {
  id: "G1-LONG-1500W", lane: "Sherpa", pipeline: "PRO",
  purpose: "Stage TC parse stress — 1500-word prose-preamble + markdown-fenced output across all six chained-pipeline parses. Verifies B9 cleanJsonResponse substring-extraction fix. G_STAGE_TC_PARSE primary anchor.",
  profile: { coding: "Intermediate", ai: "Regular AI user", education: "Senior software engineer (12 years at FAANG and venture-backed startups), built developer experience tooling for internal teams, IDE plugin development experience" },
  idea: `I've spent the last decade watching engineers struggle with the gap between coding tutorials and real production engineering. The tutorials teach you how to write code that works in isolation; production teaches you how to write code that survives integration, scale, and the ongoing maintenance burden of a codebase that twenty other engineers also touch. There's a gap there — call it the "tutorial-to-real-engineering gap" — that no one really teaches systematically. So here's what I want to build: a developer experience monitoring product called Sherpa.

The core idea: an IDE plugin (VSCode + JetBrains to start) that observes your day-to-day coding behavior locally — files you open, edits you make, errors you hit, tests you run, the time you spend in different parts of your codebase, the patterns of your debugging cycles — and produces a weekly "developer experience report" that surfaces patterns invisible to you in real-time. Not surveillance: all data stays local on your machine, you control whether you ever export it. The product runs entirely local-first; no telemetry to a central server unless you explicitly opt in to share with your team or a manager. The output: clear visibility into where you're spending the most cognitive load, where the friction points are, where the tutorial-vs-real-engineering gap is biting you specifically.

The deeper bet: most developer-experience tools today are organizational metrics (DORA, deployment frequency, lead time, cycle time). Those are fine for managers but useless for the individual engineer trying to improve their own work. Sherpa is the opposite — entirely individual-focused, surfaces patterns YOU specifically need to know about, makes recommendations like "you spent 47% of your time this week in 3 files; consider whether they're due for refactor" or "your average tab-cycle in the debugging panel is 3.2x your team baseline; here's what good debuggers do differently."

Pricing: $19/month individual, $39/month for team-shared (teams can opt-in to anonymized aggregate views without exposing individual data). Targets the ~25M-40M working developers globally. Initial GTM: indie-hacker / engineer-influencer marketing on dev Twitter, Hacker News, dev.to. Then organic growth via the team-shared tier (an engineer brings it home from individual use, recommends it to their team).

Competitive landscape: Pluralsight Flow and LinearB are the closest comparables but operate at the team/manager level, not individual. Wakatime tracks coding time but doesn't surface qualitative patterns. Cursor and Copilot are AI-assisted coding tools, not observability. The closest mental analog is something like a personal Garmin/Whoop for engineering productivity — analytics on your own behavior, surfacing patterns you couldn't see while inside the work.

Build complexity: IDE plugin engineering is well-trodden but not trivial. VSCode plugin API is solid; JetBrains plugin API is more complex. Local data storage and analysis: SQLite + a daily summarization pass via a small local LLM (we can use a 7B-parameter quantized model for the pattern-extraction layer). UI: web-based dashboard rendered from local data, served by a small bundled server. The pattern-extraction logic is the actual product moat — figuring out which patterns are signal vs noise, which weekly reports actually change behavior, which recommendations land vs feel like nagging. That's months of iteration on real engineer behavior data.

I'm a senior engineer (12 years) at a FAANG, recently built developer experience internal tooling for a 600-engineer org, so I've seen what data is available, what works, what doesn't. I have $40k savings. Plan to run this nights and weekends for 6-9 months while keeping the day job, then jump full-time once there's revenue signal.`,
  v4s27_baseline: null,
  gates_targeted: ["G_STAGE_TC_PARSE"],
};

// ─────────────────────────────────────────
// V8.1 SPECIFICITY GATE ANCHORS
// ─────────────────────────────────────────

const GATE_A1 = {
  id: "GATE-A1", lane: "Gate", pipeline: "PRO",
  purpose: "V8.1 multi-product PASS canonical (restaurant manager). G_GATE_A1_PASS primary anchor. NOTE: NOT same as AUDIT-A1 (V4S27 wrapper resume case).",
  profile: { coding: "Intermediate", ai: "Regular AI user", education: "Senior product manager at B2B SaaS (6 years), shipped multi-tenant features" },
  idea: "I'm building a tool for restaurant managers to handle inventory, customer loyalty, and staff scheduling. It would send POS integration alerts when inventory is low, run email campaigns with personalized offers based on order history, and let managers swap shifts on a mobile interface.",
  v4s27_baseline: null,
  gates_targeted: ["G_GATE_A1_PASS"],
};

const GATE_D2 = {
  id: "GATE-D2", lane: "Gate", pipeline: "PRO",
  purpose: "V8.1 collapse-pattern rescue PASS (collapse-pattern via 'for X to verb-object'). G_GATE_D2_PASS primary anchor. Tests V8.1 v3 code-layer rescue.",
  profile: { coding: "Beginner", ai: "Some AI experience", education: "Healthcare administrator (4 years)" },
  idea: "A platform for small clinics to schedule patient appointments.",
  v4s27_baseline: null,
  gates_targeted: ["G_GATE_D2_PASS"],
};

const GATE_G2 = {
  id: "GATE-G2", lane: "Gate", pipeline: "PRO",
  purpose: "V8.1 documented residual false-reject (`for X that` patterns). EXPECTED to gate-FAIL per cost-asymmetry principle. Conservative-scope rescue intentionally does not match this pattern.",
  profile: { coding: "Beginner", ai: "Some AI experience", education: "Solo founder" },
  idea: "An idea for a tool that helps freelancers manage their projects.",
  v4s27_baseline: null,
  gates_targeted: [], // expected gate-FAIL (residual)
  expectedGateBehavior: "FAIL",
};

// ─────────────────────────────────────────
// EVIDENCE STRENGTH ANCHORS (NEW)
// ─────────────────────────────────────────

const OPTZ_MEDIUM = {
  id: "OPTZ-MED", lane: "H-evidence", pipeline: "PRO",
  purpose: "Lens N + G_OPTION_Z_MEDIUM gate. Well-specified across user/use_case/mechanism/pricing/distribution. Missing only validation evidence (no waitlist, no design partner, no proof of demand). Should land MEDIUM with input-actionable richness gap reason — NOT 'prove the market'.",
  profile: { coding: "Intermediate", ai: "Regular AI user", education: "Senior product manager at B2B SaaS (8 years), shipped pricing-page redesigns" },
  idea: "A pricing-page A/B testing tool for B2B SaaS companies under $5M ARR. Marketers paste their existing pricing page URL, the tool generates 4 variant layouts (anchor-pricing, feature-bundling, social-proof-emphasis, simplified-tier) using their existing copy and brand. Splits live traffic via JS snippet, tracks form submits and trial signups, surfaces winning variant after 14 days at 95% confidence. $299/month flat, no per-visitor pricing. Targets growth marketers at companies with 10K-100K monthly visitors who don't have engineering resources for pricing experiments. Direct competitors: VWO ($300+/mo, requires dev setup), Optimizely (enterprise pricing). Wedge: zero-code setup + B2B SaaS-specific variants vs general-purpose A/B tools.",
  v4s27_baseline: null,
  gates_targeted: ["G_OPTION_Z_MEDIUM"],
};

const SPARSE_LOW = {
  id: "SPARSE-LOW", lane: "H-evidence", pipeline: "PRO",
  purpose: "Lens N LOW state + thin_dimensions emission. Sparse enough to land LOW on Stage 2b but specific enough to pass V8.1 gate. Verifies asymmetric LOW callout + thin_dimensions bullets render with use_case/mechanism enum.",
  profile: { coding: "Beginner", ai: "Some AI experience", education: "Marketing manager at mid-size SaaS company" },
  idea: "An app for marketing managers to track which content pieces drove the most pipeline. Connects to HubSpot and shows attribution per blog post or campaign.",
  v4s27_baseline: null,
  gates_targeted: ["G_ENUM_COMPLIANCE"],
};

const SPARSE_LOW_FREE = {
  id: "SPARSE-LOW-std", lane: "H-evidence", pipeline: "FREE",
  purpose: "B9 thin_dimensions Free parity verification. Same input as SPARSE-LOW run through Standard pipeline. G_FREE_THIN_DIMENSIONS primary anchor. Verifies Free prompt.js emits thin_dimensions array with renamed enum (target_user/use_case/mechanism, NOT workflow/core_feature).",
  profile: { coding: "Beginner", ai: "Some AI experience", education: "Marketing manager at mid-size SaaS company" },
  idea: "An app for marketing managers to track which content pieces drove the most pipeline. Connects to HubSpot and shows attribution per blog post or campaign.",
  v4s27_baseline: null,
  gates_targeted: ["G_FREE_THIN_DIMENSIONS", "G_ENUM_COMPLIANCE"],
};

// ─────────────────────────────────────────
// DOGFOOD (sanity, NOT HIGH gate)
// ─────────────────────────────────────────

const DOGFOOD_IDEALOOP = {
  id: "DOGFOOD-IDEALOOP", lane: "Z-dogfood", pipeline: "PRO",
  purpose: "End-to-end long-input sanity. Stage 3 max_tokens 8192 verification. Parser stability on elaborate ~5000-char input. NOT a HIGH gate per ChatGPT pushback 6 — score expectations open, honesty standard preserved.",
  profile: { coding: "Intermediate", ai: "Advanced AI user (Claude + Cursor daily)", education: "Solo developer, building IdeaLoop Core, no prior shipped startup" },
  idea: `IdeaLoop Core is an AI-powered startup idea evaluation tool. Builders paste a startup idea (any length, any specificity) and a brief founder profile (coding skill, AI experience, domain background). The pipeline runs a multi-stage evaluation:

Stage 1 generates competitive landscape via Serper.dev web search + GitHub API for technical alternatives. Stage 2a builds evidence packets per scoring metric. Stage 2b scores the idea on Market Demand, Monetization Opportunity, Originality, and Technical Complexity (1-10 each) with explanations and confidence calibration. Stage 2c synthesizes the verdict Summary and 2-4 prioritized failure risks (with one Risk 3 slot reserved for founder-fit gaps when they exist). Stage 3 produces an Execution Reality block (duration estimate, difficulty, named Main Bottleneck) and a phased Roadmap with success criteria per phase.

Outputs include: scored metrics with anchored explanations, a synthesis Summary that surfaces the binding constraint, prioritized risks with archetype tags (Technical Build / Buyer Access / Trust / Capital / Sales), an Execution Reality block calibrated to the founder profile, a sequenced Roadmap, a "How It Compares" landscape view, a competitor list with evidence-strength tags, and idea-comparison and re-evaluation workflow features.

Pricing: free tier ("Standard") gives one synthesis pipeline pass without evidence packets; Pro tier ("Deep Analysis") gives the full pipeline including evidence packets, asymmetric Evidence Strength calibration, and the workflow features. Pro is $29/month or pay-as-you-go at $2/eval. Target: indie hackers and idea-rich solo builders who want honest stress-testing before committing 6+ months of build time. Competitive positioning: not a validator that flatters users; explicitly framed as "upstream decision infrastructure" — designed to surface why an idea might fail before the user spends real time on it.

Built on Next.js, Anthropic API (Sonnet for scoring + Haiku for specificity gate + keyword extraction), Serper.dev for web search, Supabase (Postgres + Auth) for persistence, Vercel for hosting. Solo developer, Turkey-based, payments via Paddle (merchant of record). Pre-launch — pre-launch audit (V4S28) currently closing.`,
  v4s27_baseline: null,
  gates_targeted: [], // sanity only
};

// ============================================
// EXPORT — full bank manifest
// ============================================

const ALL_CASES = [
  // Layer 1 — Original V4S27 audit (34 cases)
  AUDIT_H1, AUDIT_H2, AUDIT_H3, AUDIT_H4,
  AUDIT_M1, AUDIT_M2, AUDIT_M3, AUDIT_M4,
  AUDIT_L1, AUDIT_L2, AUDIT_S2,
  AUDIT_A1, AUDIT_A2, AUDIT_A3,
  AUDIT_B1, AUDIT_B2, AUDIT_B3,
  AUDIT_R1, AUDIT_R2, AUDIT_R3,
  AUDIT_MAT1_BEG, AUDIT_MAT1_INT, AUDIT_MAT1_SEN,
  AUDIT_MAT2_BEG, AUDIT_MAT2_INT, AUDIT_MAT2_SEN,
  AUDIT_MAT3_INSIDER, AUDIT_MAT3_TECHNOACCESS, AUDIT_MAT3_PARTIAL,
  AUDIT_H2_STD, AUDIT_M1_STD, AUDIT_S2_STD, AUDIT_A1_STD,
  AUDIT_SP1, AUDIT_MD1,
  // Layer 2 — V4S28-specific additions (12 cases)
  ARC_C1, ARC_D1, ARC_D2, ARC_E1,
  SHERPA,
  GATE_A1, GATE_D2, GATE_G2,
  OPTZ_MEDIUM, SPARSE_LOW, SPARSE_LOW_FREE,
  DOGFOOD_IDEALOOP,
];

const CASES_BY_LANE = {};
for (const c of ALL_CASES) {
  if (!CASES_BY_LANE[c.lane]) CASES_BY_LANE[c.lane] = [];
  CASES_BY_LANE[c.lane].push(c);
}

const TIER3_BOUNDARY_TRIPLES = [
  "AUDIT-H2",   // V4S27 MEDIUM, on bimodality boundary
  "AUDIT-M1",   // V4S27 HIGH, also borderline
  "OPTZ-MED",   // expected MEDIUM, boundary candidate
];

module.exports = {
  ALL_CASES,
  CASES_BY_LANE,
  TIER3_BOUNDARY_TRIPLES,
  // Individual exports for runner introspection
  AUDIT_H1, AUDIT_H2, AUDIT_H3, AUDIT_H4,
  AUDIT_M1, AUDIT_M2, AUDIT_M3, AUDIT_M4,
  AUDIT_L1, AUDIT_L2, AUDIT_S2,
  AUDIT_A1, AUDIT_A2, AUDIT_A3,
  AUDIT_B1, AUDIT_B2, AUDIT_B3,
  AUDIT_R1, AUDIT_R2, AUDIT_R3,
  AUDIT_MAT1_BEG, AUDIT_MAT1_INT, AUDIT_MAT1_SEN,
  AUDIT_MAT2_BEG, AUDIT_MAT2_INT, AUDIT_MAT2_SEN,
  AUDIT_MAT3_INSIDER, AUDIT_MAT3_TECHNOACCESS, AUDIT_MAT3_PARTIAL,
  AUDIT_H2_STD, AUDIT_M1_STD, AUDIT_S2_STD, AUDIT_A1_STD,
  AUDIT_SP1, AUDIT_MD1,
  ARC_C1, ARC_D1, ARC_D2, ARC_E1,
  SHERPA,
  GATE_A1, GATE_D2, GATE_G2,
  OPTZ_MEDIUM, SPARSE_LOW, SPARSE_LOW_FREE,
  DOGFOOD_IDEALOOP,
};

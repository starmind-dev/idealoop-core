// run-b9.js (v2)
// V4S28 B9 — Evidence Strength contract verification runner (COMPREHENSIVE)
// =========================================================================
//
// Tests the post-B9-v2 Stage 2b Evidence Strength contract via SSE call to
// /api/analyze-pro. Designed from a user-perspective angle — not just
// contract correctness.
//
// v2 deltas vs v1 runner:
//   - T6 materiality regex EXPANDED to match constructive phrasings the model
//     actually uses (was too narrow — only matched "would [verb]" patterns,
//     produced 56% false-fail rate on v1 even though reasons were good).
//     v2 also matches: "changes/affects/shifts the [section]", "is not
//     stated/articulated/specified/operationalized", "incumbents like X
//     already provide", and human-readable section names (B9 v2 addition).
//   - Case bank, SSE caller, iteration logic, all other gates: UNCHANGED
//     from v1 runner. Same idea bank validates v2 prompt patches against
//     same behavior contract.
//
// FIVE PASSES:
//   A — Pro main bank (23 cases, 4 groups)
//   B — Length variance (3 cases, same idea at 3 lengths)
//   C — Free pipeline parity (3 cases, observational)
//   D — Iteration simulation (3 chains, dynamic gap-fill simulation)
//   E — Variance reruns (2 reruns of key cases)
//
// Total: ~38 API calls ≈ 115 min wall time.
//
// Pre-flight check (B5 standing discipline): runs ONE warm-up case to verify
// extraction shape before launching full bank.
//
// Usage:
//   Terminal 1: npm run dev
//   Terminal 2: node run-b9.js
//
// TEN THRESHOLDS / CHECKS (LOCKED before running per methodology principle 6):
//   T1 — HIGH precision on G1 (rich):              >= 75%  GATED
//   T2 — MEDIUM recall on G2 (sparse):             >= 60%  GATED
//   T3 — Regression precision on G3:               >= 75%  GATED  ← load-bearing
//   T4 — Evidence-side leakage rate:               <= 10%  GATED
//   T5 — Generic hedging rate:                     <= 10%  GATED
//   T6 — Materiality phrasing rate:                >= 80%  GATED
//   T7 — Iteration stability (no goalposts):       >= 2/3 chains clean  GATED
//   T8 — Length-MEDIUM correlation:                MEDIUM at 50w > MEDIUM at 800w  GATED
//   T9 — Variance stability:                       same idea same level on rerun  OBSERVATIONAL
//   T10 — Templating risk:                          no single gap > 70% of MEDIUMs  OBSERVATIONAL
//
// What this runner does NOT test (intentional scope):
//   - Score values themselves (this is contract-test, not score-calibration)
//   - Haiku gate behavior (B7 runner already covers; gate logic unchanged)
//   - Frontend UX (manual smoke tests handle this)
//   - Pipeline cascade behavior under LOW (B5/B6 covered)
//   - TC adjustment-math (own session per V4S28 plan)

import fs from "fs/promises";

const BASE_URL = process.env.B9_BASE_URL || "http://localhost:3000";
const PROFILE = { coding: "Intermediate", ai: "Some", education: "" };
// Stage 2b is profile-blind by V4S28 B6 atomic strip. Profile content does
// not affect evidence_strength. Sending realistic shape for route parsing.

// ============================================
// DETECTOR REGEX BANKS
// ============================================
const EVIDENCE_SIDE_LEAKAGE = [
  /\bunder[- ]evidenced\b/i,
  /\bunproven\b/i,
  /\blacking\s+validation\b/i,
  /\block\s+of\s+validation\b/i,
  /\bsearch\s+(?:shows|returned|results?|surfaced)\b/i,
  /\bincumbent\s+behavior\s+varies\b/i,
  /\bevidence\s+(?:base\s+)?varies\b/i,
  /\bno\s+signal\s+of\b/i,
  /\bno\s+data\s+on\b/i,
  /\bexternal\s+validation\s+(?:lacking|missing|absent)\b/i,
  /\bbuyer\s+urgency\s+is\s+under/i,
  /\badoption\s+mechanism\s+is\s+unproven/i,
  /\breplication\s+barrier\s+(?:is\s+)?unclear\b/i,
  /\bcompetitor\s+evidence\s+(?:is\s+)?(?:thin|sparse|limited)\b/i,
  /\btrust\s+barrier\s+is\s+high\b/i,
  /\bcompetition\s+is\s+intense\b/i,
  /\badoption\s+could\s+be\s+hard\b/i,
];

const GENERIC_HEDGING = [
  /\bcould\s+be\s+stronger\b/i,
  /\bsome\s+uncertainty\b/i,
  /\bwell[- ]understood\s+but\b/i,
  /\breasonably\s+established\b/i,
  /\bgenerally\s+well\b/i,
  /\bsome\s+aspects\b/i,
  /\bclear\s+market\s+with\s+some\b/i,
  /\bnot\s+fully\s+certain\b/i,
];

const MATERIALITY_POSITIVE = [
  // "would [verb]" patterns — the prompt's locked good-example structure
  /\bwould\s+lead\s+to\b/i,
  /\bwould\s+each\s+lead\b/i,
  /\bwould\s+change\b/i,
  /\bwould\s+shift\b/i,
  /\bwould\s+make\b/i,
  /\bwould\s+meaningfully\b/i,
  /\bwould\s+materially\b/i,
  // "changes the X" / "affects the X" / "shifts the X" patterns — used naturally
  // by the model for constructive MEDIUM reasons
  /\bchanges?\s+the\s+(?:monetization|market|demand|originality|technical|roadmap|competitor|evaluation|framing|read)/i,
  /\baffects?\s+the\s+(?:monetization|market|demand|originality|technical|roadmap|competitor|evaluation|framing|read)/i,
  /\bshifts?\s+the\s+(?:monetization|market|demand|originality|technical|roadmap|competitor|evaluation|framing|read)/i,
  // "X is not stated" / "X is not articulated" — explicit gap-naming
  /\bis\s+not\s+(?:stated|articulated|specified|operationalized|addressed|distinguished)\b/i,
  /\bare\s+not\s+(?:stated|articulated|specified|operationalized|addressed)\b/i,
  /\bbut\s+not\s+(?:stated|articulated|specified|operationalized|addressed|distinguished)\b/i,
  // "but [contrast]" patterns — names competitor/incumbent then states gap
  /\b(?:incumbents?|competitors?|already)\s+(?:like|provide|offer|cover)\b/i,
  // Section-naming pattern (B9 v2 addition) — using human-readable section name
  // signals the model is following the affected-section guidance
  /\b(?:Market\s+Demand|Monetization\s+Potential|Originality|Technical\s+Complexity|Roadmap|Competitor\s+read)\b/,
];

// Gap-type classifier — used for templating analysis (T10) and iteration
// pass goalposts detection (T7). Maps reason text to a coarse gap label.
function classifyGap(reason) {
  if (!reason) return "uncategorized";
  const r = reason.toLowerCase();
  if (/\bpricing\b|\bprice\b|\bmonetiz/.test(r)) return "pricing";
  if (/\bbuyer\b|who\s+pays|user\s+vs|distinguish/.test(r)) return "buyer-vs-user";
  if (/\bdistribution\b|\bchannel\b|\breach\b|go-to-market|\bgtm\b/.test(r)) return "distribution";
  if (/\bcompetit|\bpositioning\b|\bdifferentiat/.test(r)) return "positioning";
  if (/\bsegment\b|\btarget\b|\bniche\b/.test(r)) return "segment";
  if (/\bmechanism\b|operationaliz|first\s+action/.test(r)) return "mechanism";
  return "uncategorized";
}

// ============================================
// CASE BANK — Pass A (Pro main, 23 cases)
// ============================================
const CASES = [
  // ============================================
  // G1 — Rich inputs (HIGH expected). 6 cases covering domain + length variance.
  // ============================================
  {
    id: "G1-IDEALOOP-4K",
    group: "G1-rich",
    expected: "HIGH",
    idea: `IdeaLoop Core is an AI-powered startup idea evaluation SaaS positioned as upstream decision infrastructure for idea-rich builders. The product stress-tests ideas against real market friction, competition data from GitHub and Google search, and monetization logic — rather than offering generic validation like ChatGPT does. Target buyer: ambitious solo founders and indie builders aged 22-40 who generate multiple ideas per quarter, currently waste 2-6 weeks per idea on shallow validation, and have $20-200/month software budgets. Distribution is content-led (founder Twitter, IndieHackers, Product Hunt) plus partnerships with accelerators. Three monetization paths under evaluation: PAYG credits ($5 per evaluation), subscription ($29/mo for 20 evals + workspace features), and Pro tier ($99/mo for advanced models + comparison + lineage). Tech stack: Next.js + Anthropic API (Sonnet + Haiku) + Serper.dev + GitHub API + Supabase + Vercel. Free preview tier offers 2 lifetime Standard evaluations to seed acquisition. Direct competitors include Validator AI and IdeaCheck, neither of which run isolated multi-stage Sonnet pipelines or surface evidence-grounded competitor data.`,
    purpose: "The 4K bug-regression case from B8 closure. Was MEDIUM with 'buyer urgency under-evidenced'. Must HIGH.",
  },
  {
    id: "G1-LAW-FULL",
    group: "G1-rich",
    expected: "HIGH",
    idea: "AI-powered document automation tool for small law firms (under 20 attorneys, primarily commercial real estate practice). Sold per-seat at $99/month with annual billing. Ingests client intake forms, generates draft engagement letters, retainer agreements, and client memos based on firm-specific templates uploaded during onboarding. Distribution via Clio Marketplace integration and content marketing on lawyer-focused podcasts. Differentiates from Spellbook and Harvey AI by targeting smaller firms (5-20 attorneys vs enterprise) with simpler UI and lower price point.",
    purpose: "Well-formed legal SaaS. Tests HIGH on regulated/professional services domain.",
  },
  {
    id: "G1-B2B-FULL",
    group: "G1-rich",
    expected: "HIGH",
    idea: "AI sales intelligence tool for SMB account executives selling B2B SaaS in the $5K-50K ACV range. The product ingests CRM data (Salesforce, HubSpot) plus prospect company signals (job postings, funding, tech stack changes), generates personalized outreach drafts, and identifies highest-fit accounts weekly. Pricing is per-rep ($79/month) with team plans at 5+ seats. Distribution via Salesforce AppExchange + content marketing to RevOps leaders. Competitive positioning against Apollo and Clay focuses on workflow integration depth and lower per-seat cost than Outreach.",
    purpose: "B2B SaaS with full richness. Tests HIGH on standard B2B domain.",
  },
  {
    id: "G1-HEALTH-FULL",
    group: "G1-rich",
    expected: "HIGH",
    idea: "AI clinical documentation assistant for primary care physicians at independent practices (1-5 doctor groups). The product ambient-listens during patient encounters via mobile app, generates SOAP-format note drafts that the physician edits and signs, and pushes structured data into the EHR via FHIR APIs. Pricing: $200/month per physician, no setup fees. Distributed via state medical association partnerships and direct outreach to practice administrators. HIPAA-compliant infrastructure on AWS HealthLake. Differentiates from Abridge and Suki by focusing on small independent practices (vs enterprise health systems) with simpler EHR integration scope.",
    purpose: "Healthcare/regulated full richness. Tests that high-trust domain doesn't trigger defensive MEDIUM.",
  },
  {
    id: "G1-MARKETPLACE-FULL",
    group: "G1-rich",
    expected: "HIGH",
    idea: "AI-curated freelance marketplace for technical writers serving B2B SaaS companies. Take rate: 15% on each engagement (industry standard 20-25%, undercutting). Two-sided cold-start solved by recruiting 50 vetted writers in beta (already done) before opening the buyer side. Buyer acquisition: outbound to RevOps and PMM leaders at Series A-C SaaS companies via LinkedIn, plus partnerships with companies like Lavender and Gong. Differentiates from Upwork and Contra by domain-specific vetting (technical writing for SaaS specifically) and AI-assisted brief-writing for buyers who don't know how to scope writing work.",
    purpose: "Marketplace domain with full richness — tests HIGH on network-effect business model where 'cold start' would have been the OLD MEDIUM hedge.",
  },
  {
    id: "G1-LONG-1500W",
    group: "G1-rich",
    expected: "HIGH",
    idea: `Sherpa is a developer experience monitoring platform built for engineering managers and platform engineering teams at mid-market SaaS companies (50-500 engineers). The core insight is that current dev tooling — incident response (PagerDuty, Opsgenie), CI/CD analytics (LinearB, Faros), and code quality (SonarCloud, Codacy) — measure outputs but not the developer experience itself. Engineers report whether their last week was productive in retrospective meetings; managers learn about friction six weeks after it started causing attrition.

Sherpa instruments developer environments through three channels: (1) IDE plugin (VSCode + JetBrains) capturing context-switch frequency, build wait times, and time-to-resolution for local-environment friction; (2) Slack integration capturing question-asking patterns, async-vs-sync work distribution, and after-hours messaging; (3) Git/CI integration capturing PR cycle time, review wait time, and rebase frequency. The product synthesizes these signals into a weekly per-team developer experience score with actionable diagnostics — e.g., "Team Voyager spent 14 hours this week waiting on CI; the longest wait was on the auth-service pipeline."

Target buyer is the VP Engineering or Director of Platform Engineering at a 50-500 engineer org. These buyers have budget authority (typically $50K-$200K annual line item for dev productivity tooling) and pain (their job title is increasingly evaluated on engineering velocity metrics they can't directly observe). The user is the engineering manager or staff engineer who looks at the weekly report.

Pricing: $25/engineer/month with annual contracts, billed quarterly. At a 200-engineer org that's $60K ARR, sized to be approvable without procurement review at most companies in the target segment. Pro tier at $40/engineer adds custom dashboards, API access, and the ability to feed signals into existing data warehouses (Snowflake, BigQuery).

Distribution is two-pronged. The bottom-up motion targets staff engineers and engineering managers via content (newsletter, podcast appearances on devtools shows) and a free tier that gives a single team's worth of telemetry. The bottom-up motion exists to generate champions inside companies. The top-down motion is direct outreach to VP Engineering personas at companies that have just raised Series B-D and are entering the headcount-doubling phase where developer experience pain peaks. Conferences include LeadDev, KubeCon platform engineering tracks, and SREcon.

Competitive landscape: LinearB and Jellyfish are the closest competitors but operate at the engineering management analytics layer (PR cycle time, sprint velocity) rather than IDE-level instrumentation. Honeycomb's recent dev productivity additions are observability-adjacent rather than experience-focused. Faros is data-warehouse-positioned (you bring the data, they correlate it). Sherpa's wedge is the IDE plugin — it captures friction signals that none of the competitors can see because they only ingest already-emitted CI/Git/PM data. The risk is that one of the established players adds an IDE plugin; mitigation is the depth of the diagnostic engine (which improves with usage data the competitors don't have).`,
    purpose: "Long high-effort user input (~1500 words). Verifies HIGH default holds at extreme richness.",
  },

  // ============================================
  // G2 — Sparse-but-passable (MEDIUM expected). 8 cases covering domain breadth + gap discrimination.
  // ============================================
  {
    id: "G2-DENTAL-MIN",
    group: "G2-sparse",
    expected: "MEDIUM",
    idea: "AI scheduling assistant for dental receptionists that drafts patient follow-ups.",
    purpose: "Sparse-but-passable. All 3 slots minimally present. Missing: pricing, buyer-vs-user, positioning.",
  },
  {
    id: "G2-LEGAL-MIN",
    group: "G2-sparse",
    expected: "MEDIUM",
    idea: "AI tool for solo lawyers that automates the drafting of client engagement letters from intake forms.",
    purpose: "Different domain, sparse-but-passable. Missing: pricing, distribution, positioning.",
  },
  {
    id: "G2-ECOM-MIN",
    group: "G2-sparse",
    expected: "MEDIUM",
    idea: "AI Shopify pricing optimizer that suggests price changes based on competitor data and demand signals.",
    purpose: "E-commerce sparse case. Missing: pricing model, target merchant size, positioning.",
  },
  {
    id: "G2-DEV-TOOL-MIN",
    group: "G2-sparse",
    expected: "MEDIUM",
    idea: "AI code review assistant for backend engineers that catches subtle concurrency bugs.",
    purpose: "Dev tool sparse case. Missing: pricing, integration surface (which IDEs/repos), positioning vs CodeRabbit/Greptile.",
  },
  {
    id: "G2-CREATOR-MIN",
    group: "G2-sparse",
    expected: "MEDIUM",
    idea: "AI tool for YouTubers that generates titles, thumbnails, and chapter timestamps from raw video uploads.",
    purpose: "Creator economy sparse. Missing: pricing, target creator size (under 10K subs vs 1M+), positioning.",
  },
  {
    id: "G2-EDUCATION-MIN",
    group: "G2-sparse",
    expected: "MEDIUM",
    idea: "AI tutoring assistant for high school students preparing for AP exams that adapts question difficulty based on response patterns.",
    purpose: "Education sparse. Missing: pricing (B2C parent-paid vs B2B school-licensed), buyer-vs-user, distribution.",
  },
  {
    id: "G2-NO-PRICING",
    group: "G2-sparse",
    expected: "MEDIUM",
    idea: "AI inventory forecasting tool for independent restaurant operators (1-5 locations). Ingests POS data, weather, and local event calendars to predict 7-day ingredient demand and auto-generate purchase orders. Distributes via direct outreach to restaurant tech blogs and POS partner integrations. Differentiated from Toast Inventory and MarketMan by AI-driven forecasting depth.",
    purpose: "Discrimination test: only pricing missing. MEDIUM should specifically name pricing model.",
  },
  {
    id: "G2-NO-POSITIONING",
    group: "G2-sparse",
    expected: "MEDIUM",
    idea: "AI tool for indie podcasters that auto-generates show notes, timestamps, and social media clips from raw audio. Pricing: $29/month flat. Distribution via podcast-host partnerships (Buzzsprout, Transistor) and creator-focused newsletters. Target: solo podcasters with under 10K monthly downloads.",
    purpose: "Discrimination test: pricing + buyer + distribution all named, but competitive positioning absent. MEDIUM should fire on positioning.",
  },

  // ============================================
  // G3 — Pre-bug regression (HIGH must hold). 5 cases mapping to OLD evidence-side MEDIUM patterns.
  // ============================================
  {
    id: "G3-FOUNDER-TOOLS",
    group: "G3-regression",
    expected: "HIGH",
    idea: "Founder OS — an AI workspace for early-stage founders that consolidates idea evaluation, customer interview synthesis, GTM planning, and weekly priority surfacing into one tool. Target buyer: solo or 2-person founding teams pre-Series A, earning <$10K MRR, currently juggling 6+ tools (Notion, ChatGPT, Linear, Loom, Granola, etc.). Pricing: $39/month with annual discount. Distribution: founder community partnerships (IndieHackers, On Deck, YC alumni network), content on Twitter and Substack. Positioned against Linear (too eng-focused) and Notion (no AI synthesis) by offering founder-specific workflow templates and AI synthesis across surfaces.",
    purpose: "Pre-B9 bug pattern: founder/startup tool would fire MEDIUM 'buyer urgency under-evidenced'. Now must HIGH.",
  },
  {
    id: "G3-RESEARCH-TOOL",
    group: "G3-regression",
    expected: "HIGH",
    idea: "AI literature synthesis tool for graduate researchers in life sciences. Ingests user's paper library + new arXiv/PubMed releases weekly, generates synthesized literature reviews, identifies gaps in field, and suggests follow-up experiments grounded in cited methodology. Pricing: $19/month student tier, $49/month for postdocs/PIs. Distribution via university library partnerships and research-Twitter. Differentiates from Elicit and Scite by deeper methodology grounding and follow-up suggestion capability.",
    purpose: "Pre-B9 bug: academic tool would fire MEDIUM 'adoption mechanism unproven'. Now must HIGH.",
  },
  {
    id: "G3-CLINICAL-AI",
    group: "G3-regression",
    expected: "HIGH",
    idea: "AI prior authorization assistant for specialty pharmacy benefit managers (PBMs). Ingests prescription data + payer coverage rules + clinical documentation, drafts prior auth submissions, predicts approval likelihood, and routes denials for human review. Sold per-PBM seat at $499/month. Distribution via PBM industry conferences (AMCP) and direct outreach to PBM operations leadership. Positioned against CoverMyMeds and Surescripts by specialty-pharmacy-specific workflow depth and deeper clinical-context modeling.",
    purpose: "Pre-B9 bug: clinical tool would fire MEDIUM 'trust barrier high in clinical workflows'. Now must HIGH.",
  },
  {
    id: "G3-FINTECH-CONSUMER",
    group: "G3-regression",
    expected: "HIGH",
    idea: "AI personal finance coach for millennial professionals earning $80K-200K. Connects to bank accounts via Plaid, analyzes spending patterns, identifies savings opportunities, and provides weekly personalized financial guidance via chat. Pricing: $14/month with 30-day free trial. Distribution via TikTok personal finance creators + Reddit r/personalfinance partnerships. Differentiates from Mint (passive) and Cleo (gimmicky) with substantive AI coaching grounded in user's actual data.",
    purpose: "Pre-B9 bug: consumer fintech would fire MEDIUM 'consumer adoption hard / willingness to pay uncertain'. Now must HIGH.",
  },
  {
    id: "G3-MARKETPLACE-RICH",
    group: "G3-regression",
    expected: "HIGH",
    idea: "Two-sided marketplace connecting independent fitness coaches with clients for hybrid in-person/remote training. Take rate: 18% per session (vs Trainerize 20%, MyPTHub 25%). Cold-start solved supply-side first: 200 coaches recruited via direct outreach to gym managers in target metros (NYC, LA, Austin, Miami). Demand-side launching with paid acquisition + partnership with ClassPass for client overflow. Pricing for coaches: free to list, 18% take rate, $29/month optional Pro tier for analytics and white-labeled booking pages. Differentiates from existing fitness marketplaces by supporting hybrid (in-person + video) sessions with integrated session-recording for asynchronous form review between sessions.",
    purpose: "Pre-B9 bug: marketplace would fire MEDIUM 'cold-start risk' or 'two-sided liquidity unproven'. Now must HIGH.",
  },

  // ============================================
  // G4 — Edge cases. 4 cases covering input shape variance.
  // ============================================
  {
    id: "G4-BRAIN-DUMP",
    group: "G4-edge",
    expected: "HIGH",
    idea: "OK so I've been thinking about this for months and I want to build something for solo therapists who run their own private practice. They use SimplePractice or Jane App for scheduling/notes/billing but those are basically just admin tools. What I want is more like a clinical companion — they record their session (with patient consent obviously), AI generates the SOAP note, but ALSO it tracks themes across sessions over time, surfaces clinically relevant patterns the therapist might miss between weekly sessions, and prepares pre-session briefings 5 minutes before each appointment. Pricing I'm thinking $79/month per therapist, maybe team plans at $59/seat for group practices. Distribution would be via the AAMFT and APA practice-management content channels and partnerships with CE providers. Competitors are Eleos and Blueprint AI but Eleos is enterprise-focused (they sell to clinic chains, not solo practitioners) and Blueprint is more of a measurement-based-care tool than a clinical companion.",
    purpose: "Long rambling but all richness signals present. Should HIGH despite sloppy structure.",
  },
  {
    id: "G4-COMPARISON-IDEA",
    group: "G4-edge",
    expected: "MEDIUM",
    idea: "Notion but for therapists — a workspace that combines client notes, treatment planning, and outcome tracking specifically for mental health professionals.",
    purpose: "Comparison-as-idea (analogical specification). Likely MEDIUM (missing pricing/positioning/distribution).",
  },
  {
    id: "G4-PHILOSOPHICAL-PASS",
    group: "G4-edge",
    expected: "MEDIUM",
    idea: "I've been a primary care physician for 12 years and I've watched the documentation burden absolutely destroy my colleagues — burnout rates are catastrophic, two of my friends from residency left medicine entirely because of charting after-hours, and the existing AI scribes feel like a band-aid not a solution. What's needed is an AI clinical workflow tool that actually works the way doctors think, not the way EHR vendors design forms. The product would be ambient documentation plus structured-data generation plus workflow automation for prescription refills and prior auths.",
    purpose: "Long backstory + product mentioned at the end. Passes Haiku. MEDIUM (no pricing/distribution/positioning/buyer-vs-user clarity).",
  },
  {
    id: "G4-CHATGPT-MENTION",
    group: "G4-edge",
    expected: "MEDIUM",
    idea: "I asked ChatGPT and it told me my idea was great so I want a real check. The idea: AI tool for freelance graphic designers that auto-generates client revision summaries from email threads, so the designer doesn't have to manually parse 'can you make the logo bigger' across 12 messages.",
    purpose: "User mentions ChatGPT. Tests that meta-comment doesn't confuse Stage 2b. Real idea is sparse-but-passable; MEDIUM expected.",
  },
];

// ============================================
// Pass B — Length variance (3 cases, same idea at 3 lengths)
// ============================================
// Same product idea (an AI customer support tool for SaaS companies) expressed
// at 50w, 200w, 800w. Verifies that MEDIUM rate decreases as length/richness
// increases. T8 gate: 50w MEDIUM rate >= 800w MEDIUM rate.
const LENGTH_VARIANCE_CASES = [
  {
    id: "L-50W",
    group: "L-length",
    expected: "MEDIUM",
    idea: "AI customer support tool for SaaS companies that auto-drafts responses to common support tickets.",
    purpose: "50-word version of same idea. Sparse-but-passable, MEDIUM expected.",
  },
  {
    id: "L-200W",
    group: "L-length",
    expected: "MEDIUM",
    idea: "AI customer support tool for SaaS companies that auto-drafts responses to common support tickets. Targets B2B SaaS support teams of 3-15 agents, primarily companies with 100K+ MAUs where ticket volume is high. Integrates with Intercom, Zendesk, and HelpScout via official APIs. The drafting model fine-tunes on the company's historical resolved tickets so suggestions match their voice and known solutions. Sold per-seat at $49/month with team plans at 5+ seats.",
    purpose: "200-word version. Adds buyer detail + integrations + pricing. May go MEDIUM or HIGH.",
  },
  {
    id: "L-800W",
    group: "L-length",
    expected: "HIGH",
    idea: `Reslv is an AI customer support draft generator for B2B SaaS companies with support teams of 3-15 agents. The product targets a specific buyer pain: support teams at companies that have crossed 100K MAUs but haven't yet hit the threshold (typically Series C+) where they can justify a dedicated support engineering team or expensive enterprise tools like Ada or Forethought.

The mechanism: Reslv connects to the company's existing helpdesk (Intercom, Zendesk, or HelpScout via OAuth), trains a fine-tuned response model on the past 12 months of resolved tickets, and inserts itself as a "draft response" suggestion that appears when the support agent opens a new ticket. The agent edits the draft and sends — Reslv never auto-sends. This is the deliberate UX choice that distinguishes Reslv from competitors that go for full automation: support is a high-trust function, automation feels risky to teams that have been burned by chatbot deflection metrics that hide unresolved customer frustration.

Pricing is per-seat at $49/month with team plans at 5+ seats ($39/seat). The economics work because the average support agent at a target-segment company is paid $55-75K/year, and even modest time savings (20% on draft-writing) pay back the seat cost in the first month. Annual contracts are pushed for the team plan tier with a 15% discount.

Distribution has three channels: (1) Intercom + Zendesk app marketplace listings, where target buyers already discover support tooling; (2) outbound sales to Head of Support / Director of CX titles at target-segment companies, sourced via Apollo with Series C+ funding signals; (3) content marketing via the Support Driven community and the Customer Service Champions podcast.

Competitive positioning: Ada and Forethought serve the enterprise (50+ agent teams) with full automation and procurement-heavy sales cycles. Front and Help Scout's native AI features are baseline-quality and not focused on draft generation specifically. Resolve.ai (different company, similar wedge) targets developer-tools support, which is too narrow. Reslv's wedge is the underserved 3-15 agent segment with draft-not-auto-send framing that respects support team trust dynamics.

Tech: TypeScript backend on Cloudflare Workers, Postgres on Neon, fine-tuning via OpenAI API with optional Anthropic Claude for higher-trust tiers. Compliance: SOC 2 Type II in flight, GDPR-compliant from day one, no training on customer data without explicit opt-in.`,
    purpose: "800-word version with full richness. HIGH expected. Tests that length itself doesn't cause MEDIUM defensiveness.",
  },
];

// ============================================
// Pass C — Free pipeline parity (3 cases, observational)
// ============================================
const FREE_PARITY_CASES = [
  { sourceId: "G1-LAW-FULL", purpose: "HIGH parity check on Free pipeline" },
  { sourceId: "G2-DENTAL-MIN", purpose: "MEDIUM parity check on Free pipeline" },
  { sourceId: "G3-FOUNDER-TOOLS", purpose: "Regression parity check on Free pipeline" },
];

// ============================================
// Pass D — Iteration simulation (3 chains)
// ============================================
// Tests goalposts behavior: does Stage 2b shift gaps as user adds detail?
// Each chain starts sparse, then dynamically appends gap-fill text based on
// the actual MEDIUM reason returned by the model.
//
// Chain shape: 3 evals
//   Eval 1: sparse base input
//   Eval 2: base + addition for whichever gap MEDIUM identified
//   Eval 3: base + addition for that gap + addition for ANY new gap MEDIUM names
//
// Goalposts detection (T7):
//   - "Clean" if Eval 2 lands HIGH (the addition addressed the gap)
//   - "Clean" if Eval 2 stays MEDIUM but on the SAME gap class (model not following instructions but not goalposts)
//   - "GOALPOSTS" if Eval 2 stays MEDIUM with a DIFFERENT gap class (the user did what was asked, model moved the bar)

const ITERATION_CHAINS = [
  {
    id: "I-DENTAL",
    baseIdea: "AI scheduling assistant for dental receptionists that drafts patient follow-ups.",
    gapAdditions: {
      pricing: " Pricing: $39/month per receptionist, billed annually with team discounts at 5+ seats.",
      "buyer-vs-user": " The receptionist uses it day-to-day; the dental practice owner or office manager pays via a single firm-wide subscription.",
      distribution: " Distribution: direct outreach to dental practice management groups + partnerships with state dental association newsletters.",
      positioning: " Differentiated from Dentrix Practice Management and Open Dental by AI-first workflow design tuned for receptionists, not clinicians.",
      segment: " Specifically targeting solo and 2-3 dentist independent practices in suburban markets, not DSO chains.",
      mechanism: " First action when launched: scans the day's appointment list and surfaces patients with overdue follow-ups for one-click message drafts.",
      uncategorized: " Pricing: $39/month per receptionist. Differentiated from Dentrix and Open Dental by AI-first design.",
    },
  },
  {
    id: "I-FOUNDER",
    baseIdea: "AI workspace for early-stage founders that helps with idea evaluation and weekly priority planning.",
    gapAdditions: {
      pricing: " Pricing: $29/month with annual discount.",
      "buyer-vs-user": " Solo founders both use and pay; team plans coming later for co-founders.",
      distribution: " Distribution: founder Twitter, IndieHackers community partnerships, content on Substack.",
      positioning: " Differentiated from Notion AI by founder-specific structured idea evaluation and GTM templates, not generic note-taking.",
      segment: " Specifically targeting pre-Series A solo or 2-person founding teams generating multiple ideas per month.",
      mechanism: " First action: ingests an idea description and runs structured evaluation against real competitor data within 60 seconds.",
      uncategorized: " Pricing: $29/month. Differentiated from Notion AI by structured idea evaluation. Distribution via founder Twitter.",
    },
  },
  {
    id: "I-LEGAL",
    baseIdea: "AI tool for solo lawyers that automates the drafting of client engagement letters from intake forms.",
    gapAdditions: {
      pricing: " Sold per-attorney at $99/month with annual billing.",
      "buyer-vs-user": " Attorneys use it; the firm or managing partner pays via firm-wide subscription.",
      distribution: " Distribution via Clio Marketplace integration and content marketing on lawyer-focused podcasts.",
      positioning: " Differentiated from Spellbook and Harvey AI by targeting solo and small firms with simpler UI and lower price point.",
      segment: " Specifically targeting solo and small firms (under 20 attorneys) in commercial real estate practice.",
      mechanism: " First action: when an intake form is submitted, AI generates a draft engagement letter based on firm templates within 30 seconds.",
      uncategorized: " Pricing: $99/month per attorney. Differentiated from Spellbook and Harvey by targeting solo/small firms.",
    },
  },
];

// ============================================
// Pass E — Variance reruns (2 cases × 1 rerun each)
// ============================================
const VARIANCE_RERUNS = [
  { sourceId: "G1-IDEALOOP-4K", purpose: "Variance check on the load-bearing 4K case" },
  { sourceId: "G2-DENTAL-MIN", purpose: "Variance check on the canonical sparse-but-passable case" },
];

// ============================================
// SSE PIPELINE CALLER (matches B6 pattern)
// ============================================
async function callPipeline(endpoint, idea, profile) {
  const url = `${BASE_URL}${endpoint}`;
  const startTime = Date.now();

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea, profile }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} on ${endpoint}: ${await response.text()}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const events = [];
  let analysis = null;

  if (contentType.includes("text/event-stream")) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop();

      for (const rawEvent of parts) {
        if (!rawEvent.trim()) continue;
        const event = parseSseEvent(rawEvent);
        if (event) {
          events.push(event);
          const a = extractAnalysis(event);
          if (a) analysis = a;
        }
      }
    }
    if (buffer.trim()) {
      const event = parseSseEvent(buffer);
      if (event) {
        events.push(event);
        const a = extractAnalysis(event);
        if (a) analysis = a;
      }
    }
  } else {
    const json = await response.json();
    events.push({ event: "json_response", data: json });
    analysis = extractAnalysis({ event: "json_response", data: json });
  }

  const elapsedMs = Date.now() - startTime;
  return { analysis, events, elapsedMs };
}

function parseSseEvent(raw) {
  const lines = raw.split("\n");
  let event = "message";
  let dataLines = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  const dataStr = dataLines.join("\n");
  let data = dataStr;
  try { data = JSON.parse(dataStr); } catch (_) { /* keep as string */ }
  return { event, data };
}

function extractAnalysis(event) {
  const d = event.data;
  if (!d || typeof d !== "object") return null;
  if (d.step === "complete" && d.data && typeof d.data === "object") {
    const payload = d.data;
    if (payload.competition && payload.evaluation) return payload;
  }
  if (d.competition && d.evaluation) return d;
  return null;
}

function getEvaluation(analysis) {
  return (analysis && analysis.evaluation) || null;
}

// ============================================
// PRE-FLIGHT CHECK (B5 standing discipline)
// ============================================
async function preflightCheck() {
  console.log("\n=== Pre-flight check (B5 standing discipline) ===");
  console.log("Running ONE warm-up case to verify extraction shape...\n");

  const warmup = CASES.find((c) => c.id === "G1-LAW-FULL");
  if (!warmup) throw new Error("Pre-flight: G1-LAW-FULL not found in CASES bank");

  let result;
  try {
    result = await callPipeline("/api/analyze-pro", warmup.idea, PROFILE);
  } catch (err) {
    throw new Error(`Pre-flight: API call failed (${err.message}). Is the dev server running at ${BASE_URL}?`);
  }

  const evaluation = getEvaluation(result.analysis);
  const es = (evaluation && evaluation.evidence_strength) || null;

  const checks = {
    "analysis extracted": !!result.analysis,
    "evaluation present": !!evaluation,
    "evidence_strength present": !!es,
    "evidence_strength.level present": !!(es && typeof es.level === "string"),
    "evidence_strength.reason present": !!(es && typeof es.reason === "string"),
  };

  let allPassed = true;
  for (const [name, passed] of Object.entries(checks)) {
    console.log(`  ${passed ? "✓" : "✗"} ${name}`);
    if (!passed) allPassed = false;
  }

  if (!allPassed) {
    const completeEvent = result.events.find((e) => e.data && e.data.step === "complete");
    console.error("\nPre-flight FAILED. Raw complete event for debugging:");
    console.error(JSON.stringify(completeEvent, null, 2).slice(0, 2000));
    throw new Error("Pre-flight extraction shape mismatch — fix extractAnalysis() before running full bank");
  }

  console.log(`\n  Pre-flight PASS (${(result.elapsedMs / 1000).toFixed(1)}s)`);
  console.log(`  Warm-up evidence_strength: { level: "${es.level}", reason: "${es.reason.slice(0, 80)}${es.reason.length > 80 ? "..." : ""}" }`);
  console.log(`  Proceeding to full bank.\n`);

  return result;
}

// ============================================
// PER-CASE RUNNER
// ============================================
async function runCase(caseDef, endpoint = "/api/analyze-pro", labelOverride = null) {
  const tag = labelOverride || caseDef.id;
  process.stdout.write(`  ${tag.padEnd(30)} `);
  let result;
  try {
    result = await callPipeline(endpoint, caseDef.idea, PROFILE);
  } catch (err) {
    process.stdout.write(`ERROR: ${err.message}\n`);
    return {
      id: tag, group: caseDef.group, expected: caseDef.expected, purpose: caseDef.purpose,
      endpoint, idea: caseDef.idea, level: null, reason: null, thin_dimensions: null,
      gap: null, elapsedMs: 0, error: err.message, status: "ERROR",
    };
  }

  const evaluation = getEvaluation(result.analysis);
  const es = (evaluation && evaluation.evidence_strength) || {};
  const level = es.level || null;
  const reason = es.reason || "";
  const thin = Array.isArray(es.thin_dimensions) ? es.thin_dimensions : null;
  const gap = level === "MEDIUM" ? classifyGap(reason) : null;

  const status = level === caseDef.expected ? "OK" : "MISS";
  const statusIcon = status === "OK" ? "✓" : "✗";
  process.stdout.write(`expected=${caseDef.expected.padEnd(6)} got=${(level || "(null)").padEnd(6)} ${statusIcon}  (${(result.elapsedMs / 1000).toFixed(1)}s)\n`);
  if (reason) {
    process.stdout.write(`    reason: ${reason.slice(0, 140)}${reason.length > 140 ? "..." : ""}\n`);
  }

  return {
    id: tag, group: caseDef.group, expected: caseDef.expected, purpose: caseDef.purpose,
    endpoint, idea: caseDef.idea, level, reason, thin_dimensions: thin,
    gap, elapsedMs: result.elapsedMs, error: null, status,
  };
}

// ============================================
// DETECTOR APPLICATION (T4 / T5 / T6)
// ============================================
function detectReasonFlags(reason) {
  if (!reason) return { evidenceLeak: [], hedging: [], materiality: [] };
  return {
    evidenceLeak: EVIDENCE_SIDE_LEAKAGE.filter((re) => re.test(reason)).map((re) => re.source),
    hedging: GENERIC_HEDGING.filter((re) => re.test(reason)).map((re) => re.source),
    materiality: MATERIALITY_POSITIVE.filter((re) => re.test(reason)).map((re) => re.source),
  };
}

// ============================================
// ITERATION CHAIN RUNNER (Pass D)
// ============================================
async function runIterationChain(chain) {
  console.log(`\n  Chain: ${chain.id}`);
  const evals = [];

  // Eval 1 — base input
  const eval1Case = {
    id: `${chain.id}-EV1`,
    group: "I-iteration",
    expected: "MEDIUM",
    idea: chain.baseIdea,
    purpose: `Iteration ${chain.id} — base sparse input`,
  };
  const r1 = await runCase(eval1Case);
  evals.push(r1);

  if (r1.level !== "MEDIUM") {
    // Base wasn't MEDIUM — chain skips remaining evals, log observation
    console.log(`    ⚠ ${chain.id}: Eval 1 not MEDIUM (got ${r1.level}). Skipping iteration evals.`);
    return { chainId: chain.id, evals, goalpostStatus: "SKIPPED", reason: "Base eval did not produce MEDIUM" };
  }

  // Eval 2 — addition for the gap MEDIUM identified
  const gap1 = r1.gap || "uncategorized";
  const addition1 = chain.gapAdditions[gap1] || chain.gapAdditions.uncategorized;
  const eval2Case = {
    id: `${chain.id}-EV2`,
    group: "I-iteration",
    expected: "HIGH",
    idea: chain.baseIdea + addition1,
    purpose: `Iteration ${chain.id} — base + ${gap1} addition`,
  };
  const r2 = await runCase(eval2Case);
  evals.push(r2);

  // Goalposts determination based on Eval 2:
  //   HIGH → "CLEAN" (the gap was addressed, model recognized it)
  //   MEDIUM same gap → "STICKY" (model not seeing the addition; instruction-following issue)
  //   MEDIUM different gap → "GOALPOSTS" (the user did what was asked, model moved the bar)
  let goalpostStatus;
  let goalpostNote;
  if (r2.level === "HIGH") {
    goalpostStatus = "CLEAN";
    goalpostNote = `Eval 2 HIGH after addressing ${gap1}.`;
  } else if (r2.level === "MEDIUM" && r2.gap === gap1) {
    goalpostStatus = "STICKY";
    goalpostNote = `Eval 2 still MEDIUM on same gap (${gap1}). Model not recognizing addition.`;
  } else if (r2.level === "MEDIUM") {
    goalpostStatus = "GOALPOSTS";
    goalpostNote = `Eval 2 MEDIUM on different gap (${r1.gap} → ${r2.gap}). Goalposts moved.`;
  } else {
    goalpostStatus = "OTHER";
    goalpostNote = `Eval 2 produced unexpected level: ${r2.level}.`;
  }
  console.log(`    Goalposts: ${goalpostStatus} — ${goalpostNote}`);

  // Eval 3 — only run if Eval 2 surfaced a new gap (verify second addition resolves it)
  if (goalpostStatus === "GOALPOSTS") {
    const gap2 = r2.gap || "uncategorized";
    const addition2 = chain.gapAdditions[gap2] || chain.gapAdditions.uncategorized;
    const eval3Case = {
      id: `${chain.id}-EV3`,
      group: "I-iteration",
      expected: "HIGH",
      idea: chain.baseIdea + addition1 + addition2,
      purpose: `Iteration ${chain.id} — base + ${gap1} + ${gap2} additions`,
    };
    const r3 = await runCase(eval3Case);
    evals.push(r3);
  }

  return { chainId: chain.id, evals, goalpostStatus, goalpostNote };
}

// ============================================
// THRESHOLD EVALUATION
// ============================================
function evaluateThresholds(results, iterationChainResults) {
  const proResults = results.filter((r) => r.endpoint === "/api/analyze-pro" && r.status !== "ERROR");

  const g1 = proResults.filter((r) => r.group === "G1-rich");
  const g2 = proResults.filter((r) => r.group === "G2-sparse");
  const g3 = proResults.filter((r) => r.group === "G3-regression");

  // T1 — HIGH precision on G1
  const g1HighCount = g1.filter((r) => r.level === "HIGH").length;
  const t1Rate = g1.length > 0 ? g1HighCount / g1.length : 0;
  const T1_OK = t1Rate >= 0.75;

  // T2 — MEDIUM recall on G2
  const g2MedCount = g2.filter((r) => r.level === "MEDIUM").length;
  const t2Rate = g2.length > 0 ? g2MedCount / g2.length : 0;
  const T2_OK = t2Rate >= 0.60;

  // T3 — Regression precision on G3
  const g3HighCount = g3.filter((r) => r.level === "HIGH").length;
  const t3Rate = g3.length > 0 ? g3HighCount / g3.length : 0;
  const T3_OK = t3Rate >= 0.75;

  // T4 / T5 / T6 — applied to ALL MEDIUM cases across Pro pipeline (including iteration + length)
  const allMediums = proResults.filter((r) => r.level === "MEDIUM");
  const flagsByCase = allMediums.map((r) => ({
    id: r.id, reason: r.reason, gap: r.gap, flags: detectReasonFlags(r.reason),
  }));
  const t4Leaks = flagsByCase.filter((f) => f.flags.evidenceLeak.length > 0);
  const t5Hedges = flagsByCase.filter((f) => f.flags.hedging.length > 0);
  const t6MaterialPositive = flagsByCase.filter((f) => f.flags.materiality.length > 0);

  const t4Rate = allMediums.length > 0 ? t4Leaks.length / allMediums.length : 0;
  const t5Rate = allMediums.length > 0 ? t5Hedges.length / allMediums.length : 0;
  const t6Rate = allMediums.length > 0 ? t6MaterialPositive.length / allMediums.length : 1;

  const T4_OK = t4Rate <= 0.10;
  const T5_OK = t5Rate <= 0.10;
  const T6_OK = t6Rate >= 0.80;

  // T7 — Iteration stability (no goalposts moved). At least 2 of 3 chains clean (CLEAN or STICKY OK; GOALPOSTS counted as fail).
  const goalpostsChains = iterationChainResults.filter((c) => c.goalpostStatus === "GOALPOSTS");
  const cleanChains = iterationChainResults.filter((c) => c.goalpostStatus === "CLEAN" || c.goalpostStatus === "STICKY");
  const T7_OK = goalpostsChains.length <= 1; // allow at most 1 of 3

  // T8 — Length-MEDIUM correlation. 50w MEDIUM rate >= 800w MEDIUM rate.
  const lengthCases = proResults.filter((r) => r.group === "L-length");
  const l50 = lengthCases.find((r) => r.id === "L-50W");
  const l800 = lengthCases.find((r) => r.id === "L-800W");
  let T8_OK = true;
  let t8Note = "Skipped — length cases missing";
  if (l50 && l800) {
    // Failure: 800w MEDIUM/LOW while 50w HIGH (length defensiveness)
    const l50Med = l50.level === "MEDIUM" || l50.level === "LOW";
    const l800Med = l800.level === "MEDIUM" || l800.level === "LOW";
    if (!l800Med) {
      T8_OK = true;
      t8Note = `50w=${l50.level}, 800w=${l800.level}. 800w landed HIGH → length not causing defensiveness.`;
    } else if (l50Med && !l800Med) {
      T8_OK = true;
      t8Note = `Correct gradient: 50w=${l50.level} → 800w=${l800.level}`;
    } else if (l800Med && !l50Med) {
      T8_OK = false;
      t8Note = `INVERTED: 50w=${l50.level} but 800w=${l800.level}. Model is being defensive on long inputs.`;
    } else {
      T8_OK = true;
      t8Note = `Both MEDIUM: 50w=${l50.level}, 800w=${l800.level}. Acceptable but worth inspecting reasons.`;
    }
  }

  // T9 — Variance stability (observational)
  const t9Observations = [];
  const varianceReruns = results.filter((r) => r.id.endsWith("-RERUN"));
  for (const rerun of varianceReruns) {
    const sourceId = rerun.id.replace("-RERUN", "");
    const original = results.find((r) => r.id === sourceId && r.endpoint === "/api/analyze-pro");
    if (original) {
      t9Observations.push({
        id: sourceId,
        originalLevel: original.level,
        rerunLevel: rerun.level,
        match: original.level === rerun.level,
      });
    }
  }

  // T10 — Templating risk (observational). No single gap > 70% of MEDIUMs.
  const gapCounts = {};
  for (const m of allMediums) {
    const g = m.gap || "uncategorized";
    gapCounts[g] = (gapCounts[g] || 0) + 1;
  }
  const totalMediums = allMediums.length;
  const dominantGap = Object.entries(gapCounts).sort((a, b) => b[1] - a[1])[0];
  const dominantGapRate = dominantGap && totalMediums > 0 ? dominantGap[1] / totalMediums : 0;
  const T10_OK = dominantGapRate <= 0.70;

  return {
    g1: { total: g1.length, highCount: g1HighCount, rate: t1Rate, T1_OK },
    g2: { total: g2.length, medCount: g2MedCount, rate: t2Rate, T2_OK },
    g3: { total: g3.length, highCount: g3HighCount, rate: t3Rate, T3_OK },
    mediums: {
      total: allMediums.length,
      t4Leaks, t5Hedges, t6MaterialPositive,
      t4Rate, t5Rate, t6Rate,
      T4_OK, T5_OK, T6_OK,
    },
    iteration: {
      chains: iterationChainResults,
      cleanCount: cleanChains.length,
      goalpostsCount: goalpostsChains.length,
      T7_OK,
    },
    length: { l50, l800, T8_OK, note: t8Note },
    variance: { observations: t9Observations },
    templating: {
      gapCounts,
      dominantGap: dominantGap ? { gap: dominantGap[0], count: dominantGap[1], rate: dominantGapRate } : null,
      T10_OK,
    },
    overallPass: T1_OK && T2_OK && T3_OK && T4_OK && T5_OK && T6_OK && T7_OK && T8_OK,
  };
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log("V4S28 B9 — Evidence Strength contract verification runner (COMPREHENSIVE)");
  console.log("=========================================================================");
  console.log(`Endpoint base: ${BASE_URL}`);
  console.log(`Pro main: ${CASES.length}, Length: ${LENGTH_VARIANCE_CASES.length}, Free: ${FREE_PARITY_CASES.length}, Iteration chains: ${ITERATION_CHAINS.length}, Variance reruns: ${VARIANCE_RERUNS.length}`);
  console.log(`\nThresholds (locked):`);
  console.log(`  T1 — HIGH precision on G1 (rich):       >= 75%   GATED`);
  console.log(`  T2 — MEDIUM recall on G2 (sparse):      >= 60%   GATED`);
  console.log(`  T3 — Regression precision on G3:        >= 75%   GATED ← load-bearing`);
  console.log(`  T4 — Evidence-side leakage rate:        <= 10%   GATED`);
  console.log(`  T5 — Generic hedging rate:              <= 10%   GATED`);
  console.log(`  T6 — Materiality phrasing rate:         >= 80%   GATED`);
  console.log(`  T7 — Iteration stability (goalposts):   <= 1/3 chains GOALPOSTS  GATED`);
  console.log(`  T8 — Length-MEDIUM correlation:         50w MEDIUM rate >= 800w  GATED`);
  console.log(`  T9 — Variance stability:                same idea same level     OBSERVATIONAL`);
  console.log(`  T10 — Templating risk:                   no single gap > 70%      OBSERVATIONAL`);

  await preflightCheck();

  const results = [];

  // -------- Pass A — Pro main bank --------
  console.log("=== Pass A — Pro pipeline main bank (/api/analyze-pro) ===\n");
  const groups = ["G1-rich", "G2-sparse", "G3-regression", "G4-edge"];
  for (const group of groups) {
    const groupCases = CASES.filter((c) => c.group === group);
    if (groupCases.length === 0) continue;
    console.log(`[${group}]`);
    for (const c of groupCases) {
      const r = await runCase(c);
      results.push(r);
    }
    console.log("");
  }

  // -------- Pass B — Length variance --------
  console.log("=== Pass B — Length variance (same idea, 3 lengths) ===\n");
  console.log("[L-length]");
  for (const c of LENGTH_VARIANCE_CASES) {
    const r = await runCase(c);
    results.push(r);
  }
  console.log("");

  // -------- Pass C — Free parity --------
  console.log("=== Pass C — Free pipeline parity (/api/analyze) ===\n");
  console.log("[free-parity]");
  for (const fp of FREE_PARITY_CASES) {
    const sourceCase = CASES.find((c) => c.id === fp.sourceId);
    if (!sourceCase) {
      console.log(`  WARN: source ${fp.sourceId} not found`);
      continue;
    }
    const fpCase = { ...sourceCase, group: "G5-free" };
    const r = await runCase(fpCase, "/api/analyze", `FREE-${sourceCase.id}`);
    results.push(r);
  }
  console.log("");

  // -------- Pass D — Iteration simulation --------
  console.log("=== Pass D — Iteration simulation (3 chains, dynamic gap-fill) ===");
  const iterationChainResults = [];
  for (const chain of ITERATION_CHAINS) {
    const chainResult = await runIterationChain(chain);
    iterationChainResults.push(chainResult);
    for (const ev of chainResult.evals) results.push(ev);
  }
  console.log("");

  // -------- Pass E — Variance reruns --------
  console.log("=== Pass E — Variance reruns (key cases re-run once each) ===\n");
  console.log("[variance]");
  for (const v of VARIANCE_RERUNS) {
    const sourceCase = CASES.find((c) => c.id === v.sourceId);
    if (!sourceCase) {
      console.log(`  WARN: source ${v.sourceId} not found`);
      continue;
    }
    const rerunCase = { ...sourceCase, group: "V-variance" };
    const r = await runCase(rerunCase, "/api/analyze-pro", `${sourceCase.id}-RERUN`);
    results.push(r);
  }
  console.log("");

  // -------- Threshold evaluation --------
  console.log("=========================================================================");
  console.log("Threshold evaluation");
  console.log("=========================================================================\n");

  const errors = results.filter((r) => r.status === "ERROR");
  if (errors.length > 0) {
    console.log(`⚠ ${errors.length} case(s) errored:`);
    for (const r of errors) console.log(`    - ${r.id}: ${r.error}`);
    console.log("");
  }

  const ev = evaluateThresholds(results, iterationChainResults);

  // Gates
  console.log(`T1 — HIGH precision on G1 (rich):       ${ev.g1.highCount}/${ev.g1.total} = ${(ev.g1.rate * 100).toFixed(0)}%   ${ev.g1.T1_OK ? "✓ PASS" : "✗ FAIL"}  (target: >=75%)`);
  if (!ev.g1.T1_OK) {
    const misses = results.filter((r) => r.group === "G1-rich" && r.level !== "HIGH" && r.status !== "ERROR");
    for (const m of misses) console.log(`     MISS: ${m.id} → ${m.level} (reason: ${(m.reason || "").slice(0, 120)})`);
  }

  console.log(`T2 — MEDIUM recall on G2 (sparse):      ${ev.g2.medCount}/${ev.g2.total} = ${(ev.g2.rate * 100).toFixed(0)}%   ${ev.g2.T2_OK ? "✓ PASS" : "✗ FAIL"}  (target: >=60%)`);
  if (!ev.g2.T2_OK) {
    const misses = results.filter((r) => r.group === "G2-sparse" && r.level !== "MEDIUM" && r.status !== "ERROR");
    for (const m of misses) console.log(`     MISS: ${m.id} → ${m.level} (reason: ${(m.reason || "").slice(0, 120)})`);
  }

  console.log(`T3 — Regression precision on G3:        ${ev.g3.highCount}/${ev.g3.total} = ${(ev.g3.rate * 100).toFixed(0)}%   ${ev.g3.T3_OK ? "✓ PASS" : "✗ FAIL"}  (target: >=75%, load-bearing)`);
  if (!ev.g3.T3_OK) {
    const misses = results.filter((r) => r.group === "G3-regression" && r.level !== "HIGH" && r.status !== "ERROR");
    for (const m of misses) console.log(`     MISS: ${m.id} → ${m.level} (reason: ${(m.reason || "").slice(0, 120)})`);
    console.log(`     ⚠ G3 misses indicate the prompt fix did not fully take.`);
  }

  console.log(`\nMEDIUM reason quality (across all Pro MEDIUMs, n=${ev.mediums.total}):`);
  console.log(`T4 — Evidence-side leakage rate:        ${ev.mediums.t4Leaks.length}/${ev.mediums.total} = ${(ev.mediums.t4Rate * 100).toFixed(0)}%   ${ev.mediums.T4_OK ? "✓ PASS" : "✗ FAIL"}  (target: <=10%)`);
  if (ev.mediums.t4Leaks.length > 0) {
    for (const f of ev.mediums.t4Leaks) {
      console.log(`     LEAK: ${f.id}`);
      console.log(`       reason: ${(f.reason || "").slice(0, 160)}`);
      console.log(`       matched: ${f.flags.evidenceLeak.join(" | ")}`);
    }
  }

  console.log(`T5 — Generic hedging rate:              ${ev.mediums.t5Hedges.length}/${ev.mediums.total} = ${(ev.mediums.t5Rate * 100).toFixed(0)}%   ${ev.mediums.T5_OK ? "✓ PASS" : "✗ FAIL"}  (target: <=10%)`);
  if (ev.mediums.t5Hedges.length > 0) {
    for (const f of ev.mediums.t5Hedges) {
      console.log(`     HEDGE: ${f.id}`);
      console.log(`       reason: ${(f.reason || "").slice(0, 160)}`);
    }
  }

  console.log(`T6 — Materiality phrasing rate:         ${ev.mediums.t6MaterialPositive.length}/${ev.mediums.total} = ${(ev.mediums.t6Rate * 100).toFixed(0)}%   ${ev.mediums.T6_OK ? "✓ PASS" : "✗ FAIL"}  (target: >=80%)`);
  if (!ev.mediums.T6_OK) {
    const noMat = results.filter((r) => r.endpoint === "/api/analyze-pro" && r.level === "MEDIUM" && detectReasonFlags(r.reason).materiality.length === 0);
    for (const m of noMat) {
      console.log(`     NO-MATERIALITY: ${m.id}`);
      console.log(`       reason: ${(m.reason || "").slice(0, 160)}`);
    }
  }

  console.log(`\nIteration / length / variance / templating:`);
  console.log(`T7 — Iteration stability:               ${ev.iteration.cleanCount}/${ev.iteration.chains.length} chains clean, ${ev.iteration.goalpostsCount} GOALPOSTS  ${ev.iteration.T7_OK ? "✓ PASS" : "✗ FAIL"}  (target: <=1 GOALPOSTS)`);
  for (const c of ev.iteration.chains) {
    console.log(`     ${c.chainId}: ${c.goalpostStatus} — ${c.goalpostNote || ""}`);
  }

  console.log(`T8 — Length-MEDIUM correlation:         ${ev.length.T8_OK ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`     ${ev.length.note}`);

  console.log(`\nObservational checks (log-and-review):`);

  console.log(`\nT9 — Variance stability:`);
  if (ev.variance.observations.length === 0) {
    console.log(`     No variance reruns to compare.`);
  } else {
    for (const obs of ev.variance.observations) {
      const icon = obs.match ? "✓ stable" : "⚠ varied";
      console.log(`     ${obs.id.padEnd(20)} original=${obs.originalLevel} rerun=${obs.rerunLevel}  ${icon}`);
    }
  }

  console.log(`\nT10 — Templating risk (gap distribution across all MEDIUMs):`);
  for (const [gap, count] of Object.entries(ev.templating.gapCounts).sort((a, b) => b[1] - a[1])) {
    const rate = ev.mediums.total > 0 ? (count / ev.mediums.total * 100).toFixed(0) : 0;
    console.log(`     ${gap.padEnd(18)} ${count}/${ev.mediums.total} = ${rate}%`);
  }
  if (ev.templating.dominantGap) {
    const dg = ev.templating.dominantGap;
    if (ev.templating.T10_OK) {
      console.log(`     ✓ No single gap dominates (largest: ${dg.gap} at ${(dg.rate * 100).toFixed(0)}%, threshold 70%)`);
    } else {
      console.log(`     ⚠ TEMPLATING: ${dg.gap} dominates at ${(dg.rate * 100).toFixed(0)}% of MEDIUMs (threshold 70%). Model may be defaulting.`);
    }
  }

  // Free vs Pro parity
  const freeResults = results.filter((r) => r.endpoint === "/api/analyze");
  if (freeResults.length > 0) {
    console.log(`\n  Free vs Pro parity (G5):`);
    for (const fr of freeResults) {
      const proSourceId = fr.id.replace(/^FREE-/, "");
      const proR = results.find((r) => r.id === proSourceId && r.endpoint === "/api/analyze-pro");
      const match = proR && proR.level === fr.level;
      console.log(`     ${fr.id.padEnd(28)} Pro: ${proR ? proR.level : "(no source)"}, Free: ${fr.level}  ${match ? "✓ match" : "⚠ mismatch"}`);
    }
  }

  // LOW emissions
  const lows = results.filter((r) => r.endpoint === "/api/analyze-pro" && r.level === "LOW");
  if (lows.length > 0) {
    console.log(`\n  LOW cases observed (defense-in-depth):`);
    for (const r of lows) {
      const td = r.thin_dimensions;
      console.log(`     ${r.id.padEnd(28)} thin_dimensions: ${td ? `[${td.join(", ")}]` : "(missing)"}`);
    }
  } else {
    console.log(`\n  LOW cases: 0 (expected — Haiku gate eats sparse upstream)`);
  }

  // Latency
  const latencies = results.filter((r) => r.status !== "ERROR").map((r) => r.elapsedMs).sort((a, b) => a - b);
  if (latencies.length > 0) {
    const median = latencies[Math.floor(latencies.length / 2)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1];
    const max = latencies[latencies.length - 1];
    const total = latencies.reduce((a, b) => a + b, 0);
    console.log(`\n  Latency: median ${(median / 1000).toFixed(1)}s, p95 ${(p95 / 1000).toFixed(1)}s, max ${(max / 1000).toFixed(1)}s, total ${(total / 60000).toFixed(1)} min wall time`);
  }

  // -------- Final verdict --------
  console.log("\n=========================================================================");
  console.log(`OVERALL: ${ev.overallPass && errors.length === 0 ? "✓ PASS" : "✗ FAIL"}`);
  console.log("=========================================================================");
  if (!ev.overallPass) {
    console.log("Failed gated thresholds:");
    if (!ev.g1.T1_OK) console.log("  - T1 (HIGH precision on G1)");
    if (!ev.g2.T2_OK) console.log("  - T2 (MEDIUM recall on G2)");
    if (!ev.g3.T3_OK) console.log("  - T3 (Regression precision on G3) ← LOAD-BEARING");
    if (!ev.mediums.T4_OK) console.log("  - T4 (Evidence-side leakage)");
    if (!ev.mediums.T5_OK) console.log("  - T5 (Generic hedging)");
    if (!ev.mediums.T6_OK) console.log("  - T6 (Materiality phrasing)");
    if (!ev.iteration.T7_OK) console.log("  - T7 (Iteration goalposts)");
    if (!ev.length.T8_OK) console.log("  - T8 (Length-MEDIUM correlation)");
  }

  // Dump full results JSON
  await fs.mkdir("out", { recursive: true });
  const outPath = "out/run-b9-results.json";
  await fs.writeFile(
    outPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        base_url: BASE_URL,
        thresholds: {
          T1_g1_high_min: 0.75,
          T2_g2_medium_min: 0.60,
          T3_g3_high_min: 0.75,
          T4_evidence_leak_max: 0.10,
          T5_hedging_max: 0.10,
          T6_materiality_min: 0.80,
          T7_goalposts_max: 1,
          T8_length_correlation: "50w MEDIUM rate >= 800w MEDIUM rate",
        },
        evaluation: ev,
        results,
        iterationChainResults,
      },
      null,
      2
    )
  );
  console.log(`\nFull results: ${outPath}`);

  process.exit(ev.overallPass && errors.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\n⚠ Runner crashed:", err);
  process.exit(2);
});
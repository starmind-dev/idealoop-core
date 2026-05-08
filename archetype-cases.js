// ============================================
// ARCHETYPE C/D/E COVERAGE CASE BANK
// ============================================
// Authored 2026-05-02 for V4S28 B9 archetype coverage runner.
// Three variants per archetype × 2 reruns = 18 runs.
//
// Goal: identify which cases reliably fire archetypes C, D, E
// for inclusion in the B10a regression bank.
//
// Each archetype has three variants stress-testing different angles:
//   - Variant 1: clean canonical case
//   - Variant 2: domain alternative
//   - Variant 3: structural edge (Layered, drift-prone, or boundary)
//
// Locked from project knowledge:
//   - Archetype enum (B1, immutable): A, B, C, D, E
//   - STEP 1 PROFILE-DOMAIN MATCH rule (B1): if profile matches domain,
//     Risk 3 dropped entirely (null). C/D/E cases must survive STEP 1.
//   - P1-S1 stem-match rule (B1): no fabricated profile attribution.
//   - All profiles use Phase 0 schema { coding, ai, education } to
//     match the rest of the seed bank.
// ============================================

// ============================================
// ARCHETYPE C — DOMAIN CREDIBILITY GAP
// ============================================
// "Users require expert-level trust the founder lacks."
// Distinct from Risk 2 (user trust in product) and TC (build difficulty).
// Failure modes to defend against:
//   - Profile too domain-adjacent → STEP 1 MATCH
//   - Compliance/Trust Main Bottleneck dominates → Risk 3 fires null or A

const C1_CLINICAL = {
  id: "ARC-C1",
  archetype: "C",
  variant: "clinical-decision-support",
  purpose: "Archetype C stress test — high-trust medical domain. Tests whether C fires when Compliance/Trust Main Bottleneck likely dominates. Designed to be the HARDEST test of C — if C fires here, C fires anywhere.",
  idea: "An AI clinical decision support tool for rural primary care physicians. Doctors enter patient symptoms, vitals, medication history, and basic labs; the tool returns differential diagnoses ranked by probability with citations to current clinical guidelines (UpToDate-equivalent), flags potential drug interactions, and suggests next-step diagnostic workups. Targets clinics in towns under 50,000 population without nearby specialists. Validated against board-certified physician review on common-presentation cases (chest pain, abdominal pain, undifferentiated dyspnea). Pricing: $400/month per physician seat. Goal: reduce specialist referrals and patient travel for rural populations.",
  profile: {
    coding: "Advanced",
    ai: "Advanced AI user (fine-tuning LLMs)",
    education: "Senior ML engineer at consumer e-commerce recommendation platform (8 years) — no clinical, healthcare, or medical training",
  },
};

const C2_FINANCIAL = {
  id: "ARC-C2",
  archetype: "C",
  variant: "retail-financial-advisory",
  purpose: "Archetype C clean candidate — high-trust financial domain without FDA-equivalent gate. Cleaner than C1 because no regulatory clearance distractor. Profile is visibly distant (game dev) from finance.",
  idea: "An AI financial advisor for retail investors. Users connect their brokerage accounts; the AI generates personalized portfolio recommendations covering retirement allocation, tax-loss harvesting opportunities, and rebalancing triggers. Generates monthly review reports with rationale linked to user's stated goals (retirement timeline, risk tolerance, tax bracket). $25/month subscription. No human advisor in loop — pure AI recommendations. Target: 30-50 year old retail investors with $50k-$500k portfolios who currently DIY but lack confidence.",
  profile: {
    coding: "Advanced",
    ai: "Advanced AI user",
    education: "Mobile game developer (10 years building free-to-play games), self-taught Python, no Series 65, no CFP, no financial advisory or investment management background",
  },
};

const C3_LEGAL = {
  id: "ARC-C3",
  archetype: "C",
  variant: "criminal-defense-AI",
  purpose: "Archetype C boundary case — extreme high-trust domain (criminal defense, life-affecting outputs). Tests whether C fires for trust-of-builder, not just bar-admission compliance. Profile clearly non-legal.",
  idea: "An AI tool that drafts criminal defense motions and sentencing memos for public defenders. Reads case files (police reports, witness statements, prior records), suggests applicable case law from the relevant jurisdiction, generates first-draft motions to suppress, motions in limine, and sentencing memoranda. Public defender attorney reviews and edits before filing. $200/month per attorney. Target: state public defender offices in mid-sized jurisdictions where attorneys carry 100+ active cases.",
  profile: {
    coding: "Advanced",
    ai: "Advanced AI user",
    education: "Software engineer at e-commerce SaaS (6 years), MBA from state university — no JD, no legal practice, no paralegal experience, no criminal-justice background",
  },
};

// ============================================
// ARCHETYPE D — CAPITAL/RUNWAY GAP
// ============================================
// "Burn rate exceeds runway, fundraising required before execution."
// Hardest archetype because capital overlaps with Compliance, TC, Distribution.
// Failure modes to defend against:
//   - Idea is implicitly capital-heavy but doesn't make capital the BINDING constraint
//   - Compliance Main Bottleneck dominates → Layered case (D as Risk 3 still valid)
//   - Distribution/CAC dominates → drift to Distribution Main Bottleneck
//
// D-1 is the cleanest: pure capital arithmetic, no FDA, no enterprise compliance.
// D-2 is the Layered stress test: Compliance + D should both fire.
// D-3 is the Distribution-confound test.

const D1_HARDWARE = {
  id: "ARC-D1",
  archetype: "D",
  variant: "consumer-hardware-water-quality",
  purpose: "Archetype D clean candidate — pure capital arithmetic with no FDA, no enterprise compliance, no clinical trust. Unambiguous mismatch: $1.4M needed vs $35k savings.",
  idea: "A smart home water-quality monitoring device for households on private well water. Continuous in-line sensor measures contaminants (lead, nitrates, bacteria, hardness) and pushes readings to a mobile app with EPA-threshold alerts and quarterly trend reports. Hardware unit cost ~$140, sells direct-to-consumer at $249 device + $12/month subscription for the analytics dashboard and replacement filter alerts. No FDA, no medical clearance — sold as consumer water-quality monitoring, not medical. Initial inventory order minimum is 5,000 units ($700k); custom plastics tooling is $180k upfront, non-refundable; first 12 months pre-launch involves prototyping iterations + EPA-NSF lab certification (~$200k for accredited testing). Direct-to-consumer go-to-market via Facebook/Instagram ads + Amazon presence — estimated $300k initial CAC budget to validate paid-channel economics. Total pre-revenue runway required: ~$1.4M.",
  profile: {
    coding: "Intermediate",
    ai: "Regular AI user",
    education: "Solo founder, bootstrapped, $35k personal savings, no prior fundraising experience or VC network, never raised institutional capital",
  },
};

const D2_BANK = {
  id: "ARC-D2",
  archetype: "D",
  variant: "vertical-saas-with-compliance",
  purpose: "Archetype D Layered stress test — capital constraint compounded by Compliance gate. Tests whether D fires AS RISK 3 when Main Bottleneck legitimately fires Compliance. Per Stage 3 prompt's Layered case rule, both should fire (different surfaces).",
  idea: "An AI underwriting tool for community banks ($500M-$5B in assets). Replaces manual loan-file review with AI-driven risk scoring on commercial loans (real estate, equipment, working capital). Requires SOC2 Type II certification + state bank regulator approval before any pilot can run. Estimated 18 months pre-revenue: SOC2 audit ($150k), bank regulator legal navigation ($600k), security infrastructure for handling regulated financial data ($400k), three senior engineers for 18 months ($1.2M loaded), design-partner pilot subsidies ($450k). Total ~$2.8M pre-revenue. Banks will not pay until certifications complete and regulatory sign-off granted.",
  profile: {
    coding: "Advanced",
    ai: "Advanced AI user",
    education: "Self-taught full-stack developer (4 years), shipped two consumer apps, $20k personal savings, no enterprise SaaS experience, never raised institutional capital, no banking-industry network",
  },
};

const D3_FITNESS = {
  id: "ARC-D3",
  archetype: "D",
  variant: "consumer-subscription-CAC-heavy",
  purpose: "Archetype D Distribution-confound test — tests whether D fires when capital is concentrated in CAC and brand investment rather than tooling/inventory. Useful diagnostic regardless of outcome (D fires = capital recognized as binding; D doesn't fire = model parses capital-via-CAC as Distribution).",
  idea: "A premium AI-personalized fitness program. 10-month structured program combining custom strength training, nutrition coaching, and weekly video check-ins with an AI coach trained on certified personal trainer methodology. Monthly real-coach review of AI sessions for quality assurance. $89/month subscription. Pre-launch capital required: $400k for AI coach training (filming sessions with certified trainers, video production, model fine-tuning), $300k real-coach hiring and training, $120k fitness science advisory board (for credibility and program design), $800k for 12 months of performance marketing experimentation across Meta + TikTok + YouTube to establish CAC economics, $180k SaaS infrastructure and app development. Total ~$1.8M pre-launch. Subscription model means slow revenue ramp; CAC payback projected >12 months.",
  profile: {
    coding: "No coding experience",
    ai: "No AI experience",
    education: "Personal trainer (8 years at independent gyms), $40k personal savings, no investor network, never built software, no software-startup experience",
  },
};

// ============================================
// ARCHETYPE E — SALES/CONVERSION GAP
// ============================================
// "Lacks outbound sales experience, founder-led B2B sales required."
// Distinct from B (buyer access) — buyers ARE reachable, conversion is the gap.
// Failure modes to defend against:
//   - Profile says "no network" → invites B (buyer access)
//   - Domain unfamiliarity in profile → invites C (credibility)
//
// CRITICAL: every E case explicitly grants buyer reachability in the IDEA TEXT
// to defend against B drift. The profile then describes conversion-motion gaps
// (no discovery calls, no procurement negotiation, no pilot management,
// no champion-building) without using "no network" language as the dominant signal.

const E1_PROCUREMENT = {
  id: "ARC-E1",
  archetype: "E",
  variant: "enterprise-procurement-risk",
  purpose: "Archetype E clean candidate — high-ACV enterprise B2B with explicit reachability granted. Buyers are publicly listed; the gap is the multi-stakeholder consultative sales motion, not access.",
  idea: "An AI-powered procurement risk monitoring platform for Fortune 500 supply chain teams. Continuously ingests supplier financial filings, OSHA records, sanctions lists, ESG ratings, and news; flags emerging risk signals (insolvency indicators, regulatory exposure, geopolitical concentration) on tier-1 and tier-2 suppliers. Custom dashboard per buying organization. Pricing: $180,000/year per enterprise contract, 18-month average sales cycle, requires CPO-level executive sponsor + procurement, IT, and legal stakeholder sign-off. No self-serve tier; sales motion is exclusively outbound enterprise field sales with multi-stakeholder pilots. Fortune 500 procurement contacts are publicly available via ZoomInfo, LinkedIn Sales Navigator, and the ISM/CPO conference circuit; access is not the gap — running the 18-month consultative sales motion to close them is.",
  profile: {
    coding: "Advanced",
    ai: "Advanced AI user",
    education: "Staff backend engineer (10 years), built internal data pipelines, never customer-facing, never run discovery calls, never managed pilots, no procurement-negotiation experience, no enterprise-sales process exposure",
  },
};

const E2_MANUFACTURING = {
  id: "ARC-E2",
  archetype: "E",
  variant: "mid-market-manufacturing-ops",
  purpose: "Archetype E mid-market candidate — buyers are publicly reachable through industry channels; the gap is founder-led conversion through multi-stakeholder evaluation.",
  idea: "An AI workflow tool for mid-market manufacturing operations managers (50-500 employee discrete manufacturers). Ingests production data from existing MES/ERP systems, surfaces bottleneck patterns, and generates weekly operational recommendations for plant managers. $36,000/year per facility. Sales motion requires plant tours, in-person stakeholder meetings, multi-month evaluations with operations + IT + finance sign-off. No PLG self-serve. Mid-market manufacturers are reachable through industry trade associations (NAM, IndustryWeek conference circuit), publicly listed via ThomasNet and IndustryNet directories, and approachable at NAM-affiliated trade shows; access is not the gap — running the founder-led, multi-stakeholder consultative evaluation process to convert them is.",
  profile: {
    coding: "Advanced",
    ai: "Regular AI user",
    education: "Senior data engineer at consumer fintech (9 years), Python/SQL expert, deep experience with internal tooling, never run a sales process, never done in-person stakeholder demos, no procurement negotiation experience, no pilot-management exposure",
  },
};

const E3_MUNICIPAL = {
  id: "ARC-E3",
  archetype: "E",
  variant: "municipal-procurement-software",
  purpose: "Archetype E cleanest reachability case — buyers are LITERALLY publicly listed (city procurement officers in government directories), making B (buyer access) implausible. The conversion gap is the only available archetype.",
  idea: "An AI proposal-evaluation tool for municipal procurement officers in cities of 50,000-500,000 population. Cities run public RFPs and procurement officers are listed in public city directories. Tool ingests vendor proposals + the city's published specifications, ranks proposals against requirements, flags inconsistencies and gaps, and generates evaluation memos for council review. $42,000/year per city subscription. Sales motion: discovery call → 60-day pilot → city council demo → annual contract approval. The buyer universe is fully public (city websites, government procurement directories, NIGP membership lists, GFOA member rosters); access is not the gap — running the 6-month, multi-stakeholder consultative sales process required to close them is.",
  profile: {
    coding: "Advanced",
    ai: "Advanced AI user",
    education: "Senior software engineer at consumer SaaS (12 years), built internal evaluation tools, never in government, never customer-facing, never run a sales process, never managed a pilot, never done a stakeholder demo, no public-sector or municipal experience",
  },
};

// ============================================
// EXPORT — case bank manifest
// ============================================

const ARCHETYPE_CASES = [
  C1_CLINICAL,
  C2_FINANCIAL,
  C3_LEGAL,
  D1_HARDWARE,
  D2_BANK,
  D3_FITNESS,
  E1_PROCUREMENT,
  E2_MANUFACTURING,
  E3_MUNICIPAL,
];

const CASES_BY_ARCHETYPE = {
  C: [C1_CLINICAL, C2_FINANCIAL, C3_LEGAL],
  D: [D1_HARDWARE, D2_BANK, D3_FITNESS],
  E: [E1_PROCUREMENT, E2_MANUFACTURING, E3_MUNICIPAL],
};

module.exports = {
  C1_CLINICAL,
  C2_FINANCIAL,
  C3_LEGAL,
  D1_HARDWARE,
  D2_BANK,
  D3_FITNESS,
  E1_PROCUREMENT,
  E2_MANUFACTURING,
  E3_MUNICIPAL,
  ARCHETYPE_CASES,
  CASES_BY_ARCHETYPE,
};

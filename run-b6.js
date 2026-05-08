// ============================================
// V4S28 Bundle B6 verification runner
// ============================================
// Bundle B6: Stage 1 prompt-level changes + profile injection cleanup
//   Section 11 P11-S1: judgment-language enforcement check (Stage 1 + Free)
//   Section 11 P11-S2: sparse-input retrieval-quality rule (Stage 1 + Free)
//   Section 11 (S9 carryover): temporal anchoring (Stage 1 + Free)
//   Section 12 P12-S1: profile strip from Stage 1 input (Pro route)
//   B6 Path A finding: profile strip from Stage 2a input (Pro route)
//   B4 Change 4 fold-in: profile strip from Stage 2b input (Pro route)
//   internal_build rule rewrite: buyer-anchored, not founder-anchored
//
// What this runner verifies (T1-T7):
//   T1 — Profile-strip runtime stability: same idea × 3 founder profiles produces
//        stable Stage 1 output (within Phase 0 non-determinism cap) +
//        STABLE MD/MO/OR scores (cross-profile variance signature check)
//   T2 — Static grep gate: pre-commit only, NOT runner. Documented at end of file.
//   T3 — Sparse Stage 1 provisional framing: landscape_analysis opens with
//        "Category inferred from limited input..." on sparse cases; does NOT
//        fire on NC4 (boundary) or NC1 (well-specified)
//   T4 — Judgment-language leak rate: ZERO forbidden-term hits across Stage 1
//        outputs (landscape_analysis, differentiation, entry_barriers on Pro;
//        differentiation, summary on Free). Hard zero, not <5%.
//   T5 — Temporal anchoring factuality: dates appear in landscape_analysis when
//        search returns recent activity; ZERO timing-judgment phrases
//        (no "window is closing," "fast-moving," etc.)
//   T6 — internal_build buyer-anchored stability: enterprise idea fires
//        internal_build, SMB idea does NOT, internal_build presence stable
//        across founder profiles (MAT1 Beginner/Intermediate/Senior on same idea)
//   T7 — B5 regression check: MD1 still LOW + Specification cascade; NC4 still
//        NOT LOW + Buyer access; SP-DENTAL still no MO_INFERRED_PRICING.
//        Stage 2a strip must NOT have regressed B5's locked behavior.
//
// Methodology lessons applied:
//   - B5 lesson: extractEvaluation must look at event.data.data.evaluation,
//     NOT event.data.evaluation. Pre-flight on case 1 catches shape errors
//     before full bank wastes API spend.
//   - B5 lesson: detectors can have false positives — two-pass scoring (regex
//     flag → manual review). flags.md captures pass-1 candidates with context.
//   - B3 lesson: validOutcomes derived from locked design + Narrative Contract
//     anchor predicates, not intuition.
//   - B4 lesson: pre-commit grep gate before commit (see comment block at end).
//   - Phase 0 finding: Stage 1 is non-deterministic at temp=0; same-profile
//     reruns won't converge perfectly. Variance reruns measure stability of
//     TRIGGER FIRING, not byte-level convergence.
//
// Usage:
//   node run-b6.js [base_url]
//   default base_url: http://localhost:3000
//   ANTHROPIC env vars must be set (production routes consume them).
//
// Output:
//   ./b6-outputs/raw.json        — full per-case API responses with extracted analysis
//   ./b6-outputs/streaming.json  — SSE event log per case (replay source for rescore-b6.js)
//   ./b6-outputs/results.md      — markdown summary with T1-T7 pass/fail
//   ./b6-outputs/flags.md        — Pass-1 detector flags with context for manual review

const fs = require('fs');
const path = require('path');

const BASE_URL = process.argv[2] || process.env.B6_BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, 'b6-outputs');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ============================================
// PROFILES
// ============================================
// MAT1 trio — used for T1+T6 stability test on legal document automation.
// These three profiles share the same domain context but differ in skill level.
// Pre-B6, audit data showed internal_build fired for Intermediate/Senior but NOT
// Beginner on MAT1 — the founder-anchored bug. Post-B6, internal_build presence
// should be stable across the trio (driven by buyer nature: law firms can build).

const PROFILES = {
  INTERMEDIATE_GENERIC: {
    coding_level: 'intermediate',
    professional_background: 'Product manager; 5 years at B2B SaaS company; some technical projects',
    education: 'BS Business; bootcamp coding certificate',
    industry_experience: 'B2B SaaS; product analytics; customer-facing roles',
    runway_months: 9,
    team_size: 1,
  },
  MAT3_TECH_NO_ACCESS: {
    coding_level: 'expert',
    professional_background: 'Senior ML engineer at consumer tech company; 8 years production ML systems; no healthcare domain experience',
    education: 'BS Computer Science, MS Machine Learning',
    industry_experience: 'Consumer tech; recommendation systems; LLM applications',
    runway_months: 12,
    team_size: 1,
  },
  MAT1_BEGINNER: {
    coding_level: 'beginner',
    professional_background: 'Paralegal at mid-size law firm; 3 years; learning to code on weekends',
    education: 'BA English; paralegal certificate',
    industry_experience: 'Legal services; document review; client intake',
    runway_months: 6,
    team_size: 1,
  },
  MAT1_INTERMEDIATE: {
    coding_level: 'intermediate',
    professional_background: 'Legal ops manager at boutique law firm; 5 years; built workflow tools internally',
    education: 'BA Political Science; CLE certifications in legal tech',
    industry_experience: 'Legal services; legal operations; vendor management',
    runway_months: 9,
    team_size: 1,
  },
  MAT1_SENIOR: {
    coding_level: 'expert',
    professional_background: 'Former CTO of legal tech startup; 10 years; built and shipped contract automation tools',
    education: 'JD law degree; BS Computer Science',
    industry_experience: 'Legal tech; SaaS engineering; legal operations leadership',
    runway_months: 18,
    team_size: 2,
  },
};

// ============================================
// CASE BANK — 17 unique cases per locked design
// ============================================
// Cases organized by threshold group. Each case has:
//   - id: unique identifier (used as filename prefix in outputs)
//   - group: which threshold this case primarily exercises
//   - purpose: one-sentence statement of trigger condition / expected behavior
//             (B5 meta-lesson: avoid surface-vs-structure mismatch)
//   - idea: user idea text
//   - profile: founder profile object
//   - expected: structured expectations the runner asserts against

const CASES = [
  // === T3 + T7 — Sparse-input behavior + B5 regression (6 cases, dual-purpose) ===
  // Reused verbatim from B5 case bank. Verify:
  //   - LOW on sparse, contradictory, bare-narrative inputs (T7 regression)
  //   - landscape_analysis opens with provisional framing (T3 new)
  //   - NC4 boundary holds (counter-example clause)
  //   - SP-DENTAL still no MO_INFERRED_PRICING (T7 regression)
  {
    id: 'SP-DENTAL',
    group: 'T3T7',
    purpose: 'Sparse: dental sub-20-words. Trigger 1 should fire LOW + provisional framing on Stage 1. MO packet must not infer pricing (T7 B5 regression).',
    idea: 'tool for dentists to save time',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_level: 'LOW',
      stage1_provisional_framing: true,
      mo_inferred_pricing_count: 0,
      stage3_main_bottleneck: 'Specification',
    },
  },
  {
    id: 'SP-PETS',
    group: 'T3T7',
    purpose: 'Sparse: pets sub-20-words. Trigger 1 should fire LOW + provisional framing.',
    idea: 'an ai app for pets',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_level: 'LOW',
      stage1_provisional_framing: true,
      stage3_main_bottleneck: 'Specification',
    },
  },
  {
    id: 'MD1',
    group: 'T3T7',
    purpose: 'Contradictory scope (Trigger 2): 150-word founder dump shifting target user/mechanism. LOW + provisional framing.',
    idea: 'I have been thinking about building something in the healthcare space because I see so many problems. Maybe a tool for clinicians to manage patient follow-ups, or it could be a patient-facing app that helps with medication adherence — actually maybe both? I think there is a real market here because everyone I have talked to says they would use it. Could potentially target small clinics first, but the real opportunity is enterprise hospital systems. The pricing model could be SaaS subscription per provider, or maybe per-patient billing, we could figure that out later. The AI component would help with predictions or recommendations or maybe automated outreach. I just know there is something here and I want to build it before someone else does.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_level: 'LOW',
      stage1_provisional_framing: true,
      stage3_main_bottleneck: 'Specification',
    },
  },
  {
    id: 'BN1',
    group: 'T3T7',
    purpose: 'Bare narrative (Trigger 3): doctor backstory + AI motivation, no product spec. LOW + provisional framing.',
    idea: 'I have been a doctor for fifteen years and I have watched patient outcomes get worse over time despite all the technology we now have available. I think AI could help fix some of this if applied correctly. I want to build something using AI that helps make a real difference for patients and clinicians.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_level: 'LOW',
      stage1_provisional_framing: true,
      stage3_main_bottleneck: 'Specification',
    },
  },
  {
    id: 'NC4',
    group: 'T3T7',
    purpose: 'Counter-example clause (Trigger 3 must NOT fire): problem-first with workflow + target user + pain named. NOT LOW, NO provisional framing.',
    idea: 'Independent gym owners manage member follow-ups, cancellations, and renewal reminders manually across WhatsApp and spreadsheets. I want to help them organize this better and prevent churn.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_not: 'LOW',
      stage1_provisional_framing: false,
    },
  },
  {
    id: 'NC1',
    group: 'T3T7',
    purpose: 'Well-specified product (Customs validator). Triggers should NOT fire. NOT LOW, NO provisional framing.',
    idea: 'A document validation tool for international shipments. Importers and freight forwarders upload commercial invoices, packing lists, and certificates of origin; the tool checks for compliance issues against destination-country customs requirements before shipment, flagging missing fields, classification errors, and HTS code mismatches. Target users are mid-size importers handling 50-500 shipments per month who currently rely on manual review by customs brokers.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_not: 'LOW',
      stage1_provisional_framing: false,
    },
  },

  // === T3 boundary extra (1 case) ===
  // Strengthens counter-example coverage beyond NC4.
  {
    id: 'NC5-BOUNDARY',
    group: 'T3T7',
    purpose: 'Counter-example boundary: problem-first with workflow + buyer + pain, no product category. Like NC4 but in a different domain.',
    idea: 'Solo bookkeepers reconcile bank transactions, categorize expenses, and prepare client-ready monthly reports across QuickBooks and Excel. I want to help them spend less time on data entry and more on advising small business clients.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_not: 'LOW',
      stage1_provisional_framing: false,
    },
  },

  // === T4 — Judgment-language leak hunt (4 cases) ===
  // Three audit-known leak cases (M1, S2-std, A1-std) + one novel B2B SaaS.
  // Pre-B6 baseline: M1 leaked "crowded" once on Pro; S2-std and A1-std leaked
  // "crowded"/"highly competitive" on Standard. Post-B6, all four MUST be clean.
  {
    id: 'LEAK-M1-PRO',
    group: 'T4',
    purpose: 'Audit-known leak case (M1, habit tracker): Pro pipeline historical leak. Verify P11-S1 enforcement check eliminates "crowded" / "highly competitive" / etc. from Stage 1.',
    idea: 'A habit tracking app that uses AI to learn your patterns and send personalized nudges at moments when you are most likely to follow through. Targets professionals trying to build morning routines, exercise habits, or focus practices.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    pipeline: '/api/analyze-pro',
    expected: {
      stage1_judgment_leaks: 0,
    },
  },
  {
    id: 'LEAK-S2-FREE',
    group: 'T4',
    purpose: 'Audit-known leak case (S2-std, Uber for laundry): Free pipeline historical leak. Verify Free P11-S1 enforcement check eliminates leaks from differentiation + summary.',
    idea: 'An on-demand laundry pickup and delivery service that uses AI to optimize routes for drivers and predict customer demand. Customers schedule pickups via the app, drivers collect bags, partner laundromats wash and fold, drivers return clean clothes the next day.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    pipeline: '/api/analyze',
    expected: {
      stage1_judgment_leaks: 0,
    },
  },
  {
    id: 'LEAK-A1-FREE',
    group: 'T4',
    purpose: 'Audit-known leak case (A1-std, resume reviewer): Free pipeline historical leak. Same verification as above on Free.',
    idea: 'An AI resume reviewer for job seekers. Users upload their resume and a target job description; the tool generates a tailored rewrite, flags missing keywords from the JD, and scores ATS compatibility. Free tier offers 3 reviews per month; paid tier unlocks unlimited reviews and recruiter-style feedback.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    pipeline: '/api/analyze',
    expected: {
      stage1_judgment_leaks: 0,
    },
  },
  {
    id: 'LEAK-NOVEL',
    group: 'T4',
    purpose: 'Novel B2B SaaS not in audit: scan for unknown leak patterns under enforcement check. Pro pipeline.',
    idea: 'A sales call coaching platform for B2B SaaS sales teams. AI listens to recorded sales calls (Gong / Chorus integration), identifies missed objection-handling opportunities, suggests improved language, and tracks rep-level improvement over time. Target users are sales managers at companies with 20-200 reps.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    pipeline: '/api/analyze-pro',
    expected: {
      stage1_judgment_leaks: 0,
    },
  },

  // === T5 — Temporal anchoring (2 cases) ===
  // Domains where search results are likely to surface recent incumbent activity.
  // Verify dates appear factually + ZERO timing-judgment phrases.
  {
    id: 'TEMP-LEGAL',
    group: 'T5',
    purpose: 'Legal AI domain (Clio Q4 2025 announcements / recent Gavel/Templafy activity). Dates expected in landscape_analysis. ZERO "window is closing" / "fast-moving" judgment phrases.',
    idea: 'An AI contract analysis tool for mid-size law firms. Lawyers upload contracts in batch; the tool extracts key terms (parties, term length, indemnification, termination), flags non-standard clauses against firm playbooks, and generates a redline summary for partner review. Target users are corporate transactional partners at firms with 50-500 attorneys.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    pipeline: '/api/analyze-pro',
    expected: {
      stage1_temporal_dates: true,
      stage1_temporal_judgment: 0,
    },
  },
  {
    id: 'TEMP-INSURANCE',
    group: 'T5',
    purpose: 'Insurance appeals domain (Counterforce Health March 2025 launch / Claimable). Dates expected. ZERO timing-judgment phrases.',
    idea: 'An AI tool that helps individuals and small clinics automate health insurance claim appeals. Users upload denial letters; the tool generates appeal documents using insurer-specific argumentation patterns and tracks deadlines across multiple claims. Target users are billing managers at clinics under 25 providers + individual patients with denied claims.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    pipeline: '/api/analyze-pro',
    expected: {
      stage1_temporal_dates: true,
      stage1_temporal_judgment: 0,
    },
  },

  // === T1 + T6 — Profile-strip stability + internal_build buyer-anchoring (4 cases) ===
  // Same idea × MAT1 trio (Beginner/Intermediate/Senior). Pre-B6 audit data:
  //   MAT1-Beginner: NO Internal_Development entry
  //   MAT1-Intermediate: HAD Internal_Development
  //   MAT1-Senior: HAD Internal_Development
  // The flip with founder skill level = founder-anchored bug. Post-B6 buyer-
  // anchored rewrite: presence should be STABLE across the trio (either all
  // 3 or none — what matters is no flip on founder).
  // SMB-targeted comparator confirms internal_build does NOT fire on small-buyer
  // domain (solo dentists have no engineering org).
  {
    id: 'MAT1-LEGAL-BEGINNER',
    group: 'T1T6',
    purpose: 'MAT1 baseline × beginner profile. T1: stable Stage 1 + MD/MO/OR scores vs other MAT1 profiles. T6: internal_build presence should match Intermediate/Senior (no founder-skill flip).',
    idea: 'A legal document automation tool that uses AI to generate first drafts of standard agreements (NDAs, employment offers, service contracts) from intake form responses. Lawyers review and edit; the tool learns firm-specific language patterns over time. Target users are corporate counsel and small-firm partners drafting 10-50 standard agreements per month.',
    profile: PROFILES.MAT1_BEGINNER,
    expected: {
      evidence_strength_not: 'LOW',
    },
  },
  {
    id: 'MAT1-LEGAL-INTERMEDIATE',
    group: 'T1T6',
    purpose: 'MAT1 baseline × intermediate profile. Same idea — Stage 1 + scoring should be stable; internal_build should match Beginner/Senior outcome.',
    idea: 'A legal document automation tool that uses AI to generate first drafts of standard agreements (NDAs, employment offers, service contracts) from intake form responses. Lawyers review and edit; the tool learns firm-specific language patterns over time. Target users are corporate counsel and small-firm partners drafting 10-50 standard agreements per month.',
    profile: PROFILES.MAT1_INTERMEDIATE,
    expected: {
      evidence_strength_not: 'LOW',
    },
  },
  {
    id: 'MAT1-LEGAL-SENIOR',
    group: 'T1T6',
    purpose: 'MAT1 baseline × senior profile. Same idea — Stage 1 + scoring should be stable; internal_build should match Beginner/Intermediate outcome.',
    idea: 'A legal document automation tool that uses AI to generate first drafts of standard agreements (NDAs, employment offers, service contracts) from intake form responses. Lawyers review and edit; the tool learns firm-specific language patterns over time. Target users are corporate counsel and small-firm partners drafting 10-50 standard agreements per month.',
    profile: PROFILES.MAT1_SENIOR,
    expected: {
      evidence_strength_not: 'LOW',
    },
  },
  {
    id: 'IB-SMB',
    group: 'T1T6',
    purpose: 'SMB B2B clear-negative. Solo dentists have no engineering org — internal_build should NOT fire. Confirms buyer-anchored rule produces correct negative.',
    idea: 'A scheduling and patient reminder tool for solo dental practices. The tool sends SMS appointment reminders, manages cancellations and rebooking, and integrates with the dentist\'s calendar. Target users are independent dental practices with one practitioner and 1-2 admin staff.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_not: 'LOW',
      internal_build_count: 0,
    },
  },
];

// === T7 + variance group — same-input reruns (6 runs total) ===
// MD1 × 2: trigger 2 + provisional framing consistency
// NC4 × 2: counter-example holds across reruns
// BN1 × 1: trigger 3 (bare-narrative) consistency
// MAT1-LEGAL-SENIOR × 1: same-profile Stage 1 stability + internal_build presence
//                       stability against Phase 0 non-determinism
const VARIANCE_CASES = [
  { sourceId: 'MD1', reruns: 2 },
  { sourceId: 'NC4', reruns: 2 },
  { sourceId: 'BN1', reruns: 1 },
  { sourceId: 'MAT1-LEGAL-SENIOR', reruns: 1 },
];

// === Free parity (2 cases) ===
const FREE_PARITY_CASES = [
  { sourceId: 'MD1', purpose: 'Free LOW trigger fires on contradictory dump + provisional framing in competition.summary' },
  { sourceId: 'NC4', purpose: 'Free does NOT over-fire LOW on problem-first input (boundary parity)' },
];

// ============================================
// DETECTORS — pass-1 regex flagging, pass-2 manual review for ambiguous matches
// ============================================

const DETECTORS = {
  // === T3 — Provisional framing on sparse Stage 1 output ===
  // The locked template: "Category inferred from limited input; search executed against [X] as the closest match."
  // Detector matches the template + close paraphrases (model rotates phrasings within structural contract).
  PROVISIONAL_FRAMING_OPEN: /category (?:was\s+)?inferred from (?:the\s+)?(?:limited|sparse|thin|minimal) input|inferred (?:the\s+)?category from (?:limited|sparse|thin|minimal) input|search (?:was\s+)?executed against [^.]{3,80} as the closest match/i,

  // Provisional language anchors (used after the opening sentence)
  PROVISIONAL_LANGUAGE: /\bif the intended (?:category|target|space|market) is\b|\bassuming (?:the\s+)?(?:intended\s+)?(?:category|target|space|market) is\b|\bprovided the (?:category|space|target) is\b|\bif (?:we\s+)?(?:assume|interpret) (?:the\s+)?(?:idea|input) (?:as|targets)\b/i,

  // === T4 — Stage 1 judgment-language forbidden terms ===
  // Verbatim 9-term list from locked Section 11 design. Hard zero tolerance on Stage 1 outputs.
  // Note: word-boundaries used to avoid false matches inside larger words.
  STAGE1_JUDGMENT_LEAK: /\bcrowded\b|\bpromising\b|\bhighly competitive\b|\bclear demand\b|\bopportunity for\b|\broom for\b|\bwindow is closing\b|\b(?:open|closed)\s+(?:market|space|category|opportunity)\b/i,

  // === T5 — Temporal factuality ===
  // Positive: factual date markers (year + month, quarter, "in past N months/years")
  TEMPORAL_DATE: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b|\bQ[1-4]\s+\d{4}\b|\bin\s+(?:early|mid|late)?\s*\d{4}\b|\b(?:past|last)\s+\d+\s+(?:months?|years?)\b|\brecent(?:ly)?\s+(?:launched|announced|released)\b/i,

  // Forbidden: timing-judgment phrasing (interpretive, not factual)
  TEMPORAL_JUDGMENT_FORBIDDEN: /\bwindow is closing\b|\bfast[\s-]moving (?:market|space|category)\b|\bcatching up fast\b|\bmarket is heating up\b|\bmomentum is building\b|\brace against\b|\bclosing window\b|\bshrinking window\b/i,

  // === B5 REUSE (T7 regression) ===
  MO_INFERRED_PRICING: /(?:practices|hospitals|firms|companies|businesses|clinics|banks|lawyers|dentists)\s+(?:already\s+)?pay(?:s)?\s+for\s+(?:software|tools|technology|services|subscriptions)|have\s+(?:IT|software|technology)\s+budgets|afford\s+to\s+spend|willing\s+to\s+pay|will(?:ing)?(?:ness)?\s+to\s+pay/i,

  LOW_REASON_MARKERS: /input is too vague|too thin|no specific (?:workflows?|features?|buyer|product|target user)|specification gap|contradictory scope|undefined core (?:mechanism|feature)|did not specify|does not (?:identify|specify|name)|user (?:did not|has not) (?:specify|describe|name)|lacks specification|no concrete product|leaves [a-z\s]+ ambiguous|too non-specific/i,

  // Idea-confidence patterns forbidden anywhere (Narrative Contract V3 matrix lock)
  IDEA_CONFIDENCE_PATTERNS: /this idea will likely (?:succeed|fail)|the evaluation is reliable|confident in (?:this idea|the score|the evaluation)|the score is (?:reliable|trustworthy|accurate)/i,
};

// Stage 3 sparse-cascade markers (T7 cross-stage propagation)
const SPEC_BOTTLENECK_VALUE = 'Specification';
const SPEC_DURATION_PATTERN = /Cannot estimate until specific workflow is defined/i;
const SPEC_DIFFICULTY_VALUE = 'N/A';

// ============================================
// API CALLER + SSE PARSING
// ============================================

async function callPipeline(endpoint, idea, profile) {
  const url = `${BASE_URL}${endpoint}`;
  const startTime = Date.now();

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea, profile }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} on ${endpoint}: ${await response.text()}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const events = [];
  let analysis = null;

  if (contentType.includes('text/event-stream')) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
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
    events.push({ event: 'json_response', data: json });
    analysis = extractAnalysis({ event: 'json_response', data: json });
  }

  const elapsedMs = Date.now() - startTime;
  return { analysis, events, elapsedMs };
}

function parseSseEvent(raw) {
  const lines = raw.split('\n');
  let event = 'message';
  let dataLines = [];
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  const dataStr = dataLines.join('\n');
  let data = dataStr;
  try { data = JSON.parse(dataStr); } catch (_) { /* keep as string */ }
  return { event, data };
}

// ============================================
// EXTRACTION — pulls the full analysis payload from SSE 'complete' event
// ============================================
// Critical fix from B5 lesson: the analysis payload lives at event.data.data
// (NOT event.data). The 'complete' SSE event has shape:
//   { step: 'complete', message: '...', data: { competition, evaluation,
//     estimates, _pro, _meta, ... } }
// B5's runner looked one level too shallow and reported NO_EVALUATION on every
// case until streaming.json was inspected directly. Pre-flight check (below)
// catches this class of bug before the full bank wastes API spend.

function extractAnalysis(event) {
  const d = event.data;
  if (!d || typeof d !== 'object') return null;

  // SSE 'complete' event: payload at d.data
  if (d.step === 'complete' && d.data && typeof d.data === 'object') {
    const payload = d.data;
    // Sanity check: a real analysis has competition + evaluation
    if (payload.competition && payload.evaluation) {
      return payload;
    }
  }

  // Direct payload (non-SSE fallback or already-unwrapped)
  if (d.competition && d.evaluation) return d;

  // Other SSE events (keywords_done, stage1_done, etc.) — not the analysis event
  return null;
}

// Helper extractors for B6's specific verification surfaces
function getStage1Output(analysis) {
  return (analysis && analysis.competition) || null;
}

function getStage2aPackets(analysis) {
  // Pro only — Free has no _pro field
  return (analysis && analysis._pro && analysis._pro.evidence_packets) || null;
}

function getEvaluation(analysis) {
  return (analysis && analysis.evaluation) || null;
}

function getEstimates(analysis) {
  return (analysis && analysis.estimates) || null;
}

function getCompetitorTypes(analysis) {
  const stage1 = getStage1Output(analysis);
  if (!stage1 || !Array.isArray(stage1.competitors)) return [];
  return stage1.competitors.map(c => c.competitor_type || 'unknown');
}

// ============================================
// PRE-FLIGHT CHECK — B5 standing discipline
// ============================================
// Runs ONE warm-up case before the full bank. Confirms the runner's extraction
// logic actually pulls Stage 1 / Stage 2a / Stage 2b / Stage 3 fields from the
// real SSE response shape. Cost: one Sonnet call (~3 min). Avoids B5's failure
// mode where 27 cases / 50 minutes / full API spend ran with broken extractor.

async function preflightCheck() {
  console.log('\n=== Pre-flight check (B5 standing discipline) ===');
  console.log('Running ONE warm-up case to verify extraction shape...');

  const warmup = CASES.find(c => c.id === 'NC1'); // Well-specified, all stages should populate
  if (!warmup) {
    throw new Error('Pre-flight: NC1 case missing from CASES bank');
  }

  let result;
  try {
    result = await callPipeline('/api/analyze-pro', warmup.idea, warmup.profile);
  } catch (err) {
    throw new Error(`Pre-flight: API call failed (${err.message}). Is the dev server running at ${BASE_URL}?`);
  }

  const checks = {
    'analysis extracted': !!result.analysis,
    'Stage 1 output (competition)': !!getStage1Output(result.analysis),
    'Stage 1 landscape_analysis': !!(getStage1Output(result.analysis) || {}).landscape_analysis,
    'Stage 1 differentiation': !!(getStage1Output(result.analysis) || {}).differentiation,
    'Stage 1 entry_barriers': !!(getStage1Output(result.analysis) || {}).entry_barriers,
    'Stage 1 competitors[]': Array.isArray((getStage1Output(result.analysis) || {}).competitors),
    'Stage 2a packets (_pro)': !!getStage2aPackets(result.analysis),
    'Stage 2b evaluation': !!getEvaluation(result.analysis),
    'Stage 2b evidence_strength': !!(getEvaluation(result.analysis) || {}).evidence_strength,
    'Stage 3 estimates': !!getEstimates(result.analysis),
    'Stage 3 main_bottleneck': !!(getEstimates(result.analysis) || {}).main_bottleneck,
  };

  let allPassed = true;
  for (const [name, passed] of Object.entries(checks)) {
    console.log(`  ${passed ? '✓' : '✗'} ${name}`);
    if (!passed) allPassed = false;
  }

  if (!allPassed) {
    // Dump the first complete event so debugging is fast
    const completeEvent = result.events.find(e => e.data && e.data.step === 'complete');
    console.error('\nPre-flight FAILED. Raw complete event for debugging:');
    console.error(JSON.stringify(completeEvent, null, 2).slice(0, 2000));
    throw new Error('Pre-flight extraction shape mismatch — fix extractAnalysis() before running full bank');
  }

  console.log(`Pre-flight PASS (${(result.elapsedMs / 1000).toFixed(1)}s) — proceeding to full bank.`);
  return result; // can be reused as case-1 result if desired
}

// ============================================
// PASS-1 DETECTORS — apply regexes, return candidate flags with context
// ============================================

function detectFlags(caseDef, analysis) {
  if (!analysis) {
    return [{ kind: 'NO_ANALYSIS', detail: 'API returned no analysis payload', requires_manual_review: false }];
  }

  const flags = [];
  const stage1 = getStage1Output(analysis) || {};
  const evaluation = getEvaluation(analysis) || {};
  const estimates = getEstimates(analysis) || {};
  const moPacket = (getStage2aPackets(analysis) || {}).monetization || null;

  const isFree = !analysis._pro;
  const es = evaluation.evidence_strength || {};
  const level = es.level || null;
  const reason = es.reason || '';

  // Stage 1 fields scope changes per pipeline:
  //   Pro: landscape_analysis + differentiation + entry_barriers
  //   Free: differentiation + summary (no landscape_analysis or entry_barriers)
  const stage1Texts = isFree
    ? [stage1.differentiation || '', stage1.summary || '']
    : [stage1.landscape_analysis || '', stage1.differentiation || '', stage1.entry_barriers || ''];

  const stage1Combined = stage1Texts.join('\n\n');
  const stage1FramingTarget = isFree ? (stage1.summary || '') : (stage1.landscape_analysis || '');

  // ============================================
  // T3 — Provisional framing
  // ============================================
  if (caseDef.expected) {
    const expectFraming = caseDef.expected.stage1_provisional_framing;

    if (expectFraming === true) {
      const hasFramingOpen = DETECTORS.PROVISIONAL_FRAMING_OPEN.test(stage1FramingTarget);
      const hasProvisionalLanguage = DETECTORS.PROVISIONAL_LANGUAGE.test(stage1FramingTarget);
      if (!hasFramingOpen) {
        flags.push({
          kind: 'PROVISIONAL_FRAMING_MISSING',
          detail: 'Sparse case expected provisional framing in Stage 1 but opening template not detected',
          target_field: isFree ? 'competition.summary' : 'competition.landscape_analysis',
          target_text: stage1FramingTarget.slice(0, 300),
          requires_manual_review: true,
          note: 'B3 meta-lesson: regex may miss design-faithful paraphrases. Confirm whether the opening sentence structurally matches the locked template before treating as model issue.',
        });
      }
      if (hasFramingOpen && !hasProvisionalLanguage) {
        flags.push({
          kind: 'PROVISIONAL_LANGUAGE_MISSING',
          detail: 'Provisional opening fired but rest of landscape lacks provisional language ("if the intended category is X" / "assuming...")',
          target_field: isFree ? 'competition.summary' : 'competition.landscape_analysis',
          target_text: stage1FramingTarget.slice(0, 500),
          requires_manual_review: true,
        });
      }
    }

    if (expectFraming === false) {
      const hasFramingOpen = DETECTORS.PROVISIONAL_FRAMING_OPEN.test(stage1FramingTarget);
      if (hasFramingOpen) {
        flags.push({
          kind: 'PROVISIONAL_FRAMING_OVERFIRE',
          detail: 'Negative-control case unexpectedly fired provisional framing (counter-example clause may have failed)',
          target_field: isFree ? 'competition.summary' : 'competition.landscape_analysis',
          target_text: stage1FramingTarget.slice(0, 300),
          requires_manual_review: false,
        });
      }
    }
  }

  // ============================================
  // T4 — Judgment-language leak detection (Stage 1 outputs only)
  // ============================================
  const leakMatches = stage1Combined.match(DETECTORS.STAGE1_JUDGMENT_LEAK);
  if (leakMatches) {
    flags.push({
      kind: 'STAGE1_JUDGMENT_LEAK',
      detail: `Stage 1 output contains forbidden judgment term: "${leakMatches[0]}"`,
      matched_term: leakMatches[0],
      target_combined: stage1Combined.slice(0, 800),
      requires_manual_review: true,
      note: 'P11-S1 enforcement check failed. Manual review confirms whether term appears in the named Stage 1 fields (landscape/differentiation/entry_barriers on Pro; differentiation/summary on Free) versus elsewhere.',
    });
  }

  // ============================================
  // T5 — Temporal anchoring (only on T5 cases)
  // ============================================
  if (caseDef.group === 'T5') {
    const hasFactualDate = DETECTORS.TEMPORAL_DATE.test(stage1Combined);
    const judgmentMatch = stage1Combined.match(DETECTORS.TEMPORAL_JUDGMENT_FORBIDDEN);

    if (caseDef.expected.stage1_temporal_dates && !hasFactualDate) {
      flags.push({
        kind: 'TEMPORAL_DATE_MISSING',
        detail: 'T5 case expected factual dates in Stage 1 but none detected. May be a Serper retrieval issue (no recent results) — manual review checks search results.',
        target_combined: stage1Combined.slice(0, 800),
        requires_manual_review: true,
        note: 'Relevance gate is OK to suppress dates if search did not return recent activity. Manual review confirms search returned recent results before flagging as model issue.',
      });
    }

    if (judgmentMatch) {
      flags.push({
        kind: 'TEMPORAL_JUDGMENT_LEAK',
        detail: `Stage 1 contains forbidden timing-judgment phrasing: "${judgmentMatch[0]}"`,
        matched_term: judgmentMatch[0],
        target_combined: stage1Combined.slice(0, 800),
        requires_manual_review: false,
        note: 'Hard fail: temporal anchoring is FACTUAL only, not interpretive timing commentary.',
      });
    }
  }

  // ============================================
  // T7 — B5 regression: evidence_strength + Stage 3 cascade
  // ============================================
  if (caseDef.expected) {
    if (caseDef.expected.evidence_strength_level && level !== caseDef.expected.evidence_strength_level) {
      flags.push({
        kind: 'EVIDENCE_STRENGTH_MISMATCH',
        detail: `Expected evidence_strength.level=${caseDef.expected.evidence_strength_level}, got ${level || '(missing)'}`,
        evidence_strength: es,
        requires_manual_review: false,
      });
    }

    if (caseDef.expected.evidence_strength_not && level === caseDef.expected.evidence_strength_not) {
      flags.push({
        kind: 'EVIDENCE_STRENGTH_OVERFIRE',
        detail: `Expected evidence_strength NOT to be ${caseDef.expected.evidence_strength_not}, but it fired`,
        evidence_strength: es,
        requires_manual_review: false,
      });
    }

    // T7 — Stage 3 sparse cascade when LOW fires
    if (level === 'LOW') {
      const cascadeOk =
        estimates.main_bottleneck === SPEC_BOTTLENECK_VALUE &&
        SPEC_DURATION_PATTERN.test(estimates.duration || '') &&
        estimates.difficulty === SPEC_DIFFICULTY_VALUE;
      if (!cascadeOk) {
        flags.push({
          kind: 'CROSS_STAGE_CASCADE_BROKEN',
          detail: 'LOW fired but Stage 3 sparse cascade did not propagate',
          observed: {
            main_bottleneck: estimates.main_bottleneck,
            duration: estimates.duration,
            difficulty: estimates.difficulty,
          },
          expected: {
            main_bottleneck: SPEC_BOTTLENECK_VALUE,
            duration_pattern: 'Cannot estimate until specific workflow is defined',
            difficulty: SPEC_DIFFICULTY_VALUE,
          },
          requires_manual_review: false,
        });
      }
    }

    // T7 B5 regression — MO_INFERRED_PRICING on T1-class sparse cases
    if (caseDef.expected.mo_inferred_pricing_count !== undefined && moPacket) {
      const moTexts = [
        moPacket.strongest_positive || '',
        ...(moPacket.admissible_facts || []),
      ];
      for (const text of moTexts) {
        if (DETECTORS.MO_INFERRED_PRICING.test(text)) {
          flags.push({
            kind: 'MO_INFERRED_PRICING',
            detail: 'MO packet contains potential inferred-pricing pattern (B5 regression check)',
            text,
            requires_manual_review: true,
            note: 'Confirm whether this is fabricated MO support (hard fail) or gap-naming language (acceptable, e.g., "the input does not specify whether dentists would pay"). B5 regression: Stage 2a strip should NOT have re-introduced this failure mode.',
          });
        }
      }
    }
  }

  // ============================================
  // T6 — internal_build presence (per-case + cross-profile aggregation later)
  // ============================================
  if (caseDef.expected && caseDef.expected.internal_build_count !== undefined) {
    const types = getCompetitorTypes(analysis);
    const observedCount = types.filter(t => t === 'internal_build').length;
    if (observedCount !== caseDef.expected.internal_build_count) {
      flags.push({
        kind: 'INTERNAL_BUILD_COUNT_MISMATCH',
        detail: `Expected internal_build count=${caseDef.expected.internal_build_count}, got ${observedCount}`,
        observed_count: observedCount,
        requires_manual_review: true,
        note: 'T6 buyer-anchored test: SMB-targeted ideas should NOT fire internal_build. Manual review confirms whether the observed competitors[] reflect buyer-anchored reasoning.',
      });
    }
  }

  // ============================================
  // Forbidden idea-confidence patterns (anywhere)
  // ============================================
  for (const text of [reason, evaluation.summary || '']) {
    if (DETECTORS.IDEA_CONFIDENCE_PATTERNS.test(text)) {
      flags.push({
        kind: 'IDEA_CONFIDENCE_PATTERN',
        detail: 'Idea-outcome confidence pattern detected (forbidden by Narrative Contract V3 matrix)',
        text,
        requires_manual_review: true,
      });
    }
  }

  return flags;
}

// ============================================
// CROSS-PROFILE VARIANCE ANALYSIS (T1 + T6 stability check)
// ============================================
// Compares MAT1 trio (Beginner/Intermediate/Senior) on same idea. Post-B6 expectations:
//   - Stage 1 landscape_analysis: similar across profiles (within Phase 0 noise cap)
//   - Stage 1 competitors[]: HIGH overlap (profile no longer drives selection)
//   - Stage 2b MD/MO/OR scores: small variance (profile-blind scoring)
//   - Stage 2b TC: differs per profile (TC IS profile-aware — correct)
//   - Stage 2c Risk 3 founder_fit: differs per profile (Risk 3 IS profile-aware — correct)
//   - internal_build presence: STABLE across profiles (buyer-anchored)

function jaccardSimilarity(setA, setB) {
  const a = new Set(setA);
  const b = new Set(setB);
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 1.0 : intersection.size / union.size;
}

function analyzeMat1Variance(results) {
  const mat1Cases = results.filter(r =>
    r.caseDef && r.caseDef.id && r.caseDef.id.startsWith('MAT1-LEGAL-') && !r.label.includes('-r')
  );

  if (mat1Cases.length < 3) {
    return { skipped: true, reason: `Only ${mat1Cases.length} MAT1 cases found, expected 3` };
  }

  const profiles = mat1Cases.map(r => ({
    id: r.caseDef.id,
    competitors: ((getStage1Output(r.analysis) || {}).competitors || []).map(c => c.name),
    competitor_types: getCompetitorTypes(r.analysis),
    md_score: ((getEvaluation(r.analysis) || {}).market_demand || {}).score,
    mo_score: ((getEvaluation(r.analysis) || {}).monetization || {}).score,
    or_score: ((getEvaluation(r.analysis) || {}).originality || {}).score,
    tc_score: ((getEvaluation(r.analysis) || {}).technical_complexity || {}).score,
    internal_build_count: getCompetitorTypes(r.analysis).filter(t => t === 'internal_build').length,
  }));

  // Pairwise Jaccard on competitor name lists
  const competitorOverlaps = [];
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      competitorOverlaps.push({
        pair: `${profiles[i].id} ↔ ${profiles[j].id}`,
        jaccard: jaccardSimilarity(profiles[i].competitors, profiles[j].competitors),
      });
    }
  }

  // Score spreads
  const scoreSpread = (key) => {
    const vals = profiles.map(p => p[key]).filter(v => typeof v === 'number');
    if (vals.length === 0) return null;
    return Math.max(...vals) - Math.min(...vals);
  };

  // internal_build stability: all 3 should match (all 3 fire OR all 3 not fire)
  const ibCounts = profiles.map(p => p.internal_build_count > 0);
  const ibStable = ibCounts.every(v => v === ibCounts[0]);

  return {
    skipped: false,
    profiles,
    competitor_overlaps: competitorOverlaps,
    score_spreads: {
      md: scoreSpread('md_score'),
      mo: scoreSpread('mo_score'),
      or: scoreSpread('or_score'),
      tc: scoreSpread('tc_score'),
    },
    internal_build_stable: ibStable,
    internal_build_per_profile: profiles.map(p => ({ id: p.id, count: p.internal_build_count })),
  };
}

// ============================================
// RUNNER
// ============================================

async function runCase(caseDef, endpointOverride = null, label = null) {
  const tag = label || caseDef.id;
  const endpoint = endpointOverride || caseDef.pipeline || '/api/analyze-pro';
  process.stdout.write(`[${tag}] running (${endpoint})... `);
  try {
    const { analysis, events, elapsedMs } = await callPipeline(endpoint, caseDef.idea, caseDef.profile);
    const flags = detectFlags(caseDef, analysis);
    const status = flags.some(f => !f.requires_manual_review) ? 'FAIL' :
                   flags.length > 0 ? 'FLAG' : 'OK';
    process.stdout.write(`${status} (${(elapsedMs / 1000).toFixed(1)}s, ${flags.length} flags)\n`);
    return { caseDef, analysis, events, elapsedMs, flags, status, label: tag, endpoint };
  } catch (err) {
    process.stdout.write(`ERROR: ${err.message}\n`);
    return { caseDef, analysis: null, events: [], elapsedMs: 0, flags: [{ kind: 'API_ERROR', detail: err.message }], status: 'ERROR', label: tag, endpoint };
  }
}

async function main() {
  console.log(`[B6] V4S28 Bundle B6 verification runner`);
  console.log(`[B6] base_url: ${BASE_URL}`);
  console.log(`[B6] output: ${OUTPUT_DIR}`);

  // ------------------------------
  // Pre-flight (B5 standing discipline) — die early if extraction is wrong
  // ------------------------------
  await preflightCheck();

  const results = [];

  // ------------------------------
  // Pass A — main case bank
  // ------------------------------
  console.log('\n=== Pass A — main case bank ===');
  for (const c of CASES) {
    const r = await runCase(c);
    results.push(r);
  }

  // ------------------------------
  // Pass B — variance reruns
  // ------------------------------
  console.log('\n=== Pass B — variance reruns ===');
  const varianceResults = {};
  for (const v of VARIANCE_CASES) {
    const sourceCase = CASES.find(c => c.id === v.sourceId);
    if (!sourceCase) {
      console.log(`  WARN: variance source ${v.sourceId} not found in case bank`);
      continue;
    }
    varianceResults[v.sourceId] = [];
    for (let i = 1; i <= v.reruns; i++) {
      const r = await runCase(sourceCase, null, `${v.sourceId}-r${i}`);
      varianceResults[v.sourceId].push(r);
      results.push(r);
    }
  }

  // ------------------------------
  // Pass C — Free parity
  // ------------------------------
  console.log('\n=== Pass C — Free pipeline parity ===');
  const freeResults = [];
  for (const fp of FREE_PARITY_CASES) {
    const sourceCase = CASES.find(c => c.id === fp.sourceId);
    if (!sourceCase) {
      console.log(`  WARN: Free parity source ${fp.sourceId} not found in case bank`);
      continue;
    }
    const r = await runCase(sourceCase, '/api/analyze', `FREE-${fp.sourceId}`);
    freeResults.push({ ...r, freePurpose: fp.purpose });
    results.push(r);
  }

  // ------------------------------
  // Cross-profile variance analysis (T1 + T6 stability)
  // ------------------------------
  const mat1Variance = analyzeMat1Variance(results);

  // ------------------------------
  // Threshold scoring
  // ------------------------------
  console.log('\n=== Threshold scoring ===');
  const thresholds = scoreThresholds(results, varianceResults, freeResults, mat1Variance);
  for (const t of thresholds) {
    console.log(`  ${t.name}: ${t.passed ? 'PASS' : 'FAIL'} — ${t.detail}`);
  }
  const allPassed = thresholds.every(t => t.passed);
  console.log(`\n[B6] Overall: ${allPassed ? 'PASS' : 'FAIL (review required — see flags.md)'}`);

  // ------------------------------
  // Persist outputs
  // ------------------------------
  fs.writeFileSync(path.join(OUTPUT_DIR, 'raw.json'),
    JSON.stringify(results.map(r => ({
      label: r.label,
      caseId: r.caseDef.id,
      group: r.caseDef.group,
      endpoint: r.endpoint,
      idea: r.caseDef.idea.slice(0, 200),
      analysis: r.analysis,
      flags: r.flags,
      status: r.status,
      elapsedMs: r.elapsedMs,
    })), null, 2));

  fs.writeFileSync(path.join(OUTPUT_DIR, 'streaming.json'),
    JSON.stringify(results.map(r => ({
      label: r.label,
      events: r.events,
    })), null, 2));

  fs.writeFileSync(path.join(OUTPUT_DIR, 'flags.md'), generateFlagsMarkdown(results));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'results.md'),
    generateResultsMarkdown(results, thresholds, varianceResults, freeResults, mat1Variance));

  console.log(`\n[B6] outputs written to ${OUTPUT_DIR}/`);
}

// ============================================
// THRESHOLD SCORING
// ============================================

function scoreThresholds(results, varianceResults, freeResults, mat1Variance) {
  const out = [];
  const passA = results.filter(r => !r.label.includes('-r') && !r.label.startsWith('FREE-'));

  // ------------------------------
  // T1 — Profile-strip runtime stability (cross-profile MAT1 trio)
  // ------------------------------
  // Pass criteria: MAT1 trio shows
  //   - Mean competitor Jaccard ≥ 0.50 (profile no longer drives competitor selection
  //     beyond Phase 0 non-determinism cap; Phase 0 baseline was 0.38 with profile)
  //   - MD/MO/OR score spread ≤ 1.5 each (profile-blind scoring)
  //   - TC score spread ≥ 0 (TC may legitimately differ; not a fail criterion)
  if (mat1Variance.skipped) {
    out.push({ name: 'T1', passed: false, detail: `MAT1 variance analysis skipped: ${mat1Variance.reason}` });
  } else {
    const overlapVals = mat1Variance.competitor_overlaps.map(o => o.jaccard);
    const meanOverlap = overlapVals.reduce((a, b) => a + b, 0) / overlapVals.length;
    const mdOk = mat1Variance.score_spreads.md !== null && mat1Variance.score_spreads.md <= 1.5;
    const moOk = mat1Variance.score_spreads.mo !== null && mat1Variance.score_spreads.mo <= 1.5;
    const orOk = mat1Variance.score_spreads.or !== null && mat1Variance.score_spreads.or <= 1.5;
    const overlapOk = meanOverlap >= 0.50;
    const passed = mdOk && moOk && orOk && overlapOk;
    out.push({
      name: 'T1',
      passed,
      detail: `MAT1 trio: mean competitor Jaccard=${meanOverlap.toFixed(2)} (target ≥0.50, Phase 0 baseline=0.38), MD spread=${mat1Variance.score_spreads.md} MO=${mat1Variance.score_spreads.mo} OR=${mat1Variance.score_spreads.or} TC=${mat1Variance.score_spreads.tc} (target MD/MO/OR ≤1.5; TC unbounded — profile-aware)`,
    });
  }

  // ------------------------------
  // T2 — static grep gate (NOT runner)
  // ------------------------------
  // Documented at end of file. Reported as PASS-by-construction since it's a pre-commit check.
  out.push({
    name: 'T2',
    passed: true,
    detail: 'Static grep gate (pre-commit only) — see comment block at end of file. Not measured by runner.',
  });

  // ------------------------------
  // T3 — Sparse Stage 1 provisional framing
  // ------------------------------
  const t3Cases = passA.filter(r => r.caseDef.group === 'T3T7' && r.caseDef.expected.stage1_provisional_framing !== undefined);
  let t3Pass = 0, t3Fail = 0;
  for (const r of t3Cases) {
    const expectFraming = r.caseDef.expected.stage1_provisional_framing;
    const framingFlags = r.flags.filter(f => f.kind === 'PROVISIONAL_FRAMING_MISSING' || f.kind === 'PROVISIONAL_FRAMING_OVERFIRE');
    const confirmed = framingFlags.filter(f => !f.requires_manual_review);
    if (expectFraming === true) {
      if (confirmed.some(f => f.kind === 'PROVISIONAL_FRAMING_MISSING')) t3Fail++;
      else t3Pass++;
    } else if (expectFraming === false) {
      if (confirmed.some(f => f.kind === 'PROVISIONAL_FRAMING_OVERFIRE')) t3Fail++;
      else t3Pass++;
    }
  }
  out.push({
    name: 'T3',
    passed: t3Fail === 0,
    detail: `Sparse provisional framing: ${t3Pass}/${t3Cases.length} cases behave correctly (auto-confirmed; ${t3Cases.reduce((a, r) => a + r.flags.filter(f => f.kind === 'PROVISIONAL_FRAMING_MISSING' && f.requires_manual_review).length, 0)} flagged for manual review)`,
  });

  // ------------------------------
  // T4 — Judgment-language leak (Stage 1 outputs only) — HARD ZERO TOLERANCE
  // ------------------------------
  const t4FlaggedCases = results.filter(r => r.flags.some(f => f.kind === 'STAGE1_JUDGMENT_LEAK'));
  // T4 flags are manual-review (regex catches form, manual confirms field scope).
  // Report leaked count as a number — manual review post-run determines confirmed vs false-positive.
  out.push({
    name: 'T4',
    passed: t4FlaggedCases.length === 0,
    detail: `Judgment-language leaks: ${t4FlaggedCases.length} case(s) flagged (target: 0; HARD ZERO TOLERANCE post-B6 enforcement check). If non-zero, review flags.md to confirm whether each leak is in a Stage 1 field vs metric explanation (Free pipeline allows "crowded" in metric explanations).`,
  });

  // ------------------------------
  // T5 — Temporal anchoring factuality
  // ------------------------------
  const t5Cases = passA.filter(r => r.caseDef.group === 'T5');
  const t5JudgmentLeaks = t5Cases.reduce((a, r) => a + r.flags.filter(f => f.kind === 'TEMPORAL_JUDGMENT_LEAK').length, 0);
  const t5DateMissing = t5Cases.filter(r => r.flags.some(f => f.kind === 'TEMPORAL_DATE_MISSING')).length;
  out.push({
    name: 'T5',
    passed: t5JudgmentLeaks === 0,
    detail: `Temporal anchoring: ${t5JudgmentLeaks} timing-judgment leaks (target: 0); ${t5DateMissing} cases missing dates (manual review — relevance-gated, OK if search returned no recent activity)`,
  });

  // ------------------------------
  // T6 — internal_build buyer-anchored stability
  // ------------------------------
  // Two checks:
  //   (a) MAT1 trio internal_build presence is stable (all-or-none)
  //   (b) IB-SMB has 0 internal_build entries (clear-negative)
  const ibSmbCase = passA.find(r => r.caseDef.id === 'IB-SMB');
  const ibSmbOk = ibSmbCase && !ibSmbCase.flags.some(f => f.kind === 'INTERNAL_BUILD_COUNT_MISMATCH' && !f.requires_manual_review);
  const mat1IbStable = !mat1Variance.skipped && mat1Variance.internal_build_stable;
  out.push({
    name: 'T6',
    passed: ibSmbOk && mat1IbStable,
    detail: `internal_build stability: MAT1 trio stable=${mat1IbStable} (per-profile counts: ${mat1Variance.skipped ? 'N/A' : JSON.stringify(mat1Variance.internal_build_per_profile)}), IB-SMB clear-negative=${ibSmbOk}`,
  });

  // ------------------------------
  // T7 — B5 regression
  // ------------------------------
  // Three sub-checks:
  //   (a) MD1 still LOW + Specification cascade
  //   (b) NC4 still NOT LOW + cascade absent
  //   (c) SP-DENTAL still no MO_INFERRED_PRICING (auto-confirmed only — manual flags reviewed separately)
  const md1 = passA.find(r => r.caseDef.id === 'MD1');
  const nc4 = passA.find(r => r.caseDef.id === 'NC4');
  const spDental = passA.find(r => r.caseDef.id === 'SP-DENTAL');
  const md1Ok = md1 && !md1.flags.some(f => (f.kind === 'EVIDENCE_STRENGTH_MISMATCH' || f.kind === 'CROSS_STAGE_CASCADE_BROKEN') && !f.requires_manual_review);
  const nc4Ok = nc4 && !nc4.flags.some(f => f.kind === 'EVIDENCE_STRENGTH_OVERFIRE' && !f.requires_manual_review);
  const spDentalOk = spDental && !spDental.flags.some(f => f.kind === 'MO_INFERRED_PRICING' && !f.requires_manual_review);
  // Note: MO_INFERRED_PRICING flags are manual-review per B5 lesson — auto pass here, manual confirm in flags.md
  out.push({
    name: 'T7',
    passed: md1Ok && nc4Ok && spDentalOk,
    detail: `B5 regression (Stage 2a strip didn't break locked behavior): MD1 LOW+cascade=${md1Ok}, NC4 not-LOW=${nc4Ok}, SP-DENTAL MO_INFERRED_PRICING auto-clean=${spDentalOk} (manual review of flags.md required)`,
  });

  // ------------------------------
  // Variance stability (informational, not a separate threshold)
  // ------------------------------
  for (const sourceId of Object.keys(varianceResults)) {
    const reruns = varianceResults[sourceId];
    const sourceCase = passA.find(r => r.caseDef.id === sourceId);
    const sourceLevel = (getEvaluation(sourceCase ? sourceCase.analysis : null) || {}).evidence_strength?.level;
    const rerunLevels = reruns.map(r => (getEvaluation(r.analysis) || {}).evidence_strength?.level);
    const allLevels = [sourceLevel, ...rerunLevels];
    const uniqueLevels = [...new Set(allLevels.filter(l => l))];
    if (uniqueLevels.length > 1) {
      out.push({
        name: `Variance-${sourceId}`,
        passed: false,
        detail: `BIMODALITY DETECTED across ${allLevels.length} runs of ${sourceId}: levels=${JSON.stringify(allLevels)}. Phase 0.5 lesson: expanded triggers can introduce edge-case bimodality.`,
      });
    }
  }

  // ------------------------------
  // Free parity (informational — folded into T3/T4 directly above)
  // ------------------------------
  const freeT3Cases = freeResults.filter(r => r.caseDef.expected.stage1_provisional_framing !== undefined);
  const freeT3Fails = freeT3Cases.filter(r => r.flags.some(f =>
    (f.kind === 'PROVISIONAL_FRAMING_MISSING' || f.kind === 'PROVISIONAL_FRAMING_OVERFIRE') && !f.requires_manual_review
  )).length;
  out.push({
    name: 'Free-Parity',
    passed: freeT3Fails === 0,
    detail: `Free parity on T3 sparse framing: ${freeT3Cases.length - freeT3Fails}/${freeT3Cases.length} clean`,
  });

  return out;
}

// ============================================
// REPORT GENERATORS
// ============================================

function generateFlagsMarkdown(results) {
  const lines = [
    `# B6 Pass-1 Detector Flags — Manual Review Required`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `Methodology (B1+B3+B4+B5 lesson): regex detectors can produce false positives. Each flag below requires manual review.`,
    `For each flag, read the surrounding output and classify as **CONFIRMED VIOLATION** or **DETECTOR FALSE POSITIVE**.`,
    `Threshold scoring uses confirmed-violation counts, not raw flag counts.`,
    ``,
    `When detectors miss patterns design-faithful behavior actually produces (B3 meta-lesson — runner enumeration is incomplete), update the regex sets in run-b6.js, NOT the prompt.`,
    ``,
    `---`,
    ``,
  ];

  const flaggedResults = results.filter(r => r.flags.length > 0);
  if (flaggedResults.length === 0) {
    lines.push('**No flags raised. Suite is clean.**', '');
    return lines.join('\n');
  }

  for (const r of flaggedResults) {
    lines.push(`## ${r.label} — ${r.caseDef.group} — ${r.status}`);
    lines.push(`**Idea:** ${r.caseDef.idea.slice(0, 200)}${r.caseDef.idea.length > 200 ? '...' : ''}`);
    lines.push(``);
    lines.push(`**Purpose:** ${r.caseDef.purpose}`);
    lines.push(``);
    for (const f of r.flags) {
      lines.push(`### ${f.kind}`);
      lines.push(`- detail: ${f.detail}`);
      if (f.matched_term) lines.push(`- matched_term: \`${f.matched_term}\``);
      if (f.target_field) lines.push(`- target_field: \`${f.target_field}\``);
      if (f.target_text) lines.push(`- target_text (truncated): ${f.target_text.slice(0, 400)}`);
      if (f.target_combined) lines.push(`- target_combined (truncated): ${f.target_combined.slice(0, 400)}`);
      if (f.text) lines.push(`- text: ${f.text}`);
      if (f.observed) lines.push(`- observed: ${JSON.stringify(f.observed)}`);
      if (f.expected) lines.push(`- expected: ${JSON.stringify(f.expected)}`);
      if (f.evidence_strength) lines.push(`- evidence_strength: ${JSON.stringify(f.evidence_strength)}`);
      if (f.observed_count !== undefined) lines.push(`- observed_count: ${f.observed_count}`);
      if (f.note) lines.push(`- note: ${f.note}`);
      lines.push(`- requires_manual_review: ${f.requires_manual_review === false ? 'NO (structural fail)' : 'YES'}`);
      lines.push(`- **review verdict:** _[ CONFIRMED / FALSE POSITIVE ]_`);
      lines.push(``);
    }
    lines.push(`---`, ``);
  }

  return lines.join('\n');
}

function generateResultsMarkdown(results, thresholds, varianceResults, freeResults, mat1Variance) {
  const lines = [
    `# B6 Verification Results`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `## Summary`,
    ``,
    `| Threshold | Result | Detail |`,
    `|---|---|---|`,
  ];

  for (const t of thresholds) {
    lines.push(`| ${t.name} | ${t.passed ? '✅ PASS' : '❌ FAIL'} | ${t.detail} |`);
  }

  const allPassed = thresholds.every(t => t.passed);
  lines.push(``);
  lines.push(`**Overall: ${allPassed ? '✅ PASS' : '❌ FAIL (review required)'}**`);
  lines.push(``);
  lines.push(`**Total runs:** ${results.length}`);
  lines.push(`**Wall time:** ${(results.reduce((a, r) => a + r.elapsedMs, 0) / 60000).toFixed(1)} minutes`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Per-case
  lines.push(`## Per-case results`);
  lines.push(``);
  lines.push(`| Case | Group | Endpoint | Status | Evidence Strength | Flags |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (const r of results) {
    const level = (getEvaluation(r.analysis) || {}).evidence_strength?.level || '(none)';
    lines.push(`| ${r.label} | ${r.caseDef.group} | ${r.endpoint} | ${r.status} | ${level} | ${r.flags.length} |`);
  }

  // MAT1 cross-profile variance detail
  lines.push(``);
  lines.push(`## MAT1 cross-profile variance (T1 + T6)`);
  lines.push(``);
  if (mat1Variance.skipped) {
    lines.push(`Skipped: ${mat1Variance.reason}`);
  } else {
    lines.push(`### Competitor list overlap (Jaccard similarity)`);
    lines.push(``);
    for (const o of mat1Variance.competitor_overlaps) {
      lines.push(`- ${o.pair}: ${o.jaccard.toFixed(2)}`);
    }
    lines.push(``);
    lines.push(`Phase 0 baseline was 0.38 (with profile in Stage 1). Post-B6 target ≥0.50.`);
    lines.push(``);
    lines.push(`### Score spreads`);
    lines.push(``);
    lines.push(`| Metric | Spread | Target |`);
    lines.push(`|---|---|---|`);
    lines.push(`| MD | ${mat1Variance.score_spreads.md} | ≤1.5 (profile-blind) |`);
    lines.push(`| MO | ${mat1Variance.score_spreads.mo} | ≤1.5 (profile-blind) |`);
    lines.push(`| OR | ${mat1Variance.score_spreads.or} | ≤1.5 (profile-blind) |`);
    lines.push(`| TC | ${mat1Variance.score_spreads.tc} | unbounded (TC IS profile-aware — correct) |`);
    lines.push(``);
    lines.push(`### internal_build presence per profile`);
    lines.push(``);
    for (const p of mat1Variance.internal_build_per_profile) {
      lines.push(`- ${p.id}: ${p.count} entries`);
    }
    lines.push(``);
    lines.push(`Stable across profiles: **${mat1Variance.internal_build_stable ? 'YES' : 'NO'}** (target: stable — buyer-anchored, not founder-anchored)`);
    lines.push(``);
  }

  // Variance summary
  lines.push(`## Variance reruns`);
  lines.push(``);
  for (const sourceId of Object.keys(varianceResults)) {
    const reruns = varianceResults[sourceId];
    const levels = reruns.map(r => (getEvaluation(r.analysis) || {}).evidence_strength?.level || '(none)');
    lines.push(`- **${sourceId}** × ${reruns.length}: ${levels.join(' / ')}`);
  }
  lines.push(``);

  // Free parity
  lines.push(`## Free parity`);
  lines.push(``);
  for (const fr of freeResults) {
    const level = (getEvaluation(fr.analysis) || {}).evidence_strength?.level || '(none)';
    lines.push(`- **${fr.label}** (${fr.endpoint}): level=${level} — ${fr.freePurpose}`);
  }
  lines.push(``);

  lines.push(`---`);
  lines.push(``);
  lines.push(`## Next steps`);
  lines.push(``);
  lines.push(`1. Review **flags.md** — classify each Pass-1 flag as CONFIRMED VIOLATION or DETECTOR FALSE POSITIVE.`);
  lines.push(`2. Re-score thresholds using confirmed-violation counts (use rescore-b6.js if detectors need adjustment).`);
  lines.push(`3. If T1/T7 shows regression, B5's locked behavior may have been disturbed by the Stage 2a strip. Two-strike rule applies: prompt patch first, escalate to architectural fix if patch fails.`);
  lines.push(`4. If T4 has confirmed leaks, P11-S1 enforcement check needs tightening (Path 2: post-generation validator, per locked design).`);

  return lines.join('\n');
}

// ============================================
// PRE-COMMIT GREP GATE — B4+B5 standing discipline
// ============================================
// Run before committing the B6 changes:
//
// # T1: profile injection only in expected places (4 hits, no Stage 1/2a/2b)
// grep -n "userProfile" src/app/api/analyze-pro/route.js
//   Expected: 4 hits at const def + Stage TC + Stage 2c + Stage 3 only
//
// # T2: Stage 1 + Stage 2a prompts don't claim profile access
// grep -rn "and their profile" src/lib/services/prompt-stage1.js src/lib/services/prompt-stage2a.js
//   Expected: 0 hits
//
// # B6 enforcement check terms appear in prompt-stage1.js
// grep -n "ENFORCEMENT CHECK" src/lib/services/prompt-stage1.js
//   Expected: 1 hit (block header)
//
// # SPARSE INPUT RULE block appears in prompt-stage1.js
// grep -n "SPARSE INPUT RULE" src/lib/services/prompt-stage1.js
//   Expected: 1 hit (block header)
//
// # PROFILE-BLINDNESS block appears in prompt-stage1.js
// grep -n "PROFILE-BLINDNESS" src/lib/services/prompt-stage1.js
//   Expected: 1 hit
//
// # COMPETITION SECTION DISCIPLINE block in Free prompt
// grep -n "COMPETITION SECTION DISCIPLINE" src/lib/services/prompt.js
//   Expected: 1 hit
//
// All grep gates must pass before commit.

main().catch(err => {
  console.error('FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});

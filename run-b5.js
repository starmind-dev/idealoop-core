// ============================================
// V4S28 Bundle B5 verification runner
// ============================================
// Bundle B5: Stage 2a sparse-input — MO packet discipline + spec-quality trigger expansion
//   Section 6 P6-S5: MO sparse-input rule mirrors MD's discipline (Stage 2a + Free prompt.js)
//   Section 8 P8-S5: sparse-input trigger expanded from word count to also include
//                    contradictory scope + pure-narrative dump
//
// What this runner verifies:
//   T1 — MO sparse discipline: zero MO_INFERRED_PRICING violations on sparse cases
//   T2 — Spec-quality trigger MD1-class: 4/4 LOW on contradictory dumps
//   T3 — Spec-quality trigger bare-narrative: 3/3 LOW on pure-narrative inputs
//   T4 — Negative control: 0/4 LOW on well-specified inputs (incl. NC4 problem-first)
//   T5 — Cross-stage propagation: 2/2 full chain holds (LOW → Specification + N/A)
//   T6 — Option Z MEDIUM compliance: zero generic-hedging on MEDIUM reasons (B4 regression)
//   T7 — Variance stability: 9/9 same-input runs produce same evidence_strength.level
//   T8 — Free parity: 2/2 Free pipeline matches Pro behavior
//
// Methodology lessons applied:
//   - B1 lesson: detectors can have false positives. Two-pass scoring (regex flag → manual review).
//   - B3 lesson: validOutcomes derived from locked design + Narrative Contract V2 anchor predicates,
//                not intuition. Detector enumeration is the source-of-truth check, not the prompt.
//   - B4 lesson: pre-commit grep gate before commit (see comment block at end of file).
//   - Phase 0.5 lesson: trigger expansion can introduce edge-case bimodality. T7 variance is the tripwire.
//
// Usage:
//   node run-b5.js [base_url]
//   default base_url: http://localhost:3000
//   ANTHROPIC env vars must be set (production routes consume them).
//
// Output:
//   ./b5-outputs/raw.json        — full per-case API responses
//   ./b5-outputs/streaming.json  — SSE event log per case
//   ./b5-outputs/results.md      — markdown summary with threshold pass/fail
//   ./b5-outputs/flags.md        — Pass-1 detector flags with context for manual review

const fs = require('fs');
const path = require('path');

const BASE_URL = process.argv[2] || process.env.B5_BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, 'b5-outputs');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ============================================
// PROFILES (from existing test bank)
// ============================================

const PROFILES = {
  MAT3_TECH_NO_ACCESS: {
    coding_level: 'expert',
    professional_background: 'Senior ML engineer at consumer tech company; 8 years production ML systems; no healthcare domain experience',
    education: 'BS Computer Science, MS Machine Learning',
    industry_experience: 'Consumer tech; recommendation systems; LLM applications',
    runway_months: 12,
    team_size: 1,
  },
  INTERMEDIATE_GENERIC: {
    coding_level: 'intermediate',
    professional_background: 'Product manager; 5 years at B2B SaaS company; some technical projects',
    education: 'BS Business; bootcamp coding certificate',
    industry_experience: 'B2B SaaS; product analytics; customer-facing roles',
    runway_months: 9,
    team_size: 1,
  },
};

// ============================================
// CASE BANK — 18 unique cases per locked design
// ============================================

const CASES = [
  // === T1 — MO sparse discipline (5 cases) ===
  // Sub-20-word sparse inputs across high-domain-convention categories.
  // Verify MO doesn't fabricate pricing/payment-model/willingness-to-pay claims.
  {
    id: 'SP-PETS',
    group: 'T1',
    purpose: 'MO sparse discipline — pets domain (low-trust, light pricing convention)',
    idea: 'an ai app for pets',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_level: 'LOW',
      mo_inferred_pricing_count: 0,
    },
  },
  {
    id: 'SP-DENTAL',
    group: 'T1',
    purpose: 'MO sparse discipline — dental (strong pricing convention temptation)',
    idea: 'tool for dentists to save time',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_level: 'LOW',
      mo_inferred_pricing_count: 0,
    },
  },
  {
    id: 'SP-HEALTHCARE',
    group: 'T1',
    purpose: 'MO sparse discipline — healthcare (strong domain-conventions temptation)',
    idea: 'ai for healthcare workers',
    profile: PROFILES.MAT3_TECH_NO_ACCESS,
    expected: {
      evidence_strength_level: 'LOW',
      mo_inferred_pricing_count: 0,
    },
  },
  {
    id: 'SP-LEGAL',
    group: 'T1',
    purpose: 'MO sparse discipline — legal (strong "firms pay for software" temptation)',
    idea: 'legaltech automation for lawyers',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_level: 'LOW',
      mo_inferred_pricing_count: 0,
    },
  },
  {
    id: 'SP-FINANCE',
    group: 'T1',
    purpose: 'MO sparse discipline — finance (strong "banks have budgets" temptation)',
    idea: 'fintech ai for banks',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_level: 'LOW',
      mo_inferred_pricing_count: 0,
    },
  },

  // === T2 — MD1-class contradictory dumps (4 cases) ===
  // 100-200 word inputs with conflicting scope. Trigger 2 should fire LOW.
  {
    id: 'MD1',
    group: 'T2',
    purpose: 'MD1 audit case — 150-word messy founder dump with contradictory scope',
    idea: 'I have been thinking about building something in the healthcare space because I see so many problems. Maybe a tool for clinicians to manage patient follow-ups, or it could be a patient-facing app that helps with medication adherence — actually maybe both? I think there is a real market here because everyone I have talked to says they would use it. Could potentially target small clinics first, but the real opportunity is enterprise hospital systems. The pricing model could be SaaS subscription per provider, or maybe per-patient billing, we could figure that out later. The AI component would help with predictions or recommendations or maybe automated outreach. I just know there is something here and I want to build it before someone else does.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_level: 'LOW',
    },
  },
  {
    id: 'MD-CONFLICT',
    group: 'T2',
    purpose: 'Target user shift mid-description: SMB to enterprise to consumer',
    idea: 'I want to build an AI scheduling assistant. Initially I was thinking small business owners — like restaurants and barbershops — but actually the real opportunity is probably enterprise companies that need to coordinate hundreds of employees across teams. Or maybe consumers who struggle to manage their personal calendars and family schedules. The product would use AI to learn preferences and automate booking. Different segments have very different needs but I think the same core engine could serve all of them.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_level: 'LOW',
    },
  },
  {
    id: 'MD-MULTI',
    group: 'T2',
    purpose: '"Does A and also B and also C" without coherent connection',
    idea: 'A platform that helps freelancers find clients, also tracks their time and expenses, and also generates contracts and invoices, and also has a community feature for networking, and also offers tax preparation, and also includes a learning marketplace for skill development. The AI would personalize recommendations across all these features. Target users would be self-employed professionals across all industries.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_level: 'LOW',
    },
  },
  {
    id: 'MD-USER-SHIFT',
    group: 'T2',
    purpose: 'Core mechanism described inconsistently across same paragraph',
    idea: 'A learning tool that uses AI tutors to help students study. The AI generates practice problems from textbook content. Actually it works more like a flashcard system where users upload their notes and we extract key concepts. Or it might be better as a video-based platform where AI summarizes lectures. The point is using AI to make studying more efficient. Target market is college students initially, then expand to professional certifications. Pricing would be freemium with paid tiers.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_level: 'LOW',
    },
  },

  // === T3 — Bare-narrative dumps (3 cases) ===
  // 20+ words, motivated, but no product/workflow/core feature named. Trigger 3 should fire.
  {
    id: 'BN1',
    group: 'T3',
    purpose: 'Doctor backstory + AI motivation, no product spec',
    idea: 'I have been a doctor for fifteen years and I have watched patient outcomes get worse over time despite all the technology we now have available. I think AI could help fix some of this if applied correctly. I want to build something using AI that helps make a real difference for patients and clinicians.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_level: 'LOW',
    },
  },
  {
    id: 'BN2',
    group: 'T3',
    purpose: 'Small business motivation, no product spec',
    idea: 'Small business owners are struggling with so many things at once and I think AI could really help them. There are a lot of pain points in running a small business and most existing tools are not designed for them specifically. I want to use AI to help small businesses operate more efficiently and grow.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_level: 'LOW',
    },
  },
  {
    id: 'BN3',
    group: 'T3',
    purpose: 'Industry observation, no product spec',
    idea: 'The construction industry has been slow to adopt new technology and there are huge inefficiencies everywhere. Margins are thin, projects run over budget, communication is broken. AI is finally getting good enough that it could really transform how the industry operates. I want to build something in this space.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_level: 'LOW',
    },
  },

  // === T4 — Negative control (4 cases) ===
  // Well-specified or problem-first-but-evaluable. Triggers should NOT fire.
  {
    id: 'NC1',
    group: 'T4',
    purpose: 'Well-specified product (Customs validator from V4S20 test suite)',
    idea: 'A document validation tool for international shipments. Importers and freight forwarders upload commercial invoices, packing lists, and certificates of origin; the tool checks for compliance issues against destination-country customs requirements before shipment, flagging missing fields, classification errors, and HTS code mismatches. Target users are mid-size importers handling 50-500 shipments per month who currently rely on manual review by customs brokers.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_not: 'LOW',
    },
  },
  {
    id: 'NC2',
    group: 'T4',
    purpose: 'Well-specified developer tool (Database migration)',
    idea: 'A database migration tool that automates schema changes across PostgreSQL and MySQL. It analyzes existing schemas, generates migration scripts with rollback paths, runs them in staged environments with automatic verification, and provides a CLI plus web dashboard for tracking migration history. Target users are backend developers and DBAs at SaaS companies with 10-100 engineers who currently write migration scripts by hand.',
    profile: PROFILES.MAT3_TECH_NO_ACCESS,
    expected: {
      evidence_strength_not: 'LOW',
    },
  },
  {
    id: 'NC3',
    group: 'T4',
    purpose: 'Well-specified vertical SaaS (Construction change-order analyzer)',
    idea: 'A change-order analysis tool for general contractors on commercial construction projects. It ingests RFIs, change-order requests, and project schedules; identifies cost and schedule impacts; flags double-charges and scope creep across subcontractors; and produces a defensible change-order report with supporting documentation links. Target users are project managers at GCs handling $5M-$50M projects who currently track change orders in spreadsheets.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_not: 'LOW',
    },
  },
  {
    id: 'NC4',
    group: 'T4',
    purpose: 'BOUNDARY CASE — problem-first but evaluable (ChatGPT pressure-test). MUST NOT trigger LOW.',
    idea: 'Independent gym owners manage member follow-ups, cancellations, and renewal reminders manually across WhatsApp and spreadsheets. I want to help them organize this better and prevent churn.',
    profile: PROFILES.INTERMEDIATE_GENERIC,
    expected: {
      evidence_strength_not: 'LOW',
    },
  },
];

// === T7 — Variance reruns (3 cases × 3 reruns = 9 runs) ===
const VARIANCE_CASES = [
  { sourceId: 'MD1', reruns: 3 },          // MD1-class — confirm trigger 2 fires consistently
  { sourceId: 'BN1', reruns: 3 },          // Bare-narrative — confirm trigger 3 fires consistently
  { sourceId: 'NC4', reruns: 3 },          // Boundary case — confirm trigger 3 does NOT fire
];

// === T8 — Free parity (2 cases) ===
const FREE_PARITY_CASES = [
  { sourceId: 'SP-DENTAL', purpose: 'Free pipeline LOW trigger + no MO inferred-pricing on sparse' },
  { sourceId: 'NC4', purpose: 'Free pipeline does NOT over-fire LOW on problem-first input (boundary parity)' },
];

// ============================================
// DETECTORS — regex flags surfaced for manual review
// ============================================

const DETECTORS = {
  // T1 — MO sparse discipline. Inferred-pricing claims that should not appear under sparse input.
  // Pattern matches "{practices|hospitals|firms|companies|clinics} {already pay for|pay for} {software|...}"
  // OR "have IT/software budgets", "afford to spend", "willing to pay" — all WITHOUT competitor citation.
  // MANUAL REVIEW REQUIRED: regex catches the form, human confirms it's used as MO support (not as gap-naming).
  MO_INFERRED_PRICING: /(?:practices|hospitals|firms|companies|businesses|clinics|banks|lawyers|dentists)\s+(?:already\s+)?pay(?:s)?\s+for\s+(?:software|tools|technology|services|subscriptions)|have\s+(?:IT|software|technology)\s+budgets|afford\s+to\s+spend|willing\s+to\s+pay|will(?:ing)?(?:ness)?\s+to\s+pay/i,

  // Anchor predicates from Narrative Contract V2 §3.9 — LOW reasons.
  LOW_REASON_MARKERS: /input is too vague|too thin|no specific (?:workflows?|features?|buyer|product|target user)|specification gap|contradictory scope|undefined core (?:mechanism|feature)|did not specify|does not (?:identify|specify|name)|user (?:did not|has not) (?:specify|describe|name)|lacks specification|no concrete product/i,

  // Anchor predicates from Narrative Contract V2 §3.9 — MEDIUM specific-gap markers.
  // Includes the `is\s+unknown` pattern B4 verification surfaced as missing from B4's runner.
  SPECIFIC_GAP_MARKERS: /is under-evidenced|is unclear|is ambiguous|is unproven|is unknown|lacks (?!specification)|missing|no signal of|no data on|uncertainty around|not yet (?:validated|proven|measured|quantified|established)|has not been (?:demonstrated|proven|validated)/i,

  // Forbidden generic-hedging on MEDIUM reasons (Option Z violations) — B4 regression check.
  GENERIC_HEDGING_MARKERS: /with some uncertainty|reasonably (?:established|clear|well-understood)|some aspects could|generally well-understood but not|broadly understood/i,

  // B4 contract: forbidden idea-confidence patterns — never appears anywhere.
  IDEA_CONFIDENCE_PATTERNS: /this idea will likely (?:succeed|fail)|the evaluation is reliable|confident in (?:this idea|the score|the evaluation)|the score is (?:reliable|trustworthy|accurate)/i,
};

// Stage 3 sparse-cascade markers (T5 cross-stage propagation check).
const SPEC_BOTTLENECK_VALUE = 'Specification';
const SPEC_DURATION_PATTERN = /Cannot estimate until specific workflow is defined/i;
const SPEC_DIFFICULTY_VALUE = 'N/A';

// ============================================
// API CALLER — POSTs idea + profile to Pro/Free pipeline, parses SSE response
// ============================================

// NOTE on API contract assumptions:
//   - POST /api/analyze-pro and POST /api/analyze accept { idea, profile } in JSON body.
//   - Response is SSE stream; final event contains the full evaluation JSON.
//   - This runner buffers all events and extracts the one containing the evaluation
//     (looks for evidence_strength + estimates + failure_risks shape).
//   - If your routes use a different event name or shape, adjust extractEvaluation().

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
  let evaluation = null;

  if (contentType.includes('text/event-stream')) {
    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Split on double-newline (SSE event separator)
      const parts = buffer.split('\n\n');
      buffer = parts.pop(); // last (possibly incomplete) event stays in buffer

      for (const rawEvent of parts) {
        if (!rawEvent.trim()) continue;
        const event = parseSseEvent(rawEvent);
        if (event) {
          events.push(event);
          const ev = extractEvaluation(event);
          if (ev) evaluation = ev;
        }
      }
    }
    // Flush remaining buffer
    if (buffer.trim()) {
      const event = parseSseEvent(buffer);
      if (event) {
        events.push(event);
        const ev = extractEvaluation(event);
        if (ev) evaluation = ev;
      }
    }
  } else {
    // JSON response (fallback for non-SSE endpoints)
    const json = await response.json();
    events.push({ event: 'json_response', data: json });
    evaluation = extractEvaluation({ event: 'json_response', data: json });
  }

  const elapsedMs = Date.now() - startTime;
  return { evaluation, events, elapsedMs };
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

// Find the SSE event containing the full evaluation payload.
// Looks for evidence_strength + estimates + failure_risks shape.
function extractEvaluation(event) {
  const d = event.data;
  if (!d || typeof d !== 'object') return null;

  // Direct evaluation shape
  if (d.evidence_strength && d.estimates && d.failure_risks) return d;

  // Wrapped in evaluation/result/payload field
  for (const key of ['evaluation', 'result', 'payload', 'data', 'analysis']) {
    const inner = d[key];
    if (inner && typeof inner === 'object' && inner.evidence_strength && inner.estimates) return inner;
  }
  return null;
}

// ============================================
// PASS-1 DETECTORS — apply regexes, return candidate flags with context
// ============================================

function detectFlags(caseDef, evaluation) {
  if (!evaluation) {
    return [{ kind: 'NO_EVALUATION', detail: 'API returned no evaluation payload', evaluation: null }];
  }

  const flags = [];
  const es = evaluation.evidence_strength || {};
  const level = es.level || null;
  const reason = es.reason || '';

  // T1 — MO sparse discipline (only on T1 cases)
  if (caseDef.group === 'T1') {
    const moPacket = (evaluation.evidence_packets && evaluation.evidence_packets.monetization) || null;
    if (moPacket) {
      const moTexts = [
        moPacket.strongest_positive || '',
        ...(moPacket.admissible_facts || []),
      ];
      for (const text of moTexts) {
        if (DETECTORS.MO_INFERRED_PRICING.test(text)) {
          flags.push({
            kind: 'MO_INFERRED_PRICING',
            detail: 'MO packet contains potential inferred-pricing pattern',
            text,
            requires_manual_review: true,
            note: 'Confirm whether this is fabricated MO support (hard fail) or gap-naming language (acceptable, e.g., "the input does not specify whether dentists would pay")',
          });
        }
      }
    } else {
      flags.push({
        kind: 'NO_MO_PACKET',
        detail: 'evidence_packets.monetization missing from evaluation payload',
        requires_manual_review: true,
      });
    }
  }

  // T2 / T3 — expected LOW
  if (caseDef.group === 'T2' || caseDef.group === 'T3') {
    if (level !== 'LOW') {
      flags.push({
        kind: 'EXPECTED_LOW_NOT_FIRED',
        detail: `${caseDef.group} case expected LOW, got ${level}`,
        evidence_strength: es,
        requires_manual_review: false,
      });
    } else {
      // LOW fired — confirm reason references input quality
      if (!DETECTORS.LOW_REASON_MARKERS.test(reason)) {
        flags.push({
          kind: 'LOW_REASON_MISSING_INPUT_QUALITY_MARKER',
          detail: 'LOW fired but reason does not reference input quality (specification gap, contradictory scope, etc.)',
          reason,
          requires_manual_review: true,
          note: 'B3 meta-lesson: detector enumeration may be incomplete. Confirm reason still names a sparse-input failure.',
        });
      }
    }
  }

  // T4 — expected NOT LOW (negative control + NC4 boundary case)
  if (caseDef.group === 'T4') {
    if (level === 'LOW') {
      flags.push({
        kind: 'EXPECTED_NOT_LOW_FIRED_LOW',
        detail: `T4 negative control fired LOW (false positive — trigger over-firing on well-specified or problem-first input)`,
        evidence_strength: es,
        requires_manual_review: false,
      });
    }
  }

  // T6 — Option Z MEDIUM compliance (B4 regression check) — applies to ALL cases
  if (level === 'MEDIUM') {
    const hasGap = DETECTORS.SPECIFIC_GAP_MARKERS.test(reason);
    const hasHedge = DETECTORS.GENERIC_HEDGING_MARKERS.test(reason);
    if (hasHedge) {
      flags.push({
        kind: 'GENERIC_HEDGING_ON_MEDIUM',
        detail: 'MEDIUM reason contains forbidden generic-hedging pattern (Option Z violation)',
        reason,
        requires_manual_review: true,
        note: 'B4 lock: MEDIUM must identify specific concrete gap, not generic uncertainty',
      });
    }
    if (!hasGap && !hasHedge) {
      flags.push({
        kind: 'MEDIUM_REASON_NO_GAP_MARKER',
        detail: 'MEDIUM reason missing specific-gap marker (could be detector under-enumeration or model violation)',
        reason,
        requires_manual_review: true,
        note: 'B3+B4 meta-lesson: when detector misses, FIRST check Narrative Contract §3.9 anchor predicates list before treating as model issue',
      });
    }
  }

  // Idea-confidence patterns forbidden anywhere (Narrative Contract matrix lock)
  for (const text of [reason, ...(evaluation.summary ? [evaluation.summary] : [])]) {
    if (DETECTORS.IDEA_CONFIDENCE_PATTERNS.test(text)) {
      flags.push({
        kind: 'IDEA_CONFIDENCE_PATTERN',
        detail: 'Idea-outcome confidence pattern detected (forbidden by Narrative Contract V2)',
        text,
        requires_manual_review: true,
      });
    }
  }

  // T5 — Cross-stage propagation check (when LOW fires, sparse cascade must hold)
  if (level === 'LOW') {
    const est = evaluation.estimates || {};
    const cascadeOk =
      est.main_bottleneck === SPEC_BOTTLENECK_VALUE &&
      SPEC_DURATION_PATTERN.test(est.duration || '') &&
      est.difficulty === SPEC_DIFFICULTY_VALUE;
    if (!cascadeOk) {
      flags.push({
        kind: 'CROSS_STAGE_CASCADE_BROKEN',
        detail: 'LOW fired but Stage 3 sparse cascade did not propagate',
        observed: {
          main_bottleneck: est.main_bottleneck,
          duration: est.duration,
          difficulty: est.difficulty,
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

  return flags;
}

// ============================================
// RUNNER
// ============================================

async function runCase(caseDef, endpoint = '/api/analyze-pro', label = null) {
  const tag = label || caseDef.id;
  process.stdout.write(`[${tag}] running... `);
  try {
    const { evaluation, events, elapsedMs } = await callPipeline(endpoint, caseDef.idea, caseDef.profile);
    const flags = detectFlags(caseDef, evaluation);
    const status = flags.some(f => !f.requires_manual_review) ? 'FAIL' :
                   flags.length > 0 ? 'FLAG' : 'OK';
    process.stdout.write(`${status} (${(elapsedMs / 1000).toFixed(1)}s, ${flags.length} flags)\n`);
    return { caseDef, evaluation, events, elapsedMs, flags, status, label: tag };
  } catch (err) {
    process.stdout.write(`ERROR: ${err.message}\n`);
    return { caseDef, evaluation: null, events: [], elapsedMs: 0, flags: [{ kind: 'API_ERROR', detail: err.message }], status: 'ERROR', label: tag };
  }
}

async function main() {
  console.log(`[B5] V4S28 Bundle B5 verification runner`);
  console.log(`[B5] base_url: ${BASE_URL}`);
  console.log(`[B5] output: ${OUTPUT_DIR}`);
  console.log('');

  const results = [];

  // ------------------------------
  // Pass A — main case bank (Pro pipeline)
  // ------------------------------
  console.log('=== Pass A — main case bank (Pro pipeline) ===');
  for (const c of CASES) {
    const r = await runCase(c, '/api/analyze-pro');
    results.push(r);
  }

  // ------------------------------
  // Pass B — variance reruns (T7)
  // ------------------------------
  console.log('\n=== Pass B — variance reruns (T7, 3 cases × 3 reruns) ===');
  const varianceResults = {};
  for (const v of VARIANCE_CASES) {
    const sourceCase = CASES.find(c => c.id === v.sourceId);
    if (!sourceCase) {
      console.log(`  WARN: variance source ${v.sourceId} not found in case bank`);
      continue;
    }
    varianceResults[v.sourceId] = [];
    for (let i = 1; i <= v.reruns; i++) {
      const r = await runCase(sourceCase, '/api/analyze-pro', `${v.sourceId}-r${i}`);
      varianceResults[v.sourceId].push(r);
      results.push(r);
    }
  }

  // ------------------------------
  // Pass C — Free parity (T8)
  // ------------------------------
  console.log('\n=== Pass C — Free pipeline parity (T8) ===');
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
  // Threshold scoring
  // ------------------------------
  console.log('\n=== Threshold scoring ===');
  const thresholds = scoreThresholds(results, varianceResults, freeResults);
  for (const t of thresholds) {
    console.log(`  ${t.name}: ${t.passed ? 'PASS' : 'FAIL'} — ${t.detail}`);
  }
  const allPassed = thresholds.every(t => t.passed);
  console.log(`\n[B5] Overall: ${allPassed ? 'PASS' : 'FAIL (review required)'}`);

  // ------------------------------
  // Persist outputs
  // ------------------------------
  fs.writeFileSync(path.join(OUTPUT_DIR, 'raw.json'),
    JSON.stringify(results.map(r => ({
      label: r.label,
      caseId: r.caseDef.id,
      group: r.caseDef.group,
      idea: r.caseDef.idea,
      evaluation: r.evaluation,
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
  fs.writeFileSync(path.join(OUTPUT_DIR, 'results.md'), generateResultsMarkdown(results, thresholds, varianceResults, freeResults));

  console.log(`\n[B5] outputs written to ${OUTPUT_DIR}/`);
}

// ============================================
// THRESHOLD SCORING
// ============================================

function scoreThresholds(results, varianceResults, freeResults) {
  const out = [];

  // T1 — MO sparse discipline: zero confirmed MO_INFERRED_PRICING violations on T1 cases
  // Note: Pass 1 only; Pass 2 manual review may downgrade some flags to detector false positives.
  const t1Cases = results.filter(r => r.caseDef.group === 'T1' && !r.label.startsWith('FREE-'));
  const t1Flags = t1Cases.flatMap(r => r.flags.filter(f => f.kind === 'MO_INFERRED_PRICING'));
  out.push({
    name: 'T1 — MO sparse discipline',
    passed: t1Flags.length === 0,
    detail: t1Flags.length === 0
      ? `${t1Cases.length}/${t1Cases.length} sparse cases clean (no MO_INFERRED_PRICING flags)`
      : `${t1Flags.length} candidate violations across ${t1Cases.length} cases — REQUIRES MANUAL REVIEW (see flags.md). Confirmed-violation count is the threshold; regex flags include false positives.`,
    flags: t1Flags,
  });

  // T2 — MD1-class contradictory: 4/4 LOW
  const t2Cases = results.filter(r => r.caseDef.group === 'T2' && !r.label.includes('-r'));
  const t2Low = t2Cases.filter(r => r.evaluation?.evidence_strength?.level === 'LOW').length;
  out.push({
    name: 'T2 — MD1-class contradictory',
    passed: t2Low === t2Cases.length,
    detail: `${t2Low}/${t2Cases.length} LOW (target: ${t2Cases.length}/${t2Cases.length})`,
  });

  // T3 — Bare-narrative: 3/3 LOW
  const t3Cases = results.filter(r => r.caseDef.group === 'T3' && !r.label.includes('-r'));
  const t3Low = t3Cases.filter(r => r.evaluation?.evidence_strength?.level === 'LOW').length;
  out.push({
    name: 'T3 — Bare-narrative',
    passed: t3Low === t3Cases.length,
    detail: `${t3Low}/${t3Cases.length} LOW (target: ${t3Cases.length}/${t3Cases.length})`,
  });

  // T4 — Negative control: 0/4 LOW (no false positives)
  const t4Cases = results.filter(r => r.caseDef.group === 'T4' && !r.label.includes('-r'));
  const t4Low = t4Cases.filter(r => r.evaluation?.evidence_strength?.level === 'LOW').length;
  out.push({
    name: 'T4 — Negative control (incl. NC4 boundary)',
    passed: t4Low === 0,
    detail: t4Low === 0
      ? `0/${t4Cases.length} false-positive LOW`
      : `${t4Low}/${t4Cases.length} false-positive LOW — TRIGGER OVER-FIRING`,
  });

  // T5 — Cross-stage propagation: cascade holds on LOW cases
  const lowCases = results.filter(r => r.evaluation?.evidence_strength?.level === 'LOW' && !r.label.includes('-r') && !r.label.startsWith('FREE-'));
  const cascadeBroken = lowCases.flatMap(r => r.flags.filter(f => f.kind === 'CROSS_STAGE_CASCADE_BROKEN'));
  out.push({
    name: 'T5 — Cross-stage propagation',
    passed: cascadeBroken.length === 0,
    detail: cascadeBroken.length === 0
      ? `${lowCases.length}/${lowCases.length} LOW cases produced clean Stage 3 sparse cascade`
      : `${cascadeBroken.length} broken cascades across ${lowCases.length} LOW cases — B4 regression`,
  });

  // T6 — Option Z MEDIUM compliance (B4 regression): zero confirmed generic-hedging on MEDIUM
  const allMediumFlags = results.flatMap(r => r.flags.filter(f => f.kind === 'GENERIC_HEDGING_ON_MEDIUM'));
  out.push({
    name: 'T6 — Option Z MEDIUM compliance (B4 regression)',
    passed: allMediumFlags.length === 0,
    detail: allMediumFlags.length === 0
      ? 'Zero generic-hedging flags on MEDIUM reasons across full suite'
      : `${allMediumFlags.length} candidate generic-hedging violations — REQUIRES MANUAL REVIEW (see flags.md)`,
    flags: allMediumFlags,
  });

  // T7 — Variance stability: same input → same evidence_strength.level across reruns
  const variancePass = [];
  const varianceFail = [];
  for (const [sourceId, runs] of Object.entries(varianceResults)) {
    const levels = runs.map(r => r.evaluation?.evidence_strength?.level).filter(Boolean);
    const uniqueLevels = [...new Set(levels)];
    if (uniqueLevels.length === 1 && levels.length === runs.length) {
      variancePass.push({ sourceId, level: uniqueLevels[0], runs: runs.length });
    } else {
      varianceFail.push({ sourceId, levels, runs: runs.length });
    }
  }
  const totalReruns = Object.values(varianceResults).reduce((sum, runs) => sum + runs.length, 0);
  const stableReruns = variancePass.reduce((sum, p) => sum + p.runs, 0);
  out.push({
    name: 'T7 — Variance stability',
    passed: varianceFail.length === 0,
    detail: varianceFail.length === 0
      ? `${stableReruns}/${totalReruns} reruns stable (no HIGH/MEDIUM/LOW flips)`
      : `BIMODALITY DETECTED: ${varianceFail.map(f => `${f.sourceId}=${f.levels.join('/')}`).join(', ')}`,
  });

  // T8 — Free parity
  const freeFlags = freeResults.flatMap(r => r.flags.filter(f => !f.requires_manual_review));
  const freeStructural = freeResults.every(r => {
    const expected = r.caseDef.expected;
    const level = r.evaluation?.evidence_strength?.level;
    if (expected.evidence_strength_level === 'LOW') return level === 'LOW';
    if (expected.evidence_strength_not === 'LOW') return level !== 'LOW';
    return true;
  });
  out.push({
    name: 'T8 — Free pipeline parity',
    passed: freeStructural && freeFlags.length === 0,
    detail: freeStructural && freeFlags.length === 0
      ? `${freeResults.length}/${freeResults.length} Free cases match Pro behavior`
      : `Free parity broken — see flags.md`,
  });

  return out;
}

// ============================================
// MARKDOWN OUTPUT
// ============================================

function generateFlagsMarkdown(results) {
  let md = `# B5 Pass-1 Detector Flags — Manual Review Required\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `Methodology (B1+B3+B4 lesson): regex detectors can produce false positives. Each flag below requires manual review.\n`;
  md += `For each flag, read the surrounding output and classify as **CONFIRMED VIOLATION** or **DETECTOR FALSE POSITIVE**.\n`;
  md += `Threshold scoring uses confirmed-violation counts, not raw flag counts.\n\n`;
  md += `When detectors miss patterns design-faithful behavior actually produces (B3 meta-lesson — runner enumeration is incomplete), update the regex sets in run-b5.js, NOT the prompt.\n\n`;
  md += `---\n\n`;

  for (const r of results) {
    if (r.flags.length === 0) continue;
    md += `## ${r.label} — ${r.caseDef.group} — ${r.status}\n`;
    md += `**Idea:** ${truncate(r.caseDef.idea, 200)}\n\n`;
    md += `**Purpose:** ${r.caseDef.purpose}\n\n`;
    if (r.evaluation) {
      const es = r.evaluation.evidence_strength || {};
      md += `**Evidence Strength:** ${es.level || '(missing)'}\n`;
      md += `**Reason:** ${es.reason || '(missing)'}\n\n`;
    }
    for (const f of r.flags) {
      md += `### ${f.kind}\n`;
      md += `- detail: ${f.detail}\n`;
      if (f.text) md += `- text: ${truncate(f.text, 300)}\n`;
      if (f.reason) md += `- reason: ${truncate(f.reason, 300)}\n`;
      if (f.observed) md += `- observed: \`${JSON.stringify(f.observed)}\`\n`;
      if (f.expected) md += `- expected: \`${JSON.stringify(f.expected)}\`\n`;
      if (f.note) md += `- note: ${f.note}\n`;
      md += `- requires_manual_review: ${f.requires_manual_review === true ? 'YES' : 'NO (structural fail)'}\n`;
      md += `- **review verdict:** _[ CONFIRMED / FALSE POSITIVE ]_\n\n`;
    }
    md += `---\n\n`;
  }
  return md;
}

function generateResultsMarkdown(results, thresholds, varianceResults, freeResults) {
  let md = `# B5 Verification Results\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;

  md += `## Summary\n\n`;
  md += `| Threshold | Result | Detail |\n`;
  md += `|---|---|---|\n`;
  for (const t of thresholds) {
    md += `| ${t.name} | ${t.passed ? '✅ PASS' : '❌ FAIL'} | ${t.detail} |\n`;
  }
  md += `\n`;

  const proCases = results.filter(r => !r.label.startsWith('FREE-') && !r.label.includes('-r'));
  const allPassed = thresholds.every(t => t.passed);
  md += `**Overall: ${allPassed ? '✅ PASS' : '❌ FAIL (review required)'}**\n\n`;
  md += `**Total runs:** ${results.length} (${proCases.length} unique cases + ${results.length - proCases.length - freeResults.length} variance reruns + ${freeResults.length} Free parity)\n\n`;
  md += `**Wall time:** ${(results.reduce((sum, r) => sum + r.elapsedMs, 0) / 60000).toFixed(1)} minutes\n\n`;

  md += `---\n\n`;
  md += `## Per-case results — Pass A (Pro pipeline)\n\n`;
  md += `| Case | Group | Status | Evidence Strength | Flags |\n`;
  md += `|---|---|---|---|---|\n`;
  for (const r of results) {
    if (r.label.startsWith('FREE-') || r.label.includes('-r')) continue;
    const es = r.evaluation?.evidence_strength?.level || '(none)';
    md += `| ${r.label} | ${r.caseDef.group} | ${r.status} | ${es} | ${r.flags.length} |\n`;
  }
  md += `\n`;

  md += `## Variance reruns — Pass B (T7)\n\n`;
  for (const [sourceId, runs] of Object.entries(varianceResults)) {
    const levels = runs.map(r => r.evaluation?.evidence_strength?.level || '(none)');
    const stable = [...new Set(levels)].length === 1;
    md += `- **${sourceId}** × ${runs.length}: ${levels.join(' / ')} → ${stable ? 'STABLE' : 'BIMODAL ⚠️'}\n`;
  }
  md += `\n`;

  md += `## Free parity — Pass C (T8)\n\n`;
  for (const r of freeResults) {
    const es = r.evaluation?.evidence_strength?.level || '(none)';
    md += `- **${r.label}**: ${es} — ${r.freePurpose}\n`;
  }
  md += `\n`;

  md += `---\n\n`;
  md += `## Next steps\n\n`;
  md += `1. Review **flags.md** — classify each Pass-1 flag as CONFIRMED VIOLATION or DETECTOR FALSE POSITIVE.\n`;
  md += `2. Re-score thresholds using confirmed-violation counts.\n`;
  md += `3. If T7 shows bimodality, expanded triggers may need per-case patching (Phase 0.5 lesson).\n`;
  md += `4. If T1/T6 has confirmed violations, proceed per two-strike rule: one prompt patch acceptable, second only on tight scope, third = escalate to architectural separation.\n`;
  md += `\n`;

  return md;
}

function truncate(s, n) {
  if (!s) return '';
  if (s.length <= n) return s;
  return s.slice(0, n) + '...';
}

// ============================================
// PRE-COMMIT GREP GATE (run manually before commit)
// ============================================
//
// Before single combined B5 commit, run these greps and confirm expectations:
//
//   grep -rn "FEWER THAN 20\|fewer than 20" src/
//     → expect 2 hits (prompt-stage2a.js TRIGGER 1, prompt.js TRIGGER 1)
//
//   grep -rn "SPARSE INPUT RULE" src/
//     → expect 2 hits (prompt-stage2a.js, prompt.js)
//
//   grep -rn "MO PACKET SPARSE-INPUT RULE" src/
//     → expect 1 hit (prompt-stage2a.js)
//
//   grep -rn "TRIGGER 2\|TRIGGER 3" src/
//     → expect 4 hits (2 in each file: TRIGGER 2 + TRIGGER 3 paragraphs)
//
//   grep -rn "Independent gym owners" src/
//     → expect 2 hits (counter-example anchor in both prompts)
//
// If hit counts differ, surface area was missed or duplicated. Audit before committing.
// ============================================

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

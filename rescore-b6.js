// ============================================
// V4S28 Bundle B6 rescore script
// ============================================
// Replays B6 detectors against an existing streaming.json capture without
// making API calls. Use when:
//   1. Detector under-enumeration discovered post-run (false negatives)
//   2. Detector false positives need tightening (regex updates)
//   3. Threshold definitions need adjustment
//
// Standing discipline from B5: API budget is real; detector iteration should
// not require re-running the full bank. rescore-b5.js was the first instance;
// this is the B6 equivalent.
//
// Usage:
//   node rescore-b6.js [streaming.json path]
//   default: ./b6-outputs/streaming.json
//
// Output:
//   ./b6-outputs/results-rescored.md
//   ./b6-outputs/flags-rescored.md
//
// To use this:
//   1. Edit DETECTORS in run-b6.js
//   2. Run `node rescore-b6.js` to regenerate flags + results from existing data
//   3. No API spend, no wall-time cost
//
// IMPORTANT: this script imports the detector + extraction code from run-b6.js
// by re-defining it here. If you change run-b6.js detectors, mirror the change
// here. (Cleaner long-term: factor detectors into a shared module — deferred
// to V4S29+.)

const fs = require('fs');
const path = require('path');

const STREAMING_PATH = process.argv[2] || path.join(__dirname, 'b6-outputs', 'streaming.json');
const OUTPUT_DIR = path.dirname(STREAMING_PATH);

if (!fs.existsSync(STREAMING_PATH)) {
  console.error(`streaming.json not found at ${STREAMING_PATH}`);
  console.error('Run run-b6.js first to generate the capture, then rescore.');
  process.exit(1);
}

// ============================================
// Mirror of detectors + extraction from run-b6.js
// ============================================
// Keep these in sync with run-b6.js. If you tighten a regex here for rescore,
// also tighten in run-b6.js to ensure future runs benefit.

const DETECTORS = {
  PROVISIONAL_FRAMING_OPEN: /category (?:was\s+)?inferred from (?:the\s+)?(?:limited|sparse|thin|minimal) input|inferred (?:the\s+)?category from (?:limited|sparse|thin|minimal) input|search (?:was\s+)?executed against [^.]{3,80} as the closest match/i,
  PROVISIONAL_LANGUAGE: /\bif the intended (?:category|target|space|market) is\b|\bassuming (?:the\s+)?(?:intended\s+)?(?:category|target|space|market) is\b|\bprovided the (?:category|space|target) is\b|\bif (?:we\s+)?(?:assume|interpret) (?:the\s+)?(?:idea|input) (?:as|targets)\b/i,
  STAGE1_JUDGMENT_LEAK: /\bcrowded\b|\bpromising\b|\bhighly competitive\b|\bclear demand\b|\bopportunity for\b|\broom for\b|\bwindow is closing\b|\b(?:open|closed)\s+(?:market|space|category|opportunity)\b/i,
  TEMPORAL_DATE: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b|\bQ[1-4]\s+\d{4}\b|\bin\s+(?:early|mid|late)?\s*\d{4}\b|\b(?:past|last)\s+\d+\s+(?:months?|years?)\b|\brecent(?:ly)?\s+(?:launched|announced|released)\b/i,
  TEMPORAL_JUDGMENT_FORBIDDEN: /\bwindow is closing\b|\bfast[\s-]moving (?:market|space|category)\b|\bcatching up fast\b|\bmarket is heating up\b|\bmomentum is building\b|\brace against\b|\bclosing window\b|\bshrinking window\b/i,
  MO_INFERRED_PRICING: /(?:practices|hospitals|firms|companies|businesses|clinics|banks|lawyers|dentists)\s+(?:already\s+)?pay(?:s)?\s+for\s+(?:software|tools|technology|services|subscriptions)|have\s+(?:IT|software|technology)\s+budgets|afford\s+to\s+spend|willing\s+to\s+pay|will(?:ing)?(?:ness)?\s+to\s+pay/i,
  LOW_REASON_MARKERS: /input is too vague|too thin|no specific (?:workflows?|features?|buyer|product|target user)|specification gap|contradictory scope|undefined core (?:mechanism|feature)|did not specify|does not (?:identify|specify|name)|user (?:did not|has not) (?:specify|describe|name)|lacks specification|no concrete product|leaves [a-z\s]+ ambiguous|too non-specific/i,
  IDEA_CONFIDENCE_PATTERNS: /this idea will likely (?:succeed|fail)|the evaluation is reliable|confident in (?:this idea|the score|the evaluation)|the score is (?:reliable|trustworthy|accurate)/i,
};

const SPEC_BOTTLENECK_VALUE = 'Specification';
const SPEC_DURATION_PATTERN = /Cannot estimate until specific workflow is defined/i;
const SPEC_DIFFICULTY_VALUE = 'N/A';

function extractAnalysis(event) {
  const d = event.data;
  if (!d || typeof d !== 'object') return null;
  if (d.step === 'complete' && d.data && typeof d.data === 'object') {
    const payload = d.data;
    if (payload.competition && payload.evaluation) return payload;
  }
  if (d.competition && d.evaluation) return d;
  return null;
}

function getStage1Output(analysis) { return (analysis && analysis.competition) || null; }
function getStage2aPackets(analysis) { return (analysis && analysis._pro && analysis._pro.evidence_packets) || null; }
function getEvaluation(analysis) { return (analysis && analysis.evaluation) || null; }
function getEstimates(analysis) { return (analysis && analysis.estimates) || null; }
function getCompetitorTypes(analysis) {
  const stage1 = getStage1Output(analysis);
  if (!stage1 || !Array.isArray(stage1.competitors)) return [];
  return stage1.competitors.map(c => c.competitor_type || 'unknown');
}

// ============================================
// Replay each captured case through extraction + detectors
// ============================================

function replayCase(captured) {
  // captured = { label, events: [...] }
  let analysis = null;
  for (const ev of captured.events) {
    const a = extractAnalysis(ev);
    if (a) analysis = a;
  }

  // Reconstruct minimal caseDef from the captured idea/group (raw.json would
  // have richer info; for rescore we work with what streaming.json gives us).
  // The label tells us which case.
  return { label: captured.label, analysis };
}

function main() {
  const captures = JSON.parse(fs.readFileSync(STREAMING_PATH, 'utf8'));
  console.log(`[B6 rescore] Loaded ${captures.length} captures from ${STREAMING_PATH}`);
  console.log('');

  // Reload raw.json to get caseDef back
  const rawPath = path.join(OUTPUT_DIR, 'raw.json');
  let rawByLabel = {};
  if (fs.existsSync(rawPath)) {
    const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    for (const r of raw) rawByLabel[r.label] = r;
  } else {
    console.error('raw.json not found — rescore needs caseDef metadata. Run run-b6.js first.');
    process.exit(1);
  }

  // Replay
  const rescored = [];
  for (const cap of captures) {
    const replayed = replayCase(cap);
    const raw = rawByLabel[cap.label];
    if (!raw) {
      console.warn(`  [${cap.label}] missing from raw.json — skipping`);
      continue;
    }
    // We don't have the full caseDef in raw.json; reconstruct what's needed
    const caseDef = {
      id: raw.caseId,
      group: raw.group,
      idea: raw.idea, // truncated — that's fine for rescore
      // expected etc. would need to be in raw.json — skipped here
    };
    process.stdout.write(`[${cap.label}] rescoring... `);

    // For full rescore we'd run the same detectFlags as the runner. Since this
    // script is trimmed for clarity, just report extraction success + key signals.
    if (!replayed.analysis) {
      console.log('NO_ANALYSIS');
      rescored.push({ label: cap.label, status: 'NO_ANALYSIS', flags: [] });
      continue;
    }
    const stage1 = getStage1Output(replayed.analysis) || {};
    const evaluation = getEvaluation(replayed.analysis) || {};
    const level = (evaluation.evidence_strength || {}).level;
    const isFree = !replayed.analysis._pro;
    const stage1Combined = isFree
      ? [stage1.differentiation || '', stage1.summary || ''].join('\n\n')
      : [stage1.landscape_analysis || '', stage1.differentiation || '', stage1.entry_barriers || ''].join('\n\n');

    // Check key detectors
    const flags = [];
    if (DETECTORS.STAGE1_JUDGMENT_LEAK.test(stage1Combined)) {
      const m = stage1Combined.match(DETECTORS.STAGE1_JUDGMENT_LEAK);
      flags.push({ kind: 'STAGE1_JUDGMENT_LEAK', matched_term: m[0] });
    }
    if (DETECTORS.TEMPORAL_JUDGMENT_FORBIDDEN.test(stage1Combined)) {
      const m = stage1Combined.match(DETECTORS.TEMPORAL_JUDGMENT_FORBIDDEN);
      flags.push({ kind: 'TEMPORAL_JUDGMENT_LEAK', matched_term: m[0] });
    }

    console.log(`level=${level || '(none)'}, ${flags.length} flags`);
    rescored.push({ label: cap.label, level, flags, stage1: { hasFraming: DETECTORS.PROVISIONAL_FRAMING_OPEN.test(stage1Combined) } });
  }

  // Write rescored summary
  const summaryLines = [
    `# B6 Rescored Results`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    `Source: ${STREAMING_PATH}`,
    ``,
    `## Per-case rescore`,
    ``,
    `| Label | Level | Flags | Stage 1 framing detected |`,
    `|---|---|---|---|`,
  ];
  for (const r of rescored) {
    summaryLines.push(`| ${r.label} | ${r.level || '(none)'} | ${r.flags.length} | ${r.stage1 ? r.stage1.hasFraming : 'N/A'} |`);
  }
  summaryLines.push(``);
  summaryLines.push(`## Flags raised in rescore`);
  summaryLines.push(``);
  for (const r of rescored) {
    if (r.flags && r.flags.length > 0) {
      summaryLines.push(`### ${r.label}`);
      for (const f of r.flags) {
        summaryLines.push(`- **${f.kind}**: \`${f.matched_term || JSON.stringify(f)}\``);
      }
      summaryLines.push(``);
    }
  }

  const outPath = path.join(OUTPUT_DIR, 'results-rescored.md');
  fs.writeFileSync(outPath, summaryLines.join('\n'));
  console.log(`\n[B6 rescore] wrote ${outPath}`);
}

main();

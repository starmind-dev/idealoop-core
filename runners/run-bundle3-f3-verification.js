// ============================================================================
// run-bundle3-f3-verification.js
// BUNDLE 3 / F3 — LOW-BAND SUMMARY OPENER VERIFICATION
// ============================================================================
//
// Runs the 10 canonical B10a F3 cases through the full Pro pipeline post
// Bundle 3 deployment. Captures Summary text + scores + evidence_strength
// for manual review. No automated PASS/FAIL gates — manual threshold per
// Bundle 3 ship discipline.
//
// Pattern follows run-bundle2-verification.js (per-bundle verification runners
// live in runners/, full pipeline against live /api/analyze-pro endpoint).
//
// Usage:
//   node runners/run-bundle3-f3-verification.js
//   node runners/run-bundle3-f3-verification.js --resume
//   node runners/run-bundle3-f3-verification.js --no-require-fixtures
//   node runners/run-bundle3-f3-verification.js --base-url https://...
//
// Outputs (in same dir as runner):
//   bundle3-f3-verification-checkpoint.json   — resume state (gitignored)
//   bundle3-f3-verification-results.json      — raw per-case data (gitignored)
//   bundle3-f3-verification-report.md         — manual-review report (commit)
//
// ============================================================================
//
// MANUAL REVIEW CRITERIA (locked before runner runs, per Methodology Principle 6):
//
// PRIMARY (the cure check):
//   - For each of the 8 originally-violating cases, post-fix first sentence
//     does NOT lead with founder-credibility cushioning ("Your X background...",
//     "Your N years of...", "As a [profile descriptor]...", "Given your...",
//     "Having worked in...", "You understand...") — see prompt-stage2c.js
//     HARD RULE block for full forbidden pattern list.
//   - For each of the 2 originally-compliant cases (AUDIT-M1, ARC-D2), post-fix
//     first sentence remains compliant (no regression introduced).
//
// SECONDARY (rule mechanics):
//   - First sentence names a concrete case anchor (specific noun phrase from
//     the case: competitor name, category dynamic, capability gap, etc.) —
//     not generic mood ("This idea faces challenges").
//   - For escape-hatch case AUDIT-MAT3-partial (OR=3.5 lowest, but MD=4.5
//     relationship-displacement is more decisive): opener may pivot to MD's
//     strongest_negative — verify the rule is binding to upstream evidence,
//     not mechanically picking the lowest metric.
//   - For founder-execution-binding case AUDIT-MAT1-beginner (high TC + beginner
//     coding profile): if founder-execution gap is the binding weakness,
//     sentence 1 names the structural problem (build timeline, foreclosed
//     window) — not the credential.
//
// TERTIARY (anti-template-migration):
//   - Across all 10 post-fix outputs, no two opening sentences share a 5-gram
//     (anti-template-migration check; protects against F3+F17 conflict where
//     HARD RULE produces a new template pattern).
//
// QUALITATIVE (full-summary feel):
//   - Read full Summary (not just first sentence) — does the verdict frame
//     LEAD, with evidence supporting? Or does the prose still cushion despite
//     compliant first sentence?
//
// NO AUTOMATED PASS/FAIL GATES — this verification is manual review only.
//
// ============================================================================
//
// PRE-VERIFICATION CHECKLIST (Methodology Principle 6 + Bundle 3.75 + #4):
//
// [ ] Dev server running with IDEALOOP_USE_FIXTURES=1
//     Verify on server side:  echo $IDEALOOP_USE_FIXTURES   →   "1"
//     Verify via runner:      auto-checks at preflight via /api/diag/fixture-mode
//
// [ ] Fixture freshness verified per Fixture Refresh Decision Tree
//     Refresh required when these change since fixtures were last written:
//       - prompt-stage1.js (Stage 1 competition-discovery prompt)
//       - route.js Stage 1 invocation or query-construction logic
//       - serper.js / github.js signatures or query encoding
//       - keywords.js (Specificity Gate / keyword extraction)
//       - competitors.js (query transformation)
//     Refresh procedure:  rm -rf runners/fixtures/data/*
//                         next run repopulates via cache-on-miss
//
// [ ] Pre-existing checkpoint cleared if re-running fresh
//     rm runners/bundle3-f3-verification-checkpoint.json   (or use --resume)
//
// INTERPRETATION RULES:
//   - Variance with fixture mode active     → engine-level signal (real)
//   - Variance without fixture mode active  → Layer E + engine indistinguishable
//                                             (rerun with fixture mode required)
//
// ============================================================================

const fs = require("fs");
const path = require("path");
const { ALL_CASES } = require("../cases.js");

// ============================================================================
// CONFIG
// ============================================================================

const args = process.argv.slice(2);
const BASE_URL = (() => {
  const idx = args.indexOf("--base-url");
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return process.env.IDEALOOP_BASE_URL || "http://localhost:3000";
})();
const RESUME = args.includes("--resume");
const NO_REQUIRE_FIXTURES = args.includes("--no-require-fixtures");
const REQUIRE_FIXTURES = !NO_REQUIRE_FIXTURES;
const OUTPUT_DIR = __dirname;
const CHECKPOINT_PATH = path.join(OUTPUT_DIR, "bundle3-f3-verification-checkpoint.json");
const FIXTURES_DIR = path.join(OUTPUT_DIR, "fixtures", "data");

// ============================================================================
// VERIFICATION CORPUS — the 10 canonical B10a F3 cases
// Pre-fix opening sentences captured from B10a clean run 1 (B10a-findings.md
// F3 entry table). 8 violations + 2 controls.
// ============================================================================

const F3_VERIFICATION_CASES = [
  {
    id: "AUDIT-M1",
    preFix: {
      overall: 4.7,
      opener: "Multiple active competitors like Habit Coach AI already offer personalized AI coaching with daily conversations and real habit data integration, directly overlapping your core value proposition.",
      diseaseFlag: false,
    },
    note: "CONTROL — already compliant pre-fix; verifying no regression",
  },
  {
    id: "AUDIT-A2",
    preFix: {
      overall: 4.3,
      opener: "Your home care agency background gives you direct insight into senior service needs and verification requirements, positioning you well to understand both the trust dynamics and operational challenges.",
      diseaseFlag: true,
    },
    note: "Canonical violation — credibility cushioning on B-marketplace; deepest band (4.3)",
  },
  {
    id: "AUDIT-R2",
    preFix: {
      overall: 4.9,
      opener: "Your 7 years of business development experience at a law firm gives you direct insight into the manual proposal workflow that currently dominates the market — firms using Word documents and email coordination with difficulty organizing past case examples.",
      diseaseFlag: true,
    },
    note: "Borderline violation — 4.9 just under threshold; tests boundary",
  },
  {
    id: "AUDIT-MAT1-beginner",
    preFix: {
      overall: 4.6,
      opener: "Your 6 years of paralegal experience gives you strong legal workflow understanding, but the document automation space is already well-served by established players.",
      diseaseFlag: true,
    },
    note: "FOUNDER-EXEC-BINDING — high TC (7.5) + beginner coding; if founder-execution gap is the binding weakness, sentence 1 should name structural problem (build timeline) per HARD RULE Example C",
  },
  {
    id: "AUDIT-MAT1-senior",
    preFix: {
      overall: 4.6,
      opener: "Your 5 years of LegalTech engineering experience, including document automation features, gives you the technical foundation to build this, but the legal document automation space is already well-served by established players.",
      diseaseFlag: true,
    },
    note: "Violation — same idea as MAT1-beginner but senior profile; opener should now lead with category consolidation, not foundation framing",
  },
  {
    id: "AUDIT-MAT3-partial",
    preFix: {
      overall: 4.7,
      opener: "Your hospital purchasing group consulting background positions you well to understand both the procurement workflows and buyer relationships this platform requires.",
      diseaseFlag: true,
    },
    note: "ESCAPE-HATCH — OR (3.5) is lowest but MD (4.5) relationship-displacement is more decisive; opener may pivot per HARD RULE Example B",
  },
  {
    id: "ARC-D2",
    preFix: {
      overall: 4.6,
      opener: "Aloan already operates an AI commercial loan underwriting platform specifically for community banks, directly overlapping your core value proposition and target market.",
      diseaseFlag: false,
    },
    note: "CONTROL — already compliant pre-fix; verifying no regression",
  },
  {
    id: "GATE-A1",
    preFix: {
      overall: 4.3,
      opener: "Your B2B SaaS product management experience provides the technical foundation for building multi-tenant restaurant software, but Toast already operates as a comprehensive restaurant management platform with the exact feature combination you're describing.",
      diseaseFlag: true,
    },
    note: "Violation — Gate case scoring deep (4.3); tests gate-passing case path",
  },
  {
    id: "GATE-D2",
    preFix: {
      overall: 4.6,
      opener: "Your healthcare administration background gives you insight into clinic workflows, but the appointment scheduling market is already well-served by established players like Cal.com (open-source with healthcare features), Anolla (AI-optimized scheduling), and Luma Health (patient engagement focus).",
      diseaseFlag: true,
    },
    note: "Violation — Gate case; saturated competitor landscape; opener should lead with consolidation",
  },
  {
    id: "DOGFOOD-IDEALOOP",
    preFix: {
      overall: 4.7,
      opener: "Your intermediate coding skills and advanced AI experience position you well to build this multi-stage evaluation pipeline, but the core challenge is that general-purpose LLMs can replicate most of IdeaLoop's value through structured prompting with low switching cost.",
      diseaseFlag: true,
    },
    note: "Violation — dogfood case (testing on IdeaLoop itself); LLM-substitution risk on OR; opener should lead with substitution dynamic",
  },
];

// ============================================================================
// SSE EVAL (pattern from run-b10a.js)
// ============================================================================

async function runEval(caseDef) {
  const caseFromBank = ALL_CASES.find((c) => c.id === caseDef.id);
  if (!caseFromBank) throw new Error(`Case ${caseDef.id} not in cases.js`);

  const ep = caseFromBank.pipeline === "FREE" ? "/api/analyze" : "/api/analyze-pro";
  const t0 = Date.now();

  const res = await fetch(BASE_URL + ep, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea: caseFromBank.idea, profile: caseFromBank.profile }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  let errMsg = null;
  let gateFired = false;

  const consumeLine = (line) => {
    if (!line.startsWith("data: ")) return;
    try {
      const d = JSON.parse(line.slice(6));
      if (d.step === "complete" && d.data) result = d.data;
      else if (d.step === "error") errMsg = d.message;
      if (d.specificity_insufficient === true || d.data?.specificity_insufficient === true) {
        gateFired = true;
      }
    } catch {
      /* skip malformed */
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) consumeLine(line);
  }
  if (buffer) consumeLine(buffer);

  if (errMsg) throw new Error(errMsg);
  if (!gateFired && !result) throw new Error("No result and no gate fire");

  return { result, gateFired, totalMs: Date.now() - t0 };
}

// ============================================================================
// FIRST-SENTENCE EXTRACTION
// ============================================================================

function extractFirstSentence(text) {
  if (!text) return "";
  // Split on first period/exclamation/question followed by space or end-of-string
  // Handles common edge cases: decimals (e.g., "3.5"), abbreviations are rare in
  // Summary openers but worth being defensive about.
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?]+[.!?](?=\s|$)/);
  if (match) return match[0].trim();
  // Fallback: first 200 chars if no sentence terminator
  return trimmed.substring(0, 200);
}

// ============================================================================
// CHECKPOINT
// ============================================================================

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return { runs: [], startedAt: new Date().toISOString() };
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8"));
  } catch (e) {
    console.error("⚠️  Checkpoint corrupt, starting fresh:", e.message);
    return { runs: [], startedAt: new Date().toISOString() };
  }
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

function isCompleted(cp, caseId) {
  return cp.runs.some((r) => r.caseId === caseId && r.status === "success");
}

// ============================================================================
// FIXTURE MODE PROBE (Bundle 3.75 + #4 protocol enforcement)
// ============================================================================

async function checkFixtureMode() {
  // Hit /api/diag/fixture-mode with retry — Next.js dev server may take
  // 2-5s to compile a route handler on first hit (cold start).
  // 3 attempts × 2s gap = up to 6s wait worst case.
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(BASE_URL + "/api/diag/fixture-mode");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { ok: true, enabled: data.enabled === true, timestamp: data.timestamp };
    } catch (e) {
      lastErr = e;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  return { ok: false, error: lastErr?.message || "unknown error" };
}

function countFixtures(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
}

// ============================================================================
// PRE-FLIGHT (Bundle 3.75 + #4: fixture mode only — no sanity case probe)
// ============================================================================

async function preflight() {
  console.log(`\n🔬  Fixture mode probe: ${BASE_URL}/api/diag/fixture-mode`);
  const fmCheck = await checkFixtureMode();
  if (!fmCheck.ok) {
    console.log(`   ⚠️  Fixture mode endpoint unreachable (${fmCheck.error})`);
    if (REQUIRE_FIXTURES) {
      console.error(`\n❌  Cannot verify fixture mode. Two possibilities:`);
      console.error(`    1. Endpoint missing — ensure src/app/api/diag/fixture-mode/route.js`);
      console.error(`       exists and dev server has been restarted to pick it up.`);
      console.error(`    2. Dev server unreachable at ${BASE_URL}.`);
      console.error(`\n    Override (NOT RECOMMENDED — Layer E noise will corrupt results):`);
      console.error(`        node runners/run-bundle3-f3-verification.js --no-require-fixtures`);
      return false;
    }
    console.log(`   ⏭️  Proceeding without fixture verification (--no-require-fixtures set)`);
    return true;
  }
  if (fmCheck.enabled) {
    console.log(`   ✅  Server in fixture mode (${countFixtures(FIXTURES_DIR)} fixtures present)`);
    return true;
  }
  if (REQUIRE_FIXTURES) {
    console.error(`\n❌  Server is NOT in fixture mode.`);
    console.error(`    The dev server is reachable but IDEALOOP_USE_FIXTURES is unset.`);
    console.error(`    Per Bundle 3.75 + post-Bundle-3.75 #4 protocol, verification`);
    console.error(`    must run against a fixture-mode server to avoid Layer E corruption.`);
    console.error(`\n    Fix: stop the dev server, restart with:`);
    console.error(`        IDEALOOP_USE_FIXTURES=1 npm run dev`);
    console.error(`\n    Override (NOT RECOMMENDED — Layer E noise will corrupt results):`);
    console.error(`        node runners/run-bundle3-f3-verification.js --no-require-fixtures`);
    return false;
  }
  console.log(`   ⚠️  Server NOT in fixture mode but --no-require-fixtures set; proceeding`);
  return true;
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function generateReport(results) {
  const lines = [];
  const r = (s) => lines.push(s);

  r("# Bundle 3 / F3 Verification Report");
  r("");
  r(`**Generated:** ${new Date().toISOString()}`);
  r(`**Cases run:** ${results.length}`);
  r(`**Errors:** ${results.filter((x) => x.status === "error").length}`);
  r(`**Endpoint:** ${BASE_URL}`);
  r("");

  r("## Methodology");
  r("");
  r("This report captures Summary text from 10 B10a low-band cases run through the full Pro pipeline post Bundle 3 deployment (HARD RULE — LOW-BAND OPENING SENTENCE in `prompt-stage2c.js`; `overall_score` passed to Stage 2c via `route.js`).");
  r("");
  r("The 10 cases are the canonical F3 disease corpus from B10a-findings.md F3 — 8 of which violated F3 (founder-credibility opener) in the original B10a clean run; 2 were already compliant (controls).");
  r("");
  r("**Verification approach:** manual threshold per Bundle 3 ship discipline. No automated PASS/FAIL gates; the report presents pre-fix vs post-fix first sentences side-by-side for human review against the criteria locked in the runner header.");
  r("");

  r("## Manual review checklist (locked before runner ran)");
  r("");
  r("**PRIMARY (the cure check):**");
  r("- [ ] All 8 originally-violating cases — post-fix sentence 1 does NOT lead with founder credibility");
  r("- [ ] AUDIT-M1 and ARC-D2 (controls) — post-fix sentence 1 remains compliant (no regression)");
  r("");
  r("**SECONDARY (rule mechanics):**");
  r("- [ ] All 10 post-fix sentence 1s name a concrete case anchor (not generic mood)");
  r("- [ ] AUDIT-MAT3-partial — escape hatch firing? (opener pivots from OR to a more decisive metric, e.g., MD's relationship-displacement)");
  r("- [ ] AUDIT-MAT1-beginner — if founder-execution gap is the binding weakness, sentence 1 names structural problem (build timeline) NOT the credential");
  r("");
  r("**TERTIARY (anti-template-migration):**");
  r("- [ ] No two post-fix sentence 1s share an opening 5-gram (eyeball check across the table below)");
  r("");
  r("**QUALITATIVE:**");
  r("- [ ] Read full Summary for each case — verdict frame leads, evidence supports, no cushioning despite compliant first sentence");
  r("");

  r("## Side-by-side comparison");
  r("");
  r("| Case | Pre-fix Overall | Post-fix Overall | Pre-fix violation? | Post-fix sentence 1 (first 120 chars) |");
  r("|---|---|---|---|---|");
  for (const x of results) {
    if (x.status !== "success") {
      r(`| ${x.id} | ${x.preFix.overall} | — | ${x.preFix.diseaseFlag ? "YES" : "no"} | ❌ ERROR |`);
      continue;
    }
    const opener = (x.postFix.firstSentence || "").substring(0, 120);
    const openerEsc = opener.replace(/\|/g, "\\|");
    r(`| ${x.id} | ${x.preFix.overall} | ${x.postFix.overall} | ${x.preFix.diseaseFlag ? "YES" : "no"} | ${openerEsc}${opener.length === 120 ? "…" : ""} |`);
  }
  r("");

  r("## Per-case detail");
  r("");

  for (const x of results) {
    r("---");
    r("");
    r(`### ${x.id}`);
    r("");
    r(`**Note:** ${x.note}`);
    r("");

    if (x.status === "error") {
      r(`**❌ ERROR:** ${x.errorMessage}`);
      r("");
      continue;
    }

    if (x.gateFired) {
      r("**🚪 GATED upstream** — Specificity Gate fired; no Summary produced. Not in F3 scope.");
      r("");
      continue;
    }

    r(`**Pre-fix (B10a clean run):** Overall ${x.preFix.overall} — ${x.preFix.diseaseFlag ? "**VIOLATION**" : "compliant"}`);
    r("");
    r("> " + x.preFix.opener);
    r("");

    r(`**Post-fix (Bundle 3):** Overall ${x.postFix.overall} · MD ${x.postFix.scores.md} / MO ${x.postFix.scores.mo} / OR ${x.postFix.scores.or} / TC ${x.postFix.scores.tc} · EvStr ${x.postFix.evStr || "—"}`);
    r("");
    r("**First sentence:**");
    r("");
    r("> " + (x.postFix.firstSentence || "*(empty)*"));
    r("");

    r("<details>");
    r("<summary>Full Summary (post-fix)</summary>");
    r("");
    r(x.postFix.fullSummary || "*(empty)*");
    r("");
    r("</details>");
    r("");
  }

  r("---");
  r("");
  r("## Cross-case observations (fill in during manual review)");
  r("");
  r("**Opening 5-gram overlap (anti-template-migration check):**");
  r("");
  r("- Manually scan the side-by-side table above. Note any two cases sharing first 5 words.");
  r("");
  r("**Honest-frame test (qualitative):**");
  r("");
  r("- Of the 8 originally-violating cases, how many post-fix Summaries feel honest (verdict leads, evidence supports) vs still cushioning despite first-sentence compliance?");
  r("");
  r("**Escape-hatch and exception correctness:**");
  r("");
  r("- AUDIT-MAT3-partial (escape hatch): does the opener pivot away from OR's negative to a more decisive metric? Or did it mechanically pick OR's strongest_negative?");
  r("- AUDIT-MAT1-beginner (founder-execution exception): is the founder-execution gap named structurally, or is it absent / cushioned?");
  r("");

  return lines.join("\n");
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("=".repeat(80));
  console.log("Bundle 3 / F3 Verification — 10 low-band cases");
  console.log("=".repeat(80));
  console.log(`Base URL:        ${BASE_URL}`);
  console.log(`Cases:           ${F3_VERIFICATION_CASES.length}`);
  console.log(`Mode:            ${RESUME ? "RESUME from checkpoint" : "FRESH run"}`);
  console.log(`Fixture mode:    ${REQUIRE_FIXTURES ? "REQUIRED (verified at preflight)" : "BYPASSED via --no-require-fixtures (Layer E noise risk)"}`);
  console.log(`Fixtures dir:    ${FIXTURES_DIR}`);
  console.log(`Fixtures count:  ${countFixtures(FIXTURES_DIR)}`);

  // Pre-flight: fixture mode probe (Bundle 3.75 + #4 protocol enforcement)
  const ok = await preflight();
  if (!ok) {
    console.error("\n❌  Pre-flight failed. Investigate before launching verification.");
    process.exit(1);
  }

  const cp = RESUME ? loadCheckpoint() : { runs: [], startedAt: new Date().toISOString() };
  if (!RESUME) saveCheckpoint(cp);

  const results = [];
  const t0 = Date.now();

  for (let i = 0; i < F3_VERIFICATION_CASES.length; i++) {
    const caseDef = F3_VERIFICATION_CASES[i];
    const label = `[${i + 1}/${F3_VERIFICATION_CASES.length}] ${caseDef.id}`;

    if (isCompleted(cp, caseDef.id)) {
      console.log(`${label} ⏭️  (completed in checkpoint)`);
      const cached = cp.runs.find((r) => r.caseId === caseDef.id && r.status === "success");
      results.push(cached);
      continue;
    }

    process.stdout.write(`${label} ... `);
    try {
      const tCase = Date.now();
      const { result, gateFired, totalMs } = await runEval(caseDef);
      const elapsed = (totalMs / 1000).toFixed(1);

      if (gateFired) {
        console.log(`🚪 GATED (${elapsed}s)`);
        const run = {
          caseId: caseDef.id,
          status: "success",
          gateFired: true,
          preFix: caseDef.preFix,
          note: caseDef.note,
          postFix: null,
          elapsedSec: elapsed,
          ts: new Date().toISOString(),
        };
        cp.runs.push(run);
        saveCheckpoint(cp);
        results.push(run);
        continue;
      }

      const ev = result?.evaluation || {};
      const summary = ev.summary || "";
      const firstSentence = extractFirstSentence(summary);

      const run = {
        caseId: caseDef.id,
        status: "success",
        gateFired: false,
        preFix: caseDef.preFix,
        note: caseDef.note,
        postFix: {
          overall: ev.overall_score,
          scores: {
            md: ev.market_demand?.score ?? null,
            mo: ev.monetization?.score ?? null,
            or: ev.originality?.score ?? null,
            tc: ev.technical_complexity?.score ?? null,
          },
          evStr: ev.evidence_strength?.level ?? null,
          firstSentence,
          fullSummary: summary,
        },
        elapsedSec: elapsed,
        ts: new Date().toISOString(),
      };

      cp.runs.push(run);
      saveCheckpoint(cp);
      results.push(run);

      const s = run.postFix.scores;
      console.log(`✅ ${elapsed}s — Overall ${run.postFix.overall} (MD ${s.md} / MO ${s.mo} / OR ${s.or}) · EvStr ${run.postFix.evStr || "—"}`);
    } catch (e) {
      console.log(`❌ FAIL — ${e.message}`);
      const run = {
        caseId: caseDef.id,
        status: "error",
        preFix: caseDef.preFix,
        note: caseDef.note,
        errorMessage: e.message,
        ts: new Date().toISOString(),
      };
      cp.runs.push(run);
      saveCheckpoint(cp);
      results.push(run);
    }
  }

  const totalMin = ((Date.now() - t0) / 60000).toFixed(1);
  console.log("");
  console.log(`⏱️  Total wall time: ${totalMin} minutes`);

  // Emit artifacts
  const reportPath = path.join(OUTPUT_DIR, "bundle3-f3-verification-report.md");
  const resultsPath = path.join(OUTPUT_DIR, "bundle3-f3-verification-results.json");

  fs.writeFileSync(reportPath, generateReport(results));
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

  console.log("");
  console.log("📝 Report:    " + reportPath);
  console.log("📊 Raw data:  " + resultsPath);
  console.log("");
  console.log("Next: open the report and walk the manual review checklist.");
}

main().catch((err) => {
  console.error("\n💥  FATAL:", err.message);
  console.error(err.stack);
  process.exit(1);
});
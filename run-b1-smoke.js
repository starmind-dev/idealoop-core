// ============================================
// IDEALOOP CORE — V4S28 BUNDLE B1 SMOKE TEST
// Spot-runs the 4 cases affected by the post-second-verification follow-up patch.
// ============================================
//
// Purpose: confirm the three follow-up fixes work without re-running the full
// 22-case verifier:
//   FIX A — Stage 2c max_tokens 2500 → 4096 (route.js)
//           Test: MAT3-insider-r1 (parse-failed last run, summary came back empty)
//   FIX B — slot-name forbid line in prompt-stage2c.js
//           Test: M1-r2 + MD1-r1 (both invented slot "monetization" last run)
//   FIX C — P1-S1 stem-match detector (run-b1.js)
//           Test: MAT3-tech-no-access-r1 (confirm no regression, no false positive)
//
// 4 runs total, ~5 minutes wall time.
//
// If all 4 pass cleanly → B1 closes, open S4.
// If any fail → diagnose before S4.
//
// Usage:
//   node run-b1-smoke.js
//   (server must be running at localhost:3000)
//
// ============================================

const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = __dirname;

// ============================================
// IDEA + PROFILE DEFINITIONS (subset — only 4 cases)
// ============================================

const MAT2_IDEA =
  "Concierge service that handles all insurance claim disputes for small businesses (under 50 employees). Success fee of 25% on recovered claims. Starting with denied health insurance claims for employee medical expenses. Done-with-you model: we handle paperwork, customer provides documents.";

const MAT3_IDEA =
  "Platform that helps rural hospitals (under 100 beds) negotiate better rates with medical device suppliers by aggregating purchasing data across member hospitals. Members pay $24,000/year. Value prop: average 12% reduction in device spend, which pays for membership 10x over. Requires buy-in from hospital CFOs and procurement directors.";

const M1_TEST = {
  idea: "habit tracker app with an AI that talks to you about your progress and helps you figure out why you fell off. gamified. freemium with $9/mo for the AI coach.",
  profile: { coding: "Intermediate", ai: "Regular AI user", education: "Solo indie hacker, no shipped products" },
};

const MD1_TEST = {
  idea: "ok so i've been thinking about this for a while. i'm a freelance ux designer and everyone i know has the same problem where you do work, the client loves it, then payment takes forever. i want to build something that fixes this but also maybe could be a full platform for freelancers to manage everything. like invoices, contracts, tracking hours, maybe client portals too. i'm not sure if i should focus on just the payment thing or build the whole platform. i know there are other freelancer tools out there but they all suck honestly or they're way too expensive for solo people. maybe pricing it at like $15/month? i could probably get some of my designer friends to try it. the AI angle could be that it automates the annoying parts like writing payment reminders and contracts. tbh i haven't fully figured out what the MVP should be, i just know the problem is real.",
  profile: { coding: "Intermediate", ai: "Some AI experience", education: "Freelance UX designer (4 years)" },
};

const TESTS = [
  {
    id: "MAT3-insider-r1",
    fixTest: "FIX A — parse fix (max_tokens bump)",
    expectPass: "summary non-empty, failure_risks length >= 2, founder_fit dropped (STEP 1 MATCH for hospital CFO)",
    pipeline: "PRO",
    idea: MAT3_IDEA,
    profile: { coding: "No coding experience", ai: "Some AI experience", education: "Former rural hospital CFO (15 years), 80+ exec relationships" },
  },
  {
    id: "M1-r2",
    fixTest: "FIX B — slot-name forbid (was 'monetization' last run)",
    expectPass: "all slots in {market_category, trust_adoption, founder_fit}",
    pipeline: "PRO",
    idea: M1_TEST.idea,
    profile: M1_TEST.profile,
  },
  {
    id: "MD1-r1",
    fixTest: "FIX B — slot-name forbid (was 'monetization' last run)",
    expectPass: "all slots in {market_category, trust_adoption, founder_fit}",
    pipeline: "PRO",
    idea: MD1_TEST.idea,
    profile: MD1_TEST.profile,
  },
  {
    id: "MAT3-tech-no-access-r1",
    fixTest: "FIX C — P1-S1 stem-match (regression check; was real-pass detector-flagged-false-positive last run)",
    expectPass: "summary opens with profile-faithful framing, no fabricated 'healthcare' or 'hospital procurement' background",
    pipeline: "PRO",
    idea: MAT3_IDEA,
    profile: { coding: "Advanced", ai: "Advanced AI user", education: "Staff engineer at healthtech startup (8 years), built procurement tools for enterprise" },
  },
];

// ============================================
// SSE RUNNER
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
// PER-CASE PASS/FAIL EVALUATION
// ============================================

const VALID_SLOTS = new Set(["market_category", "trust_adoption", "founder_fit"]);

function evaluate(test, result) {
  const ev = result.evaluation || {};
  const summary = ev.summary || "";
  const risks = ev.failure_risks || [];
  const verdicts = [];

  if (test.id === "MAT3-insider-r1") {
    // FIX A — summary non-empty, risks length >= 2, no founder_fit
    if (summary.trim().length === 0) verdicts.push({ label: "summary non-empty", pass: false, detail: "summary is empty (parse may have failed again)" });
    else verdicts.push({ label: "summary non-empty", pass: true });

    if (risks.length < 2) verdicts.push({ label: "failure_risks length >= 2", pass: false, detail: `got ${risks.length} risks` });
    else verdicts.push({ label: "failure_risks length >= 2", pass: true });

    const ffCount = risks.filter(r => r.slot === "founder_fit").length;
    if (ffCount > 0) verdicts.push({ label: "founder_fit dropped (STEP 1 MATCH)", pass: false, detail: `got ${ffCount} founder_fit risk(s)` });
    else verdicts.push({ label: "founder_fit dropped (STEP 1 MATCH)", pass: true });
  }

  if (test.id === "M1-r2" || test.id === "MD1-r1") {
    // FIX B — all slots valid
    const invalid = risks.filter(r => !VALID_SLOTS.has(r.slot));
    if (invalid.length > 0) {
      verdicts.push({ label: "all slots valid", pass: false, detail: `invalid slot(s): ${invalid.map(r => `"${r.slot}"`).join(", ")}` });
    } else {
      verdicts.push({ label: "all slots valid", pass: true });
    }
  }

  if (test.id === "MAT3-tech-no-access-r1") {
    // FIX C — summary should NOT contain hallucinated domain claims.
    // Check for the specific failure pattern from the FIRST B1 run (pre-patch):
    // "Your healthcare and procurement background..." — that exact phrasing or close variants.
    const summaryLower = summary.toLowerCase();
    const hallucinationPatterns = [
      /your\s+healthcare\s+(?:and\s+procurement\s+)?(?:background|expertise|experience)/i,
      /your\s+hospital\s+procurement\s+(?:background|expertise|experience|knowledge)/i,
      /your\s+procurement\s+(?:background|expertise|domain knowledge)/i,
      /your\s+healthcare\s+(?:domain\s+)?(?:expertise|knowledge|insight)/i,
    ];
    const matched = hallucinationPatterns.find(p => p.test(summary));
    if (matched) {
      verdicts.push({ label: "no hallucinated domain claim", pass: false, detail: `matched pattern: ${matched}` });
    } else {
      verdicts.push({ label: "no hallucinated domain claim", pass: true });
    }

    // Also confirm summary references the profile's actual content (engineer / 8 years / procurement tools / enterprise)
    const referencesProfile = /\b(engineer|engineering|8\s+years|procurement\s+tools?|enterprise)\b/i.test(summary);
    if (!referencesProfile) {
      verdicts.push({ label: "summary references profile content", pass: false, detail: "no engineer/8-year/procurement-tools reference found" });
    } else {
      verdicts.push({ label: "summary references profile content", pass: true });
    }
  }

  return verdicts;
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
    return false;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("=".repeat(80));
  console.log("V4S28 BUNDLE B1 — SMOKE TEST (post-follow-up-patch)");
  console.log(`${TESTS.length} runs spot-checking three fixes`);
  console.log("=".repeat(80) + "\n");

  if (!(await preflight())) process.exit(1);

  const startTime = Date.now();
  const allResults = [];

  for (let i = 0; i < TESTS.length; i++) {
    const test = TESTS[i];
    const t0 = Date.now();
    process.stdout.write(`[${i + 1}/${TESTS.length}] ${test.id.padEnd(28)} `);

    try {
      const { result } = await runEval(test);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const verdicts = evaluate(test, result);
      const allPass = verdicts.every(v => v.pass);
      console.log(`${elapsed}s  ${allPass ? "PASS" : "FAIL"}`);

      allResults.push({ test, result, verdicts, elapsed, allPass });
    } catch (e) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`ERROR (${elapsed}s) — ${e.message}`);
      allResults.push({ test, error: e.message, elapsed });
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 60000).toFixed(1);

  console.log("\n" + "=".repeat(80));
  console.log("DETAILED RESULTS");
  console.log("=".repeat(80));

  for (const r of allResults) {
    console.log(`\n[${r.test.id}] ${r.test.fixTest}`);
    console.log(`  Expected: ${r.test.expectPass}`);
    if (r.error) {
      console.log(`  Error: ${r.error}`);
      continue;
    }
    for (const v of r.verdicts) {
      console.log(`  ${v.pass ? "✓" : "✗"} ${v.label}${v.detail ? `  — ${v.detail}` : ""}`);
    }
    // For MAT3-tech-no-access, print the summary opening so user can eyeball
    if (r.test.id === "MAT3-tech-no-access-r1") {
      const summary = r.result?.evaluation?.summary || "";
      console.log(`\n  Summary[:300]:`);
      console.log(`  ${summary.substring(0, 300).replace(/\n/g, " ")}`);
    }
    // For slot-fix tests, print the slots that came back
    if (r.test.id === "M1-r2" || r.test.id === "MD1-r1") {
      const risks = r.result?.evaluation?.failure_risks || [];
      console.log(`  Slots returned: ${risks.map(x => x.slot).join(", ")}`);
    }
    // For parse-fix test, confirm summary length
    if (r.test.id === "MAT3-insider-r1") {
      const summary = r.result?.evaluation?.summary || "";
      const risks = r.result?.evaluation?.failure_risks || [];
      console.log(`  Summary length: ${summary.length} chars`);
      console.log(`  Risk count: ${risks.length}`);
    }
  }

  // Save full output for inspection if anything fails
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 16);
  const outPath = path.join(OUTPUT_DIR, `b1-smoke-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2));

  console.log("\n" + "=".repeat(80));
  const passCount = allResults.filter(r => r.allPass).length;
  const failCount = allResults.filter(r => r.error || !r.allPass).length;
  if (failCount === 0) {
    console.log(`SMOKE TEST PASSED — ${passCount}/${TESTS.length} clean. B1 closes.`);
  } else {
    console.log(`SMOKE TEST FAILED — ${passCount} passed, ${failCount} failed.`);
    console.log(`Full output: ${outPath}`);
  }
  console.log(`Total wall time: ${totalElapsed} minutes`);
  console.log("=".repeat(80));
}

main().catch(err => {
  console.error("\nFATAL:", err.message);
  console.error(err.stack);
  process.exit(1);
});

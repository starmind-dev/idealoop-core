// run-b7.js
// V4S28 B7 — Specificity gate test runner
// =========================================
//
// Tests the Haiku-layer specificity gate via SSE call to /api/analyze.
// Uses Free pipeline because the gate is a shared upstream module — gate
// decision is identical across Free and Pro. Free's halt point at gate
// fire is also the same as Pro's, so verifying once covers both routes.
//
// Optimization: aborts the SSE stream as soon as gate decision is known
// (on `keywords_done` event for PASS, or `complete` with specificity_insufficient
// for FAIL). PASS cases don't wait for the full Sonnet evaluation — we only
// care about the gate's classification, not pipeline output.
//
// Usage:
//   Terminal 1: npm run dev
//   Terminal 2: node run-b7.js
//
// Two thresholds (LOCKED before running per methodology principle 6):
//   T1 — False reject rate: 0% strict
//        Section 13 lock: "false rejects are user-facing harm"
//   T2 — False accept rate: <= 12.5%
//        Section 13 lock: default-to-PASS allows slack since defensive
//        layers downstream (Stage 1 + 2a + 2b + 2c + 3) catch borderline
//        cases that slip through the gate
//
// Observational logs (no pass/fail):
//   - missing_elements coarse-enum compliance per FAIL case
//   - per-case latency
//   - empty missing_elements check on FAIL cases
//
// What this runner does NOT test (intentional scope):
//   - Pipeline halt mechanics — verified manually post-deploy
//   - Downstream stage behavior — covered by B5/B6 + future B10a regression
//   - TC scoring / profile leakage — irrelevant to gate accuracy
//   - Free/Pro pipeline parity beyond gate — gate is shared module

import fs from "fs/promises";

const ENDPOINT = process.env.B7_ENDPOINT || "http://localhost:3000/api/analyze";
const PROFILE = { coding: "Intermediate", ai: "Some", education: "" };
// Gate is profile-blind — profile content doesn't affect gate decision.
// Sending realistic shape just to satisfy route's parsing.

const VALID_MISSING_ELEMENTS = ["target_user", "workflow", "core_feature"];

const CASES = [
  // ============================================
  // SHOULD FAIL — Trigger 1 (word count + no product)
  // ============================================
  {
    id: "SP1",
    bucket: "fail-trigger1",
    expected: "FAIL",
    input: "tool for dentists to save time",
    purpose: "Trigger 1 — canonical sparse from audit (6 words, no product/workflow/feature)",
  },
  {
    id: "SP-PETS",
    bucket: "fail-trigger1",
    expected: "FAIL",
    input: "app for pet owners that's helpful",
    purpose: "Trigger 1 — short, no specific product/workflow/feature named",
  },
  {
    id: "SP-MINIMAL",
    bucket: "fail-trigger1",
    expected: "FAIL",
    input: "AI thing for productivity",
    purpose: "Trigger 1 — minimal, no product committed",
  },

  // ============================================
  // SHOULD FAIL — Trigger 2 (contradictory scope)
  // ============================================
  {
    id: "MD-MULTI",
    bucket: "fail-trigger2",
    expected: "FAIL",
    input: "platform that helps people maybe X or Y, could be enterprise or consumer, focused on the future of work",
    purpose: "Trigger 2 — locked matrix row; contradictory scope (enterprise vs consumer; X or Y)",
  },
  {
    id: "MD-SHIFTING",
    bucket: "fail-trigger2",
    expected: "FAIL",
    input: "I want to build a SaaS for B2B sales teams, or maybe consumers who like productivity, basically a tool that does scheduling and also chat and also note-taking",
    purpose: "Trigger 2 — shifting target user + multiple unconnected functions",
  },

  // ============================================
  // SHOULD FAIL — Trigger 3 (narrative-only / fake-specific)
  // ============================================
  {
    id: "FAKE-SPECIFIC",
    bucket: "fail-trigger3",
    expected: "FAIL",
    input: "platform for the future of work for teams and creators and enterprises",
    purpose: "Trigger 3 — locked matrix row; long, names domains/audiences but no product",
  },
  {
    id: "BN-PHILOSOPHICAL",
    bucket: "fail-trigger3",
    expected: "FAIL",
    input: "We're entering a new era of work where AI fundamentally transforms how teams collaborate, and I think there's a huge opportunity to build something that addresses the changing nature of knowledge work in the post-pandemic landscape",
    purpose: "Trigger 3 — long philosophical narrative, no product named",
  },
  {
    id: "BN-VAGUE",
    bucket: "fail-trigger3",
    expected: "FAIL",
    input: "AI is changing how we live and work, and I want to build something that captures this transformation. The opportunity is enormous and the timing is right.",
    purpose: "Trigger 3 — narrative without product specification",
  },

  // ============================================
  // SHOULD PASS — sparse but specific (boundary critical, false-reject zone)
  // ============================================
  {
    id: "DENTIST-PA",
    bucket: "pass-sparse",
    expected: "PASS",
    input: "AI tool for dentists to automate prior authorizations",
    purpose: "Counter-example — locked matrix; short but dense (target+type+workflow named)",
  },
  {
    id: "SHOPIFY-OPT",
    bucket: "pass-sparse",
    expected: "PASS",
    input: "AI Shopify pricing optimizer",
    purpose: "Counter-example — locked matrix; 4 words, names product type + domain + feature",
  },
  {
    id: "SMB-ACC",
    bucket: "pass-sparse",
    expected: "PASS",
    input: "AI workflow tool for SMB accountants",
    purpose: "Counter-example — locked matrix; sparse, names target + product type",
  },
  {
    id: "NC4-GYM",
    bucket: "pass-sparse",
    expected: "PASS",
    input: "Independent gym owners manage member follow-ups, cancellations, and renewal reminders manually across WhatsApp and spreadsheets. I want to help them organize this and prevent churn.",
    purpose: "NC4-class — problem-first w/ workflow + target + concrete pain (B5/B6 boundary case)",
  },
  {
    id: "NC4-DENTAL",
    bucket: "pass-sparse",
    expected: "PASS",
    input: "Solo dentists track patient follow-ups, missed appointments, and recall reminders manually across SMS and Excel sheets. I want to help them organize this and reduce no-shows.",
    purpose: "NC4-dental — dental equivalent of NC4-GYM; verifies counter-example holds across domains",
  },

  // ============================================
  // SHOULD PASS — well-formed (control)
  // ============================================
  {
    id: "LAW-FIRM-DOC",
    bucket: "pass-wellformed",
    expected: "PASS",
    input: "AI-powered document automation tool for small law firms (under 20 attorneys). Ingests client intake forms, generates draft engagement letters, retainer agreements, and client memos based on firm templates.",
    purpose: "Well-formed control — locked matrix; long, fully specified",
  },
  {
    id: "NC1-CUSTOMS",
    bucket: "pass-wellformed",
    expected: "PASS",
    input: "An AI customs declaration validator for SMB freight forwarders. Ingests commercial invoices and packing lists, predicts HS code classifications, and flags missing required fields before submission to customs.",
    purpose: "Well-formed control — long, target + product + features all named",
  },
];

async function runCase(c) {
  const start = Date.now();
  let gateFired = null;
  let missingElements = null;
  let error = null;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: c.input, profile: PROFILE }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let resolved = false;

    outer: while (!resolved) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        let event;
        try {
          event = JSON.parse(line.slice(6));
        } catch {
          continue;
        }

        if (event.step === "keywords_done") {
          // Gate did NOT fire — pipeline continued past gate. We have our answer.
          gateFired = false;
          resolved = true;
          break outer;
        }

        if (event.step === "complete" && event.data?.specificity_insufficient === true) {
          gateFired = true;
          missingElements = Array.isArray(event.data.missing_elements)
            ? event.data.missing_elements
            : [];
          resolved = true;
          break outer;
        }

        if (event.step === "error") {
          throw new Error(event.message || "stream error");
        }
      }
    }

    // Cancel reader to free resources for PASS cases (we don't need rest of pipeline)
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
  } catch (e) {
    error = e.message;
  }

  const elapsedMs = Date.now() - start;
  const actual =
    gateFired === true ? "FAIL" :
    gateFired === false ? "PASS" :
    "ERROR";
  const correct = actual === c.expected;

  return {
    id: c.id,
    bucket: c.bucket,
    expected: c.expected,
    purpose: c.purpose,
    input: c.input,
    actual,
    correct,
    elapsedMs,
    missing_elements: missingElements,
    error,
  };
}

function formatRow(r) {
  const status =
    r.actual === "ERROR" ? "⚠ ERROR" :
    r.correct ? "✓" :
    "✗ MISS";
  const me =
    r.missing_elements && r.missing_elements.length > 0
      ? `  [${r.missing_elements.join(", ")}]`
      : "";
  const errSuffix = r.error ? `  err=${r.error}` : "";
  return `  ${r.id.padEnd(20)} expected ${r.expected.padEnd(4)} got ${r.actual.padEnd(5)} ${status}${me}  (${r.elapsedMs}ms)${errSuffix}`;
}

async function main() {
  console.log("V4S28 B7 — Specificity gate test runner");
  console.log("=========================================\n");
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Cases: ${CASES.length}\n`);
  console.log(`Thresholds (locked):`);
  console.log(`  T1 — False reject rate: 0% strict`);
  console.log(`  T2 — False accept rate: <= 12.5% (>=7/8 FAIL caught)\n`);

  const results = [];
  const buckets = ["fail-trigger1", "fail-trigger2", "fail-trigger3", "pass-sparse", "pass-wellformed"];

  for (const bucket of buckets) {
    const bucketCases = CASES.filter((c) => c.bucket === bucket);
    if (bucketCases.length === 0) continue;
    console.log(`[${bucket}]`);
    for (const c of bucketCases) {
      const r = await runCase(c);
      results.push(r);
      console.log(formatRow(r));
    }
    console.log("");
  }

  // ============================================
  // THRESHOLD EVALUATION
  // ============================================
  console.log("=========================================");
  console.log("Threshold evaluation");
  console.log("=========================================\n");

  const errors = results.filter((r) => r.actual === "ERROR");
  if (errors.length > 0) {
    console.log(`⚠ ${errors.length} case(s) errored — check connectivity / API key:`);
    for (const r of errors) console.log(`    - ${r.id}: ${r.error}`);
    console.log("");
  }

  const passCases = results.filter((r) => r.expected === "PASS" && r.actual !== "ERROR");
  const failCases = results.filter((r) => r.expected === "FAIL" && r.actual !== "ERROR");

  const falseRejects = passCases.filter((r) => r.actual === "FAIL");
  const falseAccepts = failCases.filter((r) => r.actual === "PASS");

  const falseRejectRate = passCases.length > 0 ? falseRejects.length / passCases.length : 0;
  const falseAcceptRate = failCases.length > 0 ? falseAccepts.length / failCases.length : 0;

  const T1_OK = falseRejects.length === 0;
  const T2_OK = falseAcceptRate <= 0.125;

  console.log(
    `T1 — False rejects: ${falseRejects.length}/${passCases.length} (${(falseRejectRate * 100).toFixed(1)}%)  ${T1_OK ? "✓ PASS" : "✗ FAIL"}  (target: 0%)`
  );
  if (falseRejects.length > 0) {
    console.log(`     Cases the gate incorrectly blocked:`);
    for (const r of falseRejects) {
      console.log(`       - ${r.id}: ${r.purpose}`);
    }
  }

  console.log(
    `T2 — False accepts: ${falseAccepts.length}/${failCases.length} (${(falseAcceptRate * 100).toFixed(1)}%)  ${T2_OK ? "✓ PASS" : "✗ FAIL"}  (target: <=12.5%)`
  );
  if (falseAccepts.length > 0) {
    console.log(`     Cases the gate missed:`);
    for (const r of falseAccepts) {
      console.log(`       - ${r.id}: ${r.purpose}`);
    }
  }

  // ============================================
  // SANITY CHECKS (observational)
  // ============================================
  console.log("\nSanity checks (log-and-review, not pass/fail):");

  const firedCases = failCases.filter((r) => r.actual === "FAIL");

  // Coarse-enum compliance
  const enumViolations = firedCases.filter(
    (r) =>
      Array.isArray(r.missing_elements) &&
      r.missing_elements.some((s) => !VALID_MISSING_ELEMENTS.includes(s))
  );
  if (enumViolations.length === 0) {
    console.log(`  Coarse-enum compliance: ✓ all missing_elements use locked 3-value enum`);
  } else {
    console.log(`  Coarse-enum compliance: ⚠ ${enumViolations.length} case(s) used invalid values:`);
    for (const r of enumViolations) {
      console.log(`    - ${r.id}: ${JSON.stringify(r.missing_elements)}`);
    }
  }

  // Empty missing_elements
  const emptyMissing = firedCases.filter(
    (r) => !Array.isArray(r.missing_elements) || r.missing_elements.length === 0
  );
  if (emptyMissing.length === 0) {
    console.log(`  Non-empty missing_elements: ✓ all FAIL cases returned at least one slot`);
  } else {
    console.log(`  Non-empty missing_elements: ⚠ ${emptyMissing.length} FAIL case(s) returned empty:`);
    for (const r of emptyMissing) {
      console.log(`    - ${r.id}`);
    }
  }

  // Latency
  const latencies = results.filter((r) => r.actual !== "ERROR").map((r) => r.elapsedMs).sort((a, b) => a - b);
  if (latencies.length > 0) {
    const median = latencies[Math.floor(latencies.length / 2)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1];
    const max = latencies[latencies.length - 1];
    console.log(`  Latency: median ${median}ms, p95 ${p95}ms, max ${max}ms`);
  }

  // ============================================
  // FINAL VERDICT
  // ============================================
  const overallPass = T1_OK && T2_OK && errors.length === 0;
  console.log("\n=========================================");
  console.log(`OVERALL: ${overallPass ? "✓ PASS" : "✗ FAIL"}`);
  console.log("=========================================");

  // Dump results to file for record-keeping
  await fs.mkdir("out", { recursive: true });
  await fs.writeFile(
    "out/run-b7-results.json",
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        endpoint: ENDPOINT,
        thresholds: {
          T1_false_reject_max: 0,
          T2_false_accept_max: 0.125,
        },
        summary: {
          total: results.length,
          errors: errors.length,
          falseRejects: falseRejects.length,
          falseAccepts: falseAccepts.length,
          falseRejectRate,
          falseAcceptRate,
          T1_OK,
          T2_OK,
          overallPass,
        },
        results,
      },
      null,
      2
    )
  );
  console.log(`\nFull results: out/run-b7-results.json`);

  process.exit(overallPass ? 0 : 1);
}

main().catch((err) => {
  console.error("\n⚠ Runner crashed:", err);
  process.exit(2);
});

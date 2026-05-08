// ============================================================================
// run-haiku-calibration.js
// V4S28 PRE-B10A HAIKU CALIBRATION REGRESSION RUNNER (May 4, 2026)
// ============================================================================
//
// Tests the recalibrated Haiku specificity gate against a 71-case bank covering
// all major user-input behavioral classes. Plus 15 variance-rerun calls = 86
// total Haiku calls. Estimated wall time: ~100 seconds.
//
// Pattern (carries from B7's run-b7.js): consumes the Free pipeline SSE stream
// and aborts on the first verdict signal:
//   - `keywords_done` event → gate PASSED, no Sonnet call triggered
//   - `complete` event with specificity_insufficient: true → gate FAILED
//
// Aborting on these events means each test costs only ~$0.001 (one Haiku call).
// Sonnet is never invoked. ~86 calls ≈ $0.09 total.
//
// Usage: node run-haiku-calibration.js
//
// Endpoint: production (https://idealoopcore.com/api/analyze)
// ============================================================================

const ENDPOINT = "https://idealoopcore.com/api/analyze";

// Profile is required by the route signature but irrelevant to the gate
// (gate is profile-blind by signature, verified module-level in B6).
const TEST_PROFILE = {
  coding: "intermediate",
  ai: "intermediate",
  education: "Software engineer with 5 years experience",
};

// ============================================================================
// CASE BANK — 71 unique cases organized into 14 blocks
// ============================================================================
//
// Each case: { id, block, input, expected, threshold }
//   id          — unique case identifier (used in report)
//   block       — letter code for grouping
//   input       — the idea text sent to the gate
//   expected    — "PASS" | "FAIL" | "OBSERVE" (no threshold check)
//   threshold   — which threshold gate this case contributes to

const CASES = [
  // ========================================================================
  // BLOCK A — Bug-trigger canon (multi-product PASS, the bug this session fixes)
  // ========================================================================
  {
    id: "A1", block: "A", expected: "PASS", threshold: "G_NEW_PASS",
    label: "restaurant manager (canonical)",
    input: "I'm building a tool for restaurant managers to handle inventory, customer loyalty, and staff scheduling. It would send POS integration alerts when inventory is low, run email campaigns with personalized offers based on order history, and let managers swap shifts on a mobile interface.",
  },
  {
    id: "A2", block: "A", expected: "PASS", threshold: "G_NEW_PASS",
    label: "mid-market manufacturing across three workflows",
    input: "A tool for mid-market manufacturers to track inventory across plants, schedule production runs, and audit quality issues using barcode scanners, capacity planning algorithms, and incident logging dashboards.",
  },
  {
    id: "A3", block: "A", expected: "PASS", threshold: "G_NEW_PASS",
    label: "consumer fitness platform with three feature lines",
    input: "An AI fitness app for runners that combines training plan generation, nutrition tracking through meal photo recognition, and weekly check-ins with a virtual coach.",
  },
  {
    id: "A4", block: "A", expected: "PASS", threshold: "G_NEW_PASS",
    label: "AI workspace with three product framings",
    input: "An AI workspace for solo consultants — handles client intake forms, generates project proposals from past templates, and tracks invoice payment status with automated reminders.",
  },
  {
    id: "A5", block: "A", expected: "PASS", threshold: "G_NEW_PASS",
    label: "restaurant case rephrased (different opening tone)",
    input: "I'm thinking about a SaaS for restaurant owners that helps them track inventory levels with POS integration, run customer loyalty programs through personalized email offers, and coordinate staff schedules through a mobile shift-swap interface.",
  },

  // ========================================================================
  // BLOCK B — Sparse-FAIL floor (the B7 floor must hold)
  // ========================================================================
  {
    id: "B1", block: "B", expected: "FAIL", threshold: "G_FLOOR_HOLD",
    label: "tool for dentists to save time",
    input: "tool for dentists to save time",
  },
  {
    id: "B2", block: "B", expected: "FAIL", threshold: "G_FLOOR_HOLD",
    label: "AI assistant for teachers",
    input: "AI assistant for teachers",
  },
  {
    id: "B3", block: "B", expected: "FAIL", threshold: "G_FLOOR_HOLD",
    label: "AI app for pets",
    input: "AI app for pets",
  },
  {
    id: "B4", block: "B", expected: "FAIL", threshold: "G_FLOOR_HOLD",
    label: "AI for accountants",
    input: "AI for accountants",
  },
  {
    id: "B5", block: "B", expected: "FAIL", threshold: "G_FLOOR_HOLD",
    label: "a productivity tool for SMBs",
    input: "a productivity tool for SMBs",
  },
  {
    id: "B6", block: "B", expected: "FAIL", threshold: "G_FLOOR_HOLD",
    label: "platform for the future of work",
    input: "platform for the future of work for teams and creators and enterprises",
  },
  {
    id: "B7", block: "B", expected: "FAIL", threshold: "G_FLOOR_HOLD",
    label: "an app that helps people",
    input: "an app that helps people",
  },
  {
    id: "B8", block: "B", expected: "FAIL", threshold: "G_FLOOR_HOLD",
    label: "tool to make work easier",
    input: "tool to make work easier",
  },

  // ========================================================================
  // BLOCK C — Conversational-tone PASS (real users write conversationally)
  // ========================================================================
  {
    id: "C1", block: "C", expected: "PASS", threshold: "G_CONVERSATIONAL",
    label: "freelance writers pitch tracker",
    input: "I want to build something for freelance writers that helps them keep track of pitches they've sent and which editors haven't replied yet.",
  },
  {
    id: "C2", block: "C", expected: "PASS", threshold: "G_CONVERSATIONAL",
    label: "parents school deadlines tracker",
    input: "thinking about a tool for parents that organizes their kids' school deadlines and sends reminders before assignments are due",
  },
  {
    id: "C3", block: "C", expected: "PASS", threshold: "G_CONVERSATIONAL",
    label: "powerlifter workout tracker",
    input: "an idea I have — a workout tracker for powerlifters that logs lifts, calculates 1RM progression, and warns about overtraining patterns",
  },
  {
    id: "C4", block: "C", expected: "PASS", threshold: "G_CONVERSATIONAL",
    label: "therapist SOAP notes",
    input: "I'm building this thing where therapists can dictate session notes and an AI structures them into SOAP format for their EHR",
  },
  {
    id: "C5", block: "C", expected: "PASS", threshold: "G_CONVERSATIONAL",
    label: "indie game devs localization",
    input: "okay so my idea is basically a tool for indie game devs that handles localization — you upload your strings, it translates them, and tracks which ones changed between versions",
  },
  {
    id: "C6", block: "C", expected: "PASS", threshold: "G_CONVERSATIONAL",
    label: "podcaster show notes generator",
    input: "want to build a tool for podcasters that auto-generates show notes, timestamps, and social clips from each episode upload",
  },
  {
    id: "C7", block: "C", expected: "PASS", threshold: "G_CONVERSATIONAL",
    label: "solo lawyers pleadings drafter",
    input: "an AI assistant for solo lawyers that drafts pleadings from intake forms and tracks deadlines",
  },
  {
    id: "C8", block: "C", expected: "PASS", threshold: "G_CONVERSATIONAL",
    label: "property managers tenant routing",
    input: "I'm working on something for property managers — they get tenant complaints by text, and the AI categorizes them by urgency and routes to the right contractor",
  },

  // ========================================================================
  // BLOCK D — use_case ≈ mechanism collapse PASS
  // ========================================================================
  {
    id: "D1", block: "D", expected: "PASS", threshold: "G_COLLAPSE",
    label: "freelance designers manage invoices",
    input: "A tool for freelance designers to manage their client invoices.",
  },
  {
    id: "D2", block: "D", expected: "PASS", threshold: "G_COLLAPSE",
    label: "small clinics schedule appointments",
    input: "A platform for small clinics to schedule patient appointments.",
  },
  {
    id: "D3", block: "D", expected: "PASS", threshold: "G_COLLAPSE",
    label: "marketing teams plan content calendars",
    input: "A tool for marketing teams to plan content calendars.",
  },
  {
    id: "D4", block: "D", expected: "PASS", threshold: "G_COLLAPSE",
    label: "personal trainers track client progress",
    input: "An app for personal trainers to track client progress.",
  },
  {
    id: "D5", block: "D", expected: "PASS", threshold: "G_COLLAPSE",
    label: "landlords handle rent collection",
    input: "A system for landlords to handle rent collection.",
  },
  {
    id: "D6", block: "D", expected: "PASS", threshold: "G_COLLAPSE",
    label: "event planners coordinate vendor bookings",
    input: "A tool for event planners to coordinate vendor bookings.",
  },

  // ========================================================================
  // BLOCK E — Adoption-unit (consumer/free user) PASS — buyer ≠ payer
  // ========================================================================
  {
    id: "E1", block: "E", expected: "PASS", threshold: "G_ADOPTION",
    label: "AI quiz generator for biology teachers",
    input: "AI quiz generator for high-school biology teachers",
  },
  {
    id: "E2", block: "E", expected: "PASS", threshold: "G_ADOPTION",
    label: "college students lecture summarizer",
    input: "an app for college students to summarize lecture recordings into revision notes",
  },
  {
    id: "E3", block: "E", expected: "PASS", threshold: "G_ADOPTION",
    label: "free hobbyist photo organizer",
    input: "a free tool for hobbyist photographers to organize and tag their photo library",
  },
  {
    id: "E4", block: "E", expected: "PASS", threshold: "G_ADOPTION",
    label: "open-source indie writer platform",
    input: "an open-source platform for indie writers to share short fiction and get feedback",
  },
  {
    id: "E5", block: "E", expected: "PASS", threshold: "G_ADOPTION",
    label: "Discord bot Minecraft daily challenges",
    input: "a Discord bot for small Minecraft servers that auto-generates daily challenges",
  },
  {
    id: "E6", block: "E", expected: "PASS", threshold: "G_ADOPTION",
    label: "iOS app runners route logger",
    input: "an iOS app for runners to log routes and share with friends",
  },

  // ========================================================================
  // BLOCK F — Sparse-but-specific PASS (brevity not disqualifying)
  // ========================================================================
  {
    id: "F1", block: "F", expected: "PASS", threshold: "G_SPARSE_SPECIFIC",
    label: "AI Shopify pricing optimizer",
    input: "AI Shopify pricing optimizer",
  },
  {
    id: "F2", block: "F", expected: "PASS", threshold: "G_SPARSE_SPECIFIC",
    label: "AI workflow tool SMB accountants",
    input: "AI workflow tool for SMB accountants",
  },
  {
    id: "F3", block: "F", expected: "PASS", threshold: "G_SPARSE_SPECIFIC",
    label: "AI tool dentists prior auth",
    input: "AI tool for dentists to automate prior authorizations",
  },
  {
    id: "F4", block: "F", expected: "PASS", threshold: "G_SPARSE_SPECIFIC",
    label: "Slack bot eng managers schedule 1:1s",
    input: "Slack bot for engineering managers to schedule 1:1s",
  },
  {
    id: "F5", block: "F", expected: "PASS", threshold: "G_SPARSE_SPECIFIC",
    label: "Notion plugin keyword rankings",
    input: "Notion plugin for content writers to track keyword rankings",
  },
  {
    id: "F6", block: "F", expected: "PASS", threshold: "G_SPARSE_SPECIFIC",
    label: "Chrome extension seller histories",
    input: "Chrome extension for ecommerce buyers to compare seller histories",
  },

  // ========================================================================
  // BLOCK G — Edge cases / boundaries (G_BORDERLINE + G_MULTI_PRODUCT)
  // ========================================================================
  // G1-G4: Borderline PASS (graduating toward pass)
  {
    id: "G1", block: "G", expected: "PASS", threshold: "G_BORDERLINE",
    label: "10-year doctor with concrete product",
    input: "I'm a 10-year doctor who wants to build an AI assistant that helps clinicians document encounters in under 90 seconds using voice dictation and structured templates",
  },
  {
    id: "G2", block: "G", expected: "PASS", threshold: "G_BORDERLINE",
    label: "freelancers invoicing + payment reminders",
    input: "An idea for a tool that helps freelancers manage their invoicing and payment reminders for late-paying clients",
  },
  {
    id: "G3", block: "G", expected: "PASS", threshold: "G_BORDERLINE",
    label: "law firms summarize discovery docs",
    input: "AI tool for small law firms to summarize discovery documents",
  },
  {
    id: "G4", block: "G", expected: "PASS", threshold: "G_BORDERLINE",
    label: "moms newborns sleep tracking",
    input: "Building something for moms with newborns — sleep tracking with audio analysis to predict feeding times",
  },
  // G5-G8: Borderline FAIL (surface specificity, no slot content)
  {
    id: "G5", block: "G", expected: "FAIL", threshold: "G_BORDERLINE",
    label: "AI for healthcare",
    input: "AI for healthcare",
  },
  {
    id: "G6", block: "G", expected: "FAIL", threshold: "G_BORDERLINE",
    label: "enterprise GenAI buzzword",
    input: "an enterprise SaaS solution leveraging GenAI to transform B2B workflows",
  },
  {
    id: "G7", block: "G", expected: "FAIL", threshold: "G_BORDERLINE",
    label: "next-gen modern workforce",
    input: "next-generation platform for the modern workforce",
  },
  {
    id: "G8", block: "G", expected: "FAIL", threshold: "G_BORDERLINE",
    label: "disrupt legaltech with AI",
    input: "I want to disrupt the legaltech industry with AI",
  },
  // G9-G12: Multi-product gradient
  {
    id: "G9", block: "G", expected: "PASS", threshold: "G_MULTI_PRODUCT",
    label: "restaurant multi-product (high coherence)",
    input: "I'm building a tool for restaurant managers to handle inventory, customer loyalty, and staff scheduling. It would send POS integration alerts when inventory is low, run email campaigns with personalized offers based on order history, and let managers swap shifts on a mobile interface.",
  },
  {
    id: "G10", block: "G", expected: "FAIL", threshold: "G_MULTI_PRODUCT",
    label: "clinics+hospitals+wellness scattered slots",
    input: "I want to build something for clinics, hospitals, wellness users, and maybe patients that improves care, operations, and communication with AI.",
  },
  {
    id: "G11", block: "G", expected: "PASS", threshold: "G_MULTI_PRODUCT",
    label: "service SMBs (restaurants/gyms/salons) booking platform",
    input: "a platform for restaurants and gyms and salons to handle bookings and reminders and loyalty programs",
  },
  {
    id: "G12", block: "G", expected: "FAIL", threshold: "G_MULTI_PRODUCT",
    label: "two unrelated products (healthcare + SMB payroll)",
    input: "I'm building tools for both healthcare providers (for documentation) and SMB owners (for payroll) using AI",
  },

  // ========================================================================
  // BLOCK I — Typo / broken English / non-native phrasing PASS
  // ========================================================================
  {
    id: "I1", block: "I", expected: "PASS", threshold: "G_TYPO",
    label: "restaurant typos + broken grammar",
    input: "AI tool for resturant owners to track invetory and send alert when stock low",
  },
  {
    id: "I2", block: "I", expected: "PASS", threshold: "G_TYPO",
    label: "students broken English",
    input: "I want make app for students, it summarize lecture records and create study notes",
  },

  // ========================================================================
  // BLOCK J — Founder-backstory mixed with idea PASS
  // ========================================================================
  {
    id: "J1", block: "J", expected: "PASS", threshold: "G_BACKSTORY",
    label: "10-year doctor backstory + product (medical)",
    input: "I'm a 10-year doctor who wants to build an AI assistant that helps clinicians document encounters in under 90 seconds using voice dictation and structured templates",
  },
  {
    id: "J2", block: "J", expected: "PASS", threshold: "G_BACKSTORY",
    label: "5-year restaurant veteran backstory + product (non-medical)",
    input: "I worked in restaurants for 5 years and I want to build something for restaurant owners that predicts ingredient shortages from POS sales and supplier delivery data.",
  },

  // ========================================================================
  // BLOCK K — Uncertain / hedged phrasing PASS
  // ========================================================================
  {
    id: "K1", block: "K", expected: "PASS", threshold: "G_UNCERTAIN",
    label: "Etsy sellers uncertain phrasing",
    input: "Not fully sure yet, but maybe a tool for Etsy sellers that tracks competitor prices and suggests when to adjust their listings.",
  },
  {
    id: "K2", block: "K", expected: "PASS", threshold: "G_UNCERTAIN",
    label: "dental hygienists hedged phrasing",
    input: "I don't know exactly yet but I'm thinking about an app for dental hygienists that records cleaning sessions and auto-generates patient education handouts based on what was discussed.",
  },

  // ========================================================================
  // BLOCK L — Service / non-software ideas PASS
  // ========================================================================
  {
    id: "L1", block: "L", expected: "PASS", threshold: "G_SERVICE",
    label: "consulting service for textile shops",
    input: "A consulting service for small textile shops that audits their fabric inventory and creates weekly purchasing plans.",
  },

  // ========================================================================
  // BLOCK M — Marketplace / two-sided ideas PASS
  // ========================================================================
  {
    id: "M1", block: "M", expected: "PASS", threshold: "G_MARKETPLACE",
    label: "photographer-business marketplace",
    input: "A marketplace for local photographers and small businesses where businesses post product-shoot requests and photographers bid with portfolios and prices.",
  },
  {
    id: "M2", block: "M", expected: "PASS", threshold: "G_MARKETPLACE",
    label: "tutor-student marketplace",
    input: "A two-sided platform connecting freelance tutors with high-school students preparing for AP exams — tutors post availability, students book sessions and pay through the platform.",
  },

  // ========================================================================
  // BLOCK N — Integration-heavy ideas PASS
  // ========================================================================
  {
    id: "N1", block: "N", expected: "PASS", threshold: "G_INTEGRATION",
    label: "Slack+Zendesk integration for support managers",
    input: "A Slack integration for customer support managers that summarizes angry customer threads and creates escalation tickets in Zendesk.",
  },

  // ========================================================================
  // BLOCK O — Comparison input (OBSERVE only — no threshold)
  // ========================================================================
  {
    id: "O1", block: "O", expected: "OBSERVE", threshold: null,
    label: "podcaster vs YouTuber comparison",
    input: "I'm choosing between a tool for podcasters that creates short clips from episodes and a tool for YouTubers that turns long videos into Shorts using AI scene detection.",
  },
];

// ============================================================================
// VARIANCE BANK — 5 cases × 3 reruns = 15 calls
// ============================================================================

const VARIANCE_CASES = [
  {
    id: "V_REST", label: "restaurant multi-product PASS",
    input: "I'm building a tool for restaurant managers to handle inventory, customer loyalty, and staff scheduling. It would send POS integration alerts when inventory is low, run email campaigns with personalized offers based on order history, and let managers swap shifts on a mobile interface.",
    expected: "PASS",
  },
  {
    id: "V_DENT", label: "tool for dentists sparse FAIL",
    input: "tool for dentists to save time",
    expected: "FAIL",
  },
  {
    id: "V_LAW", label: "small law firm sparse-specific PASS",
    input: "AI tool for small law firms to summarize discovery documents",
    expected: "PASS",
  },
  {
    id: "V_FOUND", label: "founder-story PASS",
    input: "I worked in restaurants for 5 years and I want to build something for restaurant owners that predicts ingredient shortages from POS sales and supplier delivery data.",
    expected: "PASS",
  },
  {
    id: "V_BUZZ", label: "enterprise GenAI buzzword FAIL",
    input: "an enterprise SaaS solution leveraging GenAI to transform B2B workflows",
    expected: "FAIL",
  },
];
const VARIANCE_RERUNS = 3;

// ============================================================================
// SSE CONSUMER — one Haiku gate call via Free pipeline streaming
// ============================================================================

async function callGate(input) {
  const startTime = Date.now();

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea: input, profile: TEST_PROFILE }),
  });

  if (!response.ok) {
    return {
      verdict: "ERROR",
      latency_ms: Date.now() - startTime,
      error: `HTTP ${response.status}`,
      missing_elements: [],
      raw: null,
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const events = buffer.split("\n\n");
      // Keep last (possibly partial) chunk in buffer
      buffer = events.pop() || "";

      for (const eventBlock of events) {
        const dataLine = eventBlock
          .split("\n")
          .find((l) => l.startsWith("data: "));
        if (!dataLine) continue;

        const jsonStr = dataLine.slice(6).trim();
        if (!jsonStr) continue;

        let parsed;
        try {
          parsed = JSON.parse(jsonStr);
        } catch (e) {
          continue;
        }

        // PASS verdict — gate let the input through
        if (parsed.step === "keywords_done") {
          await reader.cancel();
          return {
            verdict: "PASS",
            latency_ms: Date.now() - startTime,
            missing_elements: [],
            keywords: parsed.data?.keywords || [],
            raw: parsed,
          };
        }

        // FAIL verdict — gate fired
        if (
          parsed.step === "complete" &&
          parsed.data &&
          parsed.data.specificity_insufficient === true
        ) {
          await reader.cancel();
          return {
            verdict: "FAIL",
            latency_ms: Date.now() - startTime,
            missing_elements: parsed.data.missing_elements || [],
            message: parsed.data.message || "",
            raw: parsed,
          };
        }

        // Pipeline ran past the gate without firing — should not happen if
        // we caught keywords_done first, but fall through defensively
        if (parsed.step === "complete") {
          await reader.cancel();
          return {
            verdict: "PASS_VIA_COMPLETE",
            latency_ms: Date.now() - startTime,
            missing_elements: [],
            raw: parsed,
            note: "complete event arrived without specificity_insufficient — pipeline ran fully (unexpected for runner)",
          };
        }

        if (parsed.step === "error") {
          await reader.cancel();
          return {
            verdict: "ERROR",
            latency_ms: Date.now() - startTime,
            error: parsed.message || "Unknown stream error",
            raw: parsed,
          };
        }
      }
    }
  } catch (streamErr) {
    return {
      verdict: "ERROR",
      latency_ms: Date.now() - startTime,
      error: `Stream error: ${streamErr.message}`,
      raw: null,
    };
  }

  return {
    verdict: "ERROR",
    latency_ms: Date.now() - startTime,
    error: "Stream ended without verdict event",
    raw: null,
  };
}

// ============================================================================
// MAIN — run all cases, compute thresholds, print report
// ============================================================================

async function main() {
  const startTime = Date.now();
  const results = [];
  const varianceResults = [];

  // Group cases by block for organized output
  const blocks = {};
  for (const c of CASES) {
    if (!blocks[c.block]) blocks[c.block] = [];
    blocks[c.block].push(c);
  }

  console.log("═".repeat(78));
  console.log("HAIKU CALIBRATION REGRESSION RUNNER");
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Cases: ${CASES.length} unique + ${VARIANCE_CASES.length}×${VARIANCE_RERUNS}=${VARIANCE_CASES.length * VARIANCE_RERUNS} variance = ${CASES.length + VARIANCE_CASES.length * VARIANCE_RERUNS} total`);
  console.log("═".repeat(78));

  // Run all 71 unique cases sequentially
  for (const c of CASES) {
    const result = await callGate(c.input);
    const correct = c.expected === "OBSERVE" ? null : result.verdict === c.expected;
    results.push({ ...c, ...result, correct });

    const marker = c.expected === "OBSERVE" ? "·" : (correct ? "✓" : "✗");
    const verdictStr = result.verdict.padEnd(6);
    const latencyStr = `${result.latency_ms}ms`.padStart(7);
    console.log(`  ${marker} ${c.id.padEnd(4)} [${verdictStr}] ${latencyStr}  ${c.label}`);
  }

  console.log("");
  console.log("─".repeat(78));
  console.log("VARIANCE BLOCK (5 cases × 3 reruns)");
  console.log("─".repeat(78));

  // Run variance reruns
  for (const vc of VARIANCE_CASES) {
    const runs = [];
    for (let i = 1; i <= VARIANCE_RERUNS; i++) {
      const result = await callGate(vc.input);
      const correct = result.verdict === vc.expected;
      runs.push({ ...vc, run: i, ...result, correct });
    }
    varianceResults.push({ case: vc, runs });

    const verdicts = runs.map((r) => r.verdict);
    const allMatch = verdicts.every((v) => v === verdicts[0]);
    const allCorrect = runs.every((r) => r.correct);
    const marker = allMatch && allCorrect ? "✓" : (allMatch ? "≈" : "✗");
    const verdictsStr = verdicts.join(" ");
    console.log(`  ${marker} ${vc.id.padEnd(8)} [${verdictsStr}]  ${vc.label}`);
  }

  // ========================================================================
  // THRESHOLD GATES
  // ========================================================================

  const thresholdResults = {};

  // Per-threshold tally
  const thresholds = [
    { name: "G_NEW_PASS", desc: "Block A: bug-trigger canon (5/5 PASS)", expected: 5 },
    { name: "G_FLOOR_HOLD", desc: "Block B: sparse-FAIL floor (8/8 FAIL)", expected: 8 },
    { name: "G_CONVERSATIONAL", desc: "Block C: conversational tone (8/8 PASS)", expected: 8 },
    { name: "G_COLLAPSE", desc: "Block D: use_case ≈ mechanism (6/6 PASS)", expected: 6 },
    { name: "G_ADOPTION", desc: "Block E: adoption-unit consumer (6/6 PASS)", expected: 6 },
    { name: "G_SPARSE_SPECIFIC", desc: "Block F: sparse-but-specific (6/6 PASS)", expected: 6 },
    { name: "G_BORDERLINE", desc: "Block G1-G8: borderline (8/8 correct)", expected: 8 },
    { name: "G_MULTI_PRODUCT", desc: "Block G9-G12: multi-product (4/4 correct)", expected: 4 },
    { name: "G_TYPO", desc: "Block I: typo/broken English (2/2 PASS)", expected: 2 },
    { name: "G_BACKSTORY", desc: "Block J: founder-backstory (2/2 PASS)", expected: 2 },
    { name: "G_UNCERTAIN", desc: "Block K: uncertain phrasing (2/2 PASS)", expected: 2 },
    { name: "G_SERVICE", desc: "Block L: service/non-software (1/1 PASS)", expected: 1 },
    { name: "G_MARKETPLACE", desc: "Block M: marketplace/two-sided (2/2 PASS)", expected: 2 },
    { name: "G_INTEGRATION", desc: "Block N: integration-heavy (1/1 PASS)", expected: 1 },
  ];

  for (const t of thresholds) {
    const cases = results.filter((r) => r.threshold === t.name);
    const correct = cases.filter((r) => r.correct === true).length;
    const total = cases.length;
    thresholdResults[t.name] = { correct, total, pass: correct === t.expected, desc: t.desc };
  }

  // G_ENUM_COMPLIANCE — every FAIL response uses only the locked enum
  const validEnum = new Set(["target_user", "use_case", "mechanism"]);
  const failResults = results.filter((r) => r.verdict === "FAIL");
  let enumViolations = 0;
  const enumViolationCases = [];
  for (const r of failResults) {
    for (const elem of r.missing_elements || []) {
      if (!validEnum.has(elem)) {
        enumViolations++;
        enumViolationCases.push(`${r.id}: invented "${elem}"`);
        break;
      }
    }
  }
  thresholdResults["G_ENUM_COMPLIANCE"] = {
    correct: failResults.length - enumViolations,
    total: failResults.length,
    pass: enumViolations === 0,
    desc: "Enum compliance (no invented finer taxonomies)",
    violations: enumViolationCases,
  };

  // G_LATENCY — p95 across all calls
  const allLatencies = [...results, ...varianceResults.flatMap((v) => v.runs)]
    .map((r) => r.latency_ms)
    .sort((a, b) => a - b);
  const p95Index = Math.floor(allLatencies.length * 0.95);
  const p95 = allLatencies[p95Index];
  const median = allLatencies[Math.floor(allLatencies.length / 2)];
  const max = allLatencies[allLatencies.length - 1];
  thresholdResults["G_LATENCY"] = {
    p95,
    median,
    max,
    pass: p95 <= 1500,
    desc: `Latency p95 ≤ 1500ms (observed median ${median}ms / p95 ${p95}ms / max ${max}ms)`,
  };

  // G_VARIANCE — all 15 variance reruns produce stable verdicts
  let varianceStable = 0;
  let varianceTotal = 0;
  const unstableCases = [];
  for (const vr of varianceResults) {
    const verdicts = vr.runs.map((r) => r.verdict);
    const allMatch = verdicts.every((v) => v === verdicts[0]);
    const allCorrect = vr.runs.every((r) => r.correct);
    varianceTotal += vr.runs.length;
    if (allMatch && allCorrect) {
      varianceStable += vr.runs.length;
    } else {
      unstableCases.push(`${vr.case.id}: [${verdicts.join(", ")}] expected ${vr.case.expected}`);
    }
  }
  thresholdResults["G_VARIANCE"] = {
    correct: varianceStable,
    total: varianceTotal,
    pass: varianceStable === varianceTotal,
    desc: "Variance stability (15/15 stable across reruns)",
    unstable: unstableCases,
  };

  // G_STRIKE_COUNT — 0 = first-run pass on all gates above
  const allGatesPass = Object.values(thresholdResults).every((t) => t.pass);
  thresholdResults["G_STRIKE_COUNT"] = {
    correct: allGatesPass ? 0 : 1,
    total: 0,
    pass: allGatesPass,
    desc: "Strike count: 0 = first-run pass on all gates",
  };

  // ========================================================================
  // PRINT FINAL VERDICT
  // ========================================================================

  console.log("");
  console.log("═".repeat(78));
  console.log("THRESHOLD VERDICTS");
  console.log("═".repeat(78));

  const allThresholdNames = [
    "G_NEW_PASS", "G_FLOOR_HOLD", "G_CONVERSATIONAL", "G_COLLAPSE", "G_ADOPTION",
    "G_SPARSE_SPECIFIC", "G_BORDERLINE", "G_MULTI_PRODUCT", "G_TYPO", "G_BACKSTORY",
    "G_UNCERTAIN", "G_SERVICE", "G_MARKETPLACE", "G_INTEGRATION", "G_ENUM_COMPLIANCE",
    "G_LATENCY", "G_VARIANCE", "G_STRIKE_COUNT",
  ];

  for (const name of allThresholdNames) {
    const t = thresholdResults[name];
    const marker = t.pass ? "✓" : "✗";
    let detail;
    if (name === "G_LATENCY") {
      detail = `median=${t.median}ms p95=${t.p95}ms max=${t.max}ms (target ≤1500ms p95)`;
    } else if (name === "G_STRIKE_COUNT") {
      detail = t.pass ? "0 (first-run pass)" : "≥1 (one or more gates failed)";
    } else {
      detail = `${t.correct}/${t.total}`;
    }
    console.log(`  ${marker} ${name.padEnd(20)} ${detail}`);
  }

  // Detailed failure surfacing
  const failedThresholds = allThresholdNames.filter((n) => !thresholdResults[n].pass);
  if (failedThresholds.length > 0) {
    console.log("");
    console.log("─".repeat(78));
    console.log("FAILURE DETAIL");
    console.log("─".repeat(78));
    for (const name of failedThresholds) {
      console.log(`\n  ${name}:`);
      const failingCases = results.filter(
        (r) => r.threshold === name && r.correct === false
      );
      for (const c of failingCases) {
        console.log(`    ${c.id} expected ${c.expected}, got ${c.verdict}`);
        console.log(`         input: "${c.input.slice(0, 80)}${c.input.length > 80 ? "..." : ""}"`);
        if (c.verdict === "FAIL") {
          console.log(`         missing_elements: [${(c.missing_elements || []).join(", ")}]`);
        }
      }
      if (thresholdResults[name].violations) {
        for (const v of thresholdResults[name].violations) console.log(`    ${v}`);
      }
      if (thresholdResults[name].unstable) {
        for (const v of thresholdResults[name].unstable) console.log(`    ${v}`);
      }
    }
  }

  // OBSERVE block — surface results without threshold gating
  const observeResults = results.filter((r) => r.expected === "OBSERVE");
  if (observeResults.length > 0) {
    console.log("");
    console.log("─".repeat(78));
    console.log("OBSERVE-ONLY RESULTS (no threshold gating)");
    console.log("─".repeat(78));
    for (const o of observeResults) {
      console.log(`  ${o.id}: ${o.verdict}  ${o.label}`);
      if (o.verdict === "FAIL") {
        console.log(`       missing_elements: [${(o.missing_elements || []).join(", ")}]`);
      }
    }
  }

  // Final verdict
  console.log("");
  console.log("═".repeat(78));
  const overall = allGatesPass ? "SHIP ✓" : "NO-SHIP ✗ — re-discuss design lock";
  console.log(`OVERALL: ${overall}`);
  console.log(`Wall time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log("═".repeat(78));

  // Write JSON output for post-hoc analysis
  const fs = require("fs");
  const reportPath = "/home/claude/idealoop/runner/haiku-calibration-report.json";
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        endpoint: ENDPOINT,
        unique_cases: CASES.length,
        variance_runs: VARIANCE_CASES.length * VARIANCE_RERUNS,
        results,
        variance_results: varianceResults,
        threshold_results: thresholdResults,
        overall_pass: allGatesPass,
        wall_time_s: (Date.now() - startTime) / 1000,
      },
      null,
      2
    )
  );
  console.log(`Full results: ${reportPath}`);

  process.exit(allGatesPass ? 0 : 1);
}

main().catch((err) => {
  console.error("Runner crashed:", err);
  process.exit(2);
});

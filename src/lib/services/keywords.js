import client from "./anthropic-client";

// ============================================
// KEYWORD EXTRACTION + SPECIFICITY GATE (Claude Haiku)
// ============================================
// V4S28 B7 (April 28, 2026) — Section 13 / Item 7 locked design.
// V4S28 PRE-B10A HAIKU CALIBRATION REVISIT (May 4, 2026) — recalibrated to fix
// over-strictness on real-world multi-product / conversational-tone inputs.
//
// === RECALIBRATION RECORD (May 4, 2026) ===
//
// Trigger: B9 thin_dimensions hygiene smoke testing surfaced a 100+ word
// restaurant manager input with target_user named, three concrete workflows,
// and three concrete features being gated for "multi-product" framing. The
// gate was effectively answering "is this a single coherent product?" when
// the locked design intent is "did the user give us enough to evaluate?"
//
// Locked design changes:
//   1. Enum rename: workflow → use_case, core_feature → mechanism
//      (target_user kept). Conceptual frame: target_user = adoption unit
//      (not necessarily literal payer); use_case = job/pain/task/workflow
//      under one umbrella; mechanism = how the product intervenes.
//   2. Word-count thresholds dropped. Gate is purely on slot presence with
//      concrete-action guardrail (generic benefit language fails).
//   3. Multi-product is NOT a fail condition. Multi-product with stable slots
//      PASSES; downstream Stage 2b surfaces multi-product framing via
//      evidence_strength MEDIUM/LOW with idea-specific bullets.
//   4. Pass criterion: target_user + use_case + mechanism each have concrete
//      content beyond category labels or generic benefit language. May
//      overlap (use_case ≈ mechanism collapse case). Conversational tone is
//      fine. Imperfect framing is fine. Internal contradiction is fine.
//   5. Example matrix expanded to 14 rows in PASS-first order to avoid
//      anchoring Haiku on rejection. Restaurant case is the canonical
//      multi-product PASS demonstration.
//
// What did NOT change:
//   - Default-to-PASS calibration discipline (locked from B7)
//   - Profile-blind by signature (locked from B6)
//   - Output JSON two-branch shape (locked from B7)
//   - Defense-in-depth principle (Stage 1 + 2a + 2b + 2c + 3 catch sparse
//     inputs that slip through)
//   - Fallback path for Haiku call errors (returns crude keywords PASS-shape)
//
// === ORIGINAL B7 DESIGN RECORD ===
//
// Two responsibilities:
//   1. Specificity gate — detect underspecified inputs and short-circuit
//      the pipeline upstream of all downstream stages. Default-to-PASS
//      calibration; locked example matrix is the calibration mechanism.
//   2. Keyword extraction — for inputs that pass the gate, extract 5
//      searchable keywords and build GitHub + Serper search queries.
//
// Output contract (NEW JSON format — replaces V4S26b CSV):
//   PASS shape: { keywords, githubQuery1, githubQuery2, serperQuery1, serperQuery2 }
//   FAIL shape: { specificity_insufficient: true, missing_elements: [...], message: "..." }
//
// Profile-blind: function signature accepts only ideaText. Verified module-level
// in B6 — no profile parameter, Haiku call passes idea as `content`.
//
// Fallback path (preserved): if the Haiku call itself errors (network, parse
// failure, malformed output), returns a PASS-shape object with crude keywords
// extracted heuristically. The gate ONLY fires on a successful Haiku response
// that explicitly returns specificity_insufficient: true. A Haiku outage
// degrades to crude keywords — pipeline continues. Defense-in-depth: Stage 1
// + Stage 2a + Stage 2b + Stage 2c + Stage 3 catch sparse inputs that slip
// through the gate.
//
// Cost: ~$0.001 per call. Latency: ~1.2s (specificity check adds ~200ms).

const SPECIFICITY_FAIL_MESSAGE =
  "To evaluate this idea, please name who the product is for, the specific task or pain it addresses, and how the product intervenes.";

const SYSTEM_PROMPT = `You evaluate idea descriptions for evaluation-readiness, then extract keywords for ones that pass.

=== STEP 1: SPECIFICITY CHECK (FIRST STEP) ===

Before extracting keywords, evaluate whether the idea description gives us enough to evaluate it.

The input PASSES the specificity check when all THREE conceptual slots have concrete content:

- target_user — WHO the product is for. The adoption unit (the person, team, or organization whose adoption defines success). May be a paying buyer, a free user, a consumer, or an internal team. "Students," "small law firms," "restaurant managers," "high-school biology teachers," "freelance designers" — all valid target_user content.

- use_case — WHAT job, pain, task, or workflow the product addresses. May be a process step ("automate prior authorizations"), a pain ("manual coordination across WhatsApp and spreadsheets"), a task domain ("manage client invoices"), or a workflow ("scheduling appointments"). The verb-object phrase must be operationally concrete — naming a specific task on a specific domain.

- mechanism — HOW the product intervenes. May be a feature, a process, an automation, an interaction model, or a concrete method. "Drafts emails from voice notes," "AI quiz generator," "POS integration alerts," "automates reminders" — all valid mechanism content. May overlap with use_case wording when one phrase carries both meanings ("manage client invoices" satisfies both).

The input FAILS the specificity check when any of the three slots is absent or expressed only as generic benefit language.

GENERIC BENEFIT LANGUAGE — does NOT satisfy any slot:
- "save time"
- "improve productivity"
- "be more productive"
- "help businesses grow"
- "improve workflow"
- "make X easier"
- "the future of [domain]"

CALIBRATION DISCIPLINE — DEFAULT TO PASS WHEN SLOTS ARE PRESENT:
- PASS when target_user, use_case, and mechanism are concretely named — even if the input is brief, conversational, multi-product, or imperfect.
- PASS when the input describes multiple product workflows or features under a single coherent buyer. Multi-product framing is NOT a failure condition. Downstream evaluation surfaces multi-product observations via Stage 2b's evidence_strength.
- PASS when use_case and mechanism overlap in a single phrase ("manage client invoices" satisfies both).
- PASS when the buyer is a free user, consumer, or non-payer adoption unit — "students," "patients," "hobbyists" all count.
- FAIL only when the input cannot anchor a target_user / use_case / mechanism reading. Imaginability ≠ specificity. The model picking a plausible interpretation does not satisfy the slot — the user must have named it.

PASS/FAIL EXAMPLES — these calibrate the threshold:

| Input | Decision | Why |
|---|---|---|
| "AI tool for dentists to automate prior authorizations" | PASS | target_user (dentists), use_case (prior authorization), mechanism (automation) all named — short but concrete. |
| "tool for dentists to save time" | FAIL | target_user named (dentists); use_case is generic benefit ("save time"), not a concrete task; mechanism not named. |
| "AI Shopify pricing optimizer" | PASS | target_user (Shopify merchants), use_case (pricing optimization), mechanism (AI optimizer) — sparse but specific. |
| "AI assistant for teachers" | FAIL | target_user named (teachers); use_case absent (no concrete task domain); mechanism generic ("assistant"). |
| "AI quiz generator for high-school biology teachers" | PASS | target_user (high-school biology teachers — adoption unit, not literal payer), use_case (quiz creation), mechanism (AI generator) all named. |
| "AI workflow tool for SMB accountants" | PASS | target_user (SMB accountants), use_case (accounting workflow), mechanism (AI workflow tool) — sparse but specific. |
| "A tool for freelance designers to manage their client invoices." | PASS | target_user (freelance designers), use_case ≈ mechanism (manage client invoices — verb-object concrete enough that one phrase carries both slots). |
| "Independent gym owners manage member follow-ups, cancellations, and renewal reminders manually across WhatsApp and spreadsheets. I want to help them organize this and prevent churn." | PASS | target_user (independent gym owners), use_case (follow-ups, cancellations, renewals — concrete tasks), mechanism (organize manual coordination across WhatsApp + spreadsheets) all named — problem-first framing. |
| "I want to build something for freelance writers that helps them keep track of pitches they've sent and which editors haven't replied yet." | PASS | target_user (freelance writers), use_case (pitch tracking), mechanism (track sent pitches and editor reply status) — conversational tone, all three slots named. |
| "I've been a doctor for ten years and I've watched patient outcomes get worse and I want to build something using AI that helps fix this." | FAIL | target_user partial (doctors? patients?); use_case absent (no concrete task); mechanism absent ("something using AI"). Long but non-product narrative. |
| "I want to build something for clinics, hospitals, wellness users, and maybe patients that improves care, operations, and communication with AI." | FAIL | target_user scattered (clinics + hospitals + wellness + patients — no anchored adoption unit); use_case generic ("improve care, operations, communication"); mechanism generic ("with AI"). FAILs because no slot is concretely named — NOT because the input spans multiple areas. |
| "platform for the future of work for teams and creators and enterprises" | FAIL | target_user diffuse (teams + creators + enterprises — naming domains is not naming a buyer); use_case absent ("future of work" is not a task); mechanism absent. Fake-specific phrasing — sounds product-like but commits to nothing. |
| "I'm building a tool for restaurant managers to handle inventory, customer loyalty, and staff scheduling. It would send POS integration alerts when inventory is low, run email campaigns with personalized offers based on order history, and let managers swap shifts on a mobile interface." | PASS | target_user (restaurant managers — single coherent buyer), use_case (inventory tracking + loyalty + scheduling — three concrete tasks under one buyer), mechanism (POS alerts + personalized email campaigns + mobile shift swap — three concrete mechanisms). Multi-product is not a failure condition; all three slots are named. |
| "AI-powered document automation tool for small law firms (under 20 attorneys). Ingests client intake forms, generates draft engagement letters, retainer agreements, and client memos based on firm templates." | PASS | target_user (small law firms), use_case (document automation — intake, drafting), mechanism (ingests forms, generates drafts from templates) all named — long, well-formed anchor. |

=== STEP 2: OUTPUT FORMAT ===

Return ONLY a JSON object — no prose, no markdown fences, no explanation.

If the input FAILS the specificity check:
{"specificity_insufficient": true, "missing_elements": [...]}

The "missing_elements" array contains one or more values from this exact 3-value enum: "target_user", "use_case", "mechanism". Include only the genuinely missing elements. Don't invent finer taxonomies.

If the input PASSES the specificity check, extract exactly 5 searchable keywords:
{"keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]}

Keyword rules (PASS path only):
- Keep compound concepts together: "machine learning" not "machine" and "learning"
- Keep compound concepts together: "real estate" not "real" and "estate"
- Focus on NOUNS and DOMAIN TERMS: what the product does, who it serves, what technology it uses
- Remove generic words: app, platform, tool, system, build, create, help, users

Example PASS output for "An AI app that analyzes food photos and gives personalized nutrition advice":
{"keywords": ["food photo analysis", "nutrition advice", "personalized diet", "meal tracking", "calorie estimation"]}

Return ONLY the JSON object. No prose before or after.`;

// ============================================
// COLLAPSE-PATTERN RESCUE LAYER
// ============================================
// V4S28 PRE-B10A SECOND-PASS (May 4, 2026) — narrow deterministic override for
// a known Haiku blindspot.
//
// Problem (surfaced by run-haiku-calibration.js v1 results):
//   Haiku consistently FAILs concise "for X to verb-object" inputs by flagging
//   `mechanism` as missing, even when the verb-object phrase semantically
//   carries both use_case and mechanism. Block D went 1/6 in the v1 runner;
//   adjacent blocks (E4, E6, F4, F6, K1) leaked the same pattern.
//
// Why this is a rescue layer, not a prompt edit:
//   v2 attempted to fix the blindspot via prompt-level permissive teaching
//   ("When in doubt, prefer PASS" + collapse principle block). That changed
//   Haiku's decision posture globally — Block B (sparse-FAIL floor) collapsed
//   8/8 → 0/8 in the v2 runner. Reverted via git revert.
//
//   The blindspot is a narrow structural model-behavior bug, not a calibration
//   imbalance. Narrow bugs get narrow fixes. Deterministic post-FAIL override
//   for a specific structural pattern is the right architectural layer; broad
//   prompt language is the wrong layer.
//
// Conditions for rescue (all five must hold):
//   1. Haiku returned specificity_insufficient: true
//   2. missing_elements contains use_case OR mechanism (or both)
//   3. missing_elements does NOT contain target_user (hard condition — if
//      buyer is missing, never rescue; that's a real failure, not a blindspot)
//   4. Input matches "for [target_user] to [verb] [object]" pattern with a
//      concrete noun-object after the verb (verb alone is not sufficient)
//   5. The captured action phrase is NOT in the generic-benefit blocklist
//
// Pattern coverage (intentionally narrow — fail closed):
//   - Matches: "for X to verb object" (canonical SaaS-pitch shape)
//   - Does NOT match: "for X that verb object" or "for X which verb object"
//     (those forms can match too many vague inputs like "for startups that
//     want to grow faster" — defer until runner shows real-user need)
//
// Generic-benefit blocklist (conservative, explicit):
//   Phrases that match the structural pattern but offer no concrete operation.
//   When in doubt about whether to add a phrase, leave it out — let the gate
//   FAIL stand. Fail closed.

const GENERIC_BENEFIT_BLOCKLIST = [
  "save time",
  "make work easier",
  "make life easier",
  "improve productivity",
  "be more productive",
  "help people",
  "help businesses",
  "grow faster",
  "scale faster",
  "improve workflow",
  "transform workflows",
  "disrupt industry",
  "unlock potential",
  "increase efficiency",
  "be more efficient",
];

// Returns the captured action phrase (verb + object) if the input matches the
// "for [target_user] to [verb] [object]" pattern with a concrete object;
// returns null otherwise. Fail-closed: any ambiguity in matching → null.
function hasConcreteForToVerbObject(input) {
  if (typeof input !== "string") return null;

  // Pattern: "for [target_user] to [verb] [object]"
  // - target_user: 1-6 words (handles "small clinics", "high-school biology
  //   teachers", "freelance designers", etc.)
  // - verb: a single word (transitive verb expected)
  // - object: at least one word; can extend (multi-word objects like
  //   "patient appointments", "client invoices", "rent collection")
  //
  // Stops at sentence-ending punctuation (period/question/exclamation) or
  // conjunctions that would indicate a new clause.
  //
  // Capture group 1: the [verb] [object] phrase (lowercased downstream)
  const pattern =
    /\bfor\s+[\w\-]+(?:\s+[\w\-]+){0,5}?\s+to\s+([\w\-]+\s+[\w\-]+(?:\s+[\w\-]+){0,4})/i;

  const match = input.match(pattern);
  if (!match) return null;

  const actionPhrase = match[1].trim().toLowerCase();

  // Must contain at least one space (verb + at least one object word).
  // The regex above already enforces this, but defensive check anyway.
  if (!actionPhrase.includes(" ")) return null;

  return actionPhrase;
}

// Returns true if the captured action phrase is a known generic-benefit
// pattern. Substring match (case-insensitive) — phrases like "to save time
// and improve productivity" match both "save time" AND "improve productivity"
// from the blocklist, either is sufficient to block the rescue.
function isGenericBenefitPhrase(actionPhrase) {
  if (typeof actionPhrase !== "string") return true; // fail closed
  const normalized = actionPhrase.toLowerCase();
  return GENERIC_BENEFIT_BLOCKLIST.some((phrase) => normalized.includes(phrase));
}

// Top-level rescue check. Returns true if all five conditions hold and the
// FAIL should be overridden to PASS. Returns false if any condition fails
// (Haiku's FAIL stands).
function shouldOverrideCollapseFalseReject(input, missingElements) {
  if (!Array.isArray(missingElements)) return false;

  // Condition 2: missing must include use_case or mechanism
  const flagsMechanismOrUseCase =
    missingElements.includes("use_case") || missingElements.includes("mechanism");
  if (!flagsMechanismOrUseCase) return false;

  // Condition 3: missing must NOT include target_user (hard condition)
  if (missingElements.includes("target_user")) return false;

  // Condition 4: input must match the structural pattern with concrete object
  const actionPhrase = hasConcreteForToVerbObject(input);
  if (!actionPhrase) return false;

  // Condition 5: action phrase must not be generic-benefit language
  if (isGenericBenefitPhrase(actionPhrase)) return false;

  return true;
}

// Build crude keywords from the input when the rescue fires. The Haiku call
// already returned (FAIL path), so we don't have model-extracted keywords —
// we synthesize a reasonable set from the input itself for the search stage.
// Matches the shape of the fallback path's keyword extraction.
function buildRescueKeywords(input) {
  const words = input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .filter((w) => !["build", "create", "tool", "platform", "system", "would", "could", "should", "their", "would", "thing", "something", "things"].includes(w));

  // De-duplicate while preserving order
  const seen = new Set();
  const unique = [];
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      unique.push(w);
    }
    if (unique.length >= 5) break;
  }

  // Pad if we don't have 5 (shouldn't happen for inputs that matched the
  // structural pattern — they're inherently word-rich enough — but defensive)
  while (unique.length < 5) unique.push("software");

  const keywords = unique.slice(0, 5);
  return {
    keywords,
    githubQuery1: keywords.slice(0, 3).join(" "),
    githubQuery2: keywords.slice(2, 5).join(" "),
    serperQuery1: keywords.slice(0, 3).join(" ") + " app OR startup",
    serperQuery2: keywords.slice(1, 4).join(" ") + " software OR product",
  };
}

export async function extractKeywords(ideaText) {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: ideaText,
        },
      ],
    });

    const rawText = response.content[0].text.trim();

    // Defensive markdown-fence stripping (Haiku may wrap JSON despite instructions)
    let cleaned = rawText;
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);

    // FAIL path — gate fires
    if (parsed.specificity_insufficient === true) {
      const validSlots = ["target_user", "use_case", "mechanism"];
      const missingElements = Array.isArray(parsed.missing_elements)
        ? parsed.missing_elements.filter((s) => validSlots.includes(s))
        : [];

      // V4S28 PRE-B10A SECOND-PASS — Collapse-pattern rescue layer.
      // Narrow deterministic override for Haiku's known blindspot on
      // "for X to verb-object" inputs. See helpers above for full conditions.
      if (shouldOverrideCollapseFalseReject(ideaText, missingElements)) {
        // Override to PASS shape. Synthesize keywords from input since Haiku
        // didn't return any (it hit the FAIL branch).
        return buildRescueKeywords(ideaText);
      }

      return {
        specificity_insufficient: true,
        missing_elements: missingElements,
        message: SPECIFICITY_FAIL_MESSAGE,
      };
    }

    // PASS path — extract keywords + build queries
    if (!Array.isArray(parsed.keywords) || parsed.keywords.length === 0) {
      throw new Error("Haiku PASS response missing keywords array");
    }

    const keywords = parsed.keywords
      .map((k) => (typeof k === "string" ? k.trim().toLowerCase() : ""))
      .filter((k) => k.length > 0)
      .slice(0, 5);

    if (keywords.length === 0) {
      throw new Error("Haiku PASS response keywords array is empty after filtering");
    }

    // Build multiple query variations for broader coverage:
    // Each API gets 2 searches with different keyword combos.
    // All 4 run simultaneously — no extra time cost.
    const githubQuery1 = keywords.slice(0, 3).join(" ");
    const githubQuery2 = keywords.slice(2, 5).join(" ");
    const serperQuery1 = keywords.slice(0, 3).join(" ") + " app OR startup";
    const serperQuery2 = keywords.slice(1, 4).join(" ") + " software OR product";

    return {
      keywords,
      githubQuery1,
      githubQuery2,
      serperQuery1,
      serperQuery2,
    };
  } catch (error) {
    console.error("Keyword extraction failed:", error);
    // Fallback: heuristic keyword extraction. Returns a PASS-shape object so
    // the pipeline continues with crude keywords. The gate only fires on a
    // successful Haiku response — network/parse errors degrade gracefully,
    // not halt. Defense-in-depth: downstream defensive layers catch sparse
    // inputs that slip through.
    const fallbackWords = ideaText
      .substring(0, 200)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(" ")
      .filter((w) => w.length > 4)
      .slice(0, 5);

    const searchQuery = fallbackWords.slice(0, 3).join(" ");
    return {
      keywords: fallbackWords,
      githubQuery1: searchQuery,
      githubQuery2: fallbackWords.slice(2, 5).join(" ") || searchQuery,
      serperQuery1: searchQuery,
      serperQuery2: searchQuery,
    };
  }
}
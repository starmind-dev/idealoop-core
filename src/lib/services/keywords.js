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

THE COLLAPSE PRINCIPLE — when ONE phrase satisfies BOTH use_case AND mechanism:

When the input states "tool/app/platform/system for [target_user] to [verb] [object]," the verb-object phrase typically carries BOTH slots simultaneously and BOTH should be marked present:
- "schedule patient appointments" — use_case (the task) AND mechanism (how the product intervenes: scheduling)
- "manage client invoices" — use_case AND mechanism (managing them is the intervention)
- "track client progress" — use_case AND mechanism (tracking is the intervention)
- "handle rent collection" — use_case AND mechanism (handling is the intervention)
- "coordinate vendor bookings" — use_case AND mechanism (coordination is the intervention)
- "tracks competitor prices and suggests adjustments" — use_case AND mechanism (tracking + suggesting are the interventions)

DO NOT require separate distinct vocabulary for use_case and mechanism. When the verb-object phrase is operationally concrete enough to anchor evaluation, both slots are satisfied. Marking mechanism as missing because there isn't a *second* distinct phrase explaining how is a calibration error — the verb IS the mechanism.

Mechanism is genuinely missing only when the input names target_user and a category/domain but no concrete verb-object action ("AI assistant for teachers" — no verb-object; "tool for dentists to save time" — verb-object is generic-benefit, not concrete).

THE BUYER-CATEGORY PRINCIPLE — multi-buyer is not scattered when buyers share a coherent category:

Multiple buyer types listed together PASS target_user when they share a coherent operational category:
- "restaurants and gyms and salons" — service SMBs with appointment/customer-loyalty needs (coherent category)
- "freelancers" — work-on-multiple-client professionals (coherent category, even if broad)
- "small clinics, dental offices, and physical therapy practices" — small healthcare practitioners (coherent category)

Multiple buyer types FAIL target_user only when they cannot be unified under a coherent operational frame:
- "clinics, hospitals, wellness users, and maybe patients" — provider/consumer mix with no coherent operational frame
- "for both healthcare providers (for documentation) and SMB owners (for payroll)" — two unrelated products with two unrelated buyer-product pairs

When in doubt, prefer PASS — Stage 2b will surface "target segment too broad" as MEDIUM evidence_strength downstream if needed. The gate's job is to confirm a buyer is named, not to enforce a buyer is narrow.

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
| "A platform for small clinics to schedule patient appointments." | PASS | target_user (small clinics), use_case ≈ mechanism (schedule patient appointments — collapse case; scheduling IS the intervention, no separate mechanism phrase needed). |
| "An app for personal trainers to track client progress." | PASS | target_user (personal trainers), use_case ≈ mechanism (track client progress — collapse case; tracking IS the mechanism). |
| "A system for landlords to handle rent collection." | PASS | target_user (landlords), use_case ≈ mechanism (handle rent collection — collapse case; handling IS the mechanism). |
| "Slack bot for engineering managers to schedule 1:1s" | PASS | target_user (engineering managers), use_case ≈ mechanism (schedule 1:1s — collapse case; the named platform Slack does NOT consume the mechanism slot, scheduling does). |
| "a platform for restaurants and gyms and salons to handle bookings and reminders and loyalty programs" | PASS | target_user (service SMBs — restaurants/gyms/salons share coherent operational category, NOT scattered), use_case (bookings, reminders, loyalty — three concrete tasks), mechanism (platform that handles these). Multi-buyer under a coherent category is PASS, not scatter. |
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
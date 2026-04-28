import client from "./anthropic-client";

// ============================================
// KEYWORD EXTRACTION + SPECIFICITY GATE (Claude Haiku)
// ============================================
// V4S28 B7 (April 28, 2026) — Section 13 / Item 7 locked design.
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
// Counter-example clause (B5/B6 carryover): problem-first inputs that name
// target user + workflow + concrete pain (NC4-class, e.g., gym-owners
// follow-up case) must NOT fire the gate. Verified by the gym-owners row in
// the example matrix.
//
// Cost: ~$0.001 per call. Latency: ~1.2s (specificity check adds ~200ms).

const SPECIFICITY_FAIL_MESSAGE =
  "Input lacks specific product category, workflow, or feature. Please describe what the product does (e.g., 'appointment scheduling', 'patient intake forms', 'clinical note generation') to enable evaluation.";

const SYSTEM_PROMPT = `You evaluate idea descriptions for evaluation-readiness, then extract keywords for ones that pass.

=== STEP 1: SPECIFICITY CHECK (FIRST STEP) ===

Before extracting keywords, evaluate whether the idea description meets specificity threshold.

The input FAILS the specificity check if ANY of the following is clearly true:
1. Contains fewer than 20 meaningful words AND no specific product category, workflow, or core feature is named
2. Contains contradictory or ambiguous scope signals (tool that does A and also B and also C without coherent connection; target user shifts mid-description; mixed enterprise/consumer framing)
3. Contains 20+ words but reads as narrative description without naming what the product does

CALIBRATION DISCIPLINE — DEFAULT TO PASS (WITH A QUALIFIER): Default to PASS only when the product, workflow, or feature is actually named in the input — even if the input is brief. NOT when the idea "sounds plausible" or when you can imagine a reasonable product from the description. Imaginability ≠ specificity. SP1's "tool for dentists to save time" fails because no product is named, even though a plausible dental product can be imagined. "AI tool for dentists to automate prior authorizations" passes because the product IS named.

PASS/FAIL EXAMPLES — these calibrate the threshold:

| Input | Decision | Why |
|---|---|---|
| "tool for dentists to save time" | FAIL | 6 words, no product category, no workflow, no feature named |
| "AI tool for dentists to automate prior authorizations" | PASS | Short but dense — names target user (dentists), product type (AI tool), AND specific workflow (prior authorization automation). Demonstrates that specificity is about product commitment, not word count. |
| "AI Shopify pricing optimizer" | PASS | 4 words but names product type (optimizer), domain (Shopify), and feature (pricing). Sparse but specific. |
| "AI workflow tool for SMB accountants" | PASS | 6 words, names target user (SMB accountants) + product type (workflow tool). Sparse but specific. |
| "Independent gym owners manage member follow-ups, cancellations, and renewal reminders manually across WhatsApp and spreadsheets. I want to help them organize this and prevent churn." | PASS | Problem-first framing with workflow (member follow-ups, cancellations, renewal reminders) + target user (independent gym owners) + concrete pain (manual coordination across WhatsApp + spreadsheets) all named. Evaluable — does NOT fire Trigger 3. |
| "platform that helps people maybe X or Y, could be enterprise or consumer, focused on the future of work" | FAIL | Long but contradictory scope (enterprise vs consumer; X or Y); no specific product |
| "platform for the future of work for teams and creators and enterprises" | FAIL | Long, uses specific-sounding words (platform, teams, creators, enterprises), but commits to nothing. No product, no workflow, no feature. Fake-specific. Demonstrates that naming domains/audiences ≠ naming a product. |
| 200-word philosophical narrative about "AI changing how we work" without naming what the product is, who uses it, or what it does | FAIL | Long but non-product-like; no actual product named |
| "AI-powered document automation tool for small law firms (under 20 attorneys). Ingests client intake forms, generates draft engagement letters, retainer agreements, and client memos based on firm templates." | PASS | Long, names target user (small law firms), product type (document automation), and core features (intake, drafting). Well-formed. |

=== STEP 2: OUTPUT FORMAT ===

Return ONLY a JSON object — no prose, no markdown fences, no explanation.

If the input FAILS the specificity check:
{"specificity_insufficient": true, "missing_elements": [...]}

The "missing_elements" array contains one or more values from this exact 3-value enum: "target_user", "workflow", "core_feature". Include only the genuinely missing elements. Don't invent finer taxonomies.

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
      const validSlots = ["target_user", "workflow", "core_feature"];
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
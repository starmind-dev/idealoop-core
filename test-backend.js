// ============================================
// IdeaValidator V2 — Backend Diagnostic Script
// ============================================
// Run: node test-backend.js
// Optional: node test-backend.js https://idea-validator-pink-zeta.vercel.app
//
// Tests the /api/analyze endpoint and checks whether
// V2 fields (source, url, data_source, _meta) are present.

const BASE_URL = process.argv[2] || "http://localhost:3000";

const TEST_IDEA =
  "An AI tool that scores startup ideas based on competition, monetization, originality, and technical difficulty.";

const TEST_PROFILE = {
  coding: "Beginner",
  ai: "Regular AI user",
  education: "Computer Science",
};

async function run() {
  console.log("=".repeat(60));
  console.log("IdeaValidator V2 — Backend Diagnostic");
  console.log("=".repeat(60));
  console.log(`Target:  ${BASE_URL}/api/analyze`);
  console.log(`Idea:    "${TEST_IDEA.slice(0, 60)}..."`);
  console.log(`Profile: ${JSON.stringify(TEST_PROFILE)}`);
  console.log("=".repeat(60));
  console.log("\nSending request... (this may take 8-15 seconds)\n");

  const startTime = Date.now();

  try {
    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: TEST_IDEA, profile: TEST_PROFILE }),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Response received in ${elapsed}s`);
    console.log(`HTTP Status: ${res.status}`);

    if (!res.ok) {
      const errorText = await res.text();
      console.log(`\n❌ ERROR RESPONSE:\n${errorText}`);
      return;
    }

    const data = await res.json();

    // ---- FULL RAW RESPONSE (for debugging) ----
    console.log("\n" + "=".repeat(60));
    console.log("FULL RAW JSON RESPONSE");
    console.log("=".repeat(60));
    console.log(JSON.stringify(data, null, 2));

    // ---- DIAGNOSTIC CHECKS ----
    console.log("\n" + "=".repeat(60));
    console.log("DIAGNOSTIC CHECKS");
    console.log("=".repeat(60));

    // Check 1: _meta exists
    if (data._meta) {
      console.log("\n✅ _meta field EXISTS");
      console.log(`   github_results: ${data._meta.github_results}`);
      console.log(`   serper_results: ${data._meta.serper_results}`);
      console.log(`   data_source:    ${data._meta.data_source}`);
      console.log(`   keywords_used:  ${JSON.stringify(data._meta.keywords_used)}`);
      console.log(`   queries:        ${JSON.stringify(data._meta.queries)}`);
    } else {
      console.log("\n❌ _meta field MISSING — backend may be V1 or _meta not attached");
    }

    // Check 2: competition.data_source
    if (data.competition) {
      const ds = data.competition.data_source;
      if (ds === "verified") {
        console.log(`\n✅ competition.data_source = "verified" — REAL DATA IS BEING USED`);
      } else if (ds === "llm_generated") {
        console.log(`\n⚠️  competition.data_source = "llm_generated" — FALLBACK MODE`);
        console.log("   Real searches may have returned empty or failed.");
      } else if (ds === undefined) {
        console.log(`\n❌ competition.data_source is MISSING — Sonnet may have dropped the field`);
      } else {
        console.log(`\n⚠️  competition.data_source = "${ds}" — unexpected value`);
      }
    } else {
      console.log("\n❌ competition object MISSING entirely");
    }

    // Check 3: competitors have source + url
    if (data.competition?.competitors?.length > 0) {
      console.log(`\n📋 Competitors (${data.competition.competitors.length}):`);
      for (const comp of data.competition.competitors) {
        const hasSource = comp.source !== undefined;
        const hasUrl = comp.url !== undefined;
        const sourceIcon = hasSource ? "✅" : "❌";
        const urlIcon = hasUrl && comp.url ? "✅" : comp.url === null ? "⚠️ null" : "❌";
        console.log(`   ${sourceIcon} source=${comp.source || "MISSING"}  ${urlIcon} url=${comp.url || "MISSING"}  — ${comp.name}`);
      }
    } else {
      console.log("\n❌ No competitors in response");
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));

    const hasMeta = !!data._meta;
    const hasVerified = data.competition?.data_source === "verified";
    const hasRealSources = data.competition?.competitors?.some(
      (c) => c.source === "github" || c.source === "google"
    );

    if (hasMeta && hasVerified && hasRealSources) {
      console.log("✅ Backend V2 is WORKING — real competitor data is flowing through.");
      console.log("   → Problem is FRONTEND ONLY. Update page.js to show source/url/badges.");
    } else if (hasMeta && !hasVerified) {
      console.log("⚠️  Backend V2 is RUNNING but falling back to LLM-generated data.");
      console.log("   → Check: Are GITHUB_TOKEN and SERPER_API_KEY set in .env.local?");
      console.log("   → Check: Are the API keys valid? (Try a manual curl to Serper/GitHub)");
      console.log("   → Check: Is the test idea producing useful search keywords?");
      console.log(`   → Keywords extracted: ${JSON.stringify(data._meta?.keywords_used)}`);
    } else if (!hasMeta) {
      console.log("❌ Backend appears to be V1 — no _meta field found.");
      console.log("   → Is the new route.js actually deployed/running?");
      console.log("   → Did you restart the dev server after replacing route.js?");
    } else {
      console.log("⚠️  Mixed results — review the raw JSON above for details.");
    }

    console.log("");
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n❌ REQUEST FAILED after ${elapsed}s`);
    console.log(`Error: ${err.message}`);
    if (err.cause) console.log(`Cause: ${err.cause.message}`);
    console.log("\nIs the dev server running? Try: npm run dev");
  }
}

run();

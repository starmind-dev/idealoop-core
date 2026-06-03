// ============================================
// FIXTURE STORE — verification-only search cache
// ============================================
// Bundle 3.75 (Layer E mitigation, May 10, 2026).
//
// Purpose: stabilize Serper + GitHub responses for verification runs.
// Empirically confirmed (B10a-findings Layer E investigation) that Google
// returns drifted organic results for byte-identical queries even on
// back-to-back calls (~60% URL instability rate). That drift propagates
// through Stage 1 → Stage 2a → Stage 2b and produces inter-run score
// variance up to 1.1pt Overall on identical inputs. Verification runners
// (B10a, bundle-N-verification) need deterministic measurement; this
// module provides a thin disk-backed cache, gated by env var.
//
// Activation: IDEALOOP_USE_FIXTURES=1 must be set on the running Next.js
// server. When unset (Vercel production, normal `npm run dev`), this
// module is a no-op — readFixture returns null, writeFixture returns
// silently. Production behavior is byte-identical to pre-Bundle-3.75.
//
// Storage: runners/fixtures/data/{source}-{queryHash16}.json
//   queryHash16 = first 16 chars of sha256(query)
//   File contents: the array as returned by serper.js / github.js
//   (post slice + map shape, ready for caller consumption)
//
// Refresh lifecycle: delete runners/fixtures/data/ and rerun a B10a or
// verification runner. Cache repopulates from live API calls on miss.
// No automatic invalidation — fixtures stay valid until you delete them.
//
// Cached: Serper + GitHub search responses, and (as of the V5.0 freeze arc)
// keyword extraction — Haiku is NON-deterministic at temperature=0 on dense
// multi-clause inputs, so keywords are frozen upstream to stabilize the search
// cache (see keywords.js header). This supersedes the original Bundle 3.75 note
// that keyword extraction was deterministic (a 2-run spot check on stable cases).
// Not frozen here: Stage 1 LLM non-determinism (the attribution arc identified
// Stage 1 as the irreducible variance source); isolating it would need a
// Stage-1-output freeze, deliberately left unbuilt.
// ============================================

import fs from "fs";
import path from "path";
import crypto from "crypto";

const FIXTURE_DIR = path.join(process.cwd(), "runners", "fixtures", "data");

export function isFixtureMode() {
  return process.env.IDEALOOP_USE_FIXTURES === "1" && process.env.NODE_ENV !== "production";
}

function fixturePath(source, query) {
  const hash = crypto.createHash("sha256").update(query).digest("hex").slice(0, 16);
  return path.join(FIXTURE_DIR, `${source}-${hash}.json`);
}

export function readFixture(source, query) {
  if (!isFixtureMode()) return null;
  const p = fixturePath(source, query);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (err) {
    console.error(`Fixture read failed for ${source} (${p}):`, err.message);
    return null;
  }
}

export function writeFixture(source, query, data) {
  if (!isFixtureMode()) return;
  try {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    fs.writeFileSync(fixturePath(source, query), JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Fixture write failed for ${source}:`, err.message);
  }
}
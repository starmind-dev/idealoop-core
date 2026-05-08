// ============================================================================
// runners/extension-resolver.mjs
// ============================================================================
// Custom Node.js ESM loader hook. Workaround for the Next.js / native-Node
// import-resolution mismatch.
//
// Production code in src/lib/services/* uses bundler-style ESM imports without
// .js extensions (e.g. `import client from "./anthropic-client"`). Webpack /
// Turbopack inside Next.js append extensions during bundling. Native Node ESM
// does not — it is strict about extensions and rejects bare relative paths.
//
// Our F1 diagnostic runners need to dynamic-import production modules
// (prompts, keywords helper, search helpers, competitor helpers) directly via
// Node, outside the Next.js build pipeline. This loader rescues failed
// resolutions by retrying with `.js` and `/index.js` suffixes — the same
// resolution that bundlers do silently.
//
// Behavioral footprint: zero. The hook only fires on failed resolutions and
// retries with appended suffixes; resolutions that already work are
// untouched. Adds nothing functionally — just makes implicit explicit.
//
// Usage: node --experimental-loader=./runners/extension-resolver.mjs ...
//
// Note: --experimental-loader emits a single warning about the feature being
// experimental. This is acceptable for a one-shot diagnostic and stable
// across Node 18/20/22.
// ============================================================================

const SUFFIXES = [".js", ".mjs", ".cjs", "/index.js", "/index.mjs"];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code !== "ERR_MODULE_NOT_FOUND") throw err;

    // Already has a recognized extension — don't retry, surface the original error
    if (/\.(js|mjs|cjs|json)$/.test(specifier)) throw err;

    // Try each suffix until one resolves
    for (const sfx of SUFFIXES) {
      try {
        return await nextResolve(specifier + sfx, context);
      } catch (retryErr) {
        if (retryErr.code !== "ERR_MODULE_NOT_FOUND") throw retryErr;
      }
    }

    // None of the suffixes worked — surface the original error
    throw err;
  }
}

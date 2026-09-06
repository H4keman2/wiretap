/**
 * Rate limiting and short-lived verified-key caching for license checks.
 *
 * This is split out from license.server.ts because it needs
 * `@tanstack/react-start/server`'s `getRequestIP`, which is a genuinely
 * server-only module. `license.server.ts` is reachable from client code
 * (league-store.ts imports `verifyLicense` from it to make the RPC call),
 * so anything it imports at the top level has to be safe for the client
 * bundle too — importing a server-only package there breaks the build
 * (TanStack Start's import-protection plugin refuses it outright). Loading
 * this module via dynamic `import()` from inside the two handlers, the same
 * way the rest of this codebase reaches players.server / ranking / weakness,
 * keeps it out of the client graph entirely.
 */

import { getRequestIP } from "@tanstack/react-start/server";

/**
 * Best-effort per-IP rate limit, shared by every path that can trigger a
 * Gumroad lookup (`verifyLicense` directly, `analyzeTeam` via
 * `requireValidLicense`). Before this, both were uncapped: an attacker could
 * script license-key guesses against Gumroad through this app all day, and
 * a real user's Team Analyzer session re-verified on every roster edit with
 * no local throttle at all.
 *
 * This is in-memory and per-instance — it resets on redeploy/cold start and
 * doesn't share state across multiple server instances. That's a real gap
 * under serverless/edge scaling, but it still meaningfully raises the cost
 * of brute-forcing keys or abusing this app as a free Gumroad-request relay
 * from a single source, which is the realistic threat here.
 */
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 8;
const rateLimitState = new Map<string, { count: number; windowStart: number }>();

/** Rate-limits by the caller's IP, resolved from the current request. */
export function isRateLimited(): boolean {
  const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  const now = Date.now();
  const entry = rateLimitState.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitState.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_ATTEMPTS;
}

/**
 * Once a key has verified as valid, trust that for a few minutes instead of
 * round-tripping to Gumroad on every `analyzeTeam` call. The Team Analyzer
 * re-runs this check on every roster edit, config change, and slider tweak
 * (see analyzer.tsx's effect) — without this cache every keystroke-driven
 * update was blocking on an external HTTP call to Gumroad, and a busy
 * session could rack up dozens of lookups per minute for one paying user.
 * A revoked/refunded key can stay accepted for up to this long; for a
 * low-stakes season-pass gate that's an acceptable trade for not hammering
 * a third-party API on every UI interaction.
 */
const VERIFIED_CACHE_TTL_MS = 5 * 60 * 1000;
const verifiedCache = new Map<string, number>();

export function isRecentlyVerified(key: string): boolean {
  const validUntil = verifiedCache.get(key);
  return validUntil !== undefined && validUntil > Date.now();
}

export function rememberVerified(key: string): void {
  verifiedCache.set(key, Date.now() + VERIFIED_CACHE_TTL_MS);
}

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

/** Drop expired buckets so the map can't grow forever on a long-lived server. */
function pruneRateLimitState(): void {
  if (rateLimitState.size < 500) return;
  const now = Date.now();
  for (const [ip, entry] of rateLimitState) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitState.delete(ip);
  }
}

/** Rate-limits by the caller's IP, resolved from the current request. */
export function isRateLimited(): boolean {
  pruneRateLimitState();
  let ip: string;
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  } catch {
    // If the request context isn't available, don't let it break the
    // license check — fall back to a shared bucket.
    ip = "unknown";
  }
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
 * A separate, generous throttle for the free read endpoints
 * (`getRecommendations`, `getWatchlistPlayers`, `searchPlayers`,
 * `getSosHealthStatus`). The license limiter above (8/10min) would break
 * normal browsing — the waiver page alone refetches every 60 seconds. This
 * bucket allows 120 requests/minute per IP: plenty for real use, enough to
 * stop someone scripting this app as a free ESPN/Sleeper proxy.
 */
const READ_WINDOW_MS = 60 * 1000;
const READ_MAX_REQUESTS = 120;
const readLimitState = new Map<string, { count: number; windowStart: number }>();

export function isReadRateLimited(): boolean {
  if (readLimitState.size >= 1000) {
    const now = Date.now();
    for (const [ip, entry] of readLimitState) {
      if (now - entry.windowStart > READ_WINDOW_MS) readLimitState.delete(ip);
    }
  }
  let ip: string;
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  } catch {
    ip = "unknown";
  }
  const now = Date.now();
  const entry = readLimitState.get(ip);
  if (!entry || now - entry.windowStart > READ_WINDOW_MS) {
    readLimitState.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > READ_MAX_REQUESTS;
}
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
  if (validUntil === undefined) return false;
  if (validUntil <= Date.now()) {
    verifiedCache.delete(key);
    return false;
  }
  return true;
}

export function rememberVerified(key: string): void {
  if (verifiedCache.size >= 500) {
    const now = Date.now();
    for (const [k, validUntil] of verifiedCache) {
      if (validUntil <= now) verifiedCache.delete(k);
    }
  }
  verifiedCache.set(key, Date.now() + VERIFIED_CACHE_TTL_MS);
}

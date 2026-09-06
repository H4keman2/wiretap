/**
 * Baseline security response headers.
 *
 * Wire Tap shipped with none of these — every response left clickjacking,
 * MIME-sniffing, and referrer leakage entirely up to the browser's defaults.
 * Applied as request middleware so it covers every response (pages and
 * server functions alike), added once here rather than per-route.
 *
 * The CSP is intentionally not locked down to a strict script-src: the app
 * relies on an inline bootstrap script (theme flash prevention in
 * __root.tsx) and inline `style={{...}}` attributes throughout the UI, so
 * removing 'unsafe-inline' would need a nonce/hash pass and real testing
 * against a production build first. What's below still removes the cheap,
 * safe wins: no framing, no plugin/object embeds, restricted default
 * origins, and no leaking full referrer URLs cross-origin.
 */

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "font-src 'self' https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
].join("; ");

const SECURITY_HEADERS: Array<[string, string]> = [
  ["Content-Security-Policy", CSP],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()"],
];

/**
 * Applies the headers to whatever a request-middleware `next()` resolved
 * to — either a bare Response or `{ response: Response, ... }` depending on
 * handler type. Best-effort: if the response turns out to be immutable for
 * some reason, headers just don't get set rather than breaking the request.
 */
export function applySecurityHeaders<T>(result: T): T {
  try {
    const response =
      result instanceof Response
        ? result
        : ((result as { response?: unknown } | null)?.response ?? null);
    if (response instanceof Response) {
      for (const [key, value] of SECURITY_HEADERS) {
        if (!response.headers.has(key)) response.headers.set(key, value);
      }
    }
  } catch {
    // Setting headers on an already-sent/immutable response is not worth
    // failing the request over.
  }
  return result;
}

/**
 * Every outbound fetch from the data layer must fail fast instead of hanging.
 *
 * A stalled external API used to leave server functions hanging indefinitely
 * (the client shows "waiting for data" forever). Each call is now armed with
 * an AbortController that fires after 10s; the finally block always clears
 * the timer so nothing leaks. Callers keep their existing degradation paths —
 * on AbortError they fall back / retry / throw a clear message as before.
 */

const TIMEOUT_MS = 10000;

export async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

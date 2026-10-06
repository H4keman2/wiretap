/**
 * Server-side license verification against Gumroad's license API.
 *
 * The old client-only check (`/^WT-[A-Z0-9]{4}-[A-Z0-9]{4}$/`) only verified
 * that a string *looked like* a key — it accepted any string matching that
 * shape, and the gated server function never checked it at all. This file
 * replaces that with a real check against Gumroad, and callers must treat
 * the server function as the source of truth (see waivers.functions.ts).
 *
 * Requires GUMROAD_PRODUCT_ID to be set in the environment to the product's
 * permalink or product_id, matching your Gumroad product settings.
 */

import { createServerFn } from "@tanstack/react-start";

const GUMROAD_VERIFY_URL = "https://api.gumroad.com/v2/licenses/verify";

interface GumroadVerifyResponse {
  success: boolean;
  purchase?: {
    refunded?: boolean;
    chargebacked?: boolean;
    subscription_cancelled_at?: string | null;
    subscription_failed_at?: string | null;
  };
  uses?: number;
}

export interface LicenseCheckResult {
  valid: boolean;
  reason?: string;
}

/** Basic shape check so we don't round-trip to Gumroad for obvious junk input. */
function looksLikeKey(key: string): boolean {
  return key.trim().length >= 8;
}

const MAX_DEVICES = 3;

async function verifyAgainstGumroad(
  licenseKey: string,
  incrementUses: boolean,
): Promise<LicenseCheckResult> {
  const productId = process.env["GUMROAD_PRODUCT_ID"];
  if (!productId) {
    // Fail closed: if the server isn't configured, no key can unlock Pro.
    return { valid: false, reason: "License verification is not configured." };
  }

  try {
    const res = await fetch(GUMROAD_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        product_id: productId,
        license_key: licenseKey.trim(),
        increment_uses_count: incrementUses ? "true" : "false",
      }),
    });

    const data = (await res.json()) as GumroadVerifyResponse;

    if (!res.ok || !data.success) {
      return { valid: false, reason: "License key not recognized." };
    }

    const purchase = data.purchase;
    if (purchase?.refunded || purchase?.chargebacked) {
      return { valid: false, reason: "This purchase was refunded or reversed." };
    }
    if (purchase?.subscription_cancelled_at || purchase?.subscription_failed_at) {
      return { valid: false, reason: "This subscription is no longer active." };
    }

    if (typeof data.uses === "number" && data.uses > MAX_DEVICES) {
      return {
        valid: false,
        reason: "This key has already been activated on the maximum of 3 devices.",
      };
    }

    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      reason:
        "Could not reach the license server (" +
        (err instanceof Error ? err.name : "error") +
        ").",
    };
  }
}

/** Public server function the client calls to activate/re-check Pro status. */
export const verifyLicense = createServerFn({ method: "POST" })
  .inputValidator((data: { licenseKey: string }) => data)
  .handler(async ({ data }): Promise<LicenseCheckResult> => {
    let guard: {
      isRateLimited: () => boolean;
      rememberVerified: (k: string) => void;
      isRecentlyVerified: (k: string) => boolean;
    } | null = null;
    try {
      guard = await import("./license-guard.server");
    } catch {
      // Degrade gracefully: no rate limiting or verified-key cache, but the
      // license check itself still runs instead of failing the request.
    }
    if (guard ? guard.isRateLimited() : false) {
      return { valid: false, reason: "Too many attempts. Wait a few minutes and try again." };
    }
    if (!looksLikeKey(data.licenseKey)) {
      return { valid: false, reason: "That key doesn't look right." };
    }
    const result = await verifyAgainstGumroad(data.licenseKey, true);
    if (result.valid) guard?.rememberVerified(data.licenseKey.trim());
    return result;
  });

/**
 * Internal helper for other server functions (e.g. analyzeTeam) to gate
 * on a license without importing createServerFn machinery themselves.
 */
export async function requireValidLicense(licenseKey: string | null | undefined): Promise<void> {
  if (!licenseKey || !looksLikeKey(licenseKey)) {
    throw new Error("PRO_REQUIRED");
  }
  const key = licenseKey.trim();
  let guard: {
    isRateLimited: () => boolean;
    rememberVerified: (k: string) => void;
    isRecentlyVerified: (k: string) => boolean;
  } | null = null;
  try {
    guard = await import("./license-guard.server");
  } catch {
    // Degrade gracefully: skip cache/rate-limit checks rather than blocking Pro.
  }
  if (guard ? guard.isRecentlyVerified(key) : false) return;

  if (guard && guard.isRateLimited()) {
    // A real Pro user re-verifying mid-session should never hit this: the
    // cache above absorbs that traffic. Landing here means either a burst
    // of distinct/invalid keys from one IP, or the cache TTL just lapsed
    // during unusually rapid edits — fail closed either way.
    throw new Error("PRO_REQUIRED");
  }

  const result = await verifyAgainstGumroad(key, false);
  if (!result.valid) {
    throw new Error("PRO_REQUIRED");
  }
  guard?.rememberVerified(key);
}

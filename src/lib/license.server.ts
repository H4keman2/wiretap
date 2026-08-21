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
}

export interface LicenseCheckResult {
  valid: boolean;
  reason?: string;
}

/** Basic shape check so we don't round-trip to Gumroad for obvious junk input. */
function looksLikeKey(key: string): boolean {
  return key.trim().length >= 8;
}

async function verifyAgainstGumroad(licenseKey: string): Promise<LicenseCheckResult> {
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

    return { valid: true };
  } catch {
    return { valid: false, reason: "Could not reach the license server, try again shortly." };
  }
}

/** Public server function the client calls to activate/re-check Pro status. */
export const verifyLicense = createServerFn({ method: "POST" })
  .inputValidator((data: { licenseKey: string }) => data)
  .handler(async ({ data }): Promise<LicenseCheckResult> => {
    if (!looksLikeKey(data.licenseKey)) {
      return { valid: false, reason: "That key doesn't look right." };
    }
    return verifyAgainstGumroad(data.licenseKey);
  });

/**
 * Internal helper for other server functions (e.g. analyzeTeam) to gate
 * on a license without importing createServerFn machinery themselves.
 */
export async function requireValidLicense(licenseKey: string | null | undefined): Promise<void> {
  if (!licenseKey || !looksLikeKey(licenseKey)) {
    throw new Error("PRO_REQUIRED");
  }
  const result = await verifyAgainstGumroad(licenseKey);
  if (!result.valid) {
    throw new Error("PRO_REQUIRED");
  }
}

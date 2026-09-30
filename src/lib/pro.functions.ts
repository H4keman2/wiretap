/**
 * Checkout link for the Team Analyzer season pass.
 *
 * Rendered as a plain static anchor on the /pro page so the buy CTA always
 * shows, even if server functions are unavailable on a visitor's first paint.
 *
 * Note: GUMROAD_PRODUCT_ID (a secret) now holds Gumroad's *API* product id,
 * needed by license.server.ts to verify keys — it does NOT resolve as a
 * gumroad.com/l/<id> checkout link. If the permalink ever changes (e.g. the
 * product is renamed on Gumroad), update GUMROAD_CHECKOUT_URL below —
 * license verification is unaffected because it keeps reading
 * GUMROAD_PRODUCT_ID.
 */
export const GUMROAD_CHECKOUT_URL = "https://gumroad.com/l/mcmnke";

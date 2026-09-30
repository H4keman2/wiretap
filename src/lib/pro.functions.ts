import { createServerFn } from "@tanstack/react-start";

/**
 * Checkout link for the Team Analyzer season pass.
 *
 * GUMROAD_PRODUCT_ID now holds Gumroad's *API* product id (needed by
 * license.server.ts to verify keys against the licenses/verify endpoint),
 * which does not resolve as a gumroad.com/l/<id> checkout link. The buy
 * button therefore uses the product's public permalink directly.
 *
 * If the permalink ever changes (e.g. the product is renamed on Gumroad),
 * update GUMROAD_CHECKOUT_URL below — license verification is unaffected
 * because it keeps reading GUMROAD_PRODUCT_ID.
 */
export const GUMROAD_CHECKOUT_URL = "https://gumroad.com/l/mcmnke";

export interface ProInfo {
  price: string;
  gumroadUrl: string;
  /** Kept for compatibility with callers; the permalink is always valid. */
  urlLikelyValid: boolean;
}

export const getProInfo = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProInfo> => {
    return {
      price: "$4.99",
      gumroadUrl: GUMROAD_CHECKOUT_URL,
      urlLikelyValid: true,
    };
  },
);

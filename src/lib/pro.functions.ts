import { createServerFn } from "@tanstack/react-start";

/**
 * Exposes the Gumroad purchase URL for the Team Analyzer season pass so the
 * sales page can render a real buy button without hardcoding the product
 * permalink in the client bundle. The product id is the same env var
 * license.server.ts uses to verify keys (GUMROAD_PRODUCT_ID), which Gumroad
 * accepts as either a permalink slug or a numeric product id. The purchase
 * link form (gumroad.com/l/<permalink>) only resolves with the permalink,
 * so if the env is set to the numeric id the link won't open a checkout —
 * flag that so the UI can warn instead of sending buyers to a dead page.
 */
export interface ProInfo {
  price: string;
  gumroadUrl: string | null;
  /** False when GUMROAD_PRODUCT_ID looks like a numeric id, not a permalink. */
  urlLikelyValid: boolean;
}

export const getProInfo = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProInfo> => {
    const productId = process.env["GUMROAD_PRODUCT_ID"];
    const looksNumeric = !!productId && /^\d+$/.test(productId.trim());
    return {
      price: "$4.99",
      gumroadUrl: productId
        ? `https://gumroad.com/l/${productId.trim()}`
        : null,
      urlLikelyValid: !!productId && !looksNumeric,
    };
  },
);

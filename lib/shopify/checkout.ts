import "server-only";

import { CHECKOUT_PRODUCT } from "@/lib/checkout";

export type CheckoutProvider = "disabled" | "paypal" | "shopify";

export type ShopifyCheckoutConfig = {
  storeDomain: string;
  variantId: string;
};

const EXPECTED_CHECKOUT_STORE_DOMAIN = "drhrvj-70.myshopify.com";
const LEGACY_COM_DEPOSIT_VARIANT_ID = "51438752923931";

export function getCheckoutProvider(): CheckoutProvider {
  const provider = process.env.CHECKOUT_PROVIDER?.trim().toLowerCase();

  if (provider === "paypal") return "paypal";
  if (provider === "shopify") return "shopify";
  return "disabled";
}

export function getShopifyCheckoutConfig(): ShopifyCheckoutConfig | null {
  const storeDomain = (
    process.env.SHOPIFY_CHECKOUT_STORE_DOMAIN ?? ""
  )
    .trim()
    .toLowerCase();
  const variantId = process.env.SHOPIFY_DEPOSIT_VARIANT_ID?.trim() ?? "";

  if (
    storeDomain !== EXPECTED_CHECKOUT_STORE_DOMAIN ||
    !/^\d{6,30}$/.test(variantId) ||
    variantId === LEGACY_COM_DEPOSIT_VARIANT_ID
  ) {
    return null;
  }

  return { storeDomain, variantId };
}

/**
 * Creates a Shopify cart permalink for the fixed, server-configured deposit
 * variant. Price, quantity and product identity never come from the browser.
 * Shopify creates a fresh cart/checkout when the buyer follows this URL.
 */
export function buildShopifyCheckoutUrl(config: ShopifyCheckoutConfig): string {
  const url = new URL(
    `/cart/${config.variantId}:${CHECKOUT_PRODUCT.quantity}`,
    `https://${config.storeDomain}`,
  );

  url.searchParams.set("attributes[glyde_source]", "glydeclipper.online");
  url.searchParams.set("attributes[glyde_offer]", CHECKOUT_PRODUCT.offerCode);
  url.searchParams.set("attributes[checkout_version]", "shopify-v1");
  url.searchParams.set("ref", "glydeclipper-online");

  return url.toString();
}

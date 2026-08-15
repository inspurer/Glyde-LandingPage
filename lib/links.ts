// The Shopify theme links to these with store-relative paths (`/pages/deposit`,
// `/policies/*`) because Shopify serves them from the same origin. This
// deployment does not, so they have to be absolute back to the storefront.
export const STOREFRONT_ORIGIN = "https://glydeclipper.com";

export const DEPOSIT_URL = `${STOREFRONT_ORIGIN}/pages/deposit`;
export const PRIVACY_POLICY_URL = `${STOREFRONT_ORIGIN}/policies/privacy-policy`;
export const TERMS_OF_SERVICE_URL = `${STOREFRONT_ORIGIN}/policies/terms-of-service`;
export const CONTACT_EMAIL = "timchen@smarthairclipper.com";

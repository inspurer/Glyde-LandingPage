import "server-only";

import { ONLINE_ORIGIN } from "@/lib/links";

export type PayPalEnvironment = "sandbox" | "production";

export type PayPalConfig = {
  environment: PayPalEnvironment;
  clientId: string;
  clientSecret: string;
  webhookId: string;
  merchantId: string;
  checkoutOrigin: string;
  credentialsConfigured: boolean;
  webhookConfigured: boolean;
  checkoutEnabled: boolean;
  newOrdersEnabled: boolean;
};

function cleanSecret(name: string, maxLength = 1_024): string {
  const value = process.env[name]?.trim() ?? "";
  if (!value || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) return "";
  return value;
}

function environment(): PayPalEnvironment {
  const value = process.env.PAYPAL_ENVIRONMENT?.trim().toLowerCase();
  return value === "production" || value === "live" ? "production" : "sandbox";
}

function acceptsNewOrders(environment: PayPalEnvironment): boolean {
  const value = process.env.PAYPAL_ACCEPT_NEW_ORDERS?.trim().toLowerCase();
  if (value === "true" || value === "1" || value === "yes") return true;
  if (value === "false" || value === "0" || value === "no") return false;

  // Keep local/sandbox development convenient, but require an explicit opt-in
  // before a production deployment can create any new PayPal orders.
  return environment === "sandbox";
}

function checkoutOrigin(): string {
  const value = process.env.CHECKOUT_ORIGIN?.trim() || ONLINE_ORIGIN;
  try {
    const url = new URL(value);
    const localDevelopment =
      process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost");

    if (url.pathname === "/" && !url.search && !url.hash && (url.protocol === "https:" || localDevelopment)) {
      return url.origin;
    }
  } catch {
    // A malformed configured origin must never be echoed into a payment URL.
  }
  return ONLINE_ORIGIN;
}

export function getPayPalConfig(): PayPalConfig {
  const paypalEnvironment = environment();
  const clientId = cleanSecret("PAYPAL_CLIENT_ID", 512);
  const clientSecret = cleanSecret("PAYPAL_CLIENT_SECRET", 1_024);
  const webhookId = cleanSecret("PAYPAL_WEBHOOK_ID", 256);
  const merchantId = cleanSecret("PAYPAL_MERCHANT_ID", 256);
  const credentialsConfigured = Boolean(clientId && clientSecret);
  const webhookConfigured = Boolean(webhookId);

  // Sandbox can be exercised before a webhook is created. Live collection is
  // intentionally fail-closed until both webhook verification and merchant
  // identity checks are available.
  const checkoutEnabled =
    credentialsConfigured &&
    (paypalEnvironment === "sandbox" || Boolean(webhookId && merchantId));
  const newOrdersEnabled = checkoutEnabled && acceptsNewOrders(paypalEnvironment);

  return {
    environment: paypalEnvironment,
    clientId,
    clientSecret,
    webhookId,
    merchantId,
    checkoutOrigin: checkoutOrigin(),
    credentialsConfigured,
    webhookConfigured,
    checkoutEnabled,
    newOrdersEnabled,
  };
}

export function requestHasTrustedOrigin(request: Request): boolean {
  const config = getPayPalConfig();
  const origin = request.headers.get("origin");
  if (!origin) return false;

  if (origin === config.checkoutOrigin) return true;

  if (process.env.NODE_ENV !== "production") {
    try {
      const url = new URL(origin);
      return (
        url.protocol === "http:" &&
        (url.hostname === "127.0.0.1" || url.hostname === "localhost")
      );
    } catch {
      return false;
    }
  }

  return false;
}

export function paypalApiOrigin(environment: PayPalEnvironment): string {
  return environment === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { getPayPalConfig } from "@/lib/paypal/config";
import {
  buildShopifyCheckoutUrl,
  getCheckoutProvider,
  getShopifyCheckoutConfig,
} from "@/lib/shopify/checkout";

import { CheckoutClient } from "./CheckoutClient";
import styles from "./checkout.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function ShopifyCheckoutUnavailable() {
  return (
    <main className={styles.statusPage}>
      <section className={styles.statusCard} aria-labelledby="checkout-unavailable-title">
        <h1 id="checkout-unavailable-title">Checkout temporarily unavailable</h1>
        <p>No payment was started. Please return to the reservation page and try again later.</p>
        <div className={styles.statusActions}>
          <Link className={styles.statusPrimary} href="/deposit">
            Return to reservation
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function CheckoutPage() {
  const checkoutProvider = getCheckoutProvider();

  if (checkoutProvider === "shopify") {
    const shopifyConfig = getShopifyCheckoutConfig();

    if (!shopifyConfig) {
      console.error("[shopify] checkout enabled without a valid deposit variant");
      return <ShopifyCheckoutUnavailable />;
    }

    redirect(buildShopifyCheckoutUrl(shopifyConfig));
  }

  if (checkoutProvider === "disabled") {
    console.error("[checkout] unsupported checkout provider");
    return <ShopifyCheckoutUnavailable />;
  }

  const config = getPayPalConfig();

  return (
    <CheckoutClient
      clientId={config.newOrdersEnabled ? config.clientId : null}
      environment={config.environment}
      checkoutEnabled={config.newOrdersEnabled}
      credentialsConfigured={config.credentialsConfigured}
      productionRequirementsConfigured={Boolean(config.webhookId && config.merchantId)}
      newOrdersPaused={config.checkoutEnabled && !config.newOrdersEnabled}
    />
  );
}

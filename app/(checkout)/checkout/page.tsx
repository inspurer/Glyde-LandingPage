import { getPayPalConfig } from "@/lib/paypal/config";

import { CheckoutClient } from "./CheckoutClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default function CheckoutPage() {
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

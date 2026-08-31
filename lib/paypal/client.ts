import "server-only";

import { createHash } from "node:crypto";

import {
  Client,
  Environment,
  OrdersController,
  PaymentsController,
} from "@paypal/paypal-server-sdk";

import { getPayPalConfig } from "./config";

let cached:
  | {
      signature: string;
      orders: OrdersController;
      payments: PaymentsController;
    }
  | undefined;

function getPayPalControllers(): {
  orders: OrdersController;
  payments: PaymentsController;
} {
  const config = getPayPalConfig();
  if (!config.credentialsConfigured) {
    throw new Error("PAYPAL_NOT_CONFIGURED");
  }

  // Include both credentials without retaining either one in the cache key.
  // This makes an in-process credential rotation take effect immediately while
  // keeping the secret out of diagnostics and heap snapshots of this object.
  const signature = createHash("sha256")
    .update(config.environment)
    .update("\0")
    .update(config.clientId)
    .update("\0")
    .update(config.clientSecret)
    .digest("base64url");
  if (cached?.signature === signature) {
    return { orders: cached.orders, payments: cached.payments };
  }

  const client = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: config.clientId,
      oAuthClientSecret: config.clientSecret,
    },
    timeout: 15_000,
    environment:
      config.environment === "production" ? Environment.Production : Environment.Sandbox,
  });

  // No logging configuration is supplied: request and response bodies can
  // carry payer PII and must not be written to application logs.
  cached = {
    signature,
    orders: new OrdersController(client),
    payments: new PaymentsController(client),
  };
  return { orders: cached.orders, payments: cached.payments };
}

export function getPayPalOrdersController(): OrdersController {
  return getPayPalControllers().orders;
}

export function getPayPalPaymentsController(): PaymentsController {
  return getPayPalControllers().payments;
}

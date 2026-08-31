import "server-only";

import {
  CaptureStatus,
  CheckoutPaymentIntent,
  ItemCategory,
  OrderStatus,
  PaypalExperienceLandingPage,
  PaypalExperienceUserAction,
  PaypalWalletContextShippingPreference,
  VenmoWalletExperienceContextShippingPreference,
  VenmoWalletExperienceContextUserAction,
  type CapturedPayment,
  type Order,
  type PaymentSource,
} from "@paypal/paypal-server-sdk";

import { CHECKOUT_PRODUCT } from "@/lib/checkout";
import {
  createPaymentOrder,
  getPaymentOrderByCaptureId,
  getPaymentOrderByPayPalId,
  markPaymentCompleted,
  markPaymentFailure,
  markPaymentOrderCreated,
  markPaymentPending,
  preparePaymentCapture,
  type PaymentOrder,
} from "@/lib/payments";

import { getPayPalOrdersController, getPayPalPaymentsController } from "./client";
import { getPayPalConfig } from "./config";

export type PaymentMethod = "paypal" | "venmo";

export type CheckoutBilling = {
  email: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  countryCode: string;
  paymentMethod: PaymentMethod;
};

export type CheckoutOrderInput =
  | { checkoutMode: "express"; paymentMethod: PaymentMethod }
  | ({ checkoutMode: "form" } & CheckoutBilling);

export type CaptureResult = {
  orderId: string;
  captureId?: string;
  status: "completed" | "pending";
};

export type ValidatedRefundCapture = {
  captureId: string;
  status: "partially_refunded" | "refunded";
  paypalStatus: CaptureStatus;
};

type ValidatedOrder = {
  captureId: string;
  captureStatus: CaptureStatus.Completed | CaptureStatus.Pending;
  paypalStatus: string;
  payerEmail?: string;
  payerId?: string;
};

const REFERENCE_ID = "GLYDE-VIP-RESERVATION";

function invoiceId(order: PaymentOrder): string {
  return `GLYDE-${order.checkoutKey}`;
}

function localOrderIsCurrent(order: PaymentOrder): boolean {
  const config = getPayPalConfig();
  return (
    order.offerCode === CHECKOUT_PRODUCT.offerCode &&
    order.amountMinor === CHECKOUT_PRODUCT.amountMinor &&
    order.currency === CHECKOUT_PRODUCT.currency &&
    order.environment === config.environment
  );
}

function validateOrderContract(order: Order, local: PaymentOrder): boolean {
  if (!localOrderIsCurrent(local) || order.intent !== CheckoutPaymentIntent.Capture) return false;
  if (!order.purchaseUnits || order.purchaseUnits.length !== 1) return false;

  const config = getPayPalConfig();
  const unit = order.purchaseUnits[0];
  return (
    unit.referenceId === REFERENCE_ID &&
    unit.customId === local.checkoutKey &&
    unit.invoiceId === invoiceId(local) &&
    unit.amount?.currencyCode === CHECKOUT_PRODUCT.currency &&
    unit.amount.value === CHECKOUT_PRODUCT.amount &&
    (!config.merchantId || unit.payee?.merchantId === config.merchantId)
  );
}

function validateCreatedOrder(order: Order, local: PaymentOrder): boolean {
  return Boolean(
    order.id &&
      (order.status === OrderStatus.Created || order.status === OrderStatus.PayerActionRequired) &&
      validateOrderContract(order, local),
  );
}

function validatePayPalOrder(order: Order): ValidatedOrder | null {
  if (!order.id) return null;
  const local = getPaymentOrderByPayPalId(order.id);
  if (!local || !validateOrderContract(order, local)) return null;

  const captures = order.purchaseUnits?.[0].payments?.captures ?? [];
  const capture = captures.find(
    (candidate) =>
      candidate.status === CaptureStatus.Completed || candidate.status === CaptureStatus.Pending,
  );
  if (
    !capture?.id ||
    !capture.amount ||
    (local.paypalCaptureId && local.paypalCaptureId !== capture.id) ||
    capture.customId !== local.checkoutKey ||
    capture.invoiceId !== invoiceId(local) ||
    capture.amount.currencyCode !== CHECKOUT_PRODUCT.currency ||
    capture.amount.value !== CHECKOUT_PRODUCT.amount
  ) {
    return null;
  }
  if (
    capture.status !== CaptureStatus.Completed &&
    capture.status !== CaptureStatus.Pending
  ) {
    return null;
  }
  if (capture.status === CaptureStatus.Completed && order.status !== OrderStatus.Completed) {
    return null;
  }

  return {
    captureId: capture.id,
    captureStatus: capture.status,
    paypalStatus: order.status ?? capture.status,
    payerEmail:
      order.paymentSource?.paypal?.emailAddress ??
      order.paymentSource?.venmo?.emailAddress ??
      order.payer?.emailAddress,
    payerId:
      order.paymentSource?.paypal?.accountId ??
      order.paymentSource?.venmo?.accountId ??
      order.payer?.payerId,
  };
}

function applyValidatedOrder(order: Order): CaptureResult {
  const validated = validatePayPalOrder(order);
  if (!order.id || !validated) throw new Error("PAYPAL_ORDER_VALIDATION_FAILED");

  if (validated.captureStatus === CaptureStatus.Completed) {
    const applied = markPaymentCompleted({
      paypalOrderId: order.id,
      paypalCaptureId: validated.captureId,
      paypalStatus: validated.paypalStatus,
      payerEmail: validated.payerEmail,
      payerId: validated.payerId,
    });
    if (!applied) throw new Error("PAYPAL_TERMINAL_STATE_CONFLICT");
    return { orderId: order.id, captureId: validated.captureId, status: "completed" };
  }

  const applied = markPaymentPending({
    paypalOrderId: order.id,
    paypalCaptureId: validated.captureId,
    paypalStatus: validated.captureStatus,
  });
  if (!applied) throw new Error("PAYPAL_TERMINAL_STATE_CONFLICT");
  return { orderId: order.id, captureId: validated.captureId, status: "pending" };
}

function paymentSource(input: CheckoutOrderInput): PaymentSource {
  if (input.paymentMethod === "venmo") {
    return {
      venmo: {
        ...(input.checkoutMode === "form" ? { emailAddress: input.email } : {}),
        experienceContext: {
          brandName: "GLYDE",
          shippingPreference: VenmoWalletExperienceContextShippingPreference.NoShipping,
          userAction: VenmoWalletExperienceContextUserAction.PayNow,
        },
      },
    };
  }

  return {
    paypal: {
      ...(input.checkoutMode === "form"
        ? {
            emailAddress: input.email,
            name: { givenName: input.firstName, surname: input.lastName },
            address: {
              addressLine1: input.addressLine1,
              ...(input.addressLine2 ? { addressLine2: input.addressLine2 } : {}),
              adminArea2: input.city,
              ...(input.state ? { adminArea1: input.state } : {}),
              postalCode: input.postalCode,
              countryCode: input.countryCode,
            },
          }
        : {}),
      experienceContext: {
        brandName: "GLYDE",
        locale: "en-US",
        landingPage: PaypalExperienceLandingPage.NoPreference,
        shippingPreference: PaypalWalletContextShippingPreference.NoShipping,
        userAction: PaypalExperienceUserAction.PayNow,
        returnUrl: `${getPayPalConfig().checkoutOrigin}/checkout/return`,
        cancelUrl: `${getPayPalConfig().checkoutOrigin}/checkout/cancelled`,
      },
    },
  };
}

export async function createPayPalOrder(input: CheckoutOrderInput): Promise<{ orderId: string }> {
  const config = getPayPalConfig();
  if (!config.checkoutEnabled) throw new Error("PAYPAL_NOT_CONFIGURED");
  if (!config.newOrdersEnabled) throw new Error("PAYPAL_NEW_ORDERS_PAUSED");

  const localOrder = createPaymentOrder(
    input.checkoutMode === "form" ? input.email : "",
    config.environment,
  );

  try {
    const response = await getPayPalOrdersController().createOrder({
      paypalRequestId: localOrder.createRequestId,
      prefer: "return=representation",
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          {
            referenceId: REFERENCE_ID,
            customId: localOrder.checkoutKey,
            invoiceId: invoiceId(localOrder),
            description: CHECKOUT_PRODUCT.description,
            amount: {
              currencyCode: CHECKOUT_PRODUCT.currency,
              value: CHECKOUT_PRODUCT.amount,
              breakdown: {
                itemTotal: {
                  currencyCode: CHECKOUT_PRODUCT.currency,
                  value: CHECKOUT_PRODUCT.amount,
                },
              },
            },
            items: [
              {
                name: CHECKOUT_PRODUCT.shortName,
                description: CHECKOUT_PRODUCT.description,
                sku: CHECKOUT_PRODUCT.sku,
                category: ItemCategory.DigitalGoods,
                quantity: String(CHECKOUT_PRODUCT.quantity),
                unitAmount: {
                  currencyCode: CHECKOUT_PRODUCT.currency,
                  value: CHECKOUT_PRODUCT.amount,
                },
                url: `${config.checkoutOrigin}/deposit`,
                imageUrl: `${config.checkoutOrigin}/assets/checkout-product.png`,
              },
            ],
          },
        ],
        paymentSource: paymentSource(input),
      },
    });

    let order = response.result;
    if (order.id && !validateCreatedOrder(order, localOrder)) {
      order = (await getPayPalOrdersController().getOrder({ id: order.id })).result;
    }
    if (!validateCreatedOrder(order, localOrder) || !order.id || !order.status) {
      throw new Error("PAYPAL_CREATE_CONTRACT_MISMATCH");
    }

    markPaymentOrderCreated(localOrder.id, order.id, order.status);
    return { orderId: order.id };
  } catch (error) {
    markPaymentFailure(localOrder.id, "create_failed");
    throw error;
  }
}

export async function capturePayPalOrder(paypalOrderId: string): Promise<CaptureResult> {
  const config = getPayPalConfig();
  if (!config.checkoutEnabled) throw new Error("PAYPAL_NOT_CONFIGURED");

  const knownOrder = getPaymentOrderByPayPalId(paypalOrderId);
  if (!knownOrder) throw new Error("PAYPAL_ORDER_NOT_FOUND");
  if (knownOrder.environment !== config.environment) {
    throw new Error("PAYPAL_ENVIRONMENT_MISMATCH");
  }

  const existing = preparePaymentCapture(paypalOrderId);
  if (!existing) throw new Error("PAYPAL_ORDER_NOT_FOUND");

  if (existing.status === "completed" && existing.paypalCaptureId) {
    return { orderId: paypalOrderId, captureId: existing.paypalCaptureId, status: "completed" };
  }
  if (["refunded", "partially_refunded", "reversed", "cancelled"].includes(existing.status)) {
    throw new Error("PAYPAL_ORDER_FINALIZED");
  }
  if (!existing.captureRequestId) throw new Error("CAPTURE_IDEMPOTENCY_KEY_MISSING");

  try {
    const response = await getPayPalOrdersController().captureOrder({
      id: paypalOrderId,
      paypalRequestId: existing.captureRequestId,
      prefer: "return=representation",
    });
    return applyValidatedOrder(response.result);
  } catch (error) {
    try {
      const current = await getPayPalOrdersController().getOrder({ id: paypalOrderId });
      const validated = validatePayPalOrder(current.result);
      if (validated) return applyValidatedOrder(current.result);
    } catch {
      // Preserve the original capture error; this lookup is best-effort
      // reconciliation for an ambiguous network timeout.
    }

    markPaymentFailure(existing.id, "capture_failed");
    throw error;
  }
}

export async function reconcilePayPalOrder(paypalOrderId: string): Promise<CaptureResult | null> {
  if (!getPaymentOrderByPayPalId(paypalOrderId)) return null;
  const response = await getPayPalOrdersController().getOrder({ id: paypalOrderId });
  const validated = validatePayPalOrder(response.result);
  return validated ? applyValidatedOrder(response.result) : null;
}

function validateCapturedPayment(
  capture: CapturedPayment,
  local: PaymentOrder,
): ValidatedRefundCapture | null {
  const config = getPayPalConfig();
  if (
    !localOrderIsCurrent(local) ||
    capture.id !== local.paypalCaptureId ||
    capture.customId !== local.checkoutKey ||
    capture.invoiceId !== invoiceId(local) ||
    capture.amount?.currencyCode !== CHECKOUT_PRODUCT.currency ||
    capture.amount.value !== CHECKOUT_PRODUCT.amount ||
    (config.merchantId && capture.payee?.merchantId !== config.merchantId) ||
    (capture.supplementaryData?.relatedIds?.orderId &&
      capture.supplementaryData.relatedIds.orderId !== local.paypalOrderId)
  ) {
    return null;
  }

  if (capture.status === CaptureStatus.PartiallyRefunded) {
    return {
      captureId: capture.id,
      status: "partially_refunded",
      paypalStatus: capture.status,
    };
  }
  if (capture.status === CaptureStatus.Refunded) {
    return { captureId: capture.id, status: "refunded", paypalStatus: capture.status };
  }
  return null;
}

export async function getValidatedRefundCapture(
  paypalCaptureId: string,
): Promise<ValidatedRefundCapture | null> {
  const local = getPaymentOrderByCaptureId(paypalCaptureId);
  if (!local) return null;
  const response = await getPayPalPaymentsController().getCapturedPayment({
    captureId: paypalCaptureId,
  });
  return validateCapturedPayment(response.result, local);
}

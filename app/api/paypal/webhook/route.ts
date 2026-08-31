import { NextResponse } from "next/server";

import {
  finishWebhookEvent,
  getPaymentOrderByCaptureId,
  getPaymentOrderByPayPalId,
  markPaymentStateByCaptureId,
  markPaymentStateByOrderId,
  recordPaymentRefund,
  reserveWebhookEvent,
} from "@/lib/payments";
import { getPayPalConfig } from "@/lib/paypal/config";
import {
  capturePayPalOrder,
  getValidatedRefundCapture,
  reconcilePayPalOrder,
} from "@/lib/paypal/orders";
import { paymentRateLimited } from "@/lib/paypal/request";
import { verifyPayPalWebhook } from "@/lib/paypal/webhook";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 262_144;
const MAX_CONCURRENT_WEBHOOKS = 16;
const HEADERS = { "Cache-Control": "no-store, max-age=0" };
let webhookInFlight = 0;

type WebhookEvent = {
  id: string;
  event_type: string;
  resource?: Record<string, unknown>;
};

function response(body: Record<string, unknown>, status: number, retryAfter?: string) {
  return NextResponse.json(body, {
    status,
    headers: { ...HEADERS, ...(retryAfter ? { "Retry-After": retryAfter } : {}) },
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function string(value: unknown, max = 200): string | null {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= max &&
    !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null;
}

function relatedId(resource: Record<string, unknown>, key: string): string | null {
  const supplementary = asRecord(resource.supplementary_data);
  const related = asRecord(supplementary?.related_ids);
  return string(related?.[key]);
}

function refundAmountMinor(resource: Record<string, unknown>): number | null {
  const amount = asRecord(resource.amount);
  if (amount?.currency_code !== "USD" || typeof amount.value !== "string") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount.value);
  if (!match || match[1].length > 3) return null;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor > 0 && minor <= 300 ? minor : null;
}

async function applyEvent(event: WebhookEvent): Promise<string> {
  const resource = event.resource ?? {};
  const resourceId = string(resource.id);

  if (event.event_type === "CHECKOUT.ORDER.APPROVED" && resourceId) {
    if (!getPaymentOrderByPayPalId(resourceId)) return "unmatched";
    await capturePayPalOrder(resourceId);
    return "processed";
  }

  if (event.event_type === "CHECKOUT.PAYMENT-APPROVAL.REVERSED") {
    const orderId = string(resource.order_id);
    if (!orderId || !getPaymentOrderByPayPalId(orderId)) return "unmatched";
    markPaymentStateByOrderId(orderId, "reversed", "PAYMENT_APPROVAL_REVERSED");
    return "processed";
  }

  if (
    event.event_type === "CHECKOUT.ORDER.COMPLETED" ||
    event.event_type === "PAYMENT.CAPTURE.COMPLETED" ||
    event.event_type === "PAYMENT.CAPTURE.PENDING"
  ) {
    const orderId = event.event_type.startsWith("CHECKOUT.ORDER.")
      ? resourceId
      : relatedId(resource, "order_id");
    if (!orderId) return "ignored";
    const local = getPaymentOrderByPayPalId(orderId);
    if (!local) return "unmatched";
    if (["refunded", "partially_refunded", "reversed"].includes(local.status)) {
      return "processed";
    }
    if (!(await reconcilePayPalOrder(orderId))) {
      throw new Error("PAYPAL_ORDER_RECONCILIATION_FAILED");
    }
    return "processed";
  }

  if (event.event_type === "PAYMENT.CAPTURE.REFUNDED") {
    const captureId = relatedId(resource, "capture_id");
    const refundId = resourceId;
    const amountMinor = refundAmountMinor(resource);
    if (!captureId || !refundId || !amountMinor) {
      throw new Error("PAYPAL_REFUND_EVENT_INVALID");
    }
    const capture = await getValidatedRefundCapture(captureId);
    if (!capture) throw new Error("PAYPAL_REFUND_RECONCILIATION_FAILED");
    if (
      !recordPaymentRefund({
        eventId: event.id,
        refundId,
        paypalCaptureId: captureId,
        refundAmountMinor: amountMinor,
        currency: "USD",
        captureStatus: capture.status,
        paypalStatus: capture.paypalStatus,
      })
    ) {
      return "unmatched";
    }
    return "processed";
  }

  if (
    event.event_type === "PAYMENT.CAPTURE.REVERSED" ||
    event.event_type === "PAYMENT.CAPTURE.DENIED" ||
    event.event_type === "PAYMENT.CAPTURE.DECLINED"
  ) {
    const captureId = resourceId;
    const orderId = relatedId(resource, "order_id");
    const status = event.event_type === "PAYMENT.CAPTURE.REVERSED" ? "reversed" : "failed";
    if (captureId && getPaymentOrderByCaptureId(captureId)) {
      markPaymentStateByCaptureId(captureId, status, event.event_type);
      return "processed";
    }
    if (orderId && getPaymentOrderByPayPalId(orderId)) {
      markPaymentStateByOrderId(orderId, status, event.event_type);
      return "processed";
    }
    return "unmatched";
  }

  return "ignored";
}

export async function POST(request: Request) {
  const config = getPayPalConfig();
  if (!config.credentialsConfigured || !config.webhookConfigured) {
    return response({ ok: false, code: "webhook_not_configured" }, 503);
  }
  if (paymentRateLimited(request, 120)) {
    return response({ ok: false, code: "rate_limited" }, 429, "30");
  }
  if (webhookInFlight >= MAX_CONCURRENT_WEBHOOKS) {
    return response({ ok: false, code: "webhook_busy" }, 503, "5");
  }

  webhookInFlight += 1;
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BYTES) {
      return response({ ok: false, code: "payload_too_large" }, 413);
    }

    let rawBody: string;
    let payload: unknown;
    try {
      rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BYTES) {
        return response({ ok: false, code: "payload_too_large" }, 413);
      }
      payload = JSON.parse(rawBody);
    } catch {
      return response({ ok: false, code: "invalid_payload" }, 400);
    }

    const record = asRecord(payload);
    const id = string(record?.id);
    const eventType = string(record?.event_type, 120);
    if (!record || !id || !eventType) {
      return response({ ok: false, code: "invalid_event" }, 400);
    }

    try {
      if (!(await verifyPayPalWebhook(request, rawBody))) {
        return response({ ok: false, code: "invalid_signature" }, 401);
      }
    } catch (error) {
      console.error("[paypal] webhook verification unavailable", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return response({ ok: false, code: "verification_unavailable" }, 503, "30");
    }

    const resource = asRecord(record.resource) ?? undefined;
    const reservation = reserveWebhookEvent(id, eventType, string(resource?.id) ?? undefined);
    if (reservation === "completed") {
      return response({ ok: true, duplicate: true }, 200);
    }
    if (reservation === "busy") {
      return response({ ok: false, code: "event_in_progress" }, 503, "10");
    }

    try {
      const processingStatus = await applyEvent({ id, event_type: eventType, resource });
      finishWebhookEvent(id, processingStatus);
      return response({ ok: true }, 200);
    } catch (error) {
      finishWebhookEvent(id, "processing_failed");
      console.error("[paypal] webhook processing failed", {
        eventType,
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return response({ ok: false, code: "processing_failed" }, 500, "30");
    }
  } finally {
    webhookInFlight -= 1;
  }
}

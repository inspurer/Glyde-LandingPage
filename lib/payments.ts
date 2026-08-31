import "server-only";

import { randomUUID } from "node:crypto";

import { CHECKOUT_PRODUCT } from "./checkout";
import { getDatabase } from "./db";

export type PaymentStatus =
  | "creating"
  | "created"
  | "approved"
  | "capture_pending"
  | "completed"
  | "cancelled"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "reversed";

export type PaymentOrder = {
  id: number;
  checkoutKey: string;
  offerCode: string;
  amountMinor: number;
  refundedMinor: number;
  currency: string;
  contactEmail: string;
  paypalOrderId: string | null;
  paypalCaptureId: string | null;
  createRequestId: string;
  captureRequestId: string | null;
  status: PaymentStatus;
  paypalStatus: string | null;
  payerEmail: string | null;
  payerId: string | null;
  environment: string;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
  capturedAt: string | null;
};

type PaymentOrderRow = {
  id: number;
  checkout_key: string;
  offer_code: string;
  amount_minor: number;
  refunded_minor: number;
  currency: string;
  contact_email: string;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  create_request_id: string;
  capture_request_id: string | null;
  status: PaymentStatus;
  paypal_status: string | null;
  payer_email: string | null;
  payer_id: string | null;
  environment: string;
  failure_code: string | null;
  created_at: string;
  updated_at: string;
  captured_at: string | null;
};

function mapOrder(row: PaymentOrderRow): PaymentOrder {
  return {
    id: Number(row.id),
    checkoutKey: row.checkout_key,
    offerCode: row.offer_code,
    amountMinor: Number(row.amount_minor),
    refundedMinor: Number(row.refunded_minor),
    currency: row.currency,
    contactEmail: row.contact_email,
    paypalOrderId: row.paypal_order_id,
    paypalCaptureId: row.paypal_capture_id,
    createRequestId: row.create_request_id,
    captureRequestId: row.capture_request_id,
    status: row.status,
    paypalStatus: row.paypal_status,
    payerEmail: row.payer_email,
    payerId: row.payer_id,
    environment: row.environment,
    failureCode: row.failure_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    capturedAt: row.captured_at,
  };
}

export function createPaymentOrder(contactEmail: string, environment: string): PaymentOrder {
  const db = getDatabase();
  const checkoutKey = randomUUID();
  const createRequestId = randomUUID();

  const result = db
    .prepare(
      `INSERT INTO payment_orders
         (checkout_key, offer_code, amount_minor, currency, contact_email,
          create_request_id, environment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      checkoutKey,
      CHECKOUT_PRODUCT.offerCode,
      CHECKOUT_PRODUCT.amountMinor,
      CHECKOUT_PRODUCT.currency,
      contactEmail,
      createRequestId,
      environment,
    );

  return getPaymentOrderById(Number(result.lastInsertRowid))!;
}

function getPaymentOrderById(id: number): PaymentOrder | null {
  const row = getDatabase().prepare("SELECT * FROM payment_orders WHERE id = ?").get(id) as
    | PaymentOrderRow
    | undefined;
  return row ? mapOrder(row) : null;
}

export function getPaymentOrderByPayPalId(paypalOrderId: string): PaymentOrder | null {
  const row = getDatabase()
    .prepare("SELECT * FROM payment_orders WHERE paypal_order_id = ?")
    .get(paypalOrderId) as PaymentOrderRow | undefined;
  return row ? mapOrder(row) : null;
}

export function getPaymentOrderByCaptureId(paypalCaptureId: string): PaymentOrder | null {
  const row = getDatabase()
    .prepare("SELECT * FROM payment_orders WHERE paypal_capture_id = ?")
    .get(paypalCaptureId) as PaymentOrderRow | undefined;
  return row ? mapOrder(row) : null;
}

export function markPaymentOrderCreated(
  id: number,
  paypalOrderId: string,
  paypalStatus: string,
): void {
  getDatabase()
    .prepare(
      `UPDATE payment_orders
       SET paypal_order_id = ?, status = 'created', paypal_status = ?,
           failure_code = NULL, updated_at = datetime('now')
       WHERE id = ? AND status = 'creating'`,
    )
    .run(paypalOrderId, paypalStatus, id);
}

export function markPaymentFailure(
  id: number,
  failureCode: string,
  paypalStatus?: string,
): void {
  getDatabase()
    .prepare(
      `UPDATE payment_orders
       SET status = 'failed', failure_code = ?, paypal_status = COALESCE(?, paypal_status),
           updated_at = datetime('now')
       WHERE id = ?
         AND status IN ('creating', 'created', 'approved', 'capture_pending', 'failed')`,
    )
    .run(failureCode.slice(0, 80), paypalStatus ?? null, id);
}

/**
 * Returns a stable PayPal-Request-Id for capture. Concurrent retries can both
 * reach PayPal, but they use the same key and therefore cannot double-charge.
 */
export function preparePaymentCapture(paypalOrderId: string): PaymentOrder | null {
  const db = getDatabase();
  const existing = getPaymentOrderByPayPalId(paypalOrderId);
  if (
    !existing ||
    ["completed", "cancelled", "refunded", "partially_refunded", "reversed"].includes(
      existing.status,
    )
  ) {
    return existing;
  }

  const captureRequestId = existing.captureRequestId ?? randomUUID();
  db.prepare(
    `UPDATE payment_orders
     SET capture_request_id = COALESCE(capture_request_id, ?),
         status = 'capture_pending', failure_code = NULL,
         updated_at = datetime('now')
     WHERE paypal_order_id = ?
       AND status IN ('created', 'approved', 'capture_pending', 'failed')`,
  ).run(captureRequestId, paypalOrderId);

  return getPaymentOrderByPayPalId(paypalOrderId);
}

export function markPaymentCompleted(input: {
  paypalOrderId: string;
  paypalCaptureId: string;
  paypalStatus: string;
  payerEmail?: string;
  payerId?: string;
}): boolean {
  const result = getDatabase()
    .prepare(
      `UPDATE payment_orders
       SET paypal_capture_id = COALESCE(paypal_capture_id, ?),
           status = 'completed', paypal_status = ?,
           payer_email = COALESCE(?, payer_email),
           payer_id = COALESCE(?, payer_id),
           contact_email = CASE
             WHEN contact_email = '' AND ? IS NOT NULL THEN ?
             ELSE contact_email
           END,
           failure_code = NULL,
           captured_at = COALESCE(captured_at, datetime('now')),
           updated_at = datetime('now')
       WHERE paypal_order_id = ?
         AND status IN ('created', 'approved', 'capture_pending', 'failed', 'cancelled', 'completed')`,
    )
    .run(
      input.paypalCaptureId,
      input.paypalStatus,
      input.payerEmail ?? null,
      input.payerId ?? null,
      input.payerEmail ?? null,
      input.payerEmail ?? null,
      input.paypalOrderId,
    );
  return Number(result.changes) === 1;
}

export function markPaymentPending(input: {
  paypalOrderId: string;
  paypalCaptureId?: string;
  paypalStatus: string;
}): boolean {
  const result = getDatabase()
    .prepare(
      `UPDATE payment_orders
       SET paypal_capture_id = COALESCE(?, paypal_capture_id),
           status = 'capture_pending', paypal_status = ?,
           failure_code = NULL, updated_at = datetime('now')
       WHERE paypal_order_id = ?
         AND status IN ('created', 'approved', 'capture_pending', 'failed')`,
    )
    .run(input.paypalCaptureId ?? null, input.paypalStatus, input.paypalOrderId);
  return Number(result.changes) === 1;
}

export function markPaymentStateByOrderId(
  paypalOrderId: string,
  status: PaymentStatus,
  paypalStatus: string,
): void {
  const allowedCurrentStatuses: Partial<Record<PaymentStatus, readonly PaymentStatus[]>> = {
    approved: ["created", "approved"],
    cancelled: ["created", "approved"],
    failed: ["creating", "created", "approved", "capture_pending", "failed"],
    reversed: ["created", "approved", "capture_pending", "failed", "reversed"],
  };
  const allowed = allowedCurrentStatuses[status];
  if (!allowed) throw new Error("UNSAFE_PAYMENT_STATE_TRANSITION");

  const placeholders = allowed.map(() => "?").join(", ");
  getDatabase()
    .prepare(
      `UPDATE payment_orders
       SET status = ?, paypal_status = ?, updated_at = datetime('now')
       WHERE paypal_order_id = ?
         AND status IN (${placeholders})`,
    )
    .run(status, paypalStatus, paypalOrderId, ...allowed);
}

export function markPaymentStateByCaptureId(
  paypalCaptureId: string,
  status: PaymentStatus,
  paypalStatus: string,
): void {
  const allowedCurrentStatuses: Partial<Record<PaymentStatus, readonly PaymentStatus[]>> = {
    failed: ["created", "approved", "capture_pending", "failed"],
    reversed: ["completed", "capture_pending", "reversed"],
  };
  const allowed = allowedCurrentStatuses[status];
  if (!allowed) throw new Error("UNSAFE_PAYMENT_STATE_TRANSITION");

  const placeholders = allowed.map(() => "?").join(", ");
  getDatabase()
    .prepare(
      `UPDATE payment_orders
       SET status = ?, paypal_status = ?, updated_at = datetime('now')
       WHERE paypal_capture_id = ? AND status IN (${placeholders})`,
    )
    .run(status, paypalStatus, paypalCaptureId, ...allowed);
}

export function expireStaleCreatedPaymentOrders(): void {
  getDatabase()
    .prepare(
      `UPDATE payment_orders
       SET status = 'cancelled', paypal_status = 'LOCAL_APPROVAL_WINDOW_EXPIRED',
           updated_at = datetime('now')
       WHERE status = 'created' AND created_at < datetime('now', '-24 hours')`,
    )
    .run();
}

/**
 * Records one verified PayPal refund exactly once and derives the local state
 * from the authoritative capture status returned by PayPal.
 */
export function recordPaymentRefund(input: {
  eventId: string;
  refundId: string;
  paypalCaptureId: string;
  refundAmountMinor: number;
  currency: string;
  captureStatus: "partially_refunded" | "refunded";
  paypalStatus: string;
}): boolean {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    const order = db
      .prepare("SELECT * FROM payment_orders WHERE paypal_capture_id = ?")
      .get(input.paypalCaptureId) as PaymentOrderRow | undefined;
    if (
      !order ||
      order.currency !== input.currency ||
      input.currency !== CHECKOUT_PRODUCT.currency ||
      !Number.isInteger(input.refundAmountMinor) ||
      input.refundAmountMinor <= 0 ||
      input.refundAmountMinor > order.amount_minor
    ) {
      db.exec("ROLLBACK");
      return false;
    }

    db.prepare(
      `INSERT OR IGNORE INTO paypal_refund_ledger
         (event_id, refund_id, paypal_capture_id, amount_minor, currency)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      input.eventId,
      input.refundId,
      input.paypalCaptureId,
      input.refundAmountMinor,
      input.currency,
    );

    const knownRefunded = Number(
      (
        db
          .prepare(
            "SELECT COALESCE(SUM(amount_minor), 0) AS total FROM paypal_refund_ledger WHERE paypal_capture_id = ?",
          )
          .get(input.paypalCaptureId) as { total: number }
      ).total,
    );
    if (knownRefunded > order.amount_minor) {
      throw new Error("REFUND_TOTAL_EXCEEDS_CAPTURE");
    }

    const refundedMinor =
      input.captureStatus === "refunded" ? order.amount_minor : knownRefunded;
    if (input.captureStatus === "partially_refunded" && refundedMinor >= order.amount_minor) {
      throw new Error("PARTIAL_REFUND_TOTAL_INVALID");
    }

    db.prepare(
      `UPDATE payment_orders
       SET status = ?, paypal_status = ?, refunded_minor = ?,
           failure_code = NULL, updated_at = datetime('now')
       WHERE paypal_capture_id = ?
         AND status NOT IN ('reversed')`,
    ).run(
      input.captureStatus,
      input.paypalStatus,
      refundedMinor,
      input.paypalCaptureId,
    );
    db.exec("COMMIT");
    return true;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Preserve the original ledger error.
    }
    throw error;
  }
}

export type WebhookReservation = "claimed" | "completed" | "busy";

export function reserveWebhookEvent(
  eventId: string,
  eventType: string,
  resourceId?: string,
): WebhookReservation {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO paypal_webhook_events
         (event_id, event_type, resource_id, processing_status)
       VALUES (?, ?, ?, 'processing')`,
    )
    .run(eventId, eventType, resourceId ?? null);
  if (Number(result.changes) === 1) return "claimed";

  const existing = db
    .prepare(
      "SELECT processing_status, received_at FROM paypal_webhook_events WHERE event_id = ?",
    )
    .get(eventId) as { processing_status: string; received_at: string } | undefined;
  if (!existing) return "busy";
  if (["processed", "ignored", "unmatched"].includes(existing.processing_status)) {
    return "completed";
  }

  // A failed attempt is immediately retryable. A worker that vanished while
  // holding `processing` can be reclaimed after a five-minute lease instead of
  // causing every future PayPal retry to be acknowledged and discarded.
  const claimed = db
    .prepare(
      `UPDATE paypal_webhook_events
       SET processing_status = 'processing', received_at = datetime('now'), processed_at = NULL
       WHERE event_id = ?
         AND (
           processing_status IN ('processing_failed', 'received')
           OR (
             processing_status = 'processing'
             AND received_at <= datetime('now', '-5 minutes')
           )
         )`,
    )
    .run(eventId);
  return Number(claimed.changes) === 1 ? "claimed" : "busy";
}

export function finishWebhookEvent(eventId: string, processingStatus: string): void {
  getDatabase()
    .prepare(
      `UPDATE paypal_webhook_events
       SET processing_status = ?, processed_at = datetime('now')
       WHERE event_id = ? AND processing_status = 'processing'`,
    )
    .run(processingStatus.slice(0, 40), eventId);
}

export function listPaymentOrders(
  requestedPage: number,
  pageSize: number,
): { rows: PaymentOrder[]; total: number; page: number; pageCount: number } {
  expireStaleCreatedPaymentOrders();
  const db = getDatabase();
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));
  const total = Number(
    (db.prepare("SELECT COUNT(*) AS total FROM payment_orders").get() as { total: number }).total,
  );
  const pageCount = Math.max(1, Math.ceil(total / safePageSize));
  const page = Math.min(pageCount, Math.max(1, Math.trunc(requestedPage) || 1));
  const rows = db
    .prepare("SELECT * FROM payment_orders ORDER BY id DESC LIMIT ? OFFSET ?")
    .all(safePageSize, (page - 1) * safePageSize) as PaymentOrderRow[];

  return { rows: rows.map(mapOrder), total, page, pageCount };
}

export function getPaymentTotals(): {
  completed: number;
  pending: number;
  refunded: number;
  amountMinor: number;
} {
  expireStaleCreatedPaymentOrders();
  const row = getDatabase()
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status IN ('created', 'approved', 'capture_pending') THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status IN ('refunded', 'partially_refunded', 'reversed') THEN 1 ELSE 0 END) AS refunded,
         SUM(
           CASE
             WHEN status IN ('completed', 'partially_refunded')
               THEN amount_minor - refunded_minor
             ELSE 0
           END
         ) AS amount_minor
       FROM payment_orders`,
    )
    .get() as {
    completed: number | null;
    pending: number | null;
    refunded: number | null;
    amount_minor: number | null;
  };

  return {
    completed: Number(row.completed) || 0,
    pending: Number(row.pending) || 0,
    refunded: Number(row.refunded) || 0,
    amountMinor: Number(row.amount_minor) || 0,
  };
}

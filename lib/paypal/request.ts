import "server-only";

import type { CheckoutBilling } from "./orders";

export type CheckoutOrderInput =
  | {
      checkoutMode: "express";
      paymentMethod: CheckoutBilling["paymentMethod"];
    }
  | (CheckoutBilling & {
      checkoutMode: "form";
    });

const MAX_BODY_BYTES = 8_192;
const EMAIL_PATTERN = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

const buckets = new Map<string, { count: number; resetAt: number }>();

export function paymentRateLimited(request: Request, limit: number, windowMs = 60_000): boolean {
  const forwarded = request.headers.get("x-forwarded-for");
  const key = forwarded?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const bucketKey = `${key}:${limit}`;
  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5_000) {
      for (const [candidate, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(candidate);
      }
    }
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
}

export async function readSmallJson(request: Request): Promise<unknown | null> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return null;

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function field(value: unknown, max: number, required = true): string | null {
  if (typeof value !== "string") return required ? null : "";
  const normalized = value.trim().replace(/\s+/g, " ");
  if ((required && !normalized) || normalized.length > max) return null;
  if (/[\u0000-\u001f\u007f]/.test(normalized)) return null;
  return normalized;
}

function email(value: unknown): string | null {
  const normalized = field(value, 254);
  if (!normalized || !EMAIL_PATTERN.test(normalized)) return null;
  const at = normalized.lastIndexOf("@");
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1).toLowerCase();
  if (local.length > 64 || domain.length > 253 || local.includes("..")) return null;
  return `${local}@${domain}`;
}

function paymentMethod(value: unknown): CheckoutBilling["paymentMethod"] | null {
  return value === "paypal" || value === "venmo" ? value : null;
}

function parseFormBilling(
  body: Record<string, unknown>,
  method: CheckoutBilling["paymentMethod"],
): CheckoutBilling | null {
  const normalizedEmail = email(body.email);
  const firstName = field(body.firstName, 100);
  const lastName = field(body.lastName, 100);
  const addressLine1 = field(body.addressLine1, 300);
  const addressLine2 = field(body.addressLine2, 300, false);
  const city = field(body.city, 120);
  const state = field(body.state, 100, false);
  const postalCode = field(body.postalCode, 20);
  const countryCode =
    typeof body.countryCode === "string" ? body.countryCode.trim().toUpperCase() : "";

  if (
    !normalizedEmail ||
    !firstName ||
    !lastName ||
    !addressLine1 ||
    addressLine2 === null ||
    !city ||
    state === null ||
    (countryCode === "US" && !state) ||
    !postalCode ||
    !/^[A-Z]{2}$/.test(countryCode)
  ) {
    return null;
  }

  return {
    email: normalizedEmail,
    firstName,
    lastName,
    addressLine1,
    ...(addressLine2 ? { addressLine2 } : {}),
    city,
    ...(state ? { state } : {}),
    postalCode,
    countryCode,
    paymentMethod: method,
  };
}

export function parseCheckoutOrderInput(payload: unknown): CheckoutOrderInput | null {
  const body = record(payload);
  if (!body) return null;

  const method = paymentMethod(body.paymentMethod);
  if (!method) return null;

  if (body.checkoutMode === "express") {
    return { checkoutMode: "express", paymentMethod: method };
  }

  if (body.checkoutMode !== "form") return null;
  const billing = parseFormBilling(body, method);
  return billing ? { checkoutMode: "form", ...billing } : null;
}

/**
 * Temporary compatibility parser for the existing API route. It intentionally
 * accepts only the fully validated form flow; express checkout must use the
 * discriminated `parseCheckoutOrderInput` result instead.
 */
export function parseCheckoutBilling(payload: unknown): CheckoutBilling | null {
  const body = record(payload);
  if (!body) return null;

  const method = paymentMethod(body.paymentMethod);
  return method ? parseFormBilling(body, method) : null;
}

export function paypalOrderId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : null;
}

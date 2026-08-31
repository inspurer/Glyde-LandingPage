import "server-only";

import { createPublicKey, verify } from "node:crypto";

import { getPayPalConfig, type PayPalEnvironment } from "./config";

const CERTIFICATE_TIMEOUT_MS = 10_000;
const CERTIFICATE_MAX_BYTES = 64 * 1_024;
const CERTIFICATE_CACHE_MS = 24 * 60 * 60 * 1_000;
const MAX_CERTIFICATES = 32;
const MAX_TRANSMISSION_AGE_MS = 4 * 24 * 60 * 60 * 1_000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;

const certificateCache = new Map<string, { pem: string; expiresAt: number }>();

function webhookHeader(request: Request, name: string, maxLength: number): string | null {
  const value = request.headers.get(name)?.trim() ?? "";
  return value && value.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null;
}

function certificateUrl(value: string, environment: PayPalEnvironment): URL | null {
  try {
    const url = new URL(value);
    const allowedHosts =
      environment === "production"
        ? new Set(["api.paypal.com", "api-m.paypal.com"])
        : new Set(["api.sandbox.paypal.com", "api-m.sandbox.paypal.com"]);

    if (
      url.protocol !== "https:" ||
      !allowedHosts.has(url.hostname) ||
      (url.port && url.port !== "443") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !url.pathname.startsWith("/v1/notifications/certs/")
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

async function readPayPalCertificate(url: URL): Promise<string> {
  const key = url.toString();
  const now = Date.now();
  const cached = certificateCache.get(key);
  if (cached && cached.expiresAt > now) return cached.pem;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CERTIFICATE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/x-pem-file, application/pkix-cert, text/plain" },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("PAYPAL_CERTIFICATE_UNAVAILABLE");

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > CERTIFICATE_MAX_BYTES) {
      throw new Error("PAYPAL_CERTIFICATE_TOO_LARGE");
    }

    const pem = await response.text();
    if (
      new TextEncoder().encode(pem).byteLength > CERTIFICATE_MAX_BYTES ||
      !pem.startsWith("-----BEGIN CERTIFICATE-----") ||
      !pem.includes("-----END CERTIFICATE-----")
    ) {
      throw new Error("PAYPAL_CERTIFICATE_INVALID");
    }

    // Parsing here rejects malformed material before it reaches the cache.
    createPublicKey(pem);
    certificateCache.set(key, { pem, expiresAt: now + CERTIFICATE_CACHE_MS });
    if (certificateCache.size > MAX_CERTIFICATES) {
      for (const [candidate, value] of certificateCache) {
        if (value.expiresAt <= now || certificateCache.size > MAX_CERTIFICATES) {
          certificateCache.delete(candidate);
        }
      }
    }
    return pem;
  } finally {
    clearTimeout(timeout);
  }
}

/** PayPal signs the decimal unsigned CRC32 of the exact request bytes. */
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validTransmissionTime(value: string): boolean {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const age = Date.now() - timestamp;
  return age >= -MAX_CLOCK_SKEW_MS && age <= MAX_TRANSMISSION_AGE_MS;
}

/**
 * Verifies PayPal's signature locally against the original UTF-8 request body.
 * Never parse/re-stringify `rawBody` before this call: its exact bytes are part
 * of the signed message.
 */
export async function verifyPayPalWebhook(request: Request, rawBody: string): Promise<boolean> {
  const config = getPayPalConfig();
  if (!config.credentialsConfigured || !config.webhookId) return false;

  const authAlgo = webhookHeader(request, "paypal-auth-algo", 100);
  const certValue = webhookHeader(request, "paypal-cert-url", 2_048);
  const transmissionId = webhookHeader(request, "paypal-transmission-id", 200);
  const transmissionSig = webhookHeader(request, "paypal-transmission-sig", 2_048);
  const transmissionTime = webhookHeader(request, "paypal-transmission-time", 100);
  const certUrl = certValue ? certificateUrl(certValue, config.environment) : null;

  if (
    authAlgo !== "SHA256withRSA" ||
    !certUrl ||
    !transmissionId ||
    !transmissionSig ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(transmissionSig) ||
    transmissionSig.length % 4 !== 0 ||
    !transmissionTime ||
    !validTransmissionTime(transmissionTime)
  ) {
    return false;
  }

  const signature = Buffer.from(transmissionSig, "base64");
  if (signature.length < 128 || signature.length > 1_024) return false;

  const rawBytes = new TextEncoder().encode(rawBody);
  const message = `${transmissionId}|${transmissionTime}|${config.webhookId}|${crc32(rawBytes)}`;
  const certificate = await readPayPalCertificate(certUrl);

  try {
    return verify(
      "RSA-SHA256",
      Buffer.from(message, "utf8"),
      createPublicKey(certificate),
      signature,
    );
  } catch {
    return false;
  }
}

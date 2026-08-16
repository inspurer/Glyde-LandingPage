import { createHmac, timingSafeEqual } from "node:crypto";

// Admin access is a single shared token held in ADMIN_TOKEN. The browser never
// stores the token itself: on a correct entry the server issues a cookie
// carrying only an expiry plus an HMAC of it, keyed by the token. That way a
// leaked cookie expires on its own and cannot be replayed once the token is
// rotated, and there is no session table to keep.

export const SESSION_COOKIE = "glyde_admin";
const SESSION_TTL_SECONDS = 12 * 60 * 60;

export function getAdminToken(): string | null {
  const token = process.env.ADMIN_TOKEN?.trim();
  // Refuse to run with a trivially guessable token rather than pretend the
  // admin page is protected.
  return token && token.length >= 16 ? token : null;
}

function sign(payload: string, token: string): string {
  return createHmac("sha256", token).update(payload).digest("base64url");
}

/**
 * Compares two strings without leaking, through timing, how much of a guess was
 * correct. Length is compared first because timingSafeEqual throws on a
 * mismatch; length alone is not the secret.
 */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyToken(candidate: string, token: string): boolean {
  return safeEqual(candidate, token);
}

export function issueSession(token: string): { value: string; maxAge: number } {
  const payload = String(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS);
  return {
    value: `${payload}.${sign(payload, token)}`,
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function verifySession(cookieValue: string | undefined, token: string): boolean {
  if (!cookieValue) {
    return false;
  }

  const separator = cookieValue.lastIndexOf(".");
  if (separator <= 0) {
    return false;
  }

  const payload = cookieValue.slice(0, separator);
  const signature = cookieValue.slice(separator + 1);

  if (!safeEqual(signature, sign(payload, token))) {
    return false;
  }

  const expiry = Number(payload);
  return Number.isFinite(expiry) && expiry > Math.floor(Date.now() / 1000);
}

// Brute-force throttle. In-memory is sufficient because this runs as a single
// container; it resets on restart, which is acceptable for slowing guesses.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

export function tooManyAttempts(key: string): boolean {
  const entry = attempts.get(key);
  return entry !== undefined && entry.resetAt > Date.now() && entry.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  entry.count += 1;

  // Keep the map from growing without bound if it is ever probed from many
  // addresses.
  if (attempts.size > 1000) {
    for (const [candidate, value] of attempts) {
      if (value.resetAt <= now) {
        attempts.delete(candidate);
      }
    }
  }
}

export function clearAttempts(key: string): void {
  attempts.delete(key);
}

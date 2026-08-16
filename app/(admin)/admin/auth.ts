import { cookies } from "next/headers";

import { SESSION_COOKIE, getAdminToken, verifySession } from "@/lib/admin-auth";

/**
 * Every admin page calls this before reading any data. Returning a discriminated
 * result rather than redirecting keeps the "not configured" and "not signed in"
 * cases distinguishable, so the page can explain which one it is.
 */
export async function checkAccess(): Promise<
  { ok: true } | { ok: false; reason: "unconfigured" | "signed_out" }
> {
  const token = getAdminToken();
  if (!token) {
    return { ok: false, reason: "unconfigured" };
  }

  const cookieStore = await cookies();
  if (!verifySession(cookieStore.get(SESSION_COOKIE)?.value, token)) {
    return { ok: false, reason: "signed_out" };
  }

  return { ok: true };
}

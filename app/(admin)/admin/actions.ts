"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE,
  clearAttempts,
  getAdminToken,
  issueSession,
  recordFailedAttempt,
  tooManyAttempts,
  verifyToken,
} from "@/lib/admin-auth";

async function clientKey(): Promise<string> {
  const headerList = await headers();
  // Caddy sets X-Forwarded-For; the left-most entry is the original client.
  const forwarded = headerList.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function login(formData: FormData): Promise<void> {
  const token = getAdminToken();
  if (!token) {
    redirect("/admin?error=unconfigured");
  }

  const key = await clientKey();
  if (tooManyAttempts(key)) {
    redirect("/admin?error=throttled");
  }

  const candidate = String(formData.get("token") ?? "");

  if (!verifyToken(candidate, token)) {
    recordFailedAttempt(key);
    redirect("/admin?error=invalid");
  }

  clearAttempts(key);
  const session = issueSession(token);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "lax",
    // The preview is served over HTTPS only; without this the cookie would also
    // travel over a plain-HTTP request to the same host.
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: session.maxAge,
  });

  redirect("/admin");
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({ name: SESSION_COOKIE, path: "/admin" });
  redirect("/admin");
}

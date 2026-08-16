import Link from "next/link";
import { cookies } from "next/headers";

import { SESSION_COOKIE, getAdminToken, verifySession } from "@/lib/admin-auth";
import { listSubscribers } from "@/lib/subscribers";
import { login, logout } from "./actions";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 25;

const ERRORS: Record<string, string> = {
  invalid: "That token is not correct.",
  throttled: "Too many attempts. Try again in a few minutes.",
  unconfigured: "ADMIN_TOKEN is not set on the server.",
};

const SHOPIFY_LABELS: Record<string, { text: string; tone: "ok" | "muted" | "warn" }> = {
  success: { text: "Synced", tone: "ok" },
  not_configured: { text: "Local only", tone: "muted" },
  timeout: { text: "Timed out", tone: "warn" },
  upstream_error: { text: "Failed", tone: "warn" },
  configuration_error: { text: "Not configured", tone: "muted" },
};

function LoginScreen({ error }: { error?: string }) {
  return (
    <main className={styles.page}>
      <div className={`${styles.card} ${styles.login}`}>
        <h1>GLYDE waitlist</h1>
        <p>Enter the admin token to view collected addresses.</p>
        {error ? <p className={styles.error}>{ERRORS[error] ?? "Sign-in failed."}</p> : null}
        <form action={login}>
          <label className={styles.field}>
            <span>Admin token</span>
            <input
              type="password"
              name="token"
              autoComplete="off"
              autoFocus
              required
              aria-label="Admin token"
            />
          </label>
          <button className={styles.submit} type="submit">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = getAdminToken();

  if (!token) {
    return <LoginScreen error="unconfigured" />;
  }

  const cookieStore = await cookies();
  if (!verifySession(cookieStore.get(SESSION_COOKIE)?.value, token)) {
    return <LoginScreen error={params.error} />;
  }

  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const { rows, total, page, pageCount } = listSubscribers(
    Number.isFinite(requestedPage) ? requestedPage : 1,
    PAGE_SIZE,
  );

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1>Waitlist addresses</h1>
            <p className={styles.count}>
              {total} {total === 1 ? "address" : "addresses"} collected
            </p>
          </div>
          <form action={logout}>
            <button className={styles.signOut} type="submit">
              Sign out
            </button>
          </form>
        </header>

        <div className={styles.card}>
          {rows.length === 0 ? (
            <p className={styles.empty}>No addresses yet.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Email</th>
                    <th scope="col">Form</th>
                    <th scope="col">Collected (UTC)</th>
                    <th scope="col">Shopify</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const label = SHOPIFY_LABELS[row.shopifyStatus] ?? {
                      text: row.shopifyStatus,
                      tone: "muted" as const,
                    };
                    const toneClass =
                      label.tone === "ok"
                        ? styles.tag
                        : label.tone === "warn"
                          ? `${styles.tag} ${styles.tagWarn}`
                          : `${styles.tag} ${styles.tagMuted}`;

                    return (
                      <tr key={row.id}>
                        <td>{row.id}</td>
                        <td className={styles.email}>{row.email}</td>
                        <td>{row.source}</td>
                        <td>{row.createdAt}</td>
                        <td>
                          <span className={toneClass}>{label.text}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pageCount > 1 ? (
          <nav className={styles.pagination} aria-label="Pagination">
            <span className={styles.pageStatus}>
              Page {page} of {pageCount}
            </span>
            <div className={styles.pageLinks}>
              {page > 1 ? (
                <Link className={styles.pageLink} href={`/admin?page=${page - 1}`}>
                  Previous
                </Link>
              ) : (
                <span className={styles.pageLinkDisabled}>Previous</span>
              )}
              {page < pageCount ? (
                <Link className={styles.pageLink} href={`/admin?page=${page + 1}`}>
                  Next
                </Link>
              ) : (
                <span className={styles.pageLinkDisabled}>Next</span>
              )}
            </div>
          </nav>
        ) : null}
      </div>
    </main>
  );
}

import Link from "next/link";

import { listSubscribers } from "@/lib/subscribers";
import { AdminShell, LoginScreen } from "../AdminShell";
import { checkAccess } from "../auth";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 25;

const SHOPIFY_LABELS: Record<string, { text: string; tone: "ok" | "muted" | "warn" }> = {
  success: { text: "Synced", tone: "ok" },
  not_configured: { text: "Local only", tone: "muted" },
  timeout: { text: "Timed out", tone: "warn" },
  upstream_error: { text: "Failed", tone: "warn" },
  configuration_error: { text: "Not configured", tone: "muted" },
};

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; error?: string }>;
}) {
  const params = await searchParams;
  const access = await checkAccess();

  if (!access.ok) {
    return <LoginScreen error={access.reason === "unconfigured" ? "unconfigured" : params.error} />;
  }

  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const { rows, total, page, pageCount } = listSubscribers(
    Number.isFinite(requestedPage) ? requestedPage : 1,
    PAGE_SIZE,
  );

  return (
    <AdminShell
      active="/admin/subscribers"
      title="Subscribers"
      subtitle={`${total} ${total === 1 ? "address" : "addresses"} collected`}
    >
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
              <Link className={styles.pageLink} href={`/admin/subscribers?page=${page - 1}`}>
                Previous
              </Link>
            ) : (
              <span className={styles.pageLinkDisabled}>Previous</span>
            )}
            {page < pageCount ? (
              <Link className={styles.pageLink} href={`/admin/subscribers?page=${page + 1}`}>
                Next
              </Link>
            ) : (
              <span className={styles.pageLinkDisabled}>Next</span>
            )}
          </div>
        </nav>
      ) : null}
    </AdminShell>
  );
}

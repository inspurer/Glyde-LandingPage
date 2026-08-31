import Link from "next/link";

import { listPaymentOrders } from "@/lib/payments";
import { AdminShell, LoginScreen } from "../AdminShell";
import { checkAccess } from "../auth";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 30;

const STATUS_LABELS: Record<string, { text: string; tone: "ok" | "muted" | "warn" }> = {
  completed: { text: "Completed", tone: "ok" },
  capture_pending: { text: "Processing", tone: "warn" },
  created: { text: "Created", tone: "muted" },
  approved: { text: "Approved", tone: "warn" },
  refunded: { text: "Refunded", tone: "muted" },
  partially_refunded: { text: "Partial refund", tone: "warn" },
  reversed: { text: "Reversed", tone: "warn" },
  failed: { text: "Failed", tone: "warn" },
  cancelled: { text: "Cancelled", tone: "muted" },
  creating: { text: "Creating", tone: "muted" },
};

function shortId(value: string | null): string {
  if (!value) return "—";
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

export default async function PaymentsPage({
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
  const { rows, total, page, pageCount } = listPaymentOrders(
    Number.isFinite(requestedPage) ? requestedPage : 1,
    PAGE_SIZE,
  );

  return (
    <AdminShell
      active="/admin/payments"
      title="Payments"
      subtitle={`${total} ${total === 1 ? "reservation order" : "reservation orders"}`}
    >
      <div className={styles.card}>
        {rows.length === 0 ? (
          <p className={styles.empty}>No payment attempts yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Status</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Amount</th>
                  <th scope="col">PayPal order</th>
                  <th scope="col">Capture</th>
                  <th scope="col">Environment</th>
                  <th scope="col">Created (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const label = STATUS_LABELS[row.status] ?? {
                    text: row.status,
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
                      <td><span className={toneClass}>{label.text}</span></td>
                      <td className={styles.email}>{row.contactEmail}</td>
                      <td>{row.currency} ${(row.amountMinor / 100).toFixed(2)}</td>
                      <td className={styles.mono}>{shortId(row.paypalOrderId)}</td>
                      <td className={styles.mono}>{shortId(row.paypalCaptureId)}</td>
                      <td>{row.environment}</td>
                      <td>{row.createdAt}</td>
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
          <span className={styles.pageStatus}>Page {page} of {pageCount}</span>
          <div className={styles.pageLinks}>
            {page > 1 ? (
              <Link className={styles.pageLink} href={`/admin/payments?page=${page - 1}`}>Previous</Link>
            ) : <span className={styles.pageLinkDisabled}>Previous</span>}
            {page < pageCount ? (
              <Link className={styles.pageLink} href={`/admin/payments?page=${page + 1}`}>Next</Link>
            ) : <span className={styles.pageLinkDisabled}>Next</span>}
          </div>
        </nav>
      ) : null}
    </AdminShell>
  );
}


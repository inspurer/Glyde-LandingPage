import Link from "next/link";

import { listEventNames, listEvents } from "@/lib/events";
import { AdminShell, LoginScreen } from "../AdminShell";
import { checkAccess } from "../auth";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 50;

/** Visitor and session ids are long random strings; show enough to correlate rows. */
function shortId(id: string): string {
  return id.slice(0, 6);
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; name?: string; error?: string }>;
}) {
  const params = await searchParams;
  const access = await checkAccess();

  if (!access.ok) {
    return <LoginScreen error={access.reason === "unconfigured" ? "unconfigured" : params.error} />;
  }

  const names = listEventNames();
  const filterName = params.name && names.includes(params.name) ? params.name : undefined;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const { rows, total, page, pageCount } = listEvents(
    Number.isFinite(requestedPage) ? requestedPage : 1,
    PAGE_SIZE,
    filterName,
  );

  const pageHref = (target: number) =>
    `/admin/events?page=${target}${filterName ? `&name=${encodeURIComponent(filterName)}` : ""}`;

  return (
    <AdminShell
      active="/admin/events"
      title="Events"
      subtitle={`${total} ${total === 1 ? "event" : "events"}${filterName ? ` named “${filterName}”` : ""}`}
      toolbar={
        names.length > 0 ? (
          <div className={styles.rangePicker} role="group" aria-label="Filter by event name">
            <Link
              href="/admin/events"
              className={filterName ? styles.range : styles.rangeActive}
              aria-current={filterName ? undefined : "true"}
            >
              All
            </Link>
            {names.map((name) => (
              <Link
                key={name}
                href={`/admin/events?name=${encodeURIComponent(name)}`}
                className={name === filterName ? styles.rangeActive : styles.range}
                aria-current={name === filterName ? "true" : undefined}
              >
                {name}
              </Link>
            ))}
          </div>
        ) : undefined
      }
    >
      <div className={styles.card}>
        {rows.length === 0 ? (
          <p className={styles.empty}>No events recorded yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Event</th>
                  <th scope="col">Label</th>
                  <th scope="col">Path</th>
                  <th scope="col">Device</th>
                  <th scope="col">Referrer</th>
                  <th scope="col">Visitor</th>
                  <th scope="col">Session</th>
                  <th scope="col">Value</th>
                  <th scope="col">When (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>
                      <span className={styles.tag}>{row.name}</span>
                    </td>
                    <td className={styles.wrapCell}>{row.label || "—"}</td>
                    <td>{row.path || "—"}</td>
                    <td>{row.device}</td>
                    <td>{row.referrerHost || "direct"}</td>
                    <td className={styles.mono}>{shortId(row.visitorId)}</td>
                    <td className={styles.mono}>{shortId(row.sessionId)}</td>
                    <td>{row.value ?? "—"}</td>
                    <td>{row.createdAt}</td>
                  </tr>
                ))}
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
              <Link className={styles.pageLink} href={pageHref(page - 1)}>
                Previous
              </Link>
            ) : (
              <span className={styles.pageLinkDisabled}>Previous</span>
            )}
            {page < pageCount ? (
              <Link className={styles.pageLink} href={pageHref(page + 1)}>
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

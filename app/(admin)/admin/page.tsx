import { getBreakdown, getDailySeries, getOverview } from "@/lib/events";
import { AdminShell, LoginScreen, RangePicker } from "./AdminShell";
import { BarList, TrendChart } from "./Charts";
import { checkAccess } from "./auth";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RANGES = [7, 14, 30, 90];

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className={styles.stat}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value}</p>
      {hint ? <p className={styles.statHint}>{hint}</p> : null}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; error?: string }>;
}) {
  const params = await searchParams;
  const access = await checkAccess();

  if (!access.ok) {
    return <LoginScreen error={access.reason === "unconfigured" ? "unconfigured" : params.error} />;
  }

  const requested = Number.parseInt(params.days ?? "14", 10);
  const days = RANGES.includes(requested) ? requested : 14;

  const overview = getOverview(days);
  const series = getDailySeries(days);
  const topEvents = getBreakdown("name", days);
  const topPages = getBreakdown("path", days, 6, "page_view");
  const topClicks = getBreakdown("label", days, 8, "click");
  const devices = getBreakdown("device", days, 4);
  const referrers = getBreakdown("referrer", days, 5);

  return (
    <AdminShell
      active="/admin"
      title="Dashboard"
      subtitle={`Last ${days} days`}
      toolbar={<RangePicker active={days} basePath="/admin" />}
    >
      <div className={styles.statGrid}>
        <StatTile label="Visitors" value={String(overview.visitors)} hint="Unique browsers" />
        <StatTile label="Sessions" value={String(overview.sessions)} hint="30-min inactivity window" />
        <StatTile label="Page views" value={String(overview.pageViews)} />
        <StatTile label="Signups" value={String(overview.signups)} />
        <StatTile
          label="Conversion"
          value={`${overview.conversionRate.toFixed(1)}%`}
          hint="Signups per session"
        />
        <StatTile
          label="Events / session"
          value={overview.avgEventsPerSession.toFixed(1)}
          hint={`${overview.events} events total`}
        />
      </div>

      <section className={styles.card} aria-labelledby="trend-title">
        <h2 id="trend-title" className={styles.cardTitle}>
          Daily visitors
        </h2>
        <TrendChart data={series} measure="visitors" />
      </section>

      <div className={styles.cardGrid}>
        <section className={styles.card} aria-labelledby="events-title">
          <h2 id="events-title" className={styles.cardTitle}>
            Events by type
          </h2>
          <BarList items={topEvents} emptyLabel="No events recorded yet." />
        </section>

        <section className={styles.card} aria-labelledby="pages-title">
          <h2 id="pages-title" className={styles.cardTitle}>
            Top pages
          </h2>
          <BarList items={topPages} emptyLabel="No page views recorded yet." />
        </section>

        <section className={styles.card} aria-labelledby="clicks-title">
          <h2 id="clicks-title" className={styles.cardTitle}>
            Most clicked
          </h2>
          <BarList items={topClicks} emptyLabel="No clicks recorded yet." />
        </section>

        <section className={styles.card} aria-labelledby="devices-title">
          <h2 id="devices-title" className={styles.cardTitle}>
            Devices
          </h2>
          <BarList items={devices} emptyLabel="No devices recorded yet." />
        </section>

        <section className={styles.card} aria-labelledby="referrers-title">
          <h2 id="referrers-title" className={styles.cardTitle}>
            Referrers
          </h2>
          <BarList items={referrers} emptyLabel="All traffic so far is direct." />
        </section>
      </div>
    </AdminShell>
  );
}

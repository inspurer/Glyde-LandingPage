import { getDatabase } from "./db";

// Analytics storage and the aggregations the dashboard reads.
//
// What is deliberately NOT stored: no IP address, no raw user-agent string, no
// cookies, no third party. A visitor is identified only by a random id this site
// generates and keeps in the visitor's own browser, which makes the data useless
// for following anyone off this host. Referrers are reduced to a hostname so a
// full URL with its own query string never lands in the table.

export const MAX_BATCH = 50;
export const MAX_FIELD = 200;
export const MAX_PROPS = 1_000;

export type IncomingEvent = {
  name: string;
  path?: string;
  label?: string;
  referrer?: string;
  device?: string;
  value?: number;
  props?: Record<string, unknown>;
};

export type StoredEvent = {
  id: number;
  visitorId: string;
  sessionId: string;
  name: string;
  path: string;
  label: string;
  referrerHost: string;
  device: string;
  value: number | null;
  props: string | null;
  createdAt: string;
};

export type Overview = {
  visitors: number;
  sessions: number;
  pageViews: number;
  events: number;
  signups: number;
  conversionRate: number;
  avgEventsPerSession: number;
};

export type DailyPoint = { date: string; visitors: number; pageViews: number };
export type Breakdown = { label: string; count: number };

function clamp(value: unknown, limit: number): string {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

/**
 * Keeps only the hostname of a referrer. A full referring URL can carry the
 * previous page's query string, which is exactly the kind of incidental
 * personal data this table should never accumulate.
 */
function referrerHost(referrer: unknown): string {
  if (typeof referrer !== "string" || referrer === "") {
    return "";
  }

  try {
    return new URL(referrer).hostname.slice(0, MAX_FIELD);
  } catch {
    return "";
  }
}

export function recordEvents(
  visitorId: string,
  sessionId: string,
  events: IncomingEvent[],
): number {
  const db = getDatabase();
  const insert = db.prepare(
    `INSERT INTO events
       (visitor_id, session_id, name, path, label, referrer_host, device, value, props)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let written = 0;

  // One transaction per batch: the beacon sent on page-hide carries several
  // events, and committing them individually would multiply fsyncs for data
  // that is only meaningful together.
  db.exec("BEGIN");
  try {
    for (const event of events.slice(0, MAX_BATCH)) {
      const name = clamp(event.name, 60);
      if (!name) continue;

      let props: string | null = null;
      if (event.props && typeof event.props === "object") {
        const encoded = JSON.stringify(event.props);
        props = encoded.length <= MAX_PROPS ? encoded : null;
      }

      insert.run(
        visitorId,
        sessionId,
        name,
        clamp(event.path, MAX_FIELD),
        clamp(event.label, MAX_FIELD),
        referrerHost(event.referrer),
        clamp(event.device, 20) || "unknown",
        typeof event.value === "number" && Number.isFinite(event.value)
          ? Math.trunc(event.value)
          : null,
        props,
      );
      written += 1;
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return written;
}

/** SQLite datetime() boundary for "N days ago", matching created_at's format. */
function since(days: number): string {
  return `-${Math.max(1, Math.trunc(days))} days`;
}

export function getOverview(days: number): Overview {
  const db = getDatabase();
  const window = since(days);

  const row = db
    .prepare(
      `SELECT
         COUNT(DISTINCT visitor_id) AS visitors,
         COUNT(DISTINCT session_id) AS sessions,
         COUNT(*) AS events,
         SUM(CASE WHEN name = 'page_view' THEN 1 ELSE 0 END) AS page_views
       FROM events
       WHERE created_at >= datetime('now', ?)`,
    )
    .get(window) as {
    visitors: number;
    sessions: number;
    events: number;
    page_views: number | null;
  };

  const signups = (
    db
      .prepare(
        `SELECT COUNT(*) AS total FROM subscribers
         WHERE created_at >= datetime('now', ?)`,
      )
      .get(window) as { total: number }
  ).total;

  const sessions = Number(row.sessions) || 0;

  return {
    visitors: Number(row.visitors) || 0,
    sessions,
    pageViews: Number(row.page_views) || 0,
    events: Number(row.events) || 0,
    signups: Number(signups) || 0,
    // Signups per session is the number worth watching; per visitor would drift
    // as returning visitors accumulate.
    conversionRate: sessions > 0 ? (Number(signups) / sessions) * 100 : 0,
    avgEventsPerSession: sessions > 0 ? Number(row.events) / sessions : 0,
  };
}

/**
 * One row per day across the whole window, including days with no traffic —
 * a chart that silently drops empty days misreports the shape of the trend.
 */
export function getDailySeries(days: number): DailyPoint[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT date(created_at) AS day,
              COUNT(DISTINCT visitor_id) AS visitors,
              SUM(CASE WHEN name = 'page_view' THEN 1 ELSE 0 END) AS page_views
       FROM events
       WHERE created_at >= datetime('now', ?)
       GROUP BY day`,
    )
    .all(since(days)) as Array<{ day: string; visitors: number; page_views: number | null }>;

  const byDay = new Map(rows.map((row) => [row.day, row]));
  const series: DailyPoint[] = [];
  const today = new Date();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    const row = byDay.get(key);
    series.push({
      date: key,
      visitors: Number(row?.visitors) || 0,
      pageViews: Number(row?.page_views) || 0,
    });
  }

  return series;
}

const BREAKDOWN_COLUMNS = {
  name: "name",
  label: "label",
  path: "path",
  device: "device",
  referrer: "referrer_host",
} as const;

export function getBreakdown(
  dimension: keyof typeof BREAKDOWN_COLUMNS,
  days: number,
  limit = 8,
  eventName?: string,
): Breakdown[] {
  const db = getDatabase();
  const column = BREAKDOWN_COLUMNS[dimension];

  // `column` is looked up from a fixed map rather than interpolated from the
  // caller, so no request value ever reaches the SQL text.
  const rows = db
    .prepare(
      `SELECT ${column} AS label, COUNT(*) AS count
       FROM events
       WHERE created_at >= datetime('now', ?)
         AND ${column} != ''
         ${eventName ? "AND name = ?" : ""}
       GROUP BY ${column}
       ORDER BY count DESC
       LIMIT ?`,
    )
    .all(...(eventName ? [since(days), eventName, limit] : [since(days), limit])) as Array<{
    label: string;
    count: number;
  }>;

  return rows.map((row) => ({ label: row.label, count: Number(row.count) }));
}

export function listEvents(
  page: number,
  pageSize: number,
  filterName?: string,
): { rows: StoredEvent[]; total: number; page: number; pageCount: number } {
  const db = getDatabase();
  const where = filterName ? "WHERE name = ?" : "";
  const filterArgs = filterName ? [filterName] : [];

  const total = Number(
    (db.prepare(`SELECT COUNT(*) AS total FROM events ${where}`).get(...filterArgs) as {
      total: number;
    }).total,
  );
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);

  const rows = db
    .prepare(
      `SELECT id, visitor_id, session_id, name, path, label, referrer_host, device, value,
              props, created_at
       FROM events ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...filterArgs, pageSize, (safePage - 1) * pageSize) as Array<{
    id: number;
    visitor_id: string;
    session_id: string;
    name: string;
    path: string;
    label: string;
    referrer_host: string;
    device: string;
    value: number | null;
    props: string | null;
    created_at: string;
  }>;

  return {
    rows: rows.map((row) => ({
      id: row.id,
      visitorId: row.visitor_id,
      sessionId: row.session_id,
      name: row.name,
      path: row.path,
      label: row.label,
      referrerHost: row.referrer_host,
      device: row.device,
      value: row.value,
      props: row.props,
      createdAt: row.created_at,
    })),
    total,
    page: safePage,
    pageCount,
  };
}

export function listEventNames(): string[] {
  const db = getDatabase();
  const rows = db
    .prepare("SELECT DISTINCT name FROM events ORDER BY name")
    .all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

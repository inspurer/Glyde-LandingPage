import { getDatabase } from "./db";

// Waitlist storage. The Shopify storefront is not in front of this app, so its
// native customer form is unavailable and there is nowhere for an address to go
// unless we keep it ourselves. Schema lives in lib/db.ts alongside the events
// table so both share one connection.

export type Subscriber = {
  id: number;
  email: string;
  source: string;
  createdAt: string;
  shopifyStatus: string;
};

export type SubscriberPage = {
  rows: Subscriber[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type InsertResult = "created" | "duplicate";

/**
 * Records an address. Re-submitting a known address is not an error — someone
 * signing up twice should still be told they are on the list — so it reports
 * "duplicate" rather than throwing, and leaves the original timestamp intact.
 */
export function addSubscriber(
  email: string,
  source: string,
  shopifyStatus: string,
): InsertResult {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO subscribers (email, source, shopify_status)
       VALUES (?, ?, ?)
       ON CONFLICT (email) DO NOTHING`,
    )
    .run(email, source, shopifyStatus);

  return result.changes > 0 ? "created" : "duplicate";
}

export function listSubscribers(page: number, pageSize: number): SubscriberPage {
  const db = getDatabase();
  const total = Number(
    (db.prepare("SELECT COUNT(*) AS total FROM subscribers").get() as { total: number }).total,
  );
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);

  const rows = db
    .prepare(
      `SELECT id, email, source, created_at, shopify_status
       FROM subscribers
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(pageSize, (safePage - 1) * pageSize) as Array<{
    id: number;
    email: string;
    source: string;
    created_at: string;
    shopify_status: string;
  }>;

  return {
    rows: rows.map((row) => ({
      id: row.id,
      email: row.email,
      source: row.source,
      createdAt: row.created_at,
      shopifyStatus: row.shopify_status,
    })),
    total,
    page: safePage,
    pageSize,
    pageCount,
  };
}

export function countSubscribers(): number {
  const db = getDatabase();
  return Number(
    (db.prepare("SELECT COUNT(*) AS total FROM subscribers").get() as { total: number }).total,
  );
}

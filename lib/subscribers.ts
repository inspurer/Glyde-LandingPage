import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// Waitlist storage for this deployment. The Shopify storefront is not in front
// of this app, so its native customer form is unavailable and there is nowhere
// for an address to go unless we keep it ourselves.
//
// SQLite via node:sqlite rather than a hosted database or an added dependency:
// the volume is a waitlist, a single file survives container restarts on a
// mounted volume, and the driver ships with Node so there is no native module
// to compile in the Alpine image.

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

const DEFAULT_DATA_DIR = process.env.NODE_ENV === "production" ? "/data" : ".data";

let database: DatabaseSync | null = null;

function connect(): DatabaseSync {
  if (database) {
    return database;
  }

  const directory = process.env.GLYDE_DATA_DIR?.trim() || DEFAULT_DATA_DIR;
  mkdirSync(directory, { recursive: true });

  const db = new DatabaseSync(join(directory, "waitlist.db"));

  // WAL keeps a reader (the admin page) from blocking a writer (a signup).
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL DEFAULT 'unknown',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      shopify_status TEXT NOT NULL DEFAULT 'not_configured'
    )
  `);
  db.exec("CREATE INDEX IF NOT EXISTS subscribers_created_at ON subscribers (created_at DESC)");

  database = db;
  return db;
}

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
  const db = connect();
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
  const db = connect();
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
  const db = connect();
  return Number(
    (db.prepare("SELECT COUNT(*) AS total FROM subscribers").get() as { total: number }).total,
  );
}

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// Single SQLite file shared by the waitlist, analytics and payment ledger,
// opened once per process. node:sqlite ships with Node, so there is no native
// module to compile in the Alpine image.

const DEFAULT_DATA_DIR = process.env.NODE_ENV === "production" ? "/data" : ".data";

let database: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (database) {
    return database;
  }

  const directory = process.env.GLYDE_DATA_DIR?.trim() || DEFAULT_DATA_DIR;
  mkdirSync(directory, { recursive: true });

  const db = new DatabaseSync(join(directory, "waitlist.db"));

  // WAL keeps readers (the admin pages) from blocking writers (signups and the
  // event firehose), which matters more here than durability of the last
  // fraction of a second of analytics.
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL DEFAULT '',
      label TEXT NOT NULL DEFAULT '',
      referrer_host TEXT NOT NULL DEFAULT '',
      device TEXT NOT NULL DEFAULT 'unknown',
      value INTEGER,
      props TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec("CREATE INDEX IF NOT EXISTS events_created_at ON events (created_at DESC)");
  db.exec("CREATE INDEX IF NOT EXISTS events_name ON events (name)");
  db.exec("CREATE INDEX IF NOT EXISTS events_visitor ON events (visitor_id)");
  db.exec("CREATE INDEX IF NOT EXISTS events_session ON events (session_id)");

  // Payment facts are deliberately separate from analytics. Browser events
  // can be dropped; this ledger is the authority used for capture idempotency,
  // receipts, refunds and admin reconciliation.
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkout_key TEXT NOT NULL UNIQUE,
      offer_code TEXT NOT NULL,
      amount_minor INTEGER NOT NULL CHECK (amount_minor = 300),
      refunded_minor INTEGER NOT NULL DEFAULT 0
        CHECK (refunded_minor >= 0 AND refunded_minor <= amount_minor),
      currency TEXT NOT NULL CHECK (currency = 'USD'),
      contact_email TEXT NOT NULL,
      paypal_order_id TEXT UNIQUE,
      paypal_capture_id TEXT UNIQUE,
      create_request_id TEXT NOT NULL UNIQUE,
      capture_request_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'creating',
      paypal_status TEXT,
      payer_email TEXT,
      payer_id TEXT,
      environment TEXT NOT NULL,
      failure_code TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      captured_at TEXT
    )
  `);
  // Existing preview volumes predate refund amount tracking. SQLite does not
  // support `ADD COLUMN IF NOT EXISTS`, so inspect the schema before applying
  // this one-way, data-preserving migration.
  const paymentColumns = db.prepare("PRAGMA table_info(payment_orders)").all() as Array<{
    name: string;
  }>;
  if (!paymentColumns.some((column) => column.name === "refunded_minor")) {
    db.exec(
      "ALTER TABLE payment_orders ADD COLUMN refunded_minor INTEGER NOT NULL DEFAULT 0 CHECK (refunded_minor >= 0 AND refunded_minor <= amount_minor)",
    );
  }
  db.exec("CREATE INDEX IF NOT EXISTS payment_orders_created_at ON payment_orders (created_at DESC)");
  db.exec("CREATE INDEX IF NOT EXISTS payment_orders_status ON payment_orders (status)");

  // A refund webhook describes one refund, while the capture resource carries
  // the aggregate state. This event/refund-id ledger makes repeated and
  // out-of-order deliveries idempotent and lets us reconstruct the known
  // cumulative refunded amount without logging the full PayPal payload.
  db.exec(`
    CREATE TABLE IF NOT EXISTS paypal_refund_ledger (
      event_id TEXT PRIMARY KEY,
      refund_id TEXT NOT NULL UNIQUE,
      paypal_capture_id TEXT NOT NULL,
      amount_minor INTEGER NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 300),
      currency TEXT NOT NULL CHECK (currency = 'USD'),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(
    "CREATE INDEX IF NOT EXISTS paypal_refund_ledger_capture ON paypal_refund_ledger (paypal_capture_id)",
  );

  // PayPal retries webhooks. The event id primary key makes every delivery
  // safe to replay without applying a financial state transition twice.
  db.exec(`
    CREATE TABLE IF NOT EXISTS paypal_webhook_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      resource_id TEXT,
      processing_status TEXT NOT NULL DEFAULT 'received',
      received_at TEXT NOT NULL DEFAULT (datetime('now')),
      processed_at TEXT
    )
  `);

  database = db;
  return db;
}

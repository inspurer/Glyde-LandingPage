import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// Single SQLite file shared by the waitlist, analytics and payment ledger,
// opened once per process. node:sqlite ships with Node, so there is no native
// module to compile in the Alpine image.

const DEFAULT_DATA_DIR = process.env.NODE_ENV === "production" ? "/data" : ".data";

let database: DatabaseSync | null = null;

type StoredSchemaObject = {
  sql: string;
};

function createPaymentOrdersTable(db: DatabaseSync, tableName: string): void {
  db.exec(`
    CREATE TABLE ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkout_key TEXT NOT NULL UNIQUE,
      offer_code TEXT NOT NULL,
      amount_minor INTEGER NOT NULL CHECK (amount_minor IN (300, 500)),
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
}

function createRefundLedgerTable(db: DatabaseSync, tableName: string): void {
  db.exec(`
    CREATE TABLE ${tableName} (
      event_id TEXT PRIMARY KEY,
      refund_id TEXT NOT NULL UNIQUE,
      paypal_capture_id TEXT NOT NULL,
      amount_minor INTEGER NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 500),
      currency TEXT NOT NULL CHECK (currency = 'USD'),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function storedSchemaObjects(db: DatabaseSync, tableName: string): StoredSchemaObject[] {
  return db
    .prepare(
      `SELECT sql
       FROM sqlite_master
       WHERE tbl_name = ? AND type IN ('index', 'trigger') AND sql IS NOT NULL
       ORDER BY type, name`,
    )
    .all(tableName) as StoredSchemaObject[];
}

function migratePaymentOrders(db: DatabaseSync): void {
  const table = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'payment_orders'")
    .get() as { sql: string } | undefined;
  if (!table) {
    createPaymentOrdersTable(db, "payment_orders");
    return;
  }

  const columns = db.prepare("PRAGMA table_info(payment_orders)").all() as Array<{ name: string }>;
  const acceptsBothDepositAmounts =
    /CHECK\s*\(\s*amount_minor\s+IN\s*\(\s*300\s*,\s*500\s*\)\s*\)/i.test(table.sql);
  const hasRefundedMinor = columns.some((column) => column.name === "refunded_minor");
  if (acceptsBothDepositAmounts && hasRefundedMinor) return;

  const schemaObjects = storedSchemaObjects(db, "payment_orders");
  const rowCount = Number(
    (db.prepare("SELECT COUNT(*) AS total FROM payment_orders").get() as { total: number }).total,
  );
  const previousSequence = (
    db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'payment_orders'").get() as
      | { seq: number }
      | undefined
  )?.seq;
  const refundedMinor = hasRefundedMinor ? "refunded_minor" : "0";

  db.exec("BEGIN IMMEDIATE");
  try {
    createPaymentOrdersTable(db, "payment_orders__deposit_amount_migration");
    const inserted = db
      .prepare(
        `INSERT INTO payment_orders__deposit_amount_migration
           (id, checkout_key, offer_code, amount_minor, refunded_minor, currency,
            contact_email, paypal_order_id, paypal_capture_id, create_request_id,
            capture_request_id, status, paypal_status, payer_email, payer_id,
            environment, failure_code, created_at, updated_at, captured_at)
         SELECT id, checkout_key, offer_code, amount_minor, ${refundedMinor}, currency,
                contact_email, paypal_order_id, paypal_capture_id, create_request_id,
                capture_request_id, status, paypal_status, payer_email, payer_id,
                environment, failure_code, created_at, updated_at, captured_at
         FROM payment_orders`,
      )
      .run();
    if (Number(inserted.changes) !== rowCount) {
      throw new Error("PAYMENT_ORDERS_MIGRATION_ROW_COUNT_MISMATCH");
    }

    db.exec("DROP TABLE payment_orders");
    db.exec(
      "ALTER TABLE payment_orders__deposit_amount_migration RENAME TO payment_orders",
    );
    if (previousSequence !== undefined) {
      const migratedSequence = (
        db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'payment_orders'").get() as
          | { seq: number }
          | undefined
      )?.seq;
      const sequence = Math.max(Number(previousSequence), Number(migratedSequence ?? 0));
      db.prepare("DELETE FROM sqlite_sequence WHERE name = 'payment_orders'").run();
      db.prepare("INSERT INTO sqlite_sequence (name, seq) VALUES ('payment_orders', ?)").run(
        sequence,
      );
    }
    for (const object of schemaObjects) db.exec(object.sql);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function migrateRefundLedger(db: DatabaseSync): void {
  const table = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'paypal_refund_ledger'")
    .get() as { sql: string } | undefined;
  if (!table) {
    createRefundLedgerTable(db, "paypal_refund_ledger");
    return;
  }
  if (/amount_minor\s*<=\s*500/i.test(table.sql)) return;

  const schemaObjects = storedSchemaObjects(db, "paypal_refund_ledger");
  const rowCount = Number(
    (
      db.prepare("SELECT COUNT(*) AS total FROM paypal_refund_ledger").get() as {
        total: number;
      }
    ).total,
  );

  db.exec("BEGIN IMMEDIATE");
  try {
    createRefundLedgerTable(db, "paypal_refund_ledger__deposit_amount_migration");
    const inserted = db
      .prepare(
        `INSERT INTO paypal_refund_ledger__deposit_amount_migration
           (event_id, refund_id, paypal_capture_id, amount_minor, currency, created_at)
         SELECT event_id, refund_id, paypal_capture_id, amount_minor, currency, created_at
         FROM paypal_refund_ledger`,
      )
      .run();
    if (Number(inserted.changes) !== rowCount) {
      throw new Error("PAYPAL_REFUND_LEDGER_MIGRATION_ROW_COUNT_MISMATCH");
    }

    db.exec("DROP TABLE paypal_refund_ledger");
    db.exec(
      "ALTER TABLE paypal_refund_ledger__deposit_amount_migration RENAME TO paypal_refund_ledger",
    );
    for (const object of schemaObjects) db.exec(object.sql);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

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
  // The original production offer was $3. New reservations are $5, while old
  // PayPal orders must remain capturable, refundable and auditable at $3.
  // SQLite cannot alter CHECK constraints in place, so these helpers rebuild
  // only stale schemas inside transactions and replay every named index/trigger.
  migratePaymentOrders(db);
  db.exec("CREATE INDEX IF NOT EXISTS payment_orders_created_at ON payment_orders (created_at DESC)");
  db.exec("CREATE INDEX IF NOT EXISTS payment_orders_status ON payment_orders (status)");

  // A refund webhook describes one refund, while the capture resource carries
  // the aggregate state. This event/refund-id ledger makes repeated and
  // out-of-order deliveries idempotent and lets us reconstruct the known
  // cumulative refunded amount without logging the full PayPal payload.
  migrateRefundLedger(db);
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

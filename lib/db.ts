import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// Single SQLite file shared by the waitlist and the analytics events, opened
// once per process. node:sqlite ships with Node, so there is no dependency to
// install and no native module to compile in the Alpine image.

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

  database = db;
  return db;
}

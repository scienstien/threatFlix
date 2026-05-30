// ---------------------------------------------------------------------------
// SQLite database setup using Bun's built-in bun:sqlite.
// Forward-compat: migration system, repository pattern for easy Postgres swap.
// ---------------------------------------------------------------------------

import { Database } from "bun:sqlite";
import { config } from "../config.ts";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";

let db: Database | null = null;

/** Get or create the singleton database connection. */
export function getDb(): Database {
  if (db) return db;

  // Ensure the data directory exists
  const dir = dirname(config.databasePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(config.databasePath, { create: true });

  // Enable WAL mode for better concurrent read performance
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA busy_timeout = 5000");

  runMigrations(db);

  return db;
}

/** Close the database (for graceful shutdown). */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: "initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS events (
        id            TEXT PRIMARY KEY,
        project_id    TEXT NOT NULL,
        event         TEXT NOT NULL,
        user          TEXT NOT NULL,
        ip            TEXT NOT NULL,
        service       TEXT NOT NULL,
        timestamp     TEXT NOT NULL,
        received_at   TEXT NOT NULL,
        metadata      TEXT NOT NULL DEFAULT '{}',
        severity      TEXT,
        session_id    TEXT,
        geo_location  TEXT,
        tags          TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_events_project   ON events(project_id);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp  ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_event      ON events(event);
      CREATE INDEX IF NOT EXISTS idx_events_project_ts ON events(project_id, timestamp);

      CREATE TABLE IF NOT EXISTS alerts (
        id                 TEXT PRIMARY KEY,
        project_id         TEXT NOT NULL,
        attack             TEXT NOT NULL,
        severity           TEXT NOT NULL,
        confidence         REAL NOT NULL,
        mitre              TEXT NOT NULL,
        mitre_name         TEXT NOT NULL,
        reasoning          TEXT NOT NULL,
        recommendation     TEXT NOT NULL,
        related_event_ids  TEXT NOT NULL DEFAULT '[]',
        created_at         TEXT NOT NULL,
        status             TEXT NOT NULL DEFAULT 'open',
        assignee           TEXT,
        webhook_delivered  INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_alerts_project  ON alerts(project_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_alerts_status   ON alerts(status);

      CREATE TABLE IF NOT EXISTS api_keys (
        key         TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL,
        label       TEXT,
        created_at  TEXT NOT NULL,
        revoked     INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_apikeys_project ON api_keys(project_id);

      CREATE TABLE IF NOT EXISTS webhooks (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL,
        url         TEXT NOT NULL,
        secret      TEXT,
        events      TEXT NOT NULL DEFAULT '["alert.created"]',
        active      INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_webhooks_project ON webhooks(project_id);

      CREATE TABLE IF NOT EXISTS users (
        id          TEXT PRIMARY KEY,
        email       TEXT NOT NULL UNIQUE,
        name        TEXT,
        role        TEXT NOT NULL DEFAULT 'user',
        project_id  TEXT,
        created_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `,
  },
];

function runMigrations(database: Database): void {
  // Create migrations tracking table
  database.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version   INTEGER PRIMARY KEY,
      name      TEXT NOT NULL,
      applied   TEXT NOT NULL
    )
  `);

  const applied = new Set(
    database
      .query("SELECT version FROM _migrations")
      .all()
      .map((row: any) => row.version as number)
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;

    console.log(`  📦 Running migration v${migration.version}: ${migration.name}`);
    database.run(migration.sql);
    database.run(
      "INSERT INTO _migrations (version, name, applied) VALUES (?, ?, ?)",
      [migration.version, migration.name, new Date().toISOString()]
    );
  }

  // Seed the demo API key if it doesn't exist
  const existing = database.query("SELECT key FROM api_keys WHERE key = ?").get("demo-key");
  if (!existing) {
    database.run(
      "INSERT INTO api_keys (key, project_id, label, created_at) VALUES (?, ?, ?, ?)",
      ["demo-key", "demo-project", "Demo key (hackathon)", new Date().toISOString()]
    );
    console.log("  🔑 Seeded demo API key: demo-key → demo-project");
  }
}

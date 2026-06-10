// ---------------------------------------------------------------------------
// SQLite database setup using Bun's built-in bun:sqlite.
// Forward-compat: migration system, repository pattern for easy Postgres swap.
// ---------------------------------------------------------------------------

import { Database } from "bun:sqlite";
import { config } from "../config.ts";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";

let db: Database | null = null;
let databasePathOverride: string | null = null;

/** Get or create the singleton database connection. */
export function getDb(): Database {
  if (db) return db;

  // Ensure the data directory exists
  const databasePath = databasePathOverride ?? config.databasePath;
  const dir = dirname(databasePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(databasePath, { create: true });

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
  {
    version: 2,
    name: "add_password_hash_to_users",
    sql: `
      ALTER TABLE users ADD COLUMN password_hash TEXT;
    `,
  },
  {
    version: 3,
    name: "add_investigations",
    sql: `
      CREATE TABLE IF NOT EXISTS investigations (
        id                 TEXT PRIMARY KEY,
        project_id         TEXT NOT NULL,
        title              TEXT NOT NULL,
        severity           TEXT NOT NULL,
        confidence         REAL NOT NULL,
        mitre              TEXT NOT NULL,
        mitre_name         TEXT NOT NULL,
        summary            TEXT NOT NULL,
        recommendation     TEXT NOT NULL,
        graph_json         TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
        feature_json       TEXT NOT NULL DEFAULT '{}',
        related_event_ids  TEXT NOT NULL DEFAULT '[]',
        created_at         TEXT NOT NULL,
        status             TEXT NOT NULL DEFAULT 'open',
        assignee           TEXT,
        webhook_delivered  INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_investigations_project
        ON investigations(project_id);
      CREATE INDEX IF NOT EXISTS idx_investigations_created
        ON investigations(created_at);
      CREATE INDEX IF NOT EXISTS idx_investigations_severity
        ON investigations(severity);
      CREATE INDEX IF NOT EXISTS idx_investigations_status
        ON investigations(status);

      CREATE TABLE IF NOT EXISTS evidence (
        id                 TEXT PRIMARY KEY,
        investigation_id   TEXT NOT NULL,
        project_id         TEXT NOT NULL,
        rule_id            TEXT NOT NULL,
        weight             REAL NOT NULL,
        description        TEXT NOT NULL,
        event_ids          TEXT NOT NULL DEFAULT '[]',
        created_at         TEXT NOT NULL,
        FOREIGN KEY (investigation_id)
          REFERENCES investigations(id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_evidence_investigation
        ON evidence(investigation_id);
      CREATE INDEX IF NOT EXISTS idx_evidence_project
        ON evidence(project_id);
    `,
  },
  {
    version: 4,
    name: "add_deterministic_columns",
    sql: `
      ALTER TABLE investigations ADD COLUMN deterministic_chain_json TEXT;
      ALTER TABLE investigations ADD COLUMN deterministic_score_json TEXT;
      ALTER TABLE evidence ADD COLUMN deterministic_json TEXT;
    `,
  },
  {
    version: 5,
    name: "add_llm_reports_and_chat",
    sql: `
      ALTER TABLE investigations ADD COLUMN ueba_summary_json TEXT;

      CREATE TABLE IF NOT EXISTS investigation_llm_reports (
        id                 TEXT PRIMARY KEY,
        investigation_id   TEXT NOT NULL,
        project_id         TEXT NOT NULL,
        context_version    INTEGER NOT NULL,
        trigger            TEXT NOT NULL,
        status             TEXT NOT NULL,
        attempt_count      INTEGER NOT NULL DEFAULT 0,
        provider           TEXT NOT NULL,
        model              TEXT NOT NULL,
        context_json       TEXT,
        report_json        TEXT,
        error              TEXT,
        created_at         TEXT NOT NULL,
        started_at         TEXT,
        completed_at       TEXT,
        FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_llm_reports_investigation
        ON investigation_llm_reports(investigation_id, context_version DESC);
      CREATE INDEX IF NOT EXISTS idx_llm_reports_status
        ON investigation_llm_reports(status, created_at);

      CREATE TABLE IF NOT EXISTS investigation_chat_messages (
        id                    TEXT PRIMARY KEY,
        investigation_id      TEXT NOT NULL,
        project_id            TEXT NOT NULL,
        report_id             TEXT NOT NULL,
        context_version       INTEGER NOT NULL,
        role                  TEXT NOT NULL,
        content               TEXT NOT NULL,
        referenced_source_ids TEXT NOT NULL DEFAULT '[]',
        model                 TEXT,
        created_at            TEXT NOT NULL,
        FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
        FOREIGN KEY (report_id) REFERENCES investigation_llm_reports(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_chat_investigation
        ON investigation_chat_messages(investigation_id, created_at);
    `,
  },
  {
    version: 6,
    name: "add_graph_similarity_fingerprints",
    sql: `
      CREATE TABLE IF NOT EXISTS investigation_graph_fingerprints (
        investigation_id    TEXT PRIMARY KEY,
        project_id           TEXT NOT NULL,
        schema_version       TEXT NOT NULL,
        algorithm_version    TEXT NOT NULL,
        iterations           INTEGER NOT NULL,
        source_scope         TEXT NOT NULL,
        source_digest        TEXT NOT NULL,
        canonical_graph_json TEXT NOT NULL,
        fingerprint_json     TEXT NOT NULL,
        summary_json         TEXT NOT NULL,
        created_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL,
        FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_graph_fingerprints_project_version
        ON investigation_graph_fingerprints(project_id, schema_version, algorithm_version);
    `,
  },
];

function runMigrations(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version   INTEGER PRIMARY KEY,
      name      TEXT NOT NULL,
      applied   TEXT NOT NULL
    )
  `);

  reconcileInvestigationMigrations(database);
  const applied = getAppliedMigrations(database);

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;

    console.log(`  📦 Running migration v${migration.version}: ${migration.name}`);
    database.transaction(() => {
      applyMigration(database, migration);
      database.run(
        "INSERT INTO _migrations (version, name, applied) VALUES (?, ?, ?)",
        [migration.version, migration.name, new Date().toISOString()]
      );
    })();
  }
}

/** Override the database path for isolated tests. Requires a closed connection. */
export function setDatabasePathForTests(path: string | null): void {
  if (db) {
    throw new Error("Close the database before changing the test database path.");
  }
  databasePathOverride = path;
}

function applyMigration(
  database: Database,
  migration: (typeof MIGRATIONS)[number]
): void {
  if (migration.version === 4) {
    ensureColumn(database, "investigations", "deterministic_chain_json", "TEXT");
    ensureColumn(database, "investigations", "deterministic_score_json", "TEXT");
    ensureColumn(database, "evidence", "deterministic_json", "TEXT");
    return;
  }
  if (migration.version === 5) {
    ensureColumn(database, "investigations", "ueba_summary_json", "TEXT");
    database.run(`
      CREATE TABLE IF NOT EXISTS investigation_llm_reports (
        id TEXT PRIMARY KEY, investigation_id TEXT NOT NULL, project_id TEXT NOT NULL,
        context_version INTEGER NOT NULL, trigger TEXT NOT NULL, status TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0, provider TEXT NOT NULL, model TEXT NOT NULL,
        context_json TEXT, report_json TEXT, error TEXT, created_at TEXT NOT NULL,
        started_at TEXT, completed_at TEXT,
        FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_llm_reports_investigation
        ON investigation_llm_reports(investigation_id, context_version DESC);
      CREATE INDEX IF NOT EXISTS idx_llm_reports_status
        ON investigation_llm_reports(status, created_at);
      CREATE TABLE IF NOT EXISTS investigation_chat_messages (
        id TEXT PRIMARY KEY, investigation_id TEXT NOT NULL, project_id TEXT NOT NULL,
        report_id TEXT NOT NULL, context_version INTEGER NOT NULL, role TEXT NOT NULL,
        content TEXT NOT NULL, referenced_source_ids TEXT NOT NULL DEFAULT '[]',
        model TEXT, created_at TEXT NOT NULL,
        FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
        FOREIGN KEY (report_id) REFERENCES investigation_llm_reports(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_chat_investigation
        ON investigation_chat_messages(investigation_id, created_at);
    `);
    return;
  }

  database.run(migration.sql);
}

function reconcileInvestigationMigrations(database: Database): void {
  const applied = getAppliedMigrations(database);
  const hasInvestigationSchema =
    tableExists(database, "investigations") && tableExists(database, "evidence");

  if (applied.has(3) && !hasInvestigationSchema) {
    database.run("DELETE FROM _migrations WHERE version >= 3");
    return;
  }

  const hasDeterministicColumns =
    columnExists(database, "investigations", "deterministic_chain_json") &&
    columnExists(database, "investigations", "deterministic_score_json") &&
    columnExists(database, "evidence", "deterministic_json");

  if (applied.has(4) && !hasDeterministicColumns) {
    database.run("DELETE FROM _migrations WHERE version = 4");
  }

  const hasLlmSchema =
    columnExists(database, "investigations", "ueba_summary_json") &&
    tableExists(database, "investigation_llm_reports") &&
    tableExists(database, "investigation_chat_messages");
  if (applied.has(5) && !hasLlmSchema) {
    database.run("DELETE FROM _migrations WHERE version = 5");
  }

  if (applied.has(6) && !tableExists(database, "investigation_graph_fingerprints")) {
    database.run("DELETE FROM _migrations WHERE version = 6");
  }
}

function getAppliedMigrations(database: Database): Set<number> {
  return new Set(
    database
      .query("SELECT version FROM _migrations")
      .all()
      .map((row: any) => row.version as number)
  );
}

function ensureColumn(
  database: Database,
  table: string,
  column: string,
  definition: string
): void {
  if (!columnExists(database, table, column)) {
    database.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function tableExists(database: Database, table: string): boolean {
  return Boolean(
    database
      .query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table)
  );
}

function columnExists(database: Database, table: string, column: string): boolean {
  if (!tableExists(database, table)) return false;
  return (database.query(`PRAGMA table_info(${table})`).all() as any[]).some(
    (row) => row.name === column
  );
}

// ---------------------------------------------------------------------------
// Event repository — all database operations for security events.
// Every query is scoped by projectId for data isolation.
// ---------------------------------------------------------------------------

import { getDb } from "../database.ts";
import type { SecurityEvent, SecurityEventInput } from "../../types/events.ts";

export const eventRepo = {
  /** Insert a new event. */
  insert(event: SecurityEvent): void {
    const db = getDb();
    db.run(
      `INSERT INTO events (id, project_id, event, user, ip, service, timestamp, received_at, metadata, severity, session_id, geo_location, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.projectId,
        event.event,
        event.user,
        event.ip,
        event.service,
        event.timestamp,
        event.receivedAt,
        JSON.stringify(event.metadata),
        event.severity ?? null,
        event.sessionId ?? null,
        event.geoLocation ? JSON.stringify(event.geoLocation) : null,
        event.tags ? JSON.stringify(event.tags) : null,
      ]
    );
  },

  /** Get the latest N events for a project. */
  getLatest(projectId: string, limit: number = 50): SecurityEvent[] {
    const db = getDb();
    const rows = db
      .query(
        `SELECT * FROM events WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?`
      )
      .all(projectId, limit) as any[];
    return rows.map(mapRow);
  },

  /** Get events within a time range for a project. */
  getByTimeRange(projectId: string, from: string, to: string): SecurityEvent[] {
    const db = getDb();
    const rows = db
      .query(
        `SELECT * FROM events WHERE project_id = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC`
      )
      .all(projectId, from, to) as any[];
    return rows.map(mapRow);
  },

  /** Get specific events by their IDs (scoped to project for safety). */
  getByIds(projectId: string, ids: string[]): SecurityEvent[] {
    if (ids.length === 0) return [];
    const db = getDb();
    const placeholders = ids.map(() => "?").join(", ");
    const rows = db
      .query(
        `SELECT * FROM events WHERE project_id = ? AND id IN (${placeholders}) ORDER BY timestamp ASC`
      )
      .all(projectId, ...ids) as any[];
    return rows.map(mapRow);
  },

  /** Count events in the last N milliseconds for a project. */
  countRecent(projectId: string, windowMs: number): number {
    const db = getDb();
    const since = new Date(Date.now() - windowMs).toISOString();
    const row = db
      .query(
        `SELECT COUNT(*) as count FROM events WHERE project_id = ? AND received_at >= ?`
      )
      .get(projectId, since) as any;
    return row?.count ?? 0;
  },

  /** Get recent unanalysed events for a project (events newer than the last alert). */
  getUnanalysed(projectId: string, limit: number = 50): SecurityEvent[] {
    const db = getDb();
    const rows = db
      .query(
        `SELECT e.* FROM events e
         WHERE e.project_id = ?
           AND e.id NOT IN (
             SELECT json_each.value
             FROM alerts a, json_each(a.related_event_ids)
             WHERE a.project_id = ?
           )
         ORDER BY e.timestamp DESC
         LIMIT ?`
      )
      .all(projectId, projectId, limit) as any[];
    return rows.map(mapRow);
  },

  /** Global count of all events (admin only). */
  countAll(): number {
    const db = getDb();
    const row = db.query("SELECT COUNT(*) as count FROM events").get() as any;
    return row?.count ?? 0;
  },

  /** Count events per project (admin only). */
  countByProject(): { projectId: string; count: number }[] {
    const db = getDb();
    const rows = db
      .query(
        "SELECT project_id, COUNT(*) as count FROM events GROUP BY project_id ORDER BY count DESC"
      )
      .all() as any[];
    return rows.map((r: any) => ({ projectId: r.project_id, count: r.count }));
  },
};

// ---------------------------------------------------------------------------
// Row → SecurityEvent mapper
// ---------------------------------------------------------------------------

function mapRow(row: any): SecurityEvent {
  return {
    id: row.id,
    projectId: row.project_id,
    event: row.event,
    user: row.user,
    ip: row.ip,
    service: row.service,
    timestamp: row.timestamp,
    receivedAt: row.received_at,
    metadata: safeJson(row.metadata, {}),
    severity: row.severity ?? undefined,
    sessionId: row.session_id ?? undefined,
    geoLocation: row.geo_location ? safeJson(row.geo_location, undefined) : undefined,
    tags: row.tags ? safeJson(row.tags, undefined) : undefined,
  };
}

function safeJson<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

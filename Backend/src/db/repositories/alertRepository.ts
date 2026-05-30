// ---------------------------------------------------------------------------
// Alert repository — all database operations for threat alerts.
// Every query is scoped by projectId for data isolation.
// ---------------------------------------------------------------------------

import { getDb } from "../database.ts";
import type { ThreatAlert, AlertStatus } from "../../types/alerts.ts";

export const alertRepo = {
  /** Insert a new alert. */
  insert(alert: ThreatAlert): void {
    const db = getDb();
    db.run(
      `INSERT INTO alerts (id, project_id, attack, severity, confidence, mitre, mitre_name, reasoning, recommendation, related_event_ids, created_at, status, assignee, webhook_delivered)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        alert.id,
        alert.projectId,
        alert.attack,
        alert.severity,
        alert.confidence,
        alert.mitre,
        alert.mitreName,
        alert.reasoning,
        alert.recommendation,
        JSON.stringify(alert.relatedEventIds),
        alert.createdAt,
        alert.status,
        alert.assignee ?? null,
        alert.webhookDelivered ? 1 : 0,
      ]
    );
  },

  /** Get all alerts for a project, optionally filtered. */
  getAll(
    projectId: string,
    filters?: { severity?: string; status?: string }
  ): ThreatAlert[] {
    const db = getDb();
    let sql = "SELECT * FROM alerts WHERE project_id = ?";
    const params: any[] = [projectId];

    if (filters?.severity) {
      sql += " AND severity = ?";
      params.push(filters.severity);
    }
    if (filters?.status) {
      sql += " AND status = ?";
      params.push(filters.status);
    }

    sql += " ORDER BY created_at DESC";

    const rows = db.query(sql).all(...params) as any[];
    return rows.map(mapRow);
  },

  /** Get a single alert by ID (scoped to project). */
  getById(id: string, projectId: string): ThreatAlert | null {
    const db = getDb();
    const row = db
      .query("SELECT * FROM alerts WHERE id = ? AND project_id = ?")
      .get(id, projectId) as any;
    return row ? mapRow(row) : null;
  },

  /** Update alert status (scoped to project). */
  updateStatus(id: string, projectId: string, status: AlertStatus): boolean {
    const db = getDb();
    const result = db.run(
      "UPDATE alerts SET status = ? WHERE id = ? AND project_id = ?",
      [status, id, projectId]
    );
    return result.changes > 0;
  },

  /** Mark alert as webhook-delivered. */
  markWebhookDelivered(id: string): void {
    const db = getDb();
    db.run("UPDATE alerts SET webhook_delivered = 1 WHERE id = ?", [id]);
  },

  /** Global: get all alerts across all projects (admin only). */
  getAllGlobal(limit: number = 100): ThreatAlert[] {
    const db = getDb();
    const rows = db
      .query("SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?")
      .all(limit) as any[];
    return rows.map(mapRow);
  },

  /** Global: count alerts by severity (admin only). */
  countBySeverity(): Record<string, number> {
    const db = getDb();
    const rows = db
      .query(
        "SELECT severity, COUNT(*) as count FROM alerts GROUP BY severity"
      )
      .all() as any[];
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.severity] = row.count;
    }
    return result;
  },
};

// ---------------------------------------------------------------------------
// Row → ThreatAlert mapper
// ---------------------------------------------------------------------------

function mapRow(row: any): ThreatAlert {
  return {
    id: row.id,
    projectId: row.project_id,
    attack: row.attack,
    severity: row.severity,
    confidence: row.confidence,
    mitre: row.mitre,
    mitreName: row.mitre_name,
    reasoning: row.reasoning,
    recommendation: row.recommendation,
    relatedEventIds: safeJson(row.related_event_ids, []),
    createdAt: row.created_at,
    status: row.status,
    assignee: row.assignee ?? undefined,
    webhookDelivered: row.webhook_delivered === 1,
  };
}

function safeJson<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

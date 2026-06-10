import { Router } from "express";
import { requireAdmin } from "../middleware/auth.ts";
import { eventRepo } from "../db/repositories/eventRepository.ts";
import { alertRepo } from "../db/repositories/alertRepository.ts";
import { investigationRepo } from "../db/repositories/investigationRepository.ts";
import { getDb } from "../db/database.ts";
import { normalizeSeverity } from "../types/api.ts";

export const adminRouter = Router();

adminRouter.get("/stats", async (req, res) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;

  const totalEvents = eventRepo.countAll();
  const alertsBySeverity = mergeSeverityCounts(
    alertRepo.countBySeverity(),
    investigationRepo.countBySeverity()
  );

  const db = getDb();
  const totalApiKeys =
    (db.query("SELECT COUNT(*) as c FROM api_keys WHERE revoked = 0").get() as any)?.c ?? 0;

  const totalAlerts = Object.values(alertsBySeverity).reduce((sum, count) => sum + count, 0);

  return res.json({
    totalEvents,
    totalTenants: totalApiKeys,
    totalAlerts,
    severityDistribution: alertsBySeverity,
  });
});

adminRouter.get("/projects", async (req, res) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;

  const db = getDb();
  const rows = db
    .query(
      `SELECT
        ak.project_id,
        ak.label,
        ak.created_at,
        COUNT(DISTINCT e.id) as event_count,
        COUNT(DISTINCT a.id) + COUNT(DISTINCT i.id) as alert_count
      FROM api_keys ak
      LEFT JOIN events e ON e.project_id = ak.project_id
      LEFT JOIN alerts a ON a.project_id = ak.project_id
      LEFT JOIN investigations i ON i.project_id = ak.project_id
      WHERE ak.revoked = 0
      GROUP BY ak.project_id
      ORDER BY event_count DESC`
    )
    .all() as any[];

  const projects = rows.map((row) => ({
    projectId: row.project_id,
    label: row.label,
    createdAt: row.created_at,
    totalEvents: row.event_count,
    totalAlerts: row.alert_count,
  }));

  return res.json({ projects });
});

function mergeSeverityCounts(...sources: Record<string, number>[]): Record<string, number> {
  const result = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const source of sources) {
    for (const [severity, count] of Object.entries(source)) {
      result[normalizeSeverity(severity)] += count;
    }
  }
  return result;
}

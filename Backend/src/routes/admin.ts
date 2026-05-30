// ---------------------------------------------------------------------------
// Admin routes — GET /admin/stats, GET /admin/projects
// ---------------------------------------------------------------------------

import { authenticateJwt } from "../middleware/auth.ts";
import { eventRepo } from "../db/repositories/eventRepository.ts";
import { alertRepo } from "../db/repositories/alertRepository.ts";
import { getDb } from "../db/database.ts";

/** Require admin role middleware. */
async function requireAdmin(req: Request): Promise<Response | null> {
  const auth = await authenticateJwt(req);
  if (!auth) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  if (auth.role !== "admin") {
    return Response.json({ error: "Admin access required." }, { status: 403 });
  }
  return null; // allowed
}

/** GET /admin/stats — global platform statistics. */
export async function handleAdminStats(req: Request): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const totalEvents = eventRepo.countAll();
  const eventsByProject = eventRepo.countByProject();
  const alertsBySeverity = alertRepo.countBySeverity();
  const recentAlerts = alertRepo.getAllGlobal(10);

  const db = getDb();
  const totalUsers = (db.query("SELECT COUNT(*) as c FROM users").get() as any)?.c ?? 0;
  const totalApiKeys = (db.query("SELECT COUNT(*) as c FROM api_keys WHERE revoked = 0").get() as any)?.c ?? 0;

  return Response.json({
    totalEvents,
    totalUsers,
    totalApiKeys,
    eventsByProject,
    alertsBySeverity,
    recentAlerts,
  });
}

/** GET /admin/projects — list all projects with their stats. */
export async function handleAdminProjects(req: Request): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const db = getDb();

  // Get all unique projects from api_keys
  const projects = db
    .query(
      `SELECT 
        ak.project_id,
        ak.label,
        ak.created_at,
        COUNT(DISTINCT e.id) as event_count,
        COUNT(DISTINCT a.id) as alert_count
      FROM api_keys ak
      LEFT JOIN events e ON e.project_id = ak.project_id
      LEFT JOIN alerts a ON a.project_id = ak.project_id
      WHERE ak.revoked = 0
      GROUP BY ak.project_id
      ORDER BY event_count DESC`
    )
    .all() as any[];

  return Response.json({
    projects: projects.map((p: any) => ({
      projectId: p.project_id,
      label: p.label,
      createdAt: p.created_at,
      eventCount: p.event_count,
      alertCount: p.alert_count,
    })),
  });
}

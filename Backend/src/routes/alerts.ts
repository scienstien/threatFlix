// ---------------------------------------------------------------------------
// Alert routes — GET /alerts, GET /alerts/:id, PATCH /alerts/:id
// ---------------------------------------------------------------------------

import { authenticateJwt } from "../middleware/auth.ts";
import { alertRepo } from "../db/repositories/alertRepository.ts";
import type { AlertStatus } from "../types/alerts.ts";

const VALID_STATUSES: AlertStatus[] = ["open", "acknowledged", "resolved", "false_positive"];

/** GET /alerts — list alerts for the authenticated project. Auth: JWT. */
export async function handleGetAlerts(req: Request): Promise<Response> {
  const auth = await authenticateJwt(req);
  if (!auth) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const url = new URL(req.url);
  const severity = url.searchParams.get("severity") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  let projectId = auth.projectId;
  if (auth.role === "admin" && url.searchParams.get("projectId")) {
    projectId = url.searchParams.get("projectId")!;
  }

  // Admin without project filter sees global alerts
  if (projectId === "__admin__" && !url.searchParams.get("projectId")) {
    const alerts = alertRepo.getAllGlobal(100);
    return Response.json({ alerts, count: alerts.length });
  }

  const alerts = alertRepo.getAll(projectId, { severity, status });
  return Response.json({ alerts, count: alerts.length });
}

/** GET /alerts/:id — get a single alert with details. Auth: JWT. */
export async function handleGetAlertById(req: Request, id: string): Promise<Response> {
  const auth = await authenticateJwt(req);
  if (!auth) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  let projectId = auth.projectId;

  // Admin can access any project's alert
  if (auth.role === "admin") {
    projectId = "__any__"; // we'll handle this below
  }

  // For admins, try to find the alert across all projects
  let alert;
  if (projectId === "__any__") {
    // Admin: search globally
    const allAlerts = alertRepo.getAllGlobal(1000);
    alert = allAlerts.find((a) => a.id === id) ?? null;
  } else {
    alert = alertRepo.getById(id, projectId);
  }

  if (!alert) {
    return Response.json({ error: "Alert not found." }, { status: 404 });
  }

  return Response.json({ alert });
}

/** PATCH /alerts/:id — update alert status. Auth: JWT. */
export async function handlePatchAlert(req: Request, id: string): Promise<Response> {
  const auth = await authenticateJwt(req);
  if (!auth) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const newStatus = body.status as AlertStatus;
  if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
    return Response.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  let projectId = auth.projectId;
  if (auth.role === "admin" && body.projectId) {
    projectId = body.projectId;
  }

  if (projectId === "__admin__") {
    return Response.json({ error: "Specify projectId for admin operations." }, { status: 400 });
  }

  const updated = alertRepo.updateStatus(id, projectId, newStatus);
  if (!updated) {
    return Response.json({ error: "Alert not found or access denied." }, { status: 404 });
  }

  return Response.json({ success: true, id, status: newStatus });
}

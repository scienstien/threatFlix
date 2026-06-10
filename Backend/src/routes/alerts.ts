import { Router } from "express";
import { authenticateJwt } from "../middleware/auth.ts";
import { alertRepo } from "../db/repositories/alertRepository.ts";
import { investigationRepo } from "../db/repositories/investigationRepository.ts";
import { toAlertApiView, toInvestigationApiView } from "../types/api.ts";
import type { AlertStatus } from "../types/alerts.ts";

const VALID_STATUSES: AlertStatus[] = ["open", "acknowledged", "resolved", "false_positive"];

export const alertsRouter = Router();

alertsRouter.get("/", async (req, res) => {
  const auth = authenticateJwt(req);
  if (!auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const severity = typeof req.query.severity === "string" ? req.query.severity : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  let projectId = auth.projectId;
  if (auth.role === "admin" && typeof req.query.projectId === "string") {
    projectId = req.query.projectId;
  }

  if (projectId === "__admin__" && typeof req.query.projectId !== "string") {
    const alerts = [
      ...alertRepo.getAllGlobal(100).map(toAlertApiView),
      ...investigationRepo.getAllGlobal(100).map(toInvestigationApiView),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return res.json({ alerts, count: alerts.length });
  }

  const alerts = [
    ...alertRepo.getAll(projectId, { severity, status }).map(toAlertApiView),
    ...investigationRepo.getAll(projectId, { severity, status }).map(toInvestigationApiView),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return res.json({ alerts, count: alerts.length });
});

alertsRouter.get("/:id", async (req, res) => {
  const auth = authenticateJwt(req);
  if (!auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const alertId = req.params.id;
  let alert = null;

  if (auth.role === "admin") {
    const allAlerts = [
      ...alertRepo.getAllGlobal(1000).map(toAlertApiView),
      ...investigationRepo.getAllGlobal(1000).map(toInvestigationApiView),
    ];
    alert = allAlerts.find((item) => item.id === alertId) ?? null;
  } else {
    const legacy = alertRepo.getById(alertId, auth.projectId);
    const investigation = investigationRepo.getById(alertId, auth.projectId);
    alert = legacy ? toAlertApiView(legacy) : investigation ? toInvestigationApiView(investigation) : null;
  }

  if (!alert) {
    return res.status(404).json({ error: "Alert not found." });
  }

  return res.json(alert);
});

alertsRouter.patch("/:id", async (req, res) => {
  const auth = authenticateJwt(req);
  if (!auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const newStatus = req.body?.status as AlertStatus | undefined;
  if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  let projectId = auth.projectId;
  if (auth.role === "admin" && typeof req.body?.projectId === "string") {
    projectId = req.body.projectId;
  }

  if (projectId === "__admin__") {
    return res.status(400).json({ error: "Specify projectId for admin operations." });
  }

  const updated =
    alertRepo.updateStatus(req.params.id, projectId, newStatus) ||
    investigationRepo.updateStatus(req.params.id, projectId, newStatus);
  if (!updated) {
    return res.status(404).json({ error: "Alert not found or access denied." });
  }

  return res.json({ success: true, id: req.params.id, status: newStatus });
});

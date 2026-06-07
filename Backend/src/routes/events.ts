import { Router } from "express";
import { authenticateApiKey, authenticateJwt } from "../middleware/auth.ts";
import { validateEventPayload } from "../middleware/validation.ts";
import { eventRepo } from "../db/repositories/eventRepository.ts";
import { analyzeEvents, shouldAutoAnalyze } from "../ai/analyzer.ts";
import type { SecurityEvent } from "../types/events.ts";

export const eventsRouter = Router();

eventsRouter.post("/", async (req, res) => {
  const auth = authenticateApiKey(req);
  if (!auth) {
    return res.status(401).json({ error: "Invalid or missing API key." });
  }

  const rawBody = req.body;
  const items = Array.isArray(rawBody) ? rawBody : [rawBody];
  const insertedIds: string[] = [];
  const errors: Array<{ index: number; errors: unknown[] }> = [];

  for (let index = 0; index < items.length; index++) {
    const rawEvent = items[index];
    const validation = validateEventPayload(rawEvent);

    if (!validation.valid) {
      errors.push({ index, errors: validation.errors });
      continue;
    }

    const data = rawEvent as Record<string, any>;
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      projectId: auth.projectId,
      event: data.event,
      user: data.user,
      ip: data.ip,
      service: data.service,
      timestamp: data.timestamp || new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      metadata: data.metadata ?? {},
      severity: data.severity,
      sessionId: data.sessionId,
      geoLocation: data.geoLocation,
      tags: data.tags,
    };

    eventRepo.insert(event);
    insertedIds.push(event.id);
  }

  if (insertedIds.length > 0 && shouldAutoAnalyze(auth.projectId)) {
    analyzeEvents(auth.projectId).catch((error) => {
      console.error("Auto-analysis failed:", (error as Error).message);
    });
  }

  const statusCode =
    errors.length > 0 ? (insertedIds.length > 0 ? 207 : 400) : 201;

  return res.status(statusCode).json({
    inserted: insertedIds.length,
    eventIds: insertedIds,
    errors: errors.length > 0 ? errors : undefined,
  });
});

eventsRouter.get("/latest", async (req, res) => {
  const auth = authenticateJwt(req);
  if (!auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const requestedLimit = Number(req.query.limit ?? 50);
  const limit = Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 50, 200);

  let projectId = auth.projectId;
  if (auth.role === "admin" && typeof req.query.projectId === "string") {
    projectId = req.query.projectId;
  }

  if (projectId === "__admin__" && typeof req.query.projectId !== "string") {
    return res.json({
      events: [],
      message: "Specify ?projectId= for admin queries.",
    });
  }

  const events = eventRepo.getLatest(projectId, limit);
  return res.json({ events, count: events.length });
});

import { Router } from "express";
import { authenticateApiKey, authenticateJwt } from "../middleware/auth.ts";
import { analyzeEvents } from "../ai/analyzer.ts";
import { eventRepo } from "../db/repositories/eventRepository.ts";

export const analyzeRouter = Router();

analyzeRouter.post("/", async (req, res) => {
  const auth = authenticateJwt(req) ?? authenticateApiKey(req);
  if (!auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const body = req.body ?? {};
  const requestedProjectId =
    auth.role === "admin" && typeof body.projectId === "string"
      ? body.projectId
      : auth.projectId;

  if (requestedProjectId === "__admin__" && typeof body.projectId !== "string") {
    return res.status(400).json({ error: "Specify projectId for admin analysis." });
  }

  let events;
  if (Array.isArray(body.eventIds)) {
    events = eventRepo.getByIds(requestedProjectId, body.eventIds);
    if (events.length === 0) {
      return res.status(404).json({ error: "No matching events found." });
    }
  }

  try {
    const alert = await analyzeEvents(requestedProjectId, events);
    return res.json({ alert });
  } catch (error) {
    const message = (error as Error).message;

    if (message.includes("rate limit") || message.includes("Cooldown")) {
      return res.status(429).json({ error: message });
    }

    return res.status(500).json({ error: message });
  }
});

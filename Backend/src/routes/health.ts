import { Router } from "express";
import { getDb } from "../db/database.ts";
import { config } from "../config.ts";

const startTime = Date.now();

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  let dbStatus = "ok";
  let eventCount = 0;
  let alertCount = 0;

  try {
    const db = getDb();
    eventCount = (db.query("SELECT COUNT(*) as c FROM events").get() as any)?.c ?? 0;
    alertCount = (db.query("SELECT COUNT(*) as c FROM alerts").get() as any)?.c ?? 0;
  } catch {
    dbStatus = "error";
  }

  res.json({
    status: "healthy",
    version: "0.1.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    database: dbStatus,
    counts: {
      events: eventCount,
      alerts: alertCount,
    },
    ai: {
      provider: "ollama",
      model: config.ollamaModel,
      url: config.ollamaUrl,
      authority: "report-only",
    },
  });
});

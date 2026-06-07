import { Router } from "express";
import { requireJwt } from "../middleware/auth.ts";
import { getDb } from "../db/database.ts";

export const webhooksRouter = Router();

webhooksRouter.post("/", async (req, res) => {
  const auth = requireJwt(req, res);
  if (!auth) return;

  const body = req.body;
  if (!body || typeof body.url !== "string") {
    return res.status(400).json({ error: '"url" is required and must be a string.' });
  }

  try {
    new URL(body.url);
  } catch {
    return res.status(400).json({ error: "Invalid URL format." });
  }

  const projectId =
    auth.role === "admin" && typeof body.projectId === "string"
      ? body.projectId
      : auth.projectId;

  if (projectId === "__admin__" && typeof body.projectId !== "string") {
    return res.status(400).json({ error: "Specify projectId for admin operations." });
  }

  const webhookId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const events = Array.isArray(body.events) ? body.events : ["alert.created"];

  const db = getDb();
  db.run(
    "INSERT INTO webhooks (id, project_id, url, secret, events, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      webhookId,
      projectId,
      body.url,
      body.secret ?? null,
      JSON.stringify(events),
      1,
      createdAt,
    ]
  );

  return res.status(201).json({
    id: webhookId,
    projectId,
    url: body.url,
    events,
    active: true,
    createdAt,
  });
});

webhooksRouter.get("/", async (req, res) => {
  const auth = requireJwt(req, res);
  if (!auth) return;

  const db = getDb();
  let rows: any[] = [];

  if (auth.role === "admin") {
    rows = db.query("SELECT * FROM webhooks ORDER BY created_at DESC").all() as any[];
  } else {
    rows = db.query("SELECT * FROM webhooks WHERE project_id = ?").all(auth.projectId) as any[];
  }

  const webhooks = rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    url: row.url,
    events: parseEvents(row.events),
    active: row.active === 1,
    createdAt: row.created_at,
  }));

  return res.json({ webhooks });
});

webhooksRouter.delete("/:id", async (req, res) => {
  const auth = requireJwt(req, res);
  if (!auth) return;

  const db = getDb();
  if (auth.role === "admin") {
    db.run("DELETE FROM webhooks WHERE id = ?", [req.params.id]);
  } else {
    db.run("DELETE FROM webhooks WHERE id = ? AND project_id = ?", [
      req.params.id,
      auth.projectId,
    ]);
  }

  return res.json({ success: true });
});

function parseEvents(value: string): string[] {
  try {
    return JSON.parse(value);
  } catch {
    return ["alert.created"];
  }
}

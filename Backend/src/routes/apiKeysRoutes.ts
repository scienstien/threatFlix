import { Router } from "express";
import { requireJwt } from "../middleware/auth.ts";
import { getDb } from "../db/database.ts";

export const apiKeysRouter = Router();

apiKeysRouter.get("/", async (req, res) => {
  const auth = requireJwt(req, res);
  if (!auth) return;

  const db = getDb();
  let rows: any[] = [];

  if (auth.role === "admin") {
    rows = db.query("SELECT * FROM api_keys ORDER BY created_at DESC").all() as any[];
  } else {
    rows = db
      .query("SELECT * FROM api_keys WHERE project_id = ? AND revoked = 0")
      .all(auth.projectId) as any[];
  }

  const keys = rows.map((row) => ({
    key: row.key,
    projectId: row.project_id,
    label: row.label,
    createdAt: row.created_at,
    revoked: row.revoked === 1,
  }));

  return res.json({ keys });
});

apiKeysRouter.post("/", async (req, res) => {
  const auth = requireJwt(req, res);
  if (!auth) return;

  const body = req.body ?? {};
  const projectId =
    auth.role === "admin" && typeof body.projectId === "string"
      ? body.projectId
      : auth.projectId;

  if (projectId === "__admin__" && typeof body.projectId !== "string") {
    return res.status(400).json({ error: "Specify projectId for admin operations." });
  }

  const apiKey = `sk-${crypto.randomUUID().replace(/-/g, "")}`;
  const label =
    typeof body.label === "string" && body.label.trim().length > 0
      ? body.label.trim()
      : "Generated via Dashboard";
  const createdAt = new Date().toISOString();

  const db = getDb();
  db.run(
    "INSERT INTO api_keys (key, project_id, label, created_at) VALUES (?, ?, ?, ?)",
    [apiKey, projectId, label, createdAt]
  );

  return res.status(201).json({
    key: apiKey,
    projectId,
    label,
    createdAt,
    revoked: false,
  });
});

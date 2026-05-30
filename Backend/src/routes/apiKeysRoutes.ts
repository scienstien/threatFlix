// ---------------------------------------------------------------------------
// API Key management routes — GET /apikeys, POST /apikeys
// ---------------------------------------------------------------------------

import { authenticateJwt } from "../middleware/auth.ts";
import { getDb } from "../db/database.ts";

/** GET /apikeys — list API keys for the authenticated project. */
export async function handleGetApiKeys(req: Request): Promise<Response> {
  const auth = await authenticateJwt(req);
  if (!auth) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const projectId = auth.projectId;
  const db = getDb();

  let rows: any[];
  if (auth.role === "admin") {
    // Admin sees all keys
    rows = db.query("SELECT * FROM api_keys ORDER BY created_at DESC").all() as any[];
  } else {
    // User sees only their project's keys
    rows = db.query("SELECT * FROM api_keys WHERE project_id = ? AND revoked = 0").all(projectId) as any[];
  }

  const apiKeys = rows.map((r: any) => ({
    key: r.key,
    projectId: r.project_id,
    label: r.label,
    createdAt: r.created_at,
    revoked: r.revoked === 1,
  }));

  return Response.json({ apiKeys });
}

/** POST /apikeys — generate a new API key for the project. */
export async function handleCreateApiKey(req: Request): Promise<Response> {
  const auth = await authenticateJwt(req);
  if (!auth) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional
  }

  const projectId = auth.role === "admin" && body.projectId ? body.projectId : auth.projectId;

  if (projectId === "__admin__" && !body.projectId) {
    return Response.json({ error: "Specify projectId for admin operations." }, { status: 400 });
  }

  const apiKey = `sk-${crypto.randomUUID().replace(/-/g, "")}`;
  const label = body.label || "Generated via Dashboard";
  const createdAt = new Date().toISOString();

  const db = getDb();
  db.run(
    "INSERT INTO api_keys (key, project_id, label, created_at) VALUES (?, ?, ?, ?)",
    [apiKey, projectId, label, createdAt]
  );

  return Response.json(
    {
      key: apiKey,
      projectId,
      label,
      createdAt,
      revoked: false,
    },
    { status: 201 }
  );
}

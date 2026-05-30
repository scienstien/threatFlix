// ---------------------------------------------------------------------------
// Webhook management routes — POST /webhooks, GET /webhooks, DELETE /webhooks/:id
// ---------------------------------------------------------------------------

import { authenticateJwt } from "../middleware/auth.ts";
import { getDb } from "../db/database.ts";

/** POST /webhooks — register a webhook URL for the authenticated project. */
export async function handleCreateWebhook(req: Request): Promise<Response> {
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

  if (!body.url || typeof body.url !== "string") {
    return Response.json({ error: '"url" is required and must be a string.' }, { status: 400 });
  }

  // Validate URL format
  try {
    new URL(body.url);
  } catch {
    return Response.json({ error: "Invalid URL format." }, { status: 400 });
  }

  const projectId = auth.role === "admin" && body.projectId
    ? body.projectId
    : auth.projectId;

  if (projectId === "__admin__" && !body.projectId) {
    return Response.json({ error: "Specify projectId for admin operations." }, { status: 400 });
  }

  const webhook = {
    id: crypto.randomUUID(),
    projectId,
    url: body.url,
    secret: body.secret ?? null,
    events: JSON.stringify(body.events ?? ["alert.created"]),
    active: 1,
    createdAt: new Date().toISOString(),
  };

  const db = getDb();
  db.run(
    "INSERT INTO webhooks (id, project_id, url, secret, events, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [webhook.id, webhook.projectId, webhook.url, webhook.secret, webhook.events, webhook.active, webhook.createdAt]
  );

  return Response.json(
    {
      id: webhook.id,
      projectId: webhook.projectId,
      url: webhook.url,
      events: body.events ?? ["alert.created"],
      active: true,
    },
    { status: 201 }
  );
}

/** GET /webhooks — list webhooks for the authenticated project. */
export async function handleGetWebhooks(req: Request): Promise<Response> {
  const auth = await authenticateJwt(req);
  if (!auth) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const projectId = auth.projectId;
  const db = getDb();

  let rows: any[];
  if (auth.role === "admin") {
    rows = db.query("SELECT * FROM webhooks ORDER BY created_at DESC").all() as any[];
  } else {
    rows = db.query("SELECT * FROM webhooks WHERE project_id = ?").all(projectId) as any[];
  }

  const webhooks = rows.map((r: any) => ({
    id: r.id,
    projectId: r.project_id,
    url: r.url,
    events: safeJson(r.events, ["alert.created"]),
    active: r.active === 1,
    createdAt: r.created_at,
  }));

  return Response.json({ webhooks });
}

/** DELETE /webhooks/:id — delete a webhook. */
export async function handleDeleteWebhook(req: Request, id: string): Promise<Response> {
  const auth = await authenticateJwt(req);
  if (!auth) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const db = getDb();

  if (auth.role === "admin") {
    db.run("DELETE FROM webhooks WHERE id = ?", [id]);
  } else {
    db.run("DELETE FROM webhooks WHERE id = ? AND project_id = ?", [id, auth.projectId]);
  }

  return Response.json({ success: true });
}

function safeJson<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

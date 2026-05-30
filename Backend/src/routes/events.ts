// ---------------------------------------------------------------------------
// Event routes — POST /events (SDK ingestion), GET /events/latest (dashboard)
// ---------------------------------------------------------------------------

import { authenticateApiKey, authenticateJwt, type AuthContext } from "../middleware/auth.ts";
import { validateEventPayload, validationErrorResponse } from "../middleware/validation.ts";
import { eventRepo } from "../db/repositories/eventRepository.ts";
import { analyzeEvents, shouldAutoAnalyze } from "../ai/analyzer.ts";
import type { SecurityEvent } from "../types/events.ts";

/** POST /events — receive events from the SDK. Auth: API key. */
export async function handlePostEvents(req: Request): Promise<Response> {
  // Authenticate via API key
  const auth = authenticateApiKey(req);
  if (!auth) {
    return Response.json({ error: "Invalid or missing API key." }, { status: 401 });
  }

  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Support both single event and batch
  const events: unknown[] = Array.isArray(body) ? body : [body];
  const inserted: string[] = [];
  const errors: { index: number; errors: any[] }[] = [];

  for (let i = 0; i < events.length; i++) {
    const raw = events[i];
    const validation = validateEventPayload(raw);

    if (!validation.valid) {
      errors.push({ index: i, errors: validation.errors });
      continue;
    }

    const data = raw as Record<string, any>;

    // Override projectId with the one from the API key (security: prevent spoofing)
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
    inserted.push(event.id);
  }

  // Auto-trigger analysis if threshold reached
  if (inserted.length > 0 && shouldAutoAnalyze(auth.projectId)) {
    // Non-blocking: run analysis in background
    analyzeEvents(auth.projectId).catch((err) =>
      console.error("  ⚠️  Auto-analysis failed:", (err as Error).message)
    );
  }

  const status = errors.length > 0 ? (inserted.length > 0 ? 207 : 400) : 201;

  return Response.json(
    {
      inserted: inserted.length,
      eventIds: inserted,
      errors: errors.length > 0 ? errors : undefined,
    },
    { status }
  );
}

/** GET /events/latest — fetch recent events for the dashboard. Auth: JWT. */
export async function handleGetEvents(req: Request): Promise<Response> {
  const auth = await authenticateJwt(req);
  if (!auth) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  // Admin sees a specific project if requested, or all
  let projectId = auth.projectId;
  if (auth.role === "admin" && url.searchParams.get("projectId")) {
    projectId = url.searchParams.get("projectId")!;
  }

  if (projectId === "__admin__" && !url.searchParams.get("projectId")) {
    // Admin without project filter — return events from all projects (limited)
    // Forward-compat: add global event query
    return Response.json({ events: [], message: "Specify ?projectId= for admin queries." });
  }

  const events = eventRepo.getLatest(projectId, limit);
  return Response.json({ events, count: events.length });
}

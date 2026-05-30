// ---------------------------------------------------------------------------
// Analyze route — POST /analyze (manual trigger)
// ---------------------------------------------------------------------------

import { authenticateJwt, authenticateApiKey } from "../middleware/auth.ts";
import { analyzeEvents } from "../ai/analyzer.ts";
import { eventRepo } from "../db/repositories/eventRepository.ts";

/** POST /analyze — manually trigger AI analysis. Auth: JWT or API key. */
export async function handleAnalyze(req: Request): Promise<Response> {
  // Accept both JWT (dashboard) and API key (SDK) auth
  const auth = (await authenticateJwt(req)) ?? authenticateApiKey(req);
  if (!auth) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional — will analyze latest unanalysed events
  }

  const projectId =
    auth.role === "admin" && body.projectId
      ? body.projectId
      : auth.projectId;

  if (projectId === "__admin__" && !body.projectId) {
    return Response.json({ error: "Specify projectId for admin analysis." }, { status: 400 });
  }

  // If specific event IDs are provided, use those
  let events;
  if (body.eventIds && Array.isArray(body.eventIds)) {
    events = eventRepo.getByIds(projectId, body.eventIds);
    if (events.length === 0) {
      return Response.json({ error: "No matching events found." }, { status: 404 });
    }
  }

  try {
    const alert = await analyzeEvents(projectId, events);
    return Response.json({ alert }, { status: 200 });
  } catch (err) {
    const message = (err as Error).message;

    // Rate limit errors
    if (message.includes("rate limit") || message.includes("Cooldown")) {
      return Response.json({ error: message }, { status: 429 });
    }

    return Response.json({ error: message }, { status: 500 });
  }
}

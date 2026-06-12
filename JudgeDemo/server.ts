import { join } from "node:path";
import { threatflix, THREATFLIX_API_KEY } from "./threatflix.ts";

const PORT = Number(process.env.JUDGE_DEMO_PORT ?? 4100);
const THREATFLIX_URL = process.env.THREATFLIX_URL ?? "http://127.0.0.1:8000/api";
const publicDir = join(import.meta.dir, "public");
const isThreatFlixConfigured =
  THREATFLIX_API_KEY !== "PASTE_GENERATED_KEY_HERE";

type ScenarioId = "brute-force" | "password-spray" | "credential-stuffing" | "persistence" | "exfiltration";
type ActivityTone = "normal" | "warning" | "critical" | "success" | "analysis";

interface Activity {
  id: string;
  at: string;
  event: string;
  user: string;
  ip: string;
  detail: string;
  tone: ActivityTone;
  delivered: boolean;
}

interface DemoState {
  status: "ready" | "attacking" | "analyzing" | "complete" | "error";
  activeScenario?: ScenarioId;
  activeLabel?: string;
  startedAt?: string;
  completedAt?: string;
  activity: Activity[];
  deliveredEvents: number;
  investigations: Array<{ id: string; attack: string; severity: string; confidence: number; at: string }>;
  error?: string;
}

const scenarioLabels: Record<ScenarioId, string> = {
  "brute-force": "Brute-force account takeover",
  "password-spray": "Password spray",
  "credential-stuffing": "Credential stuffing",
  persistence: "Privilege and persistence abuse",
  exfiltration: "Sensitive directory exfiltration",
};

let activeEventIds: string[] = [];
let state: DemoState = initialState();

function initialState(): DemoState {
  return {
    status: "ready",
    activity: [
      activity("successful_login", "maya.singh@northstar-demo.in", "49.36.112.18", "MFA login accepted · Bengaluru", "normal", true),
      activity("directory_view", "liam.chen@northstar-demo.in", "103.21.58.77", "Viewed workforce directory", "normal", true),
      activity("successful_login", "sofia.martin@northstar-demo.in", "152.58.14.32", "MFA login accepted · Mumbai", "normal", true),
    ],
    deliveredEvents: 0,
    investigations: [],
  };
}

function activity(
  event: string,
  user: string,
  ip: string,
  detail: string,
  tone: ActivityTone,
  delivered: boolean
): Activity {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), event, user, ip, detail, tone, delivered };
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Access-Control-Allow-Origin": "*" } });
}

async function readBody(request: Request): Promise<Record<string, any>> {
  try {
    return await request.json() as Record<string, any>;
  } catch {
    return {};
  }
}

function requireScenario(): ScenarioId {
  if (!state.activeScenario) throw new Error("Start a demo scenario before sending attack traffic.");
  return state.activeScenario;
}

async function emit(
  event: string,
  details: { user: string; ip: string; sessionId: string; detail: string; severity?: string; metadata?: Record<string, unknown> },
  tone: ActivityTone
) {
  requireScenario();
  if (!isThreatFlixConfigured) {
    throw new Error("ThreatFlix SDK is waiting for the generated project API key.");
  }
  const pending = activity(event, details.user, details.ip, details.detail, tone, false);
  state.activity = [pending, ...state.activity].slice(0, 80);

  const delivery = await threatflix.event(event, {
    user: details.user,
    ip: details.ip,
    service: "northstar-identity",
    sessionId: details.sessionId,
    severity: details.severity ?? (tone === "critical" ? "critical" : "high"),
    tags: ["judge-demo", state.activeScenario!],
    metadata: {
      ...details.metadata,
      customerApplication: "Northstar Identity Cloud",
      demoScenario: state.activeScenario,
    },
  });
  const delivered = delivery?.eventIds ?? [];
  activeEventIds.push(...delivered);
  state.deliveredEvents += delivered.length;
  pending.delivered = delivered.length > 0;
  if (!pending.delivered) throw new Error("ThreatFlix did not acknowledge the telemetry event.");
}

async function beginScenario(request: Request) {
  const body = await readBody(request);
  const scenario = body.scenario as ScenarioId;
  if (!(scenario in scenarioLabels)) return json({ error: "Unknown scenario." }, 400);
  if (state.status === "attacking" || state.status === "analyzing") {
    return json({ error: "Another scenario is active." }, 409);
  }
  activeEventIds = [];
  state.status = "attacking";
  state.activeScenario = scenario;
  state.activeLabel = scenarioLabels[scenario];
  state.startedAt = new Date().toISOString();
  state.completedAt = undefined;
  state.error = undefined;
  state.activity = [
    activity("scenario_started", "demo-runner", "127.0.0.1", `${scenarioLabels[scenario]} started`, "warning", true),
    ...state.activity,
  ].slice(0, 80);
  return json({ ok: true, scenario, label: scenarioLabels[scenario] });
}

async function completeScenario() {
  const scenario = requireScenario();
  if (activeEventIds.length === 0) return json({ error: "No telemetry was delivered for this scenario." }, 400);
  state.status = "analyzing";
  state.activity = [
    activity("analysis_requested", "northstar-sdk", "127.0.0.1", `${activeEventIds.length} accepted events sent for investigation`, "analysis", true),
    ...state.activity,
  ].slice(0, 80);

  try {
    const response = await fetch(`${THREATFLIX_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${THREATFLIX_API_KEY}` },
      body: JSON.stringify({ eventIds: activeEventIds, demoMode: true }),
    });
    const result = await response.json() as Record<string, any>;
    if (!response.ok) throw new Error(result.error ?? `ThreatFlix analysis failed (${response.status})`);
    const alert = result.alert;
    const summary = {
      id: alert.id,
      attack: alert.attack,
      severity: alert.severity,
      confidence: alert.confidence,
      at: new Date().toISOString(),
    };
    state.status = "complete";
    state.completedAt = summary.at;
    state.investigations = [summary, ...state.investigations];
    state.activity = [
      activity("investigation_created", "threatflix", "127.0.0.1", `${alert.severity} · ${alert.attack}`, "success", true),
      ...state.activity,
    ].slice(0, 80);
    return json({ ok: true, scenario, eventIds: activeEventIds, alert: summary });
  } catch (error) {
    state.status = "error";
    state.error = (error as Error).message;
    return json({ error: state.error }, 502);
  }
}

async function routeApi(request: Request, pathname: string): Promise<Response | null> {
  if (request.method === "GET" && pathname === "/api/state") {
    return json({ ...state, integrationConfigured: isThreatFlixConfigured });
  }
  if (request.method === "GET" && pathname === "/api/scenarios") return json({ scenarios: scenarioLabels });
  if (request.method === "POST" && pathname === "/api/demo/reset") {
    state = initialState();
    activeEventIds = [];
    return json({ ok: true });
  }
  if (request.method === "POST" && pathname === "/api/demo/begin") return beginScenario(request);
  if (request.method === "POST" && pathname === "/api/demo/complete") return completeScenario();

  if (request.method === "POST" && pathname === "/api/auth/login") {
    const body = await readBody(request);
    const accepted = body.password === "Northstar!2026";
    await emit(accepted ? "successful_login" : "failed_login", {
      user: String(body.email ?? "unknown@northstar-demo.in"),
      ip: String(body.ip ?? "unknown"),
      sessionId: String(body.sessionId ?? crypto.randomUUID()),
      detail: accepted ? "Password accepted after authentication attempt" : "Invalid password rejected",
      metadata: { userAgent: "python-requests/demo", authenticationMethod: "password" },
    }, accepted ? "critical" : "warning");
    return json({ accepted, message: accepted ? "Login accepted." : "Invalid credentials." }, accepted ? 200 : 401);
  }

  if (request.method === "POST" && pathname === "/api/admin/roles/grant") {
    const body = await readBody(request);
    await emit("privilege_escalation", {
      user: String(body.actor),
      ip: String(body.ip),
      sessionId: String(body.sessionId),
      detail: `${body.target} elevated from analyst to tenant_admin`,
      metadata: { target: body.target, previousRole: "analyst", newRole: "tenant_admin" },
    }, "critical");
    return json({ ok: true, role: "tenant_admin" });
  }

  if (request.method === "POST" && pathname === "/api/admin/api-keys") {
    const body = await readBody(request);
    await emit("api_key_created", {
      user: String(body.actor),
      ip: String(body.ip),
      sessionId: String(body.sessionId),
      detail: `Created persistent API key “${body.label}”`,
      metadata: { label: body.label, scope: "tenant:read tenant:export" },
    }, "critical");
    return json({ ok: true, keyPrefix: "nsk_demo_" });
  }

  if (request.method === "POST" && pathname === "/api/admin/export") {
    const body = await readBody(request);
    await emit("data_export", {
      user: String(body.actor),
      ip: String(body.ip),
      sessionId: String(body.sessionId),
      detail: "Exported 18,420 workforce identity records",
      metadata: { resource: "workforce-directory.csv", records: 18420, bytes: 14800000 },
    }, "critical");
    return json({ ok: true, export: "workforce-directory.csv", records: 18420 });
  }
  return null;
}

function staticFile(pathname: string): Response {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = Bun.file(join(publicDir, requested));
  const extension = requested.split(".").pop();
  const contentType = extension === "css" ? "text/css" : extension === "js" ? "text/javascript" : "text/html";
  return new Response(file, { headers: { "Content-Type": contentType } });
}

Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" } });
    try {
      const response = await routeApi(request, url.pathname);
      return response ?? staticFile(url.pathname);
    } catch (error) {
      state.status = "error";
      state.error = (error as Error).message;
      return json({ error: state.error }, 500);
    }
  },
});

console.log(`Northstar Identity Cloud: http://127.0.0.1:${PORT}`);
console.log(`ThreatFlix telemetry destination: ${THREATFLIX_URL}/events`);

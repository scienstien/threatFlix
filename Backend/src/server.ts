// ---------------------------------------------------------------------------
// ThreatFlix Backend — Main Server Entry Point
// Bun.serve() with route matching, middleware chain, and graceful shutdown.
// ---------------------------------------------------------------------------

import { config } from "./config.ts";
import { getDb, closeDb } from "./db/database.ts";
import { withCors, handlePreflight } from "./middleware/cors.ts";
import { checkRateLimit, rateLimitResponse } from "./middleware/rateLimit.ts";
import { loginWithCredentials, loginWithOAuth } from "./middleware/auth.ts";

// Route handlers
import { handlePostEvents, handleGetEvents } from "./routes/events.ts";
import { handleGetAlerts, handleGetAlertById, handlePatchAlert } from "./routes/alerts.ts";
import { handleAnalyze } from "./routes/analyze.ts";
import { handleHealth } from "./routes/health.ts";
import { handleAdminStats, handleAdminProjects } from "./routes/admin.ts";
import { handleCreateWebhook, handleGetWebhooks, handleDeleteWebhook } from "./routes/webhookRoutes.ts";
import { handleGetApiKeys, handleCreateApiKey } from "./routes/apiKeysRoutes.ts";

// ---------------------------------------------------------------------------
// Initialize database on startup
// ---------------------------------------------------------------------------

console.log("\n🛡️  ThreatFlix SecurityAI Backend");
console.log("─".repeat(45));
console.log(`  Environment : ${config.nodeEnv}`);
console.log(`  Port        : ${config.port}`);
console.log(`  Database    : ${config.databasePath}`);
console.log(`  AI Provider : ${config.geminiApiKey && config.geminiApiKey !== "your-gemini-api-key-here" ? "Google Gemini" : "Rule-based fallback"}`);
console.log("─".repeat(45));

// Force DB init + migrations
getDb();
console.log("  ✅ Database initialized\n");

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

type RouteHandler = (req: Request, ...args: string[]) => Promise<Response> | Response;

interface Route {
  method: string;
  pattern: RegExp;
  handler: RouteHandler;
}

const routes: Route[] = [
  // Public
  { method: "GET",   pattern: /^\/health$/,                handler: (_req) => handleHealth() },

  // Auth
  { method: "POST",  pattern: /^\/auth\/login$/,           handler: handleLogin },
  { method: "POST",  pattern: /^\/auth\/oauth$/,           handler: handleOAuthLogin },

  // SDK ingestion (API key auth)
  { method: "POST",  pattern: /^\/events$/,                handler: handlePostEvents },

  // Dashboard (JWT auth)
  { method: "GET",   pattern: /^\/events\/latest$/,        handler: handleGetEvents },
  { method: "GET",   pattern: /^\/alerts$/,                handler: handleGetAlerts },
  { method: "GET",   pattern: /^\/alerts\/([^/]+)$/,       handler: (req, id) => handleGetAlertById(req, id) },
  { method: "PATCH", pattern: /^\/alerts\/([^/]+)$/,       handler: (req, id) => handlePatchAlert(req, id) },

  // Analysis
  { method: "POST",  pattern: /^\/analyze$/,               handler: handleAnalyze },

  // Webhooks
  { method: "POST",   pattern: /^\/webhooks$/,             handler: handleCreateWebhook },
  { method: "GET",    pattern: /^\/webhooks$/,             handler: handleGetWebhooks },
  { method: "DELETE", pattern: /^\/webhooks\/([^/]+)$/,    handler: (req, id) => handleDeleteWebhook(req, id) },

  // API Keys
  { method: "GET",    pattern: /^\/apikeys$/,              handler: handleGetApiKeys },
  { method: "POST",   pattern: /^\/apikeys$/,              handler: handleCreateApiKey },

  // Admin
  { method: "GET",   pattern: /^\/admin\/stats$/,          handler: handleAdminStats },
  { method: "GET",   pattern: /^\/admin\/projects$/,       handler: handleAdminProjects },
];

// ---------------------------------------------------------------------------
// Auth route handlers
// ---------------------------------------------------------------------------

async function handleLogin(req: Request): Promise<Response> {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return Response.json({ error: '"email" and "password" are required.' }, { status: 400 });
  }

  const result = await loginWithCredentials(body.email, body.password);
  if (!result) {
    return Response.json({ error: "Invalid credentials." }, { status: 401 });
  }

  return Response.json(result);
}

async function handleOAuthLogin(req: Request): Promise<Response> {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.email || !body.name) {
    return Response.json({ error: '"email" and "name" are required.' }, { status: 400 });
  }

  const result = await loginWithOAuth({
    email: body.email,
    name: body.name,
    provider: body.provider ?? "mock",
  });

  return Response.json(result);
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return handlePreflight(req);
  }

  // Rate limiting (by IP)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return withCors(rateLimitResponse(rateCheck.resetMs), req);
  }

  // Match route
  for (const route of routes) {
    if (method !== route.method) continue;

    const match = path.match(route.pattern);
    if (!match) continue;

    try {
      const params = match.slice(1); // capture groups
      const response = await route.handler(req, ...params);
      return withCors(response, req);
    } catch (err) {
      console.error(`  ❌ Error in ${method} ${path}:`, err);
      return withCors(
        Response.json(
          { error: "Internal server error.", message: (err as Error).message },
          { status: 500 }
        ),
        req
      );
    }
  }

  // 404
  return withCors(
    Response.json({ error: "Not found.", path, method }, { status: 404 }),
    req
  );
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const server = Bun.serve({
  port: config.port,
  fetch: handleRequest,
});

console.log(`🚀 Server running at http://localhost:${server.port}\n`);
console.log("📡 Endpoints:");
console.log("  POST   /events          — SDK event ingestion (API key)");
console.log("  GET    /events/latest   — Recent events (JWT)");
console.log("  GET    /alerts          — List alerts (JWT)");
console.log("  GET    /alerts/:id      — Alert details (JWT)");
console.log("  PATCH  /alerts/:id      — Update alert status (JWT)");
console.log("  POST   /analyze         — Trigger AI analysis (JWT/API key)");
console.log("  POST   /webhooks        — Register webhook (JWT)");
console.log("  GET    /webhooks        — List webhooks (JWT)");
console.log("  GET    /apikeys         — List API keys (JWT)");
console.log("  POST   /apikeys         — Generate API key (JWT)");
console.log("  POST   /auth/login      — Admin login");
console.log("  POST   /auth/oauth      — OAuth user login");
console.log("  GET    /admin/stats     — Platform stats (Admin JWT)");
console.log("  GET    /admin/projects  — Project list (Admin JWT)");
console.log("  GET    /health          — Health check (public)");
console.log("");

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down...");
  closeDb();
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down...");
  closeDb();
  server.stop();
  process.exit(0);
});

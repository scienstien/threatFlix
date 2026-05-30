// ---------------------------------------------------------------------------
// Authentication & Authorization middleware.
//
// Two auth modes:
// 1. SDK auth: X-API-Key header → maps to projectId (for POST /events)
// 2. Dashboard auth: JWT Bearer token → contains role + projectId (for dashboard/admin)
//
// Forward-compat: swap to OAuth token verification, per-project key DB lookup, etc.
// ---------------------------------------------------------------------------

import { config } from "../config.ts";
import { getDb } from "../db/database.ts";

export type Role = "admin" | "user";

export interface AuthContext {
  projectId: string;
  role: Role;
  userId?: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// 1. SDK API Key authentication
// ---------------------------------------------------------------------------

/** Resolve an API key to a projectId. Returns null if invalid.
 *
 *  Accepted formats (in priority order):
 *  1. X-API-Key: <key>              (our preferred header)
 *  2. Authorization: Bearer <key>   (SDK default — checked ONLY if the value
 *                                    matches a known API key, not a JWT)
 *  3. ?apiKey=<key>                 (query-string fallback)
 */
export function authenticateApiKey(request: Request): AuthContext | null {
  let key =
    request.headers.get("X-API-Key") ??
    new URL(request.url).searchParams.get("apiKey");

  // Also accept Authorization: Bearer <token> — but only if it looks like
  // an API key (i.e. it resolves to a project). JWTs are handled separately
  // by authenticateJwt(), so there is no collision.
  if (!key) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      key = authHeader.slice(7);
    }
  }

  if (!key) return null;

  // Check hardcoded demo keys first
  const demoProject = config.demoApiKeys[key];
  if (demoProject) {
    return { projectId: demoProject, role: "user" };
  }

  // Check database
  const db = getDb();
  const row = db
    .query("SELECT project_id FROM api_keys WHERE key = ? AND revoked = 0")
    .get(key) as any;

  if (!row) return null;

  return { projectId: row.project_id, role: "user" };
}

// ---------------------------------------------------------------------------
// 2. JWT authentication (for dashboard)
// ---------------------------------------------------------------------------

/** Simple JWT implementation using Bun's built-in crypto.
 *  Forward-compat: replace with a proper JWT library or OAuth token verification. */

interface JwtPayload {
  sub: string;          // user ID
  email: string;
  role: Role;
  projectId?: string;   // null for admins (they see everything)
  iat: number;
  exp: number;
}

/** Sign a JWT. */
export async function signJwt(payload: Omit<JwtPayload, "iat" | "exp">): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + config.jwtExpiresIn,
  };

  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(fullPayload));
  const signature = await hmacSign(`${header}.${body}`);

  return `${header}.${body}.${signature}`;
}

/** Verify and decode a JWT. Returns null if invalid/expired. */
export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts as [string, string, string];

  // Verify signature
  const expected = await hmacSign(`${header}.${body}`);
  if (signature !== expected) return null;

  // Decode payload
  try {
    const payload: JwtPayload = JSON.parse(base64urlDecode(body));

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

/** Authenticate a dashboard request via Bearer token. */
export async function authenticateJwt(request: Request): Promise<AuthContext | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const payload = await verifyJwt(token);
  if (!payload) return null;

  return {
    projectId: payload.projectId ?? "__admin__",
    role: payload.role,
    userId: payload.sub,
    email: payload.email,
  };
}

// ---------------------------------------------------------------------------
// Admin login (hackathon demo — email/password)
// ---------------------------------------------------------------------------

export interface LoginResult {
  token: string;
  role: Role;
  email: string;
  projectId?: string;
}

/** Authenticate admin or user login. */
export async function loginWithCredentials(
  email: string,
  password: string
): Promise<LoginResult | null> {
  // Admin check
  if (email === config.adminEmail && password === config.adminPassword) {
    const token = await signJwt({
      sub: "admin-001",
      email,
      role: "admin",
    });
    return { token, role: "admin", email };
  }

  // Forward-compat: check users table for regular user credentials
  // (In production, this would be OAuth token exchange, not password check)
  return null;
}

/** Register or get a user via OAuth profile (forward-compat). */
export async function loginWithOAuth(profile: {
  email: string;
  name: string;
  provider: string;
}): Promise<LoginResult> {
  const db = getDb();

  // Check if user exists
  let user = db
    .query("SELECT * FROM users WHERE email = ?")
    .get(profile.email) as any;

  if (!user) {
    // Create user with a new project
    const userId = crypto.randomUUID();
    const projectId = `proj-${crypto.randomUUID().slice(0, 8)}`;

    db.run(
      "INSERT INTO users (id, email, name, role, project_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, profile.email, profile.name, "user", projectId, new Date().toISOString()]
    );

    // Create an API key for the new project
    const apiKey = `sk-${crypto.randomUUID().replace(/-/g, "")}`;
    db.run(
      "INSERT INTO api_keys (key, project_id, label, created_at) VALUES (?, ?, ?, ?)",
      [apiKey, projectId, "Auto-generated", new Date().toISOString()]
    );

    user = { id: userId, email: profile.email, name: profile.name, role: "user", project_id: projectId };
  }

  const token = await signJwt({
    sub: user.id,
    email: user.email,
    role: user.role,
    projectId: user.project_id,
  });

  return {
    token,
    role: user.role,
    email: user.email,
    projectId: user.project_id,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function base64url(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): string {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
}

async function hmacSign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(config.jwtSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64url(String.fromCharCode(...new Uint8Array(sig)));
}

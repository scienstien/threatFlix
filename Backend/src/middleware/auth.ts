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
import jwt from "jsonwebtoken";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";

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
export function authenticateApiKey(req: ExpressRequest): AuthContext | null {
  let key = (req.headers["x-api-key"] as string | undefined)
    ?? (typeof req.query.apiKey === "string" ? req.query.apiKey : undefined);

  // Also accept Authorization: Bearer <token> — but only if it looks like
  // an API key (i.e. it resolves to a project). JWTs are handled separately
  // by authenticateJwt(), so there is no collision.
  if (!key) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      key = authHeader.slice(7);
    }
  }

  if (!key) return null;

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

interface JwtPayload {
  sub: string;          // user ID
  email: string;
  role: Role;
  projectId?: string;   // null for admins (they see everything)
}

/** Sign a JWT. */
export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/** Verify and decode a JWT. Returns null if invalid/expired. */
export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

/** Authenticate a dashboard request via Bearer token. */
export function authenticateJwt(req: ExpressRequest): AuthContext | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const payload = verifyJwt(token);
  if (!payload) return null;

  return {
    projectId: payload.projectId ?? "__admin__",
    role: payload.role,
    userId: payload.sub,
    email: payload.email,
  };
}

export function requireJwt(
  req: ExpressRequest,
  res: ExpressResponse
): AuthContext | null {
  const auth = authenticateJwt(req);
  if (!auth) {
    res.status(401).json({ error: "Authentication required." });
    return null;
  }

  return auth;
}

export function requireAdmin(
  req: ExpressRequest,
  res: ExpressResponse
): AuthContext | null {
  const auth = requireJwt(req, res);
  if (!auth) return null;

  if (auth.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return null;
  }

  return auth;
}

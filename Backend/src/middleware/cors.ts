// ---------------------------------------------------------------------------
// CORS middleware — open by default, no hardcoded origins.
// Security comes from API key / JWT auth, not CORS restrictions.
// ---------------------------------------------------------------------------

/** Attach CORS headers to a Response. */
export function withCors(response: Response, request?: Request): Response {
  const headers = new Headers(response.headers);
  const origin = request?.headers.get("Origin") ?? "*";

  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Max-Age", "86400"); // cache preflight for 24h

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Handle preflight OPTIONS request. */
export function handlePreflight(request: Request): Response {
  return withCors(new Response(null, { status: 204 }), request);
}

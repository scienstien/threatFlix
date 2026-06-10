// ---------------------------------------------------------------------------
// Canonical security event types — shared contract with SDK (Member C).
// Forward-compat: accepts unknown event types via the string union fallback.
// ---------------------------------------------------------------------------

/** Known event types. The union includes `string` so the backend never
 *  rejects events it doesn't recognise yet. */
export type EventType =
  | "failed_login"
  | "successful_login"
  | "password_reset"
  | "suspicious_ip"
  | "log"
  | "mfa_challenge"
  | "mfa_failure"
  | "mfa_success"
  | "mfa_disabled"
  | "privilege_escalation"
  | "data_export"
  | "api_key_created"
  | "session_created"
  | "session_ended"
  | "role_changed"
  | "permission_granted"
  | "permission_revoked"
  | (string & {}); // forward-compat: accept unknown event types

/** Optional geo-enrichment (future). */
export interface GeoLocation {
  lat: number;
  lon: number;
  country?: string;
  city?: string;
}

/** The payload the SDK sends to POST /events. */
export interface SecurityEventInput {
  projectId: string;
  event: EventType;
  user: string;
  ip: string;
  service: string;
  timestamp?: string;                       // ISO 8601 — server normalizes if missing
  metadata?: Record<string, unknown>;
  // Forward-compat optional fields:
  severity?: string;
  sessionId?: string;
  geoLocation?: GeoLocation;
  tags?: string[];
}

/** Stored event (after server enrichment). */
export interface SecurityEvent extends SecurityEventInput {
  id: string;           // UUID — server-generated
  timestamp: string;    // always present after normalisation
  metadata: Record<string, unknown>;
  receivedAt: string;   // when the server actually received it
}

/** Minimal required fields for validation. */
export const REQUIRED_EVENT_FIELDS: (keyof SecurityEventInput)[] = [
  "projectId",
  "event",
  "user",
  "ip",
  "service",
];

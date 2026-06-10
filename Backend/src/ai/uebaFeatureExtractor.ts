import type { SecurityEvent } from "../types/events.ts";
import type { UebaFeatureVector } from "../types/ueba.ts";
import type { EventSession } from "./sessionizer.ts";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const THIRTY_DAYS_MS = 30 * DAY_MS;
const IST_OFFSET_MINUTES = 5 * 60 + 30;
const PRIVILEGE_EVENT_TYPES = new Set([
  "privilege_escalation",
  "role_changed",
  "permission_granted",
  "permission_revoked",
  "mfa_disabled",
]);

export function extractUebaFeatures(
  session: EventSession,
  historicalEvents: SecurityEvent[]
): UebaFeatureVector {
  const sessionEvents = [...session.events].sort(byTimestamp);
  const sessionStartMs = Date.parse(session.start);
  const sessionEndMs = Date.parse(session.end);
  const durationSeconds = Math.max(1, Math.round((sessionEndMs - sessionStartMs) / 1000));
  const failedLogins = count(sessionEvents, "failed_login");
  const history = historicalEvents.filter(
    (event) =>
      event.projectId === session.projectId &&
      Date.parse(event.timestamp) < sessionStartMs
  );
  const history24h = history.filter(
    (event) => Date.parse(event.timestamp) >= sessionStartMs - DAY_MS
  );
  const history30d = history.filter(
    (event) => Date.parse(event.timestamp) >= sessionStartMs - THIRTY_DAYS_MS
  );
  const userHistory24h = history24h.filter((event) => event.user === session.user);
  const ipHistory24h = history24h.filter((event) => event.ip === session.ip);
  const userHistory30d = history30d.filter((event) => event.user === session.user);
  const istHour = getIstHour(session.start);
  const angle = (2 * Math.PI * istHour) / 24;

  return {
    eventCount: sessionEvents.length,
    failedLogins,
    successfulLogins: count(sessionEvents, "successful_login"),
    mfaFailures: count(sessionEvents, "mfa_failure"),
    privilegedEvents: sessionEvents.filter((event) => PRIVILEGE_EVENT_TYPES.has(event.event)).length,
    apiKeyCreations: count(sessionEvents, "api_key_created"),
    dataExports: count(sessionEvents, "data_export"),
    durationSeconds,
    failuresPerMinute: failedLogins / Math.max(1, durationSeconds / 60),
    failureToSuccessFlag: hasFailureBeforeSuccess(sessionEvents) ? 1 : 0,
    hourSin: Math.sin(angle),
    hourCos: Math.cos(angle),
    offHoursFlag: istHour < 8 || istHour >= 18 ? 1 : 0,
    newIpForUserFlag: userHistory30d.some((event) => event.ip === session.ip) ? 0 : 1,
    distinctIpsForUser24h: uniqueCount(userHistory24h, (event) => event.ip),
    distinctUsersForIp24h: uniqueCount(ipHistory24h, (event) => event.user),
    apiKeysForUser24h: count(userHistory24h, "api_key_created"),
    dataExportsForUser24h: count(userHistory24h, "data_export"),
    privilegeChangesForUser24h: userHistory24h.filter((event) =>
      PRIVILEGE_EVENT_TYPES.has(event.event)
    ).length,
    userFailureRate24h: loginFailureRate(userHistory24h),
    tenantFailureRate24h: loginFailureRate(history24h),
  };
}

function getIstHour(timestamp: string): number {
  const date = new Date(timestamp);
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + IST_OFFSET_MINUTES;
  return ((minutes % (24 * 60)) + 24 * 60) % (24 * 60) / 60;
}

function hasFailureBeforeSuccess(events: SecurityEvent[]): boolean {
  let sawFailure = false;
  for (const event of events) {
    if (event.event === "failed_login") sawFailure = true;
    if (event.event === "successful_login" && sawFailure) return true;
  }
  return false;
}

function loginFailureRate(events: SecurityEvent[]): number {
  const failures = count(events, "failed_login");
  const successes = count(events, "successful_login");
  return failures / Math.max(1, failures + successes);
}

function count(events: SecurityEvent[], eventType: string): number {
  return events.filter((event) => event.event === eventType).length;
}

function uniqueCount(events: SecurityEvent[], getValue: (event: SecurityEvent) => string): number {
  return new Set(events.map(getValue)).size;
}

function byTimestamp(left: SecurityEvent, right: SecurityEvent): number {
  return Date.parse(left.timestamp) - Date.parse(right.timestamp);
}

import type { SecurityEvent } from "../types/events.ts";
import type { EventSession } from "./sessionizer.ts";

export interface IdentityFeatureVector {
  eventCount: number;
  failedLogins: number;
  successfulLogins: number;
  uniqueUsers: number;
  uniqueIps: number;
  uniqueServices: number;
  mfaFailures: number;
  privilegedEvents: number;
  dataExports: number;
  durationSeconds: number;
  failuresPerMinute: number;
}

export function extractIdentityFeatures(
  session: EventSession,
  contextEvents: SecurityEvent[] = session.events
): IdentityFeatureVector {
  const events = session.events;
  const start = new Date(session.start).getTime();
  const end = new Date(session.end).getTime();
  const durationSeconds = Math.max(1, Math.round((end - start) / 1000));
  const failedLogins = count(events, "failed_login");

  return {
    eventCount: events.length,
    failedLogins,
    successfulLogins: count(events, "successful_login"),
    uniqueUsers: new Set(contextEvents.map((event) => event.user)).size,
    uniqueIps: new Set(contextEvents.map((event) => event.ip)).size,
    uniqueServices: new Set(contextEvents.map((event) => event.service)).size,
    mfaFailures: count(events, "mfa_failure"),
    privilegedEvents: events.filter((event) =>
      ["privilege_escalation", "role_changed", "permission_granted", "mfa_disabled"].includes(event.event)
    ).length,
    dataExports: count(events, "data_export"),
    durationSeconds,
    failuresPerMinute: failedLogins / Math.max(1, durationSeconds / 60),
  };
}

export function mergeFeatureVectors(vectors: IdentityFeatureVector[]): IdentityFeatureVector {
  if (vectors.length === 0) {
    return {
      eventCount: 0,
      failedLogins: 0,
      successfulLogins: 0,
      uniqueUsers: 0,
      uniqueIps: 0,
      uniqueServices: 0,
      mfaFailures: 0,
      privilegedEvents: 0,
      dataExports: 0,
      durationSeconds: 0,
      failuresPerMinute: 0,
    };
  }

  const totals = vectors.reduce((acc, vector) => ({
    eventCount: acc.eventCount + vector.eventCount,
    failedLogins: acc.failedLogins + vector.failedLogins,
    successfulLogins: acc.successfulLogins + vector.successfulLogins,
    uniqueUsers: Math.max(acc.uniqueUsers, vector.uniqueUsers),
    uniqueIps: Math.max(acc.uniqueIps, vector.uniqueIps),
    uniqueServices: Math.max(acc.uniqueServices, vector.uniqueServices),
    mfaFailures: acc.mfaFailures + vector.mfaFailures,
    privilegedEvents: acc.privilegedEvents + vector.privilegedEvents,
    dataExports: acc.dataExports + vector.dataExports,
    durationSeconds: acc.durationSeconds + vector.durationSeconds,
    failuresPerMinute: 0,
  }));

  return {
    ...totals,
    failuresPerMinute: totals.failedLogins / Math.max(1, totals.durationSeconds / 60),
  };
}

function count(events: SecurityEvent[], eventType: string): number {
  return events.filter((event) => event.event === eventType).length;
}

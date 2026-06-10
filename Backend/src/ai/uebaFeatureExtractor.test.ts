import { describe, expect, test } from "bun:test";
import { UEBA_FEATURE_NAMES } from "../types/ueba.ts";
import { sessionizeEvents } from "./sessionizer.ts";
import { extractUebaFeatures } from "./uebaFeatureExtractor.ts";
import type { SecurityEvent } from "../types/events.ts";

describe("UEBA feature extractor", () => {
  test("produces the fixed feature schema from session activity", () => {
    const events = [
      event("fail", "failed_login", "2026-06-09T03:00:00.000Z"),
      event("success", "successful_login", "2026-06-09T03:01:00.000Z"),
      event("key", "api_key_created", "2026-06-09T03:02:00.000Z"),
      event("export", "data_export", "2026-06-09T03:03:00.000Z"),
    ];
    const session = sessionizeEvents(events)[0]!;
    const features = extractUebaFeatures(session, []);

    expect(Object.keys(features)).toEqual([...UEBA_FEATURE_NAMES]);
    expect(features.eventCount).toBe(4);
    expect(features.failureToSuccessFlag).toBe(1);
    expect(features.apiKeyCreations).toBe(1);
    expect(features.dataExports).toBe(1);
    expect(features.newIpForUserFlag).toBe(1);
  });

  test("uses IST business hours from 08:00 inclusive to 18:00 exclusive", () => {
    const businessSession = sessionizeEvents([
      event("business", "successful_login", "2026-06-09T03:00:00.000Z"),
    ])[0]!;
    const offHoursSession = sessionizeEvents([
      event("late", "successful_login", "2026-06-09T13:00:00.000Z"),
    ])[0]!;

    expect(extractUebaFeatures(businessSession, []).offHoursFlag).toBe(0);
    expect(extractUebaFeatures(offHoursSession, []).offHoursFlag).toBe(1);
  });

  test("uses only prior 24h history for recent behavior", () => {
    const session = sessionizeEvents([
      event("current", "successful_login", "2026-06-09T12:00:00.000Z"),
    ])[0]!;
    const history = [
      event("recent-fail", "failed_login", "2026-06-09T11:00:00.000Z", {
        ip: "198.51.100.10",
      }),
      event("recent-key", "api_key_created", "2026-06-09T10:00:00.000Z"),
      event("old-export", "data_export", "2026-06-07T12:00:00.000Z"),
      event("future", "failed_login", "2026-06-09T13:00:00.000Z"),
    ];
    const features = extractUebaFeatures(session, history);

    expect(features.distinctIpsForUser24h).toBe(2);
    expect(features.apiKeysForUser24h).toBe(1);
    expect(features.dataExportsForUser24h).toBe(0);
    expect(features.userFailureRate24h).toBe(1);
    expect(features.tenantFailureRate24h).toBe(1);
  });

  test("uses 30d user history only to determine whether an IP is new", () => {
    const session = sessionizeEvents([
      event("current", "successful_login", "2026-06-09T12:00:00.000Z"),
    ])[0]!;
    const knownIpHistory = [
      event("known-ip", "successful_login", "2026-05-20T12:00:00.000Z"),
    ];
    const expiredIpHistory = [
      event("expired-ip", "successful_login", "2026-04-20T12:00:00.000Z"),
    ];

    expect(extractUebaFeatures(session, knownIpHistory).newIpForUserFlag).toBe(0);
    expect(extractUebaFeatures(session, expiredIpHistory).newIpForUserFlag).toBe(1);
    expect(extractUebaFeatures(session, knownIpHistory).distinctIpsForUser24h).toBe(0);
  });

  test("keeps history scoped to the session project and identity", () => {
    const session = sessionizeEvents([
      event("current", "successful_login", "2026-06-09T12:00:00.000Z"),
    ])[0]!;
    const history = [
      event("other-project", "failed_login", "2026-06-09T11:00:00.000Z", {
        projectId: "other-project",
      }),
      event("other-user", "api_key_created", "2026-06-09T11:00:00.000Z", {
        user: "other-user",
      }),
      event("same-ip-user", "failed_login", "2026-06-09T11:00:00.000Z", {
        user: "other-user",
      }),
      event("same-ip-success", "successful_login", "2026-06-09T11:05:00.000Z", {
        user: "other-user",
      }),
    ];
    const features = extractUebaFeatures(session, history);

    expect(features.apiKeysForUser24h).toBe(0);
    expect(features.distinctUsersForIp24h).toBe(1);
    expect(features.tenantFailureRate24h).toBe(0.5);
  });
});

function event(
  id: string,
  eventType: string,
  timestamp: string,
  overrides: Partial<SecurityEvent> = {}
): SecurityEvent {
  return {
    id,
    projectId: "project",
    event: eventType,
    user: "alice",
    ip: "203.0.113.10",
    service: "auth",
    timestamp,
    receivedAt: timestamp,
    metadata: {},
    ...overrides,
  };
}

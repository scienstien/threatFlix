import { describe, expect, test } from "bun:test";
import { evaluateEvidence } from "./evidenceEngine.ts";
import { sessionizeEvents } from "./sessionizer.ts";
import type { SecurityEvent } from "../types/events.ts";

describe("evidence engine", () => {
  test("detects brute force windows", () => {
    const events = makeEvents(10, (index) => ({
      id: `fail-${index}`,
      event: "failed_login",
      user: "admin",
      ip: "10.0.0.1",
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, index * 20)).toISOString(),
    }));

    const result = evaluateEvidence(events, sessionizeEvents(events));

    expect(result.findings.some((finding) => finding.ruleId === "brute_force_10_failures_5m")).toBe(true);
    expect(result.rawScore).toBeGreaterThanOrEqual(40);
  });

  test("does not detect brute force across unrelated users and IPs", () => {
    const events = makeEvents(10, (index) => ({
      id: `fail-${index}`,
      event: "failed_login",
      user: `user-${index}`,
      ip: `10.0.0.${index}`,
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, index * 20)).toISOString(),
    }));

    const result = evaluateEvidence(events, sessionizeEvents(events));

    expect(result.findings.some((finding) => finding.ruleId === "brute_force_10_failures_5m")).toBe(false);
  });

  test("detects password spraying from one IP", () => {
    const events = makeEvents(10, (index) => ({
      id: `spray-${index}`,
      event: "failed_login",
      user: `user-${index}`,
      ip: "10.0.0.9",
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    }));

    const result = evaluateEvidence(events, sessionizeEvents(events));

    expect(result.findings.some((finding) => finding.ruleId === "password_spray_10_users_15m")).toBe(true);
  });

  test("detects success after five failures in one session", () => {
    const events = [
      ...makeEvents(5, (index) => ({
        id: `fail-${index}`,
        event: "failed_login",
        user: "chaya",
        ip: "10.0.0.3",
        timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      })),
      event({
        id: "success",
        event: "successful_login",
        user: "chaya",
        ip: "10.0.0.3",
        timestamp: new Date(Date.UTC(2026, 0, 1, 0, 5)).toISOString(),
      }),
    ];

    const result = evaluateEvidence(events, sessionizeEvents(events));

    expect(result.findings.some((finding) => finding.ruleId === "success_after_fail_5_to_1_10m")).toBe(true);
  });

  test("does not detect success after only three failures", () => {
    const events = [
      ...makeEvents(3, (index) => ({
        id: `fail-${index}`,
        event: "failed_login",
        user: "chaya",
        ip: "10.0.0.3",
        timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      })),
      event({
        id: "success",
        event: "successful_login",
        user: "chaya",
        ip: "10.0.0.3",
        timestamp: new Date(Date.UTC(2026, 0, 1, 0, 5)).toISOString(),
      }),
    ];

    const result = evaluateEvidence(events, sessionizeEvents(events));

    expect(result.findings.some((finding) => finding.ruleId === "success_after_fail_5_to_1_10m")).toBe(false);
  });

  test("detects credential stuffing across many users and IPs", () => {
    const events = makeEvents(15, (index) => ({
      id: `stuff-${index}`,
      event: "failed_login",
      user: `user-${index % 10}`,
      ip: `10.0.0.${index % 3}`,
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    }));

    const result = evaluateEvidence(events, sessionizeEvents(events));

    expect(result.findings.some((finding) => finding.ruleId === "credential_stuffing_10_users_3_ips_15m")).toBe(true);
  });

  test("detects distinct account and data objective rules", () => {
    const events = [
      event({ id: "mfa-off", event: "mfa_disabled" }),
      event({ id: "role", event: "role_changed" }),
      event({ id: "key", event: "api_key_created" }),
      event({ id: "revoke", event: "permission_revoked" }),
      event({ id: "export", event: "data_export" }),
    ];

    const result = evaluateEvidence(events, sessionizeEvents(events));
    const ruleIds = result.findings.map((finding) => finding.ruleId);

    expect(ruleIds).toContain("mfa_disabled");
    expect(ruleIds).toContain("privilege_change");
    expect(ruleIds).toContain("persistence_establishment");
    expect(ruleIds).toContain("account_access_removal");
    expect(ruleIds).toContain("data_exfiltration");
  });
});

function makeEvents(
  count: number,
  build: (index: number) => Partial<SecurityEvent>
): SecurityEvent[] {
  return Array.from({ length: count }, (_, index) => event(build(index)));
}

function event(overrides: Partial<SecurityEvent>): SecurityEvent {
  return {
    id: "event",
    projectId: "project",
    event: "log",
    user: "user",
    ip: "127.0.0.1",
    service: "auth",
    timestamp: "2026-01-01T00:00:00.000Z",
    receivedAt: "2026-01-01T00:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

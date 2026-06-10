import { describe, expect, test } from "bun:test";
import {
  getStageCompatibility,
  getStageOrder,
  inferStageForRule,
  isForwardStageTransition,
} from "./stages.ts";
import type { SecurityEvent } from "../../types/events.ts";

describe("deterministic attack stages", () => {
  test("orders attack stages from access pressure to objective action", () => {
    expect(getStageOrder("access_pressure")).toBeLessThan(getStageOrder("access_success"));
    expect(getStageOrder("access_success")).toBeLessThan(getStageOrder("persistence"));
    expect(getStageOrder("persistence")).toBeLessThan(getStageOrder("privilege_change"));
    expect(getStageOrder("privilege_change")).toBeLessThan(getStageOrder("objective_action"));
  });

  test("scores forward, same-stage, and reverse-stage compatibility", () => {
    expect(isForwardStageTransition("access_pressure", "access_success")).toBe(true);
    expect(getStageCompatibility("access_pressure", "access_success")).toBe(1);
    expect(getStageCompatibility("persistence", "persistence")).toBe(0.5);
    expect(getStageCompatibility("objective_action", "access_pressure")).toBe(0);
  });

  test("infers current evidence rule stages", () => {
    expect(inferStageForRule("brute_force_10_failures_5m", [])).toBe("access_pressure");
    expect(inferStageForRule("password_spray_10_users_15m", [])).toBe("access_pressure");
    expect(inferStageForRule("success_after_fail_3_to_1_10m", [])).toBe("access_success");
    expect(inferStageForRule("risky_account_change", [event({ event: "role_changed" })])).toBe(
      "privilege_change"
    );
    expect(inferStageForRule("risky_account_change", [event({ event: "api_key_created" })])).toBe(
      "persistence"
    );
  });
});

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

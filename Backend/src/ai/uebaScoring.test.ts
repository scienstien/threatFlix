import { describe, expect, test } from "bun:test";
import { UEBA_SCHEMA_VERSION } from "../types/ueba.ts";
import type { SecurityEvent } from "../types/events.ts";
import type { EvidenceFinding } from "./evidenceEngine.ts";
import { sessionizeEvents } from "./sessionizer.ts";
import { scoreDeterministicSessions } from "./uebaScoring.ts";

describe("deterministic-gated UEBA scoring", () => {
  test("does not call ML when no session is related to deterministic evidence", async () => {
    let calls = 0;
    const result = await scoreDeterministicSessions(
      "project",
      sessionizeEvents([event("event-1", "session-1")]),
      [],
      [],
      {
        fetchImpl: async () => {
          calls++;
          return Response.json(response(0.9));
        },
        now: () => new Date("2026-06-10T00:00:00.000Z"),
      }
    );

    expect(calls).toBe(0);
    expect(result.mlScore.mlUnavailable).toBe(true);
    expect(result.summary.sessionScores).toEqual([]);
  });

  test("scores only related deterministic sessions and selects the highest risk", async () => {
    const events = [
      event("event-low", "session-low", "alice"),
      event("event-high", "session-high", "bob"),
      event("event-unrelated", "session-unrelated", "carol"),
    ];
    const sessions = sessionizeEvents(events);
    const scoredUsers: string[] = [];
    const fetchImpl = async (_input: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      scoredUsers.push(request.user);
      return Response.json(response(request.user === "bob" ? 0.999 : 0.8));
    };

    const result = await scoreDeterministicSessions(
      "project",
      sessions,
      events,
      [finding(["event-low", "event-high"])],
      {
        fetchImpl,
        now: () => new Date("2026-06-10T00:00:00.000Z"),
      }
    );

    expect(scoredUsers.sort()).toEqual(["alice", "bob"]);
    expect(result.summary.sessionScores).toHaveLength(2);
    expect(result.summary.selectedSessionId).toBe(
      sessions.find((session) => session.user === "bob")?.id
    );
    expect(result.mlScore).toEqual({ anomalyScore: 0.999, isAnomaly: true });
  });

  test("keeps successful scores when another related session fails", async () => {
    const events = [
      event("event-good", "session-good", "alice"),
      event("event-fail", "session-fail", "bob"),
    ];
    const fetchImpl = async (_input: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      if (request.user === "bob") throw new Error("timeout");
      return Response.json(response(0.75));
    };

    const result = await scoreDeterministicSessions(
      "project",
      sessionizeEvents(events),
      events,
      [finding(events.map((item) => item.id))],
      { fetchImpl }
    );

    expect(result.summary.sessionScores).toHaveLength(1);
    expect(result.summary.mlUnavailable).toBe(true);
    expect(result.summary.error).toContain("timeout");
    expect(result.mlScore.anomalyScore).toBe(0.75);
  });
});

function event(
  id: string,
  sessionId: string,
  user: string = "alice"
): SecurityEvent {
  return {
    id,
    projectId: "project",
    event: "failed_login",
    user,
    ip: `203.0.113.${user.length}`,
    service: "auth",
    timestamp: "2026-06-10T00:00:00.000Z",
    receivedAt: "2026-06-10T00:00:00.000Z",
    sessionId,
    metadata: {},
  };
}

function finding(eventIds: string[]): EvidenceFinding {
  return {
    ruleId: "test-rule",
    weight: 30,
    description: "test deterministic evidence",
    eventIds,
  };
}

function response(anomalyScore: number) {
  return {
    schemaVersion: UEBA_SCHEMA_VERSION,
    modelVersion: "ueba-ensemble-v1",
    behaviorScore: anomalyScore * 100,
    anomalyScore,
    isAnomaly: anomalyScore >= 0.99,
    detectorScores: {
      isolationForest: anomalyScore,
      ecod: anomalyScore,
      copod: anomalyScore,
    },
    topReasons: [],
  };
}

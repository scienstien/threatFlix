import { describe, expect, test } from "bun:test";
import {
  UEBA_SCHEMA_VERSION,
  type UebaScoreRequest,
  type UebaScoreResponse,
  type UebaScoreSummary,
  type UebaFeatureVector,
} from "./ueba.ts";

describe("UEBA contract", () => {
  test("defines a versioned session scoring request", () => {
    const request: UebaScoreRequest = {
      schemaVersion: UEBA_SCHEMA_VERSION,
      projectId: "project-1",
      sessionId: "session-1",
      user: "analyst@example.com",
      ip: "203.0.113.10",
      service: "auth",
      eventIds: ["event-1"],
      features: featureVector({ failedLogins: 10 }),
    };

    expect(request.schemaVersion).toBe("1");
    expect(request.features.failedLogins).toBe(10);
  });

  test("defines detector scores and explainable reasons", () => {
    const response: UebaScoreResponse = {
      schemaVersion: UEBA_SCHEMA_VERSION,
      modelVersion: "bootstrap-1",
      behaviorScore: 87,
      anomalyScore: 0.87,
      isAnomaly: true,
      detectorScores: {
        isolationForest: 0.82,
        ecod: 0.91,
        copod: 0.88,
      },
      topReasons: [
        {
          feature: "failedLogins",
          value: 10,
          baseline: 0.5,
          direction: "high",
          contribution: 0.92,
        },
      ],
    };

    expect(response.detectorScores.ecod).toBe(0.91);
    expect(response.topReasons[0]?.direction).toBe("high");
  });

  test("defines an investigation-level summary without changing investigation types", () => {
    const summary: UebaScoreSummary = {
      schemaVersion: UEBA_SCHEMA_VERSION,
      modelVersion: "bootstrap-1",
      scoredAt: "2026-06-09T00:00:00.000Z",
      baselineMaturity: "bootstrap",
      behaviorScore: 0,
      sessionScores: [],
      mlUnavailable: true,
      error: "sidecar unavailable",
    };

    expect(summary.baselineMaturity).toBe("bootstrap");
    expect(summary.mlUnavailable).toBe(true);
  });
});

function featureVector(overrides: Partial<UebaFeatureVector> = {}): UebaFeatureVector {
  return {
    eventCount: 0,
    failedLogins: 0,
    successfulLogins: 0,
    mfaFailures: 0,
    privilegedEvents: 0,
    apiKeyCreations: 0,
    dataExports: 0,
    durationSeconds: 0,
    failuresPerMinute: 0,
    failureToSuccessFlag: 0,
    hourSin: 0,
    hourCos: 0,
    offHoursFlag: 0,
    newIpForUserFlag: 0,
    distinctIpsForUser24h: 0,
    distinctUsersForIp24h: 0,
    apiKeysForUser24h: 0,
    dataExportsForUser24h: 0,
    privilegeChangesForUser24h: 0,
    userFailureRate24h: 0,
    tenantFailureRate24h: 0,
    ...overrides,
  };
}

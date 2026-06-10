import { describe, expect, test } from "bun:test";
import { UEBA_SCHEMA_VERSION, type UebaScoreRequest } from "../types/ueba.ts";
import { scoreUebaSession, validateUebaResponse } from "./mlClient.ts";

describe("UEBA ML client", () => {
  test("posts the versioned request and maps a valid response", async () => {
    let receivedUrl = "";
    let receivedBody: unknown;
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      receivedUrl = String(input);
      receivedBody = JSON.parse(String(init?.body));
      return Response.json(validResponse());
    };

    const result = await scoreUebaSession(request(), {
      serviceUrl: "http://ml.test/",
      fetchImpl,
    });

    expect(receivedUrl).toBe("http://ml.test/score");
    expect(receivedBody).toEqual(request());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.modelVersion).toBe("ueba-ensemble-v1");
      expect(result.response.anomalyScore).toBe(0.995);
    }
  });

  test("fails open when the sidecar cannot be reached", async () => {
    const fetchImpl = async () => {
      throw new Error("connection refused");
    };

    const result = await scoreUebaSession(request(), { fetchImpl });

    expect(result).toEqual({
      ok: false,
      mlUnavailable: true,
      error: "connection refused",
    });
  });

  test("rejects an incompatible or malformed response", () => {
    expect(() =>
      validateUebaResponse({ ...validResponse(), schemaVersion: "2" })
    ).toThrow("Unsupported UEBA schema version");
    expect(() =>
      validateUebaResponse({ ...validResponse(), anomalyScore: 2 })
    ).toThrow("anomalyScore must be between 0 and 1");
  });
});

function request(): UebaScoreRequest {
  return {
    schemaVersion: UEBA_SCHEMA_VERSION,
    projectId: "project",
    sessionId: "session",
    user: "alice",
    ip: "203.0.113.10",
    service: "auth",
    eventIds: ["event-1"],
    features: {
      eventCount: 1,
      failedLogins: 0,
      successfulLogins: 1,
      mfaFailures: 0,
      privilegedEvents: 0,
      apiKeyCreations: 0,
      dataExports: 0,
      durationSeconds: 1,
      failuresPerMinute: 0,
      failureToSuccessFlag: 0,
      hourSin: 0,
      hourCos: 1,
      offHoursFlag: 0,
      newIpForUserFlag: 1,
      distinctIpsForUser24h: 0,
      distinctUsersForIp24h: 0,
      apiKeysForUser24h: 0,
      dataExportsForUser24h: 0,
      privilegeChangesForUser24h: 0,
      userFailureRate24h: 0,
      tenantFailureRate24h: 0,
    },
  };
}

function validResponse() {
  return {
    schemaVersion: UEBA_SCHEMA_VERSION,
    modelVersion: "ueba-ensemble-v1",
    behaviorScore: 99.5,
    anomalyScore: 0.995,
    isAnomaly: true,
    detectorScores: {
      isolationForest: 0.99,
      ecod: 1,
      copod: 1,
    },
    topReasons: [
      {
        feature: "failedLogins",
        value: 10,
        baseline: 0,
        direction: "high",
        contribution: 1,
      },
    ],
  };
}

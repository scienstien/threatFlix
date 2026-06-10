import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "../app.ts";
import { indexHistoricalInvestigation } from "../ai/graphSimilarity/service.ts";
import { buildIncidentGraph } from "../ai/incidentGraph.ts";
import { closeDb, setDatabasePathForTests } from "../db/database.ts";
import { investigationRepo } from "../db/repositories/investigationRepository.ts";
import { signJwt } from "../middleware/auth.ts";
import type { SecurityEvent } from "../types/events.ts";
import type { ThreatInvestigation } from "../types/investigations.ts";

const databasePath = join(process.cwd(), "data", `investigation-routes-test-${crypto.randomUUID()}.db`);
const projectOneToken = signJwt({
  sub: "user-p1",
  email: "p1@example.com",
  role: "user",
  projectId: "p1",
});
const projectTwoToken = signJwt({
  sub: "user-p2",
  email: "p2@example.com",
  role: "user",
  projectId: "p2",
});
const adminToken = signJwt({
  sub: "admin",
  email: "admin@example.com",
  role: "admin",
});
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  closeDb();
  setDatabasePathForTests(databasePath);
  for (let index = 0; index < 23; index++) {
    insertAndIndex(investigation(`p1-${index}`, "p1"));
  }
  insertAndIndex(investigation("p2-source", "p2"));
  investigationRepo.insert(investigation("p1-unindexed", "p1"));

  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())
  );
  closeDb();
  setDatabasePathForTests(null);
  for (const suffix of ["", "-shm", "-wal"]) {
    if (existsSync(`${databasePath}${suffix}`)) unlinkSync(`${databasePath}${suffix}`);
  }
});

describe("similar investigations API", () => {
  test("requires authentication", async () => {
    const response = await fetch(`${baseUrl}/api/investigations/p1-0/similar`);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required." });
  });

  test("keeps tenant users scoped to their own source investigation", async () => {
    const response = await getSimilar("p2-source", projectOneToken);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Investigation not found." });
  });

  test("allows admin source access while keeping candidates in the source project", async () => {
    const response = await getSimilar("p2-source", adminToken);
    const body = await response.json() as { matches: Array<{ investigationId: string }> };

    expect(response.status).toBe(200);
    expect(body.matches).toEqual([]);
  });

  test("returns a safe empty response when the source has no fingerprint", async () => {
    const response = await getSimilar("p1-unindexed", projectOneToken);
    const body = await response.json() as { investigationId: string; matches: unknown[] };

    expect(response.status).toBe(200);
    expect(body.investigationId).toBe("p1-unindexed");
    expect(body.matches).toEqual([]);
  });

  test("bounds requested result limits", async () => {
    const maximumResponse = await getSimilar("p1-0", projectOneToken, "999");
    const maximumBody = await maximumResponse.json() as { matches: unknown[] };
    const minimumResponse = await getSimilar("p1-0", projectOneToken, "-5");
    const minimumBody = await minimumResponse.json() as { matches: unknown[] };

    expect(maximumResponse.status).toBe(200);
    expect(maximumBody.matches).toHaveLength(20);
    expect(minimumBody.matches).toHaveLength(1);
  });
});

function getSimilar(investigationId: string, token: string, limit?: string): Promise<Response> {
  const query = limit ? `?limit=${limit}` : "";
  return fetch(`${baseUrl}/api/investigations/${investigationId}/similar${query}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

function insertAndIndex(item: ThreatInvestigation): void {
  investigationRepo.insert(item);
  indexHistoricalInvestigation(item);
}

function investigation(id: string, projectId: string): ThreatInvestigation {
  const events = ["failed_login", "successful_login", "api_key_created"].map(
    (eventType, index) => event(id, projectId, eventType, index)
  );
  return {
    id,
    projectId,
    title: "Account takeover",
    severity: "High",
    confidence: 0.8,
    mitre: "T1110",
    mitreName: "Brute Force",
    summary: "summary",
    recommendation: "action",
    graph: buildIncidentGraph(events),
    features: {},
    relatedEventIds: events.map((item) => item.id),
    createdAt: new Date().toISOString(),
    status: "open",
    webhookDelivered: false,
    evidence: [
      evidence(id, projectId, "brute_force_10_failures_5m", [events[0]!.id], "access_pressure", "T1110"),
      evidence(id, projectId, "success_after_fail_5_to_1_10m", [events[0]!.id, events[1]!.id], "access_success", "T1078"),
      evidence(id, projectId, "persistence_establishment", [events[2]!.id], "persistence", "T1098.001"),
    ],
    deterministicChain: [
      { fromRuleId: "brute_force_10_failures_5m", toRuleId: "success_after_fail_5_to_1_10m", sharedKeys: [], minutesBetween: 1, transitionScore: 0.9 },
      { fromRuleId: "success_after_fail_5_to_1_10m", toRuleId: "persistence_establishment", sharedKeys: [], minutesBetween: 1, transitionScore: 0.9 },
    ],
  };
}

function event(prefix: string, projectId: string, eventType: string, minute: number): SecurityEvent {
  const timestamp = new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString();
  return {
    id: `${prefix}-${eventType}`,
    projectId,
    event: eventType,
    user: `${prefix}@example.com`,
    ip: `10.0.0.${minute + 1}`,
    service: "identity",
    sessionId: `${prefix}-session`,
    timestamp,
    receivedAt: timestamp,
    metadata: {},
  };
}

function evidence(
  investigationId: string,
  projectId: string,
  ruleId: string,
  eventIds: string[],
  stage: NonNullable<ThreatInvestigation["evidence"][number]["deterministic"]>["stage"],
  techniqueId: string
): ThreatInvestigation["evidence"][number] {
  return {
    id: `${investigationId}-${ruleId}`,
    investigationId,
    projectId,
    ruleId,
    weight: 20,
    description: ruleId,
    eventIds,
    createdAt: new Date().toISOString(),
    deterministic: { stage, score: 20, confidence: 0.8, techniques: [{ id: techniqueId }] },
  };
}

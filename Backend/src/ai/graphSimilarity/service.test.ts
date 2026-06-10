import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { closeDb, setDatabasePathForTests } from "../../db/database.ts";
import { investigationRepo } from "../../db/repositories/investigationRepository.ts";
import { buildIncidentGraph } from "../incidentGraph.ts";
import type { SecurityEvent } from "../../types/events.ts";
import type { ThreatInvestigation } from "../../types/investigations.ts";
import { getSimilarIncidents, indexHistoricalInvestigation } from "./service.ts";

const databasePath = join(process.cwd(), "data", `graph-service-test-${crypto.randomUUID()}.db`);

beforeAll(() => {
  closeDb();
  setDatabasePathForTests(databasePath);
});

afterAll(() => {
  closeDb();
  setDatabasePathForTests(null);
  for (const suffix of ["", "-shm", "-wal"]) {
    if (existsSync(`${databasePath}${suffix}`)) unlinkSync(`${databasePath}${suffix}`);
  }
});

describe("graph similarity service", () => {
  test("ranks a same-project structural match and excludes another tenant", () => {
    const source = investigation("source", "p1", ["failed_login", "successful_login", "api_key_created"]);
    const similar = investigation("similar", "p1", ["failed_login", "successful_login", "api_key_created"]);
    const otherTenant = investigation("other", "p2", ["failed_login", "successful_login", "api_key_created"]);
    for (const item of [source, similar, otherTenant]) {
      investigationRepo.insert(item);
      indexHistoricalInvestigation(item);
    }

    const response = getSimilarIncidents(source, 10, 0);

    expect(response.matches[0]?.investigationId).toBe("similar");
    expect(response.matches.map((match) => match.investigationId)).not.toContain("other");
    expect(response.matches[0]?.similarity).toBe(1);
  });
});

function investigation(
  id: string,
  projectId: string,
  eventTypes: string[]
): ThreatInvestigation {
  const events = eventTypes.map((eventType, index) => event(id, projectId, eventType, index));
  const findings: ThreatInvestigation["evidence"] = [
    evidence(id, projectId, "brute_force_10_failures_5m", [events[0]!.id], "access_pressure", "T1110"),
    evidence(id, projectId, "success_after_fail_5_to_1_10m", [events[0]!.id, events[1]!.id], "access_success", "T1078"),
    evidence(id, projectId, "persistence_establishment", [events[2]!.id], "persistence", "T1098.001"),
  ];
  return {
    id, projectId, title: "Account takeover", severity: "High", confidence: 0.8,
    mitre: "T1110", mitreName: "Brute Force", summary: "summary", recommendation: "action",
    graph: buildIncidentGraph(events), features: {}, relatedEventIds: events.map((item) => item.id),
    createdAt: new Date().toISOString(), status: "open", webhookDelivered: false, evidence: findings,
    deterministicChain: [
      { fromRuleId: "brute_force_10_failures_5m", toRuleId: "success_after_fail_5_to_1_10m", sharedKeys: [], minutesBetween: 1, transitionScore: 0.9 },
      { fromRuleId: "success_after_fail_5_to_1_10m", toRuleId: "persistence_establishment", sharedKeys: [], minutesBetween: 1, transitionScore: 0.9 },
    ],
  };
}

function event(prefix: string, projectId: string, eventType: string, minute: number): SecurityEvent {
  const timestamp = new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString();
  return {
    id: `${prefix}-${eventType}`, projectId, event: eventType, user: `${prefix}@example.com`,
    ip: `10.0.0.${minute + 1}`, service: "identity", sessionId: `${prefix}-session`,
    timestamp, receivedAt: timestamp, metadata: {},
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
    id: `${investigationId}-${ruleId}`, investigationId, projectId, ruleId, weight: 20,
    description: ruleId, eventIds, createdAt: new Date().toISOString(),
    deterministic: { stage, score: 20, confidence: 0.8, techniques: [{ id: techniqueId }] },
  };
}

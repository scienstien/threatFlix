import { describe, expect, test } from "bun:test";
import { buildCorrelationClusters } from "./clustering.ts";
import type { EvidenceFinding } from "../evidenceEngine.ts";
import type { AttackStage } from "../../types/investigations.ts";

describe("deterministic correlation clustering", () => {
  test("clusters findings that share a user inside the default time window", () => {
    const clusters = buildCorrelationClusters([
      finding("brute_force", ["e1"], "access_pressure", { users: ["alice"], ips: ["10.0.0.1"] }, 0),
      finding("success_after_fail", ["e2"], "access_success", { users: ["alice"], ips: ["10.0.0.2"] }, 20),
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.eventIds).toEqual(["e1", "e2"]);
    expect(clusters[0]?.entityKeys.users).toEqual(["alice"]);
  });

  test("clusters same-session findings across a longer time gap", () => {
    const clusters = buildCorrelationClusters([
      finding("success_after_fail", ["e1"], "access_success", { sessionIds: ["session-1"] }, 0),
      finding("api_key_created", ["e2"], "persistence", { sessionIds: ["session-1"] }, 90),
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.stageSet).toEqual(["access_success", "persistence"]);
  });

  test("does not cluster service-only matches", () => {
    const clusters = buildCorrelationClusters([
      finding("brute_force", ["e1"], "access_pressure", { services: ["auth"] }, 0),
      finding("risky_account_change", ["e2"], "privilege_change", { services: ["auth"] }, 5),
    ]);

    expect(clusters).toHaveLength(2);
  });

  test("keeps unrelated findings separate", () => {
    const clusters = buildCorrelationClusters([
      finding("brute_force", ["e1"], "access_pressure", { users: ["alice"], ips: ["10.0.0.1"] }, 0),
      finding("risky_account_change", ["e2"], "privilege_change", { users: ["bob"], ips: ["10.0.0.2"] }, 5),
    ]);

    expect(clusters).toHaveLength(2);
  });

  test("merges entity keys, stages, and techniques for clustered findings", () => {
    const clusters = buildCorrelationClusters([
      finding("brute_force", ["e1"], "access_pressure", { users: ["alice"], ips: ["10.0.0.1"] }, 0, "T1110"),
      finding("success", ["e2"], "access_success", { users: ["alice"], services: ["admin"] }, 10, "T1078"),
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.entityKeys.users).toEqual(["alice"]);
    expect(clusters[0]?.entityKeys.ips).toEqual(["10.0.0.1"]);
    expect(clusters[0]?.entityKeys.services).toEqual(["admin"]);
    expect(clusters[0]?.stageSet).toEqual(["access_pressure", "access_success"]);
    expect(clusters[0]?.techniqueIds).toEqual(["T1078", "T1110"]);
  });
});

function finding(
  ruleId: string,
  eventIds: string[],
  stage: AttackStage,
  entityKeys: NonNullable<EvidenceFinding["deterministic"]>["entityKeys"],
  startMinute: number,
  techniqueId: string = "T0000"
): EvidenceFinding {
  const start = new Date(Date.UTC(2026, 0, 1, 0, startMinute)).toISOString();
  const end = new Date(Date.UTC(2026, 0, 1, 0, startMinute + 1)).toISOString();

  return {
    ruleId,
    weight: 10,
    description: ruleId,
    eventIds,
    deterministic: {
      stage,
      score: 10,
      confidence: 0.5,
      techniques: [{ id: techniqueId }],
      entityKeys,
      startTime: start,
      endTime: end,
    },
  };
}

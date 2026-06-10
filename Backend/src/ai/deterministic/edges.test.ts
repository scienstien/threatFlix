import { describe, expect, test } from "bun:test";
import { buildChainEdges } from "./edges.ts";
import type { DeterministicCluster } from "./clustering.ts";
import type { EvidenceFinding } from "../evidenceEngine.ts";
import type { AttackStage } from "../../types/investigations.ts";

describe("deterministic chain edge builder", () => {
  test("creates edge for forward stage transition with shared entities", () => {
    const cluster = makeCluster([
      finding("brute_force", ["e1"], "access_pressure", { users: ["alice"], ips: ["10.0.0.1"] }, 0, "T1110"),
      finding("success_after_fail", ["e2"], "access_success", { users: ["alice"], ips: ["10.0.0.1"] }, 5, "T1078"),
    ]);

    const edges = buildChainEdges(cluster);

    expect(edges.length).toBeGreaterThanOrEqual(1);
    expect(edges[0]?.fromRuleId).toBe("brute_force");
    expect(edges[0]?.toRuleId).toBe("success_after_fail");
    expect(edges[0]?.transitionScore).toBeGreaterThan(0);
    expect(edges[0]?.sharedKeys).toContain("user:alice");
  });

  test("rejects edges with incompatible reverse stage transitions", () => {
    const cluster = makeCluster([
      finding("data_export", ["e1"], "objective_action", { users: ["alice"] }, 0),
      finding("brute_force", ["e2"], "access_pressure", { users: ["alice"] }, 5),
    ]);

    const edges = buildChainEdges(cluster);

    // objective_action → access_pressure has 0 compatibility, should produce no edge
    expect(edges).toHaveLength(0);
  });

  test("rejects edges with no shared entity keys", () => {
    const cluster = makeCluster([
      finding("brute_force", ["e1"], "access_pressure", { users: ["alice"], ips: ["10.0.0.1"] }, 0),
      finding("privilege_change", ["e2"], "privilege_change", { users: ["bob"], ips: ["10.0.0.2"] }, 5),
    ]);

    const edges = buildChainEdges(cluster);

    expect(edges).toHaveLength(0);
  });

  test("time decay reduces transition score for distant findings", () => {
    const near = makeCluster([
      finding("brute_force", ["e1"], "access_pressure", { users: ["alice"] }, 0),
      finding("success_after_fail", ["e2"], "access_success", { users: ["alice"] }, 2),
    ]);
    const far = makeCluster([
      finding("brute_force", ["e3"], "access_pressure", { users: ["alice"] }, 0),
      finding("success_after_fail", ["e4"], "access_success", { users: ["alice"] }, 25),
    ]);

    const nearEdges = buildChainEdges(near);
    const farEdges = buildChainEdges(far);

    expect(nearEdges.length).toBeGreaterThanOrEqual(1);
    expect(farEdges.length).toBeGreaterThanOrEqual(1);
    expect(nearEdges[0]!.transitionScore).toBeGreaterThan(farEdges[0]!.transitionScore);
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

function makeCluster(findings: EvidenceFinding[]): DeterministicCluster {
  const allUsers = findings.flatMap((f) => f.deterministic?.entityKeys?.users ?? []);
  const allIps = findings.flatMap((f) => f.deterministic?.entityKeys?.ips ?? []);
  const allServices = findings.flatMap((f) => f.deterministic?.entityKeys?.services ?? []);
  const allSessions = findings.flatMap((f) => f.deterministic?.entityKeys?.sessionIds ?? []);
  const times = findings.flatMap((f) => [f.deterministic?.startTime, f.deterministic?.endTime]).filter(Boolean).sort();

  return {
    clusterId: "test-cluster",
    findings,
    eventIds: findings.flatMap((f) => f.eventIds),
    entityKeys: {
      users: allUsers.length > 0 ? [...new Set(allUsers)] : undefined,
      ips: allIps.length > 0 ? [...new Set(allIps)] : undefined,
      services: allServices.length > 0 ? [...new Set(allServices)] : undefined,
      sessionIds: allSessions.length > 0 ? [...new Set(allSessions)] : undefined,
    },
    startTime: times[0] as string,
    endTime: times[times.length - 1] as string,
    stageSet: [...new Set(findings.map((f) => f.deterministic!.stage))],
    techniqueIds: [...new Set(findings.flatMap((f) => f.deterministic?.techniques?.map((t) => t.id) ?? []))],
  };
}

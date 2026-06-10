import { describe, expect, test } from "bun:test";
import { scoreDeterministicCluster } from "./scoring.ts";
import type { DeterministicCluster } from "./clustering.ts";
import type { EvidenceFinding } from "../evidenceEngine.ts";
import type { AttackStage } from "../../types/investigations.ts";

describe("deterministic scoring", () => {
  test("single weak finding gets penalty and low final score", () => {
    const cluster = makeCluster([
      finding("mfa_disabled", ["e1"], "persistence", { users: ["alice"] }, 0, 20),
    ]);

    const result = scoreDeterministicCluster(cluster);

    expect(result.score.ruleStrength).toBeGreaterThan(0);
    expect(result.score.penalties).toBeGreaterThan(0);
    expect(result.score.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.score.finalScore).toBeLessThanOrEqual(100);
  });

  test("multi-finding cluster with chain scores coherence", () => {
    const cluster = makeCluster([
      finding("brute_force", ["e1", "e2"], "access_pressure", { users: ["alice"], ips: ["10.0.0.1"] }, 0, 40),
      finding("success_after_fail", ["e3"], "access_success", { users: ["alice"], ips: ["10.0.0.1"] }, 5, 28),
      finding("privilege_change", ["e4"], "privilege_change", { users: ["alice"] }, 8, 26),
    ]);

    const result = scoreDeterministicCluster(cluster);

    expect(result.score.ruleStrength).toBeGreaterThan(0);
    expect(result.score.chainCoherence).toBeGreaterThan(0);
    expect(result.score.blastRadius).toBeGreaterThan(0);
    expect(result.score.temporalCompression).toBeGreaterThan(0);
    expect(result.score.finalScore).toBeGreaterThan(result.score.ruleStrength);
  });

  test("final score is always clamped to [0, 100]", () => {
    const cluster = makeCluster([
      finding("brute_force", ["e1"], "access_pressure", { users: ["alice"], ips: ["10.0.0.1"] }, 0, 45),
      finding("success_after_fail", ["e2"], "access_success", { users: ["alice"], ips: ["10.0.0.1"] }, 2, 45),
      finding("mfa_bypass", ["e3"], "persistence", { users: ["alice"], ips: ["10.0.0.1"] }, 4, 45),
      finding("privilege_change", ["e4"], "privilege_change", { users: ["alice"], ips: ["10.0.0.1"] }, 6, 45),
      finding("data_export", ["e5"], "objective_action", { users: ["alice"], ips: ["10.0.0.1"] }, 8, 45),
    ]);

    const result = scoreDeterministicCluster(cluster);

    expect(result.score.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.score.finalScore).toBeLessThanOrEqual(100);
  });

  test("score breakdown includes all expected fields", () => {
    const cluster = makeCluster([
      finding("brute_force", ["e1"], "access_pressure", { users: ["alice"] }, 0, 40),
    ]);

    const result = scoreDeterministicCluster(cluster);

    expect(result.score).toHaveProperty("ruleStrength");
    expect(result.score).toHaveProperty("chainCoherence");
    expect(result.score).toHaveProperty("blastRadius");
    expect(result.score).toHaveProperty("temporalCompression");
    expect(result.score).toHaveProperty("techniqueProgression");
    expect(result.score).toHaveProperty("capecAlignment");
    expect(result.score).toHaveProperty("penalties");
    expect(result.score).toHaveProperty("finalScore");
    expect(result.clusterId).toBe("test-cluster");
    expect(result.findingRuleIds).toContain("brute_force");
  });
});

function finding(
  ruleId: string,
  eventIds: string[],
  stage: AttackStage,
  entityKeys: NonNullable<EvidenceFinding["deterministic"]>["entityKeys"],
  startMinute: number,
  score: number
): EvidenceFinding {
  const start = new Date(Date.UTC(2026, 0, 1, 0, startMinute)).toISOString();
  const end = new Date(Date.UTC(2026, 0, 1, 0, startMinute + 1)).toISOString();

  return {
    ruleId,
    weight: score,
    description: ruleId,
    eventIds,
    deterministic: {
      stage,
      score,
      confidence: 0.5,
      techniques: [{ id: "T1110" }],
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

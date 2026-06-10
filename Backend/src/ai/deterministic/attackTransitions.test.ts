import { describe, expect, test } from "bun:test";
import {
  getTechniqueTransitionPrior,
  getEffectiveTechniqueTransition,
  scoreTechniqueProgression,
} from "./attackTransitions.ts";
import type { EvidenceFinding } from "../evidenceEngine.ts";
import type { DeterministicCluster } from "./clustering.ts";
import type { DeterministicChainEdge, AttackStage } from "../../types/investigations.ts";

describe("ATT&CK transition priors", () => {
  test("returns structural prior for known technique pairs", () => {
    expect(getTechniqueTransitionPrior("T1110", "T1078")).toBe(0.75);
    expect(getTechniqueTransitionPrior("T1110.003", "T1078")).toBe(1);
    expect(getTechniqueTransitionPrior("T1110.004", "T1078")).toBe(1);
    expect(getTechniqueTransitionPrior("T1078", "T1098")).toBe(0.75);
    expect(getTechniqueTransitionPrior("T1098.001", "T1041")).toBe(0.75);
  });

  test("returns 0 for unknown technique pairs", () => {
    expect(getTechniqueTransitionPrior("T1110", "T1110.003")).toBe(0);
    expect(getTechniqueTransitionPrior("T1041", "T1110")).toBe(0);
    expect(getTechniqueTransitionPrior("UNKNOWN", "T1078")).toBe(0);
    expect(getTechniqueTransitionPrior(undefined, "T1078")).toBe(0);
    expect(getTechniqueTransitionPrior("T1110", undefined)).toBe(0);
  });

  test("effective transition multiplies prior by edge transition score", () => {
    const from = makeFinding("brute_force", "T1110");
    const to = makeFinding("success_after_fail", "T1078");
    const edge: DeterministicChainEdge = {
      fromRuleId: "brute_force",
      toRuleId: "success_after_fail",
      sharedKeys: ["user:alice"],
      minutesBetween: 4,
      transitionScore: 0.8,
    };

    const effective = getEffectiveTechniqueTransition(from, to, edge);

    // structural prior T1110→T1078 = 0.75, edge score = 0.8 → 0.75 * 0.8 = 0.6
    expect(effective).toBeCloseTo(0.6, 2);
  });

  test("effective transition returns 0 for unknown technique pair", () => {
    const from = makeFinding("brute_force", "T1041");
    const to = makeFinding("success_after_fail", "T1110");
    const edge: DeterministicChainEdge = {
      fromRuleId: "brute_force",
      toRuleId: "success_after_fail",
      sharedKeys: ["user:alice"],
      minutesBetween: 4,
      transitionScore: 0.9,
    };

    const effective = getEffectiveTechniqueTransition(from, to, edge);

    expect(effective).toBe(0);
  });

  test("technique progression scores multi-step chain", () => {
    const cluster = makeCluster([
      makeFinding("brute_force", "T1110", 0),
      makeFinding("success_after_fail", "T1078", 5),
      makeFinding("privilege_change", "T1098", 10),
    ]);
    const edges: DeterministicChainEdge[] = [
      { fromRuleId: "brute_force", toRuleId: "success_after_fail", sharedKeys: ["user:alice"], minutesBetween: 4, transitionScore: 0.8 },
      { fromRuleId: "success_after_fail", toRuleId: "privilege_change", sharedKeys: ["user:alice"], minutesBetween: 4, transitionScore: 0.7 },
    ];

    const score = scoreTechniqueProgression(cluster, edges);

    // T1110→T1078: prior=0.75, edge=0.8 → eff=0.6
    // T1078→T1098: prior=0.75, edge=0.7 → eff=0.525
    // avg eff = (0.6 + 0.525)/2 = 0.5625
    // score = 10 * 0.5625 = 5.625
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(10);
  });
});

function makeFinding(ruleId: string, techniqueId: string, startMinute: number = 0): EvidenceFinding {
  const start = new Date(Date.UTC(2026, 0, 1, 0, startMinute)).toISOString();

  return {
    ruleId,
    weight: 10,
    description: ruleId,
    eventIds: [`${ruleId}-e1`],
    deterministic: {
      stage: "access_pressure" as AttackStage,
      score: 10,
      confidence: 0.5,
      techniques: [{ id: techniqueId }],
      entityKeys: { users: ["alice"] },
      startTime: start,
      endTime: start,
    },
  };
}

function makeCluster(findings: EvidenceFinding[]): DeterministicCluster {
  return {
    clusterId: "test-cluster",
    findings,
    eventIds: findings.flatMap((f) => f.eventIds),
    entityKeys: { users: ["alice"] },
    startTime: findings[0]?.deterministic?.startTime ?? "",
    endTime: findings[findings.length - 1]?.deterministic?.endTime ?? "",
    stageSet: [...new Set(findings.map((f) => f.deterministic!.stage))],
    techniqueIds: [...new Set(findings.flatMap((f) => f.deterministic?.techniques?.map((t) => t.id) ?? []))],
  };
}

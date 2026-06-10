import { describe, expect, test } from "bun:test";
import { scoreCapecAlignment, getBestCapecTemplateMatch } from "./capecTemplates.ts";
import type { DeterministicCluster } from "./clustering.ts";
import type { EvidenceFinding } from "../evidenceEngine.ts";
import type { DeterministicChainEdge, AttackStage } from "../../types/investigations.ts";

describe("CAPEC template matching", () => {
  test("brute force cluster matches CAPEC-112", () => {
    const cluster = makeCluster([
      finding("brute_force", "access_pressure", "T1110", 0),
      finding("success_after_fail", "access_success", "T1078", 5),
    ]);
    const edges: DeterministicChainEdge[] = [
      { fromRuleId: "brute_force", toRuleId: "success_after_fail", sharedKeys: ["user:alice"], minutesBetween: 4, transitionScore: 0.8 },
    ];

    const match = getBestCapecTemplateMatch(cluster, edges);

    expect(match.id).toBe("CAPEC-112");
    expect(match.score).toBeGreaterThan(0);
  });

  test("exfiltration chain matches CAPEC-118", () => {
    const cluster = makeCluster([
      finding("success_after_fail", "access_success", "T1078", 0),
      finding("privilege_change", "privilege_change", "T1098", 5),
      finding("data_export", "objective_action", "T1041", 10),
    ]);
    const edges: DeterministicChainEdge[] = [
      { fromRuleId: "success_after_fail", toRuleId: "privilege_change", sharedKeys: ["user:alice"], minutesBetween: 4, transitionScore: 0.7 },
      { fromRuleId: "privilege_change", toRuleId: "data_export", sharedKeys: ["user:alice"], minutesBetween: 4, transitionScore: 0.6 },
    ];

    const match = getBestCapecTemplateMatch(cluster, edges);

    expect(match.id).toBe("CAPEC-118");
    expect(match.score).toBeGreaterThan(0);
  });

  test("single-finding cluster with unrelated technique returns low alignment", () => {
    const cluster = makeCluster([
      finding("unknown_rule", "access_pressure", "T9999", 0),
    ]);

    const alignment = scoreCapecAlignment(cluster, []);

    // No technique match, but partial stage overlap gives a small non-zero score
    expect(alignment).toBeLessThanOrEqual(5);
  });

  test("scoreCapecAlignment returns bounded numeric score", () => {
    const cluster = makeCluster([
      finding("brute_force", "access_pressure", "T1110", 0),
      finding("success_after_fail", "access_success", "T1078", 5),
    ]);
    const edges: DeterministicChainEdge[] = [
      { fromRuleId: "brute_force", toRuleId: "success_after_fail", sharedKeys: ["user:alice"], minutesBetween: 4, transitionScore: 0.9 },
    ];

    const score = scoreCapecAlignment(cluster, edges);

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(10);
  });
});

function finding(
  ruleId: string,
  stage: AttackStage,
  techniqueId: string,
  startMinute: number
): EvidenceFinding {
  const start = new Date(Date.UTC(2026, 0, 1, 0, startMinute)).toISOString();
  const end = new Date(Date.UTC(2026, 0, 1, 0, startMinute + 1)).toISOString();

  return {
    ruleId,
    weight: 10,
    description: ruleId,
    eventIds: [`${ruleId}-e1`],
    deterministic: {
      stage,
      score: 10,
      confidence: 0.5,
      techniques: [{ id: techniqueId }],
      entityKeys: { users: ["alice"] },
      startTime: start,
      endTime: end,
    },
  };
}

function makeCluster(findings: EvidenceFinding[]): DeterministicCluster {
  const times = findings.flatMap((f) => [f.deterministic?.startTime, f.deterministic?.endTime]).filter(Boolean).sort();

  return {
    clusterId: "test-cluster",
    findings,
    eventIds: findings.flatMap((f) => f.eventIds),
    entityKeys: { users: ["alice"] },
    startTime: times[0] as string,
    endTime: times[times.length - 1] as string,
    stageSet: [...new Set(findings.map((f) => f.deterministic!.stage))],
    techniqueIds: [...new Set(findings.flatMap((f) => f.deterministic?.techniques?.map((t) => t.id) ?? []))],
  };
}

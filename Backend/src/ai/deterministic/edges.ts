import type { EvidenceFinding } from "../evidenceEngine.ts";
import type { DeterministicChainEdge, DeterministicEntityKeys } from "../../types/investigations.ts";
import type { DeterministicCluster } from "./clustering.ts";
import { getStageCompatibility } from "./stages.ts";

const TIME_DECAY_LAMBDA = 0.05;

export function buildChainEdges(cluster: DeterministicCluster): DeterministicChainEdge[] {
  const findings = [...cluster.findings].sort(compareFindingsByStartTime);
  const edges: DeterministicChainEdge[] = [];

  for (let fromIndex = 0; fromIndex < findings.length; fromIndex++) {
    for (let toIndex = fromIndex + 1; toIndex < findings.length; toIndex++) {
      const edge = buildEdge(findings[fromIndex], findings[toIndex]);
      if (edge) {
        edges.push(edge);
      }
    }
  }

  return edges.sort((left, right) => right.transitionScore - left.transitionScore);
}

export function buildClusterChainEdges(clusters: DeterministicCluster[]): DeterministicChainEdge[] {
  return clusters.flatMap(buildChainEdges);
}

function buildEdge(
  from: EvidenceFinding | undefined,
  to: EvidenceFinding | undefined
): DeterministicChainEdge | null {
  if (!from?.deterministic || !to?.deterministic) return null;

  const stageCompatibility = getStageCompatibility(from.deterministic.stage, to.deterministic.stage);
  if (stageCompatibility <= 0) return null;

  const shared = getSharedEntityKeys(
    from.deterministic.entityKeys ?? {},
    to.deterministic.entityKeys ?? {}
  );
  const entityScore = getEntityContinuityScore(shared);
  if (entityScore <= 0) return null;

  const minutesBetween = getGapMinutes(from.deterministic.endTime, to.deterministic.startTime);
  if (minutesBetween === null) return null;

  const timeScore = Math.exp(-TIME_DECAY_LAMBDA * minutesBetween);
  const supportScore = Math.sqrt(from.deterministic.confidence * to.deterministic.confidence);
  const transitionScore = clamp01(
    0.35 * entityScore +
    0.25 * timeScore +
    0.25 * stageCompatibility +
    0.15 * supportScore
  );

  return {
    fromRuleId: from.ruleId,
    toRuleId: to.ruleId,
    sharedKeys: formatSharedKeys(shared),
    minutesBetween,
    transitionScore: Number(transitionScore.toFixed(4)),
  };
}

function getEntityContinuityScore(shared: Required<DeterministicEntityKeys>): number {
  if (shared.sessionIds.length > 0) return 1;
  if (shared.users.length > 0 && shared.ips.length > 0) return 0.95;
  if (shared.users.length > 0 && shared.services.length > 0) return 0.85;
  if (shared.users.length > 0) return 0.75;
  if (shared.ips.length > 0 && shared.services.length > 0) return 0.7;
  if (shared.ips.length > 0) return 0.65;
  return 0;
}

function getSharedEntityKeys(
  left: DeterministicEntityKeys,
  right: DeterministicEntityKeys
): Required<DeterministicEntityKeys> {
  return {
    users: intersect(left.users, right.users),
    ips: intersect(left.ips, right.ips),
    services: intersect(left.services, right.services),
    sessionIds: intersect(left.sessionIds, right.sessionIds),
  };
}

function formatSharedKeys(shared: Required<DeterministicEntityKeys>): string[] {
  return [
    ...shared.sessionIds.map((sessionId) => `session:${sessionId}`),
    ...shared.users.map((user) => `user:${user}`),
    ...shared.ips.map((ip) => `ip:${ip}`),
    ...shared.services.map((service) => `service:${service}`),
  ];
}

function getGapMinutes(
  fromEnd: string | undefined,
  toStart: string | undefined
): number | null {
  if (!fromEnd || !toStart) return null;

  const fromEndMs = Date.parse(fromEnd);
  const toStartMs = Date.parse(toStart);
  if (!Number.isFinite(fromEndMs) || !Number.isFinite(toStartMs)) return null;

  return Math.max(0, (toStartMs - fromEndMs) / 60_000);
}

function compareFindingsByStartTime(left: EvidenceFinding, right: EvidenceFinding): number {
  const leftStart = left.deterministic?.startTime;
  const rightStart = right.deterministic?.startTime;
  if (!leftStart && !rightStart) return 0;
  if (!leftStart) return 1;
  if (!rightStart) return -1;
  return Date.parse(leftStart) - Date.parse(rightStart);
}

function intersect(left: string[] | undefined, right: string[] | undefined): string[] {
  if (!left || !right) return [];
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

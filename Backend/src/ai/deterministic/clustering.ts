import type { EvidenceFinding } from "../evidenceEngine.ts";
import type { AttackStage, DeterministicEntityKeys } from "../../types/investigations.ts";

export interface DeterministicCluster {
  clusterId: string;
  findings: EvidenceFinding[];
  eventIds: string[];
  entityKeys: DeterministicEntityKeys;
  startTime?: string;
  endTime?: string;
  stageSet: AttackStage[];
  techniqueIds: string[];
}

const DEFAULT_MAX_GAP_MINUTES = 30;
const SAME_SESSION_MAX_GAP_MINUTES = 120;

export function buildCorrelationClusters(findings: EvidenceFinding[]): DeterministicCluster[] {
  if (findings.length === 0) return [];

  const parent = findings.map((_, index) => index);

  for (let left = 0; left < findings.length; left++) {
    for (let right = left + 1; right < findings.length; right++) {
      if (shouldCluster(findings[left], findings[right])) {
        union(parent, left, right);
      }
    }
  }

  const groups = new Map<number, EvidenceFinding[]>();
  findings.forEach((finding, index) => {
    const root = find(parent, index);
    const group = groups.get(root) ?? [];
    group.push(finding);
    groups.set(root, group);
  });

  return [...groups.values()]
    .map(toCluster)
    .sort((a, b) => compareOptionalTime(a.startTime, b.startTime));
}

function shouldCluster(left: EvidenceFinding | undefined, right: EvidenceFinding | undefined): boolean {
  if (!left?.deterministic || !right?.deterministic) return false;

  const shared = getSharedEntityKeys(
    left.deterministic.entityKeys ?? {},
    right.deterministic.entityKeys ?? {}
  );
  if (!hasStrongEntityLink(shared)) return false;

  const gap = getGapMinutes(
    left.deterministic.startTime,
    left.deterministic.endTime,
    right.deterministic.startTime,
    right.deterministic.endTime
  );
  if (gap === null) return false;

  const maxGap = shared.sessionIds.length > 0
    ? SAME_SESSION_MAX_GAP_MINUTES
    : DEFAULT_MAX_GAP_MINUTES;

  return gap <= maxGap;
}

function hasStrongEntityLink(shared: Required<DeterministicEntityKeys>): boolean {
  return shared.sessionIds.length > 0 ||
    shared.users.length > 0 ||
    shared.ips.length > 0 ||
    (shared.services.length > 0 && (shared.users.length > 0 || shared.ips.length > 0));
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

function getGapMinutes(
  leftStart: string | undefined,
  leftEnd: string | undefined,
  rightStart: string | undefined,
  rightEnd: string | undefined
): number | null {
  if (!leftStart || !leftEnd || !rightStart || !rightEnd) return null;

  const leftStartMs = Date.parse(leftStart);
  const leftEndMs = Date.parse(leftEnd);
  const rightStartMs = Date.parse(rightStart);
  const rightEndMs = Date.parse(rightEnd);
  if (![leftStartMs, leftEndMs, rightStartMs, rightEndMs].every(Number.isFinite)) return null;

  if (leftEndMs < rightStartMs) return (rightStartMs - leftEndMs) / 60_000;
  if (rightEndMs < leftStartMs) return (leftStartMs - rightEndMs) / 60_000;
  return 0;
}

function toCluster(findings: EvidenceFinding[], index: number): DeterministicCluster {
  const eventIds = unique(findings.flatMap((finding) => finding.eventIds)).sort();
  const entityKeys = mergeEntityKeys(findings);
  const times = findings
    .flatMap((finding) => [
      finding.deterministic?.startTime,
      finding.deterministic?.endTime,
    ])
    .filter((time): time is string => Boolean(time))
    .sort();

  return {
    clusterId: `cluster:${index}:${eventIds[0] ?? "empty"}`,
    findings,
    eventIds,
    entityKeys,
    startTime: times[0],
    endTime: times[times.length - 1],
    stageSet: unique(
      findings
        .map((finding) => finding.deterministic?.stage)
        .filter((stage): stage is AttackStage => Boolean(stage))
    ),
    techniqueIds: unique(
      findings.flatMap((finding) =>
        finding.deterministic?.techniques?.map((technique) => technique.id) ?? []
      )
    ).sort(),
  };
}

function mergeEntityKeys(findings: EvidenceFinding[]): DeterministicEntityKeys {
  const keys = findings.map((finding) => finding.deterministic?.entityKeys ?? {});
  return compactEntityKeys({
    users: unique(keys.flatMap((key) => key.users ?? [])).sort(),
    ips: unique(keys.flatMap((key) => key.ips ?? [])).sort(),
    services: unique(keys.flatMap((key) => key.services ?? [])).sort(),
    sessionIds: unique(keys.flatMap((key) => key.sessionIds ?? [])).sort(),
  });
}

function compactEntityKeys(keys: Required<DeterministicEntityKeys>): DeterministicEntityKeys {
  return {
    users: keys.users.length > 0 ? keys.users : undefined,
    ips: keys.ips.length > 0 ? keys.ips : undefined,
    services: keys.services.length > 0 ? keys.services : undefined,
    sessionIds: keys.sessionIds.length > 0 ? keys.sessionIds : undefined,
  };
}

function find(parent: number[], index: number): number {
  const currentParent = parent[index];
  if (currentParent === undefined) {
    return index;
  }

  if (currentParent !== index) {
    const root = find(parent, currentParent);
    parent[index] = root;
    return root;
  }
  return currentParent;
}

function union(parent: number[], left: number, right: number): void {
  const leftRoot = find(parent, left);
  const rightRoot = find(parent, right);
  if (leftRoot !== rightRoot) {
    parent[rightRoot] = leftRoot;
  }
}

function intersect(left: string[] | undefined, right: string[] | undefined): string[] {
  if (!left || !right) return [];
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function compareOptionalTime(left: string | undefined, right: string | undefined): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return Date.parse(left) - Date.parse(right);
}

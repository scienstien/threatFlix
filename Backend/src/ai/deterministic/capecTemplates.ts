import type { AttackStage, DeterministicChainEdge } from "../../types/investigations.ts";
import type { DeterministicCluster } from "./clustering.ts";

interface CapecTemplate {
  id: string;
  name: string;
  stages: AttackStage[];
  techniqueIds: string[];
}

const CAPEC_TEMPLATES: CapecTemplate[] = [
  {
    id: "CAPEC-112",
    name: "Brute Force",
    stages: ["access_pressure", "access_success"],
    techniqueIds: ["T1110", "T1078"],
  },
  {
    id: "CAPEC-49",
    name: "Password Brute Forcing",
    stages: ["access_pressure", "access_success"],
    techniqueIds: ["T1110.003", "T1078", "T1110.004"],
  },
  {
    id: "CAPEC-560",
    name: "Use of Known Credentials",
    stages: ["access_success", "persistence", "privilege_change"],
    techniqueIds: ["T1078", "T1098", "T1098.001"],
  },
  {
    id: "CAPEC-578",
    name: "Disable Security Controls",
    stages: ["access_success", "persistence"],
    techniqueIds: ["T1078", "T1556.006"],
  },
  {
    id: "CAPEC-118",
    name: "Data Exfiltration",
    stages: ["access_success", "privilege_change", "objective_action"],
    techniqueIds: ["T1078", "T1098", "T1098.001", "T1041"],
  },
];

export function scoreCapecAlignment(
  cluster: DeterministicCluster,
  edges: DeterministicChainEdge[]
): number {
  const bestMatch = getBestCapecTemplateMatch(cluster, edges);
  return round(10 * bestMatch.score);
}

export function getBestCapecTemplateMatch(
  cluster: DeterministicCluster,
  edges: DeterministicChainEdge[]
): { id?: string; name?: string; score: number } {
  let best = { score: 0 } as { id?: string; name?: string; score: number };

  for (const template of CAPEC_TEMPLATES) {
    const score = scoreTemplate(template, cluster, edges);
    if (score > best.score) {
      best = { id: template.id, name: template.name, score };
    }
  }

  return best;
}

function scoreTemplate(
  template: CapecTemplate,
  cluster: DeterministicCluster,
  edges: DeterministicChainEdge[]
): number {
  const stageCoverage = getCoverage(cluster.stageSet, template.stages);
  const techniqueCoverage = getCoverage(cluster.techniqueIds, template.techniqueIds);
  const orderQuality = getOrderQuality(cluster, template.stages);
  const edgeQuality = average(edges.map((edge) => edge.transitionScore));

  return clamp01(
    0.35 * stageCoverage +
    0.30 * techniqueCoverage +
    0.20 * orderQuality +
    0.15 * edgeQuality
  );
}

function getCoverage(actual: string[], expected: string[]): number {
  if (expected.length === 0) return 0;
  const actualSet = new Set(actual);
  const matched = expected.filter((item) => actualSet.has(item)).length;
  return matched / expected.length;
}

function getOrderQuality(cluster: DeterministicCluster, expectedStages: AttackStage[]): number {
  const stageTimes = new Map<AttackStage, number>();

  for (const finding of cluster.findings) {
    const stage = finding.deterministic?.stage;
    const startTime = finding.deterministic?.startTime;
    if (!stage || !startTime || !expectedStages.includes(stage)) continue;

    const timestamp = Date.parse(startTime);
    if (!Number.isFinite(timestamp)) continue;

    const existing = stageTimes.get(stage);
    if (existing === undefined || timestamp < existing) {
      stageTimes.set(stage, timestamp);
    }
  }

  const presentStages = expectedStages.filter((stage) => stageTimes.has(stage));
  if (presentStages.length <= 1) return presentStages.length;

  let validPairs = 0;
  let totalPairs = 0;

  for (let index = 0; index < presentStages.length - 1; index++) {
    const currentStage = presentStages[index];
    const nextStage = presentStages[index + 1];
    if (!currentStage || !nextStage) continue;

    const current = stageTimes.get(currentStage);
    const next = stageTimes.get(nextStage);
    if (current === undefined || next === undefined) continue;

    totalPairs++;
    if (next >= current) {
      validPairs++;
    }
  }

  return totalPairs === 0 ? 0 : validPairs / totalPairs;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

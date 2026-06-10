import type { EvidenceFinding } from "../evidenceEngine.ts";
import type { DeterministicChainEdge } from "../../types/investigations.ts";
import type { DeterministicCluster } from "./clustering.ts";

const STRUCTURAL_PRIOR: Record<string, Record<string, number>> = {
  T1110: {
    T1078: 0.75,
  },
  "T1110.003": {
    T1078: 1,
  },
  "T1110.004": {
    T1078: 1,
  },
  T1078: {
    "T1556.006": 0.5,
    T1098: 0.75,
    "T1098.001": 0.75,
    T1041: 0.5,
  },
  "T1556.006": {
    T1098: 0.5,
    "T1098.001": 0.5,
  },
  T1098: {
    "T1098.001": 0.75,
    T1531: 0.5,
    T1041: 0.5,
  },
  "T1098.001": {
    T1531: 0.25,
    T1041: 0.75,
  },
  T1531: {
    T1041: 0.25,
  },
};

export function getTechniqueTransitionPrior(
  fromTechniqueId: string | undefined,
  toTechniqueId: string | undefined
): number {
  if (!fromTechniqueId || !toTechniqueId) return 0;
  return STRUCTURAL_PRIOR[fromTechniqueId]?.[toTechniqueId] ?? 0;
}

export function getEffectiveTechniqueTransition(
  fromFinding: EvidenceFinding | undefined,
  toFinding: EvidenceFinding | undefined,
  baseEdge: DeterministicChainEdge
): number {
  const prior = getBestTechniqueTransitionPrior(fromFinding, toFinding);
  if (prior <= 0) return 0;
  return round(prior * baseEdge.transitionScore);
}

export function scoreTechniqueProgression(
  cluster: DeterministicCluster,
  edges: DeterministicChainEdge[]
): number {
  const effectiveTransitions = edges
    .map((edge) => {
      const from = findMatchingFinding(cluster.findings, edge.fromRuleId);
      const to = findMatchingFinding(cluster.findings, edge.toRuleId);
      return getEffectiveTechniqueTransition(from, to, edge);
    })
    .filter((score) => score > 0);

  if (effectiveTransitions.length === 0) return 0;
  return round(10 * average(effectiveTransitions));
}

function getBestTechniqueTransitionPrior(
  fromFinding: EvidenceFinding | undefined,
  toFinding: EvidenceFinding | undefined
): number {
  const fromTechniques = fromFinding?.deterministic?.techniques ?? [];
  const toTechniques = toFinding?.deterministic?.techniques ?? [];
  let best = 0;

  for (const from of fromTechniques) {
    for (const to of toTechniques) {
      best = Math.max(best, getTechniqueTransitionPrior(from.id, to.id));
    }
  }

  return best;
}

function findMatchingFinding(
  findings: EvidenceFinding[],
  ruleId: string
): EvidenceFinding | undefined {
  return findings.find((finding) => finding.ruleId === ruleId);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

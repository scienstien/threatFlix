import type { EvidenceFinding } from "../evidenceEngine.ts";
import type { AttackStage, DeterministicScoreBreakdown } from "../../types/investigations.ts";
import type { DeterministicCluster } from "./clustering.ts";
import { scoreTechniqueProgression } from "./attackTransitions.ts";
import { buildChainEdges } from "./edges.ts";
import { scoreCapecAlignment } from "./capecTemplates.ts";

export interface DeterministicClusterScore {
  clusterId: string;
  findingRuleIds: string[];
  eventIds: string[];
  score: DeterministicScoreBreakdown;
}

const MAX_RULE_STRENGTH = 45;
const MAX_CHAIN_COHERENCE = 25;
const MAX_BLAST_RADIUS = 15;
const MAX_TEMPORAL_COMPRESSION = 15;
const MAX_PENALTIES = 20;

export function scoreDeterministicClusters(
  clusters: DeterministicCluster[]
): DeterministicClusterScore[] {
  return clusters
    .map(scoreDeterministicCluster)
    .sort((left, right) => right.score.finalScore - left.score.finalScore);
}

export function scoreDeterministicCluster(cluster: DeterministicCluster): DeterministicClusterScore {
  const edges = buildChainEdges(cluster);
  const ruleStrength = scoreRuleStrength(cluster.findings);
  const chainCoherence = scoreChainCoherence(cluster.stageSet, edges.map((edge) => edge.transitionScore));
  const blastRadius = scoreBlastRadius(cluster.entityKeys);
  const temporalCompression = scoreTemporalCompression(cluster.stageSet, cluster.startTime, cluster.endTime);
  const techniqueProgression = scoreTechniqueProgression(cluster, edges);
  const capecAlignment = scoreCapecAlignment(cluster, edges);
  const penalties = scorePenalties(cluster.findings, edges.map((edge) => edge.transitionScore));
  const finalScore = clamp(
    ruleStrength +
    chainCoherence +
    blastRadius +
    temporalCompression -
    penalties +
    techniqueProgression +
    capecAlignment,
    0,
    100
  );

  return {
    clusterId: cluster.clusterId,
    findingRuleIds: cluster.findings.map((finding) => finding.ruleId),
    eventIds: cluster.eventIds,
    score: {
      ruleStrength,
      chainCoherence,
      blastRadius,
      temporalCompression,
      techniqueProgression,
      capecAlignment,
      penalties,
      finalScore,
    },
  };
}

function scoreRuleStrength(findings: EvidenceFinding[]): number {
  const sorted = [...findings].sort((left, right) => getRuleScore(right) - getRuleScore(left));
  const accepted: EvidenceFinding[] = [];
  let total = 0;

  for (const finding of sorted) {
    const maxOverlap = Math.max(0, ...accepted.map((existing) => getEventOverlap(finding, existing)));
    const rawScore = getRuleScore(finding);

    if (maxOverlap >= 0.7) {
      total += rawScore * 0.35;
    } else if (maxOverlap >= 0.4) {
      total += rawScore * (1 - 0.5 * maxOverlap);
    } else {
      total += rawScore;
    }

    accepted.push(finding);
  }

  return round(clamp(total, 0, MAX_RULE_STRENGTH));
}

function scoreChainCoherence(stages: AttackStage[], transitionScores: number[]): number {
  const stageCount = stages.length;
  if (stageCount === 0) return 0;

  const averageEdge = average(transitionScores);
  const transitionCount = Math.min(transitionScores.length, Math.max(0, stageCount - 1));
  const score = 4 * stageCount + 3 * transitionCount + 5 * averageEdge;

  return round(clamp(score, 0, MAX_CHAIN_COHERENCE));
}

function scoreBlastRadius(entityKeys: DeterministicCluster["entityKeys"]): number {
  const users = entityKeys.users?.length ?? 0;
  const ips = entityKeys.ips?.length ?? 0;
  const services = entityKeys.services?.length ?? 0;
  const sessions = entityKeys.sessionIds?.length ?? 0;
  const score =
    2 * Math.log2(1 + users) +
    2 * Math.log2(1 + ips) +
    1.5 * Math.log2(1 + services) +
    Math.log2(1 + sessions);

  return round(clamp(score, 0, MAX_BLAST_RADIUS));
}

function scoreTemporalCompression(
  stages: AttackStage[],
  startTime: string | undefined,
  endTime: string | undefined
): number {
  if (!startTime || !endTime) return 0;

  const start = Date.parse(startTime);
  const end = Date.parse(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;

  const durationMinutes = Math.max(0, (end - start) / 60_000);
  const criticalSteps = stages.filter((stage) => stage !== "access_pressure").length;
  const score = 2 * criticalSteps + 8 * Math.exp(-0.05 * durationMinutes);

  return round(clamp(score, 0, MAX_TEMPORAL_COMPRESSION));
}

function scorePenalties(findings: EvidenceFinding[], transitionScores: number[]): number {
  let penalty = 0;

  if (findings.length === 1 && getRuleScore(findings[0]) < 25) {
    penalty += 6;
  }

  if (transitionScores.length > 0 && average(transitionScores) < 0.45) {
    penalty += 5;
  }

  if (hasHighRuleOverlap(findings)) {
    penalty += 4;
  }

  return round(clamp(penalty, 0, MAX_PENALTIES));
}

function hasHighRuleOverlap(findings: EvidenceFinding[]): boolean {
  for (let left = 0; left < findings.length; left++) {
    for (let right = left + 1; right < findings.length; right++) {
      if (getEventOverlap(findings[left], findings[right]) >= 0.7) {
        return true;
      }
    }
  }

  return false;
}

function getRuleScore(finding: EvidenceFinding | undefined): number {
  return finding?.deterministic?.score ?? finding?.weight ?? 0;
}

function getEventOverlap(left: EvidenceFinding | undefined, right: EvidenceFinding | undefined): number {
  if (!left || !right || left.eventIds.length === 0 || right.eventIds.length === 0) return 0;

  const rightIds = new Set(right.eventIds);
  const overlap = left.eventIds.filter((eventId) => rightIds.has(eventId)).length;
  return overlap / Math.min(left.eventIds.length, right.eventIds.length);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

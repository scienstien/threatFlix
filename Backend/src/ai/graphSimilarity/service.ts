import { config } from "../../config.ts";
import { graphSimilarityRepo } from "../../db/repositories/graphSimilarityRepository.ts";
import { investigationRepo } from "../../db/repositories/investigationRepository.ts";
import type { Evidence, ThreatInvestigation } from "../../types/investigations.ts";
import {
  GRAPH_SIMILARITY_ALGORITHM_VERSION,
  GRAPH_SIMILARITY_SCHEMA_VERSION,
  type CanonicalGraphFinding,
  type GraphFingerprintRecord,
  type SimilarIncidentsResponse,
} from "../../types/graphSimilarity.ts";
import { buildCanonicalIncidentGraph } from "./canonicalGraph.ts";
import { compareFingerprints } from "./similarity.ts";
import { buildWlFingerprint } from "./wlFingerprint.ts";

export interface IndexInvestigationGraphInput {
  investigation: ThreatInvestigation;
  selectedEventIds: string[];
  findings: CanonicalGraphFinding[];
  chainEdges: ThreatInvestigation["deterministicChain"];
  sourceScope?: GraphFingerprintRecord["sourceScope"];
}

export function indexInvestigationGraph(input: IndexInvestigationGraphInput): GraphFingerprintRecord | null {
  if (!config.graphSimilarityEnabled || input.selectedEventIds.length === 0) return null;
  const canonicalGraph = buildCanonicalIncidentGraph({
    sourceInvestigationId: input.investigation.id,
    graph: input.investigation.graph,
    selectedEventIds: input.selectedEventIds,
    findings: input.findings,
    chainEdges: input.chainEdges ?? [],
  });
  if (canonicalGraph.nodes.length === 0) return null;
  const fingerprint = buildWlFingerprint(canonicalGraph);
  const now = new Date().toISOString();
  const existing = graphSimilarityRepo.getByInvestigation(
    input.investigation.id,
    input.investigation.projectId
  );
  const record: GraphFingerprintRecord = {
    investigationId: input.investigation.id,
    projectId: input.investigation.projectId,
    sourceScope: input.sourceScope ?? "selected_cluster",
    canonicalGraph,
    fingerprint,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  graphSimilarityRepo.upsert(record);
  return record;
}

export function indexHistoricalInvestigation(investigation: ThreatInvestigation): GraphFingerprintRecord | null {
  return indexInvestigationGraph({
    investigation,
    selectedEventIds: unique(investigation.evidence.flatMap((item) => item.eventIds)),
    findings: investigation.evidence.map(evidenceToFinding),
    chainEdges: investigation.deterministicChain,
    sourceScope: "historical_approximation",
  });
}

export function getSimilarIncidents(
  investigation: ThreatInvestigation,
  requestedLimit: number = config.graphSimilarityApiDefaultLimit,
  minimumScore: number = config.graphSimilarityMinScore
): SimilarIncidentsResponse {
  const limit = clampInteger(requestedLimit, 1, config.graphSimilarityApiMaxLimit);
  const empty = {
    schemaVersion: GRAPH_SIMILARITY_SCHEMA_VERSION,
    algorithmVersion: GRAPH_SIMILARITY_ALGORITHM_VERSION,
    investigationId: investigation.id,
    matches: [],
  } satisfies SimilarIncidentsResponse;
  if (!config.graphSimilarityEnabled) return { ...empty, unavailable: true };

  const source = graphSimilarityRepo.getByInvestigation(investigation.id, investigation.projectId);
  if (!source) return empty;
  const candidates = graphSimilarityRepo.getCompatibleCandidates(
    investigation.projectId,
    investigation.id,
    source.fingerprint,
    config.graphSimilarityMaxCandidates
  );
  const corpus = [source.fingerprint, ...candidates.map((candidate) => candidate.fingerprint)];
  const matches = candidates
    .map((candidate) => {
      try {
        const candidateInvestigation = investigationRepo.getById(
          candidate.investigationId,
          investigation.projectId
        );
        if (!candidateInvestigation) return null;
        return {
          ...compareFingerprints(
            source.fingerprint,
            candidate.fingerprint,
            candidate.investigationId,
            corpus,
            investigation.graph,
            candidateInvestigation.graph
          ),
          title: candidateInvestigation.title,
          severity: candidateInvestigation.severity.toLowerCase(),
          mitre: candidateInvestigation.mitre,
          createdAt: candidateInvestigation.createdAt,
        };
      } catch (error) {
        console.error(`Skipping invalid graph fingerprint ${candidate.investigationId}:`, error);
        return null;
      }
    })
    .filter((match): match is NonNullable<typeof match> => Boolean(match))
    .filter((match) => match.similarity >= minimumScore)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, limit);
  return { ...empty, matches };
}

function evidenceToFinding(evidence: Evidence): CanonicalGraphFinding {
  return {
    ruleId: evidence.ruleId,
    eventIds: evidence.eventIds,
    deterministic: evidence.deterministic
      ? {
          stage: evidence.deterministic.stage,
          techniques: evidence.deterministic.techniques,
          startTime: evidence.deterministic.startTime,
          endTime: evidence.deterministic.endTime,
        }
      : undefined,
  };
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

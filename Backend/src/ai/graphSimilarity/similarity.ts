import type { IncidentGraph } from "../../types/investigations.ts";
import type {
  GraphEntityOverlap,
  GraphSimilarityMode,
  GraphSimilaritySignals,
  IncidentGraphFingerprint,
  SimilarIncidentMatch,
} from "../../types/graphSimilarity.ts";

const ITERATION_WEIGHTS = [0.2, 0.35, 0.45] as const;
const TFIDF_MIN_DOCUMENTS = 5;

export function compareFingerprints(
  source: IncidentGraphFingerprint,
  candidate: IncidentGraphFingerprint,
  candidateInvestigationId: string,
  corpus: IncidentGraphFingerprint[] = [],
  sourceGraph?: IncidentGraph,
  candidateGraph?: IncidentGraph
): SimilarIncidentMatch {
  assertCompatible(source, candidate);
  const compatibleCorpus = corpus.filter((item) => isCompatible(source, item));
  const mode: GraphSimilarityMode =
    compatibleCorpus.length >= TFIDF_MIN_DOCUMENTS ? "tenant_tfidf" : "bootstrap";
  const scores = source.histograms.map((_histogram, iteration) =>
    cosine(
      cumulativeHistogram(source, iteration),
      cumulativeHistogram(candidate, iteration),
      mode === "tenant_tfidf" ? documentFrequencies(compatibleCorpus, iteration) : undefined,
      compatibleCorpus.length
    )
  );
  const similarity = round(
    scores.reduce((total, score, index) => total + score * (ITERATION_WEIGHTS[index] ?? 0), 0)
  );

  return {
    investigationId: candidateInvestigationId,
    similarity,
    mode,
    relation: relationForScore(similarity),
    scoreBreakdown: {
      semantic: round(scores[0] ?? 0),
      localStructure: round(scores[1] ?? 0),
      extendedStructure: round(scores[2] ?? 0),
    },
    sharedSignals: sharedSignals(source, candidate),
    differentSignals: differentSignals(source, candidate),
    entityOverlap: entityOverlap(sourceGraph, candidateGraph),
  };
}

export function relationForScore(score: number): SimilarIncidentMatch["relation"] {
  if (score >= 0.45) return "strong";
  if (score >= 0.3) return "related";
  return "weak";
}

function cosine(
  left: Record<string, number>,
  right: Record<string, number>,
  frequencies?: Map<string, number>,
  documentCount: number = 0
): number {
  const labels = new Set([...Object.keys(left), ...Object.keys(right)]);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (const label of labels) {
    const idf = frequencies
      ? Math.log((documentCount + 1) / ((frequencies.get(label) ?? 0) + 1)) + 1
      : 1;
    const leftValue = sublinearTermFrequency(left[label] ?? 0) * idf;
    const rightValue = sublinearTermFrequency(right[label] ?? 0) * idf;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return clamp01(dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)));
}

function sublinearTermFrequency(count: number): number {
  return count > 0 ? 1 + Math.log(count) : 0;
}

function documentFrequencies(
  corpus: IncidentGraphFingerprint[],
  iteration: number
): Map<string, number> {
  const result = new Map<string, number>();
  for (const fingerprint of corpus) {
    for (const label of Object.keys(cumulativeHistogram(fingerprint, iteration))) {
      result.set(label, (result.get(label) ?? 0) + 1);
    }
  }
  return result;
}

function cumulativeHistogram(
  fingerprint: IncidentGraphFingerprint,
  throughIteration: number
): Record<string, number> {
  const result: Record<string, number> = {};
  for (let iteration = 0; iteration <= throughIteration; iteration++) {
    for (const [label, count] of Object.entries(fingerprint.histograms[iteration] ?? {})) {
      result[`${iteration}:${label}`] = count;
    }
  }
  return result;
}

function sharedSignals(
  source: IncidentGraphFingerprint,
  candidate: IncidentGraphFingerprint
): GraphSimilaritySignals {
  return {
    rules: intersect(source.summary.rules, candidate.summary.rules),
    stages: intersect(source.summary.stages, candidate.summary.stages),
    techniques: intersect(source.summary.techniques, candidate.summary.techniques),
    eventTypes: intersect(source.summary.eventTypes, candidate.summary.eventTypes),
  };
}

function differentSignals(
  source: IncidentGraphFingerprint,
  candidate: IncidentGraphFingerprint
): GraphSimilaritySignals {
  return {
    rules: symmetricDifference(source.summary.rules, candidate.summary.rules),
    stages: symmetricDifference(source.summary.stages, candidate.summary.stages),
    techniques: symmetricDifference(source.summary.techniques, candidate.summary.techniques),
    eventTypes: symmetricDifference(source.summary.eventTypes, candidate.summary.eventTypes),
  };
}

function entityOverlap(source?: IncidentGraph, candidate?: IncidentGraph): GraphEntityOverlap {
  return {
    sameUsers: overlapGraphLabels(source, candidate, "user"),
    sameIps: overlapGraphLabels(source, candidate, "ip"),
    sameServices: overlapGraphLabels(source, candidate, "service"),
    sameSessions: overlapGraphLabels(source, candidate, "session"),
  };
}

function overlapGraphLabels(
  source: IncidentGraph | undefined,
  candidate: IncidentGraph | undefined,
  type: IncidentGraph["nodes"][number]["type"]
): string[] {
  if (!source || !candidate) return [];
  return intersect(
    source.nodes.filter((node) => node.type === type).map((node) => node.label),
    candidate.nodes.filter((node) => node.type === type).map((node) => node.label)
  );
}

function assertCompatible(source: IncidentGraphFingerprint, candidate: IncidentGraphFingerprint): void {
  if (!isCompatible(source, candidate)) {
    throw new Error("Incompatible graph similarity fingerprint");
  }
}

export function isCompatible(
  source: IncidentGraphFingerprint,
  candidate: IncidentGraphFingerprint
): boolean {
  return source.schemaVersion === candidate.schemaVersion &&
    source.algorithmVersion === candidate.algorithmVersion &&
    source.iterations === candidate.iterations;
}

function intersect<T extends string>(left: T[], right: T[]): T[] {
  const rightSet = new Set(right);
  return [...new Set(left.filter((item) => rightSet.has(item)))].sort();
}

function symmetricDifference<T extends string>(left: T[], right: T[]): T[] {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return [...new Set([
    ...left.filter((item) => !rightSet.has(item)),
    ...right.filter((item) => !leftSet.has(item)),
  ])].sort();
}

function round(value: number): number {
  return Number(clamp01(value).toFixed(4));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

import type {
  AttackStage,
  CandidateTechnique,
  DeterministicChainEdge,
  IncidentGraph,
} from "./investigations.ts";

export const GRAPH_SIMILARITY_SCHEMA_VERSION = "1" as const;
export const GRAPH_SIMILARITY_ALGORITHM_VERSION = "wl-subtree-cosine-v1" as const;
export const GRAPH_SIMILARITY_ITERATIONS = 2 as const;

export type CanonicalGraphNodeType =
  | "entity"
  | "event"
  | "rule"
  | "stage"
  | "technique";

export type CanonicalGraphEdgeType =
  | "performed"
  | "originated"
  | "targeted"
  | "contains"
  | "supports"
  | "has_stage"
  | "maps_to"
  | `transitions_to:${GraphTimeGapBucket}`
  | `next_in_session:${GraphTimeGapBucket}`;

export type GraphTimeGapBucket = "immediate" | "short" | "medium" | "long";

export interface CanonicalGraphNode {
  id: string;
  type: CanonicalGraphNodeType;
  label: string;
}

export interface CanonicalGraphEdge {
  id: string;
  source: string;
  target: string;
  type: CanonicalGraphEdgeType;
}

export interface CanonicalGraphSummary {
  eventTypes: string[];
  rules: string[];
  stages: AttackStage[];
  techniques: string[];
  entityCounts: {
    users: number;
    ips: number;
    services: number;
    sessions: number;
  };
}

export interface CanonicalIncidentGraph {
  schemaVersion: typeof GRAPH_SIMILARITY_SCHEMA_VERSION;
  sourceInvestigationId: string;
  sourceDigest: string;
  nodes: CanonicalGraphNode[];
  edges: CanonicalGraphEdge[];
  summary: CanonicalGraphSummary;
}

export interface CanonicalGraphFinding {
  ruleId: string;
  eventIds: string[];
  deterministic?: {
    stage: AttackStage;
    techniques?: CandidateTechnique[];
    startTime?: string;
    endTime?: string;
  };
}

export interface CanonicalGraphBuildInput {
  sourceInvestigationId: string;
  graph: IncidentGraph;
  selectedEventIds: string[];
  findings: CanonicalGraphFinding[];
  chainEdges: DeterministicChainEdge[];
}

export interface IncidentGraphFingerprint {
  schemaVersion: typeof GRAPH_SIMILARITY_SCHEMA_VERSION;
  algorithmVersion: typeof GRAPH_SIMILARITY_ALGORITHM_VERSION;
  iterations: typeof GRAPH_SIMILARITY_ITERATIONS;
  sourceDigest: string;
  histograms: Array<Record<string, number>>;
  summary: CanonicalGraphSummary;
}

export type GraphSimilarityMode = "bootstrap" | "tenant_tfidf";

export interface GraphSimilaritySignals {
  rules: string[];
  stages: AttackStage[];
  techniques: string[];
  eventTypes: string[];
}

export interface GraphEntityOverlap {
  sameUsers: string[];
  sameIps: string[];
  sameServices: string[];
  sameSessions: string[];
}

export interface SimilarIncidentMatch {
  investigationId: string;
  title?: string;
  severity?: string;
  mitre?: string;
  createdAt?: string;
  similarity: number;
  mode: GraphSimilarityMode;
  relation: "strong" | "related" | "weak";
  scoreBreakdown: {
    semantic: number;
    localStructure: number;
    extendedStructure: number;
  };
  sharedSignals: GraphSimilaritySignals;
  differentSignals: GraphSimilaritySignals;
  entityOverlap: GraphEntityOverlap;
}

export interface SimilarIncidentsResponse {
  schemaVersion: typeof GRAPH_SIMILARITY_SCHEMA_VERSION;
  algorithmVersion: typeof GRAPH_SIMILARITY_ALGORITHM_VERSION;
  investigationId: string;
  matches: SimilarIncidentMatch[];
  unavailable?: boolean;
}

export interface GraphFingerprintRecord {
  investigationId: string;
  projectId: string;
  sourceScope: "selected_cluster" | "historical_approximation";
  canonicalGraph: CanonicalIncidentGraph;
  fingerprint: IncidentGraphFingerprint;
  createdAt: string;
  updatedAt: string;
}

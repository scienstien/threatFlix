import type { SecurityEvent } from "./events.ts";
import type {
  DeterministicChainEdge,
  DeterministicScoreBreakdown,
  Evidence,
  IncidentGraph,
} from "./investigations.ts";
import type { UebaScoreSummary } from "./ueba.ts";
import type {
  GraphSimilarityMode,
  GraphSimilaritySignals,
  SimilarIncidentMatch,
} from "./graphSimilarity.ts";

export const LLM_SCHEMA_VERSION = "1" as const;
export type LlmReportStatus = "pending" | "running" | "completed" | "failed";
export type LlmReportTrigger = "initial" | "manual" | "recovery";

export interface LlmSimilarIncidentContext {
  investigationId: string;
  title?: string;
  severity?: string;
  mitre?: string;
  createdAt?: string;
  similarity: number;
  mode: GraphSimilarityMode;
  relation: SimilarIncidentMatch["relation"];
  scoreBreakdown: SimilarIncidentMatch["scoreBreakdown"];
  sharedSignals: GraphSimilaritySignals;
  differentSignals: GraphSimilaritySignals;
}

export interface LlmIncidentContext {
  schemaVersion: "1";
  contextVersion: number;
  investigation: {
    id: string;
    projectId: string;
    title: string;
    severity: string;
    confidence: number;
    mitre: string;
    mitreName: string;
    createdAt: string;
  };
  telemetry: SecurityEvent[];
  evidence: Evidence[];
  deterministicScore?: DeterministicScoreBreakdown;
  deterministicChain?: DeterministicChainEdge[];
  uebaSummary?: UebaScoreSummary;
  graph: IncidentGraph;
  similarIncidents: LlmSimilarIncidentContext[];
}

export interface LlmEvidenceAssessment {
  sourceType: "telemetry" | "deterministic" | "ueba" | "graph" | "graph_similarity";
  referenceIds: string[];
  observation: string;
  significance: string;
}

export interface LlmRecommendedAction {
  priority: "immediate" | "next" | "monitor";
  action: string;
  rationale: string;
}

export interface LlmInvestigationReport {
  schemaVersion: "1";
  contextVersion: number;
  provider: "ollama";
  model: string;
  generatedAt: string;
  executiveSummary: string;
  likelyIncident: string;
  whatLikelyHappened: string[];
  evidenceAssessment: LlmEvidenceAssessment[];
  recommendedActions: LlmRecommendedAction[];
  uncertainty: string[];
  openQuestions: string[];
}

export interface LlmReportRecord {
  id: string;
  investigationId: string;
  projectId: string;
  contextVersion: number;
  trigger: LlmReportTrigger;
  status: LlmReportStatus;
  attemptCount: number;
  provider: "ollama";
  model: string;
  context?: LlmIncidentContext;
  report?: LlmInvestigationReport;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface LlmChatMessage {
  id: string;
  investigationId: string;
  projectId: string;
  reportId: string;
  contextVersion: number;
  role: "analyst" | "assistant";
  content: string;
  referencedSourceIds: string[];
  model?: string;
  createdAt: string;
}

export interface LlmChatResponse {
  answer: string;
  citedSourceIds: string[];
  uncertainty: string[];
}

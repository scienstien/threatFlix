import type { AlertStatus, Severity } from "./alerts.ts";
import type { LlmInvestigationReport, LlmReportStatus } from "./llm.ts";
import type { UebaScoreSummary } from "./ueba.ts";

export type InvestigationStatus = AlertStatus;
export type InvestigationSource = "legacy_alert" | "investigation";
export type AttackStage =
  | "access_pressure"
  | "access_success"
  | "persistence"
  | "privilege_change"
  | "objective_action";

export interface CandidateTechnique {
  id: string;
  name?: string;
  tactic?: string;
}

export interface DeterministicEntityKeys {
  users?: string[];
  ips?: string[];
  services?: string[];
  sessionIds?: string[];
}

export interface DeterministicRuleMetadata {
  stage: AttackStage;
  score: number;
  confidence: number;
  techniques?: CandidateTechnique[];
  capecIds?: string[];
  entityKeys?: DeterministicEntityKeys;
  startTime?: string;
  endTime?: string;
}

export interface DeterministicChainEdge {
  fromRuleId: string;
  toRuleId: string;
  sharedKeys: string[];
  minutesBetween: number;
  transitionScore: number;
}

export interface DeterministicScoreBreakdown {
  ruleStrength: number;
  chainCoherence: number;
  blastRadius: number;
  temporalCompression: number;
  techniqueProgression: number;
  capecAlignment: number;
  penalties: number;
  finalScore: number;
}

export interface Evidence {
  id: string;
  investigationId: string;
  projectId: string;
  ruleId: string;
  weight: number;
  description: string;
  eventIds: string[];
  createdAt: string;
  deterministic?: DeterministicRuleMetadata;
}

export interface ThreatInvestigation {
  id: string;
  projectId: string;
  title: string;
  severity: Severity;
  confidence: number;
  mitre: string;
  mitreName: string;
  summary: string;
  recommendation: string;
  graph: IncidentGraph;
  features: Record<string, unknown>;
  relatedEventIds: string[];
  createdAt: string;
  status: InvestigationStatus;
  assignee?: string;
  webhookDelivered: boolean;
  evidence: Evidence[];
  deterministicChain?: DeterministicChainEdge[];
  deterministicScore?: DeterministicScoreBreakdown;
  uebaSummary?: UebaScoreSummary;
  llmReportStatus?: LlmReportStatus;
  llmReport?: LlmInvestigationReport;
  llmReportError?: string;
  llmContextVersion?: number;
}

export interface IncidentGraph {
  nodes: IncidentGraphNode[];
  edges: IncidentGraphEdge[];
}

export interface IncidentGraphNode {
  id: string;
  type: "user" | "ip" | "service" | "event" | "session";
  label: string;
  metadata?: Record<string, unknown>;
}

export interface IncidentGraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  eventId?: string;
  timestamp?: string;
  weight?: number;
}

export interface InvestigationApiView {
  id: string;
  projectId: string;
  source: InvestigationSource;
  attack: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: number;
  mitre: string;
  mitreName: string;
  reasoning: string;
  recommendation: string;
  eventCount: number;
  timestamp: string;
  status: InvestigationStatus;
  relatedEventIds: string[];
  graph?: IncidentGraph;
  evidence?: Evidence[];
  deterministicScore?: DeterministicScoreBreakdown;
  deterministicChain?: DeterministicChainEdge[];
  uebaSummary?: UebaScoreSummary;
  llmReportStatus?: LlmReportStatus;
  llmReport?: LlmInvestigationReport;
  llmReportError?: string;
  llmContextVersion?: number;
}

import { config } from "../config.ts";
import { enrichMitre } from "./mitre.ts";
import { canRunAnalysis, recordAnalysis } from "../middleware/rateLimit.ts";
import { eventRepo } from "../db/repositories/eventRepository.ts";
import { investigationRepo } from "../db/repositories/investigationRepository.ts";
import { emitWebhook } from "../webhooks/emitter.ts";
import { sessionizeEvents } from "./sessionizer.ts";
import { evaluateEvidence, type EvidenceFinding } from "./evidenceEngine.ts";
import { extractIdentityFeatures, mergeFeatureVectors } from "./featureExtractor.ts";
import type { MlScoreResult } from "./mlClient.ts";
import { scoreDeterministicSessions } from "./uebaScoring.ts";
import { buildIncidentGraph } from "./incidentGraph.ts";
import { buildCorrelationClusters } from "./deterministic/clustering.ts";
import { buildChainEdges, buildClusterChainEdges } from "./deterministic/edges.ts";
import { scoreDeterministicClusters, type DeterministicClusterScore } from "./deterministic/scoring.ts";
import { classifyDeterministicInvestigation } from "./deterministic/classification.ts";
import { enqueueInitialReport } from "./llmWorker.ts";
import { indexInvestigationGraph } from "./graphSimilarity/service.ts";
import { toInvestigationApiView } from "../types/api.ts";
import type { SecurityEvent } from "../types/events.ts";
import type { AIAnalysisResult, Severity } from "../types/alerts.ts";
import type {
  DeterministicChainEdge,
  DeterministicScoreBreakdown,
  Evidence,
  InvestigationApiView,
  ThreatInvestigation,
} from "../types/investigations.ts";

export async function analyzeEvents(
  projectId: string,
  events?: SecurityEvent[],
  options: { bypassRateLimit?: boolean } = {}
): Promise<InvestigationApiView> {
  if (!options.bypassRateLimit) {
    const rateCheck = canRunAnalysis(projectId);
    if (!rateCheck.allowed) {
      throw new Error(rateCheck.reason ?? "Analysis rate limit reached.");
    }
  }

  const timeline = events ?? eventRepo.getUnanalysed(projectId, 50);
  if (timeline.length === 0) {
    throw new Error("No events to analyze.");
  }

  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const sessions = sessionizeEvents(timeline);
  const evidenceResult = evaluateEvidence(timeline, sessions);

  // --- Deterministic pipeline ---
  const clusters = buildCorrelationClusters(evidenceResult.findings);
  const clusterScores = scoreDeterministicClusters(clusters);
  const chainEdges = buildClusterChainEdges(clusters);
  const topClusterScore = clusterScores[0];
  const topScore = topClusterScore?.score;
  if (!topScore) {
    throw new Error("No deterministic evidence produced an investigation.");
  }
  const topCluster = clusters.find((cluster) => cluster.clusterId === topClusterScore.clusterId);
  const topClusterFindings = topCluster?.findings ?? evidenceResult.findings;

  const featureVectors = sessions.map((session) => extractIdentityFeatures(session, timeline));
  const features = mergeFeatureVectors(featureVectors);
  const uebaResult = await scoreDeterministicSessions(
    projectId,
    sessions,
    loadUebaHistory(projectId, timeline),
    evidenceResult.findings
  );
  const mlScore = uebaResult.mlScore;
  const contextEvents = loadGraphContext(projectId, timeline);
  const graph = buildIncidentGraph(contextEvents);
  const classification = classifyDeterministicInvestigation(
    topClusterFindings,
    topScore.finalScore
  );
  const fusedConfidence = computeFusedConfidence(topScore, mlScore, topScore.finalScore / 100);
  if (!options.bypassRateLimit) recordAnalysis(projectId);

  const investigation = buildInvestigation(
    projectId,
    timeline,
    graph,
    { ...features },
    evidenceResult.findings,
    {
      attack: classification.title,
      severity: classification.severity,
      confidence: fusedConfidence,
      mitre: classification.mitre,
      mitreName: classification.mitreName,
      reasoning: classification.summary,
      recommendation: classification.recommendation,
    },
    chainEdges,
    topScore,
    uebaResult.summary
  );

  investigationRepo.insert(investigation);
  try {
    indexInvestigationGraph({
      investigation,
      selectedEventIds: topCluster?.eventIds ?? topClusterFindings.flatMap((finding) => finding.eventIds),
      findings: topClusterFindings,
      chainEdges: topCluster ? buildChainEdges(topCluster) : [],
    });
  } catch (error) {
    console.error(`Graph similarity indexing failed for ${investigation.id}:`, error);
  }
  const reportJob = enqueueInitialReport(investigation.id, projectId);
  investigation.llmReportStatus = reportJob.status;
  investigation.llmContextVersion = reportJob.contextVersion;
  emitWebhook(projectId, "investigation.created", investigation).catch((error) =>
    console.error("Webhook delivery failed:", error)
  );

  return toInvestigationApiView(investigation);
}

export function shouldAutoAnalyze(projectId: string): boolean {
  const recentCount = eventRepo.countRecent(projectId, config.analysisCooldownMs);
  return recentCount >= config.analysisEventThreshold;
}

function loadGraphContext(projectId: string, timeline: SecurityEvent[]): SecurityEvent[] {
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  if (!first || !last) return timeline;

  const from = new Date(new Date(first.timestamp).getTime() - 60 * 60 * 1000).toISOString();
  const to = new Date(new Date(last.timestamp).getTime() + 60 * 60 * 1000).toISOString();
  return eventRepo.getByTimeRange(projectId, from, to);
}

function loadUebaHistory(projectId: string, timeline: SecurityEvent[]): SecurityEvent[] {
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  if (!first || !last) return timeline;

  const from = new Date(new Date(first.timestamp).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const stored = eventRepo.getByTimeRange(projectId, from, last.timestamp);
  const byId = new Map([...stored, ...timeline].map((event) => [event.id, event]));
  return [...byId.values()].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  );
}

function buildInvestigation(
  projectId: string,
  events: SecurityEvent[],
  graph: ThreatInvestigation["graph"],
  features: ThreatInvestigation["features"],
  findings: EvidenceFinding[],
  analysis: AIAnalysisResult,
  chainEdges?: DeterministicChainEdge[],
  scoreBreakdown?: DeterministicScoreBreakdown,
  uebaSummary?: import("../types/ueba.ts").UebaScoreSummary
): ThreatInvestigation {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const normalized = normalizeAnalysis(analysis);

  return {
    id,
    projectId,
    title: normalized.attack,
    severity: normalized.severity,
    confidence: normalized.confidence,
    mitre: normalized.mitre,
    mitreName: normalized.mitreName,
    summary: normalized.reasoning,
    recommendation: normalized.recommendation,
    graph,
    features,
    relatedEventIds: events.map((event) => event.id),
    createdAt,
    status: "open",
    webhookDelivered: false,
    evidence: findings.map((finding): Evidence => ({
      id: crypto.randomUUID(),
      investigationId: id,
      projectId,
      ruleId: finding.ruleId,
      weight: finding.weight,
      description: finding.description,
      eventIds: finding.eventIds,
      createdAt,
      deterministic: finding.deterministic,
    })),
    deterministicChain: chainEdges,
    deterministicScore: scoreBreakdown,
    uebaSummary,
  };
}

/**
 * ML Bounding per guardrail contract:
 * finalScore = clamp(D + delta_ml, 0, 100)
 * where delta_ml shrinks as D increases.
 */
function computeFusedConfidence(
  deterministicScore: DeterministicScoreBreakdown,
  mlScore: MlScoreResult,
  llmConfidence: number
): number {
  const D = deterministicScore.finalScore;
  if (D <= 0) return llmConfidence;

  // Center ML anomaly score at 0: m = 100*M - 50
  const m = 100 * mlScore.anomalyScore - 50;

  // ML influence cap decreases as deterministic strength increases
  // At D=0: maxDelta=30, at D=50: maxDelta=15, at D=100: maxDelta=5
  const maxDelta = Math.max(5, 30 - 0.25 * D);
  const deltaMl = Math.max(-maxDelta, Math.min(maxDelta, m));

  const fusedScore = Math.max(0, Math.min(100, D + deltaMl));
  return Math.max(0, Math.min(1, fusedScore / 100));
}

function normalizeAnalysis(result: AIAnalysisResult): AIAnalysisResult {
  if (!result.attack || !result.severity || result.confidence === undefined) {
    throw new Error("Analysis response missing required fields.");
  }

  const mitre = enrichMitre(result.mitre, result.mitreName);
  return {
    attack: result.attack,
    severity: normalizeSeverity(result.severity),
    confidence: Math.max(0, Math.min(1, result.confidence)),
    mitre: mitre.mitre,
    mitreName: mitre.mitreName,
    reasoning: result.reasoning || "No reasoning provided.",
    recommendation: result.recommendation || "Review the related events and validate account activity.",
  };
}

function normalizeSeverity(severity: string): Severity {
  const normalized = severity.toLowerCase();
  if (normalized === "critical") return "Critical";
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  if (normalized === "low") return "Low";
  return "Info";
}

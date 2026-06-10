import type { ThreatAlert } from "./alerts.ts";
import type { InvestigationApiView, ThreatInvestigation } from "./investigations.ts";

export function toAlertApiView(alert: ThreatAlert): InvestigationApiView {
  return {
    id: alert.id,
    projectId: alert.projectId,
    source: "legacy_alert",
    attack: alert.attack,
    severity: normalizeSeverity(alert.severity),
    confidence: normalizeConfidence(alert.confidence),
    mitre: alert.mitre,
    mitreName: alert.mitreName,
    reasoning: alert.reasoning,
    recommendation: alert.recommendation,
    eventCount: alert.relatedEventIds.length,
    timestamp: alert.createdAt,
    status: alert.status,
    relatedEventIds: alert.relatedEventIds,
  };
}

export function toInvestigationApiView(investigation: ThreatInvestigation): InvestigationApiView {
  return {
    id: investigation.id,
    projectId: investigation.projectId,
    source: "investigation",
    attack: investigation.title,
    severity: normalizeSeverity(investigation.severity),
    confidence: normalizeConfidence(investigation.confidence),
    mitre: investigation.mitre,
    mitreName: investigation.mitreName,
    reasoning: investigation.summary,
    recommendation: investigation.recommendation,
    eventCount: investigation.relatedEventIds.length,
    timestamp: investigation.createdAt,
    status: investigation.status,
    relatedEventIds: investigation.relatedEventIds,
    graph: investigation.graph,
    evidence: investigation.evidence,
    deterministicScore: investigation.deterministicScore,
    deterministicChain: investigation.deterministicChain,
    uebaSummary: investigation.uebaSummary,
    llmReportStatus: investigation.llmReportStatus,
    llmReport: investigation.llmReport,
    llmReportError: investigation.llmReportError,
    llmContextVersion: investigation.llmContextVersion,
  };
}

export function normalizeSeverity(severity: string): InvestigationApiView["severity"] {
  const normalized = severity.toLowerCase();
  if (
    normalized === "critical" ||
    normalized === "high" ||
    normalized === "medium" ||
    normalized === "low" ||
    normalized === "info"
  ) {
    return normalized;
  }

  return "info";
}

export function normalizeConfidence(confidence: number): number {
  const percent = confidence <= 1 ? confidence * 100 : confidence;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

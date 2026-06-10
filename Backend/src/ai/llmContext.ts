import type { LlmIncidentContext, LlmSimilarIncidentContext } from "../types/llm.ts";
import type { SecurityEvent } from "../types/events.ts";
import type { ThreatInvestigation } from "../types/investigations.ts";

export function buildLlmIncidentContext(
  investigation: ThreatInvestigation,
  events: SecurityEvent[],
  contextVersion: number,
  similarIncidents: LlmSimilarIncidentContext[] = []
): LlmIncidentContext {
  return {
    schemaVersion: "1",
    contextVersion,
    investigation: {
      id: investigation.id,
      projectId: investigation.projectId,
      title: investigation.title,
      severity: investigation.severity,
      confidence: investigation.confidence,
      mitre: investigation.mitre,
      mitreName: investigation.mitreName,
      createdAt: investigation.createdAt,
    },
    telemetry: [...events]
      .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
      .slice(-100)
      .map((event) => ({ ...event, metadata: truncateMetadata(event.metadata) })),
    evidence: investigation.evidence,
    deterministicScore: investigation.deterministicScore,
    deterministicChain: investigation.deterministicChain,
    uebaSummary: investigation.uebaSummary
      ? { ...investigation.uebaSummary, sessionScores: investigation.uebaSummary.sessionScores.slice(0, 5) }
      : undefined,
    graph: investigation.graph,
    similarIncidents,
  };
}

function truncateMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const serialized = JSON.stringify(metadata);
  if (serialized.length <= 2048) return metadata;
  return { truncated: true, preview: serialized.slice(0, 2000) };
}

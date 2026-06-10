import type { SecurityEvent } from "../types/events.ts";
import {
  UEBA_SCHEMA_VERSION,
  type UebaScoreRequest,
  type UebaScoreSummary,
  type UebaSessionScore,
} from "../types/ueba.ts";
import type { EvidenceFinding } from "./evidenceEngine.ts";
import {
  scoreUebaSession,
  toMlScoreResult,
  type FetchImplementation,
  type MlScoreResult,
} from "./mlClient.ts";
import type { EventSession } from "./sessionizer.ts";
import { extractUebaFeatures } from "./uebaFeatureExtractor.ts";

const BOOTSTRAP_MODEL_VERSION = "unavailable";

export interface UebaScoringResult {
  summary: UebaScoreSummary;
  mlScore: MlScoreResult;
}

export async function scoreDeterministicSessions(
  projectId: string,
  sessions: EventSession[],
  historicalEvents: SecurityEvent[],
  findings: EvidenceFinding[],
  options: {
    serviceUrl?: string;
    timeoutMs?: number;
    fetchImpl?: FetchImplementation;
    now?: () => Date;
  } = {}
): Promise<UebaScoringResult> {
  const now = options.now ?? (() => new Date());
  const deterministicEventIds = new Set(findings.flatMap((finding) => finding.eventIds));
  const relatedSessions = sessions.filter((session) =>
    session.events.some((event) => deterministicEventIds.has(event.id))
  );

  if (relatedSessions.length === 0) {
    const error = "ML scoring skipped because no session is related to deterministic evidence";
    return unavailableResult(now(), error);
  }

  const results = await Promise.all(
    relatedSessions.map(async (session) => {
      const request: UebaScoreRequest = {
        schemaVersion: UEBA_SCHEMA_VERSION,
        projectId,
        sessionId: session.id,
        user: session.user,
        ip: session.ip,
        service: session.service,
        eventIds: session.events.map((event) => event.id),
        features: extractUebaFeatures(session, historicalEvents),
      };
      const result = await scoreUebaSession(request, options);
      return { request, result };
    })
  );

  const sessionScores: UebaSessionScore[] = results.flatMap(({ request, result }) =>
    result.ok
      ? [{
          ...result.response,
          sessionId: request.sessionId,
          user: request.user,
          ip: request.ip,
          service: request.service,
          eventIds: request.eventIds,
        }]
      : []
  );
  const selected = [...sessionScores].sort((left, right) => right.anomalyScore - left.anomalyScore)[0];

  if (!selected) {
    const errors = results.flatMap(({ result }) => result.ok ? [] : [result.error]);
    return unavailableResult(now(), errors.join("; ") || "ML scoring unavailable");
  }

  return {
    summary: {
      schemaVersion: UEBA_SCHEMA_VERSION,
      modelVersion: selected.modelVersion,
      scoredAt: now().toISOString(),
      baselineMaturity: "bootstrap",
      behaviorScore: selected.behaviorScore,
      selectedSessionId: selected.sessionId,
      sessionScores,
      mlUnavailable: results.some(({ result }) => !result.ok) || undefined,
      error: results.some(({ result }) => !result.ok)
        ? results.flatMap(({ result }) => result.ok ? [] : [result.error]).join("; ")
        : undefined,
    },
    mlScore: toMlScoreResult(selected),
  };
}

function unavailableResult(scoredAt: Date, error: string): UebaScoringResult {
  return {
    summary: {
      schemaVersion: UEBA_SCHEMA_VERSION,
      modelVersion: BOOTSTRAP_MODEL_VERSION,
      scoredAt: scoredAt.toISOString(),
      baselineMaturity: "bootstrap",
      behaviorScore: 0,
      sessionScores: [],
      mlUnavailable: true,
      error,
    },
    mlScore: toMlScoreResult(undefined, error),
  };
}

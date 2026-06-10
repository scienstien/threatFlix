import { config } from "../config.ts";
import {
  UEBA_SCHEMA_VERSION,
  type UebaFeatureReason,
  type UebaScoreRequest,
  type UebaScoreResponse,
} from "../types/ueba.ts";

export interface MlScoreResult {
  anomalyScore: number;
  isAnomaly: boolean;
  mlUnavailable?: boolean;
  error?: string;
}

export interface UebaClientFailure {
  ok: false;
  mlUnavailable: true;
  error: string;
}

export interface UebaClientSuccess {
  ok: true;
  response: UebaScoreResponse;
}

export type UebaClientResult = UebaClientSuccess | UebaClientFailure;
export type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export async function scoreUebaSession(
  request: UebaScoreRequest,
  options: {
    serviceUrl?: string;
    timeoutMs?: number;
    fetchImpl?: FetchImplementation;
  } = {}
): Promise<UebaClientResult> {
  const serviceUrl = options.serviceUrl ?? config.mlServiceUrl;
  const timeoutMs = options.timeoutMs ?? config.mlServiceTimeoutMs;
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(`${serviceUrl.replace(/\/$/, "")}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`ML service returned ${response.status}`);
    }

    return {
      ok: true,
      response: validateUebaResponse(await response.json()),
    };
  } catch (error) {
    return {
      ok: false,
      mlUnavailable: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function toMlScoreResult(
  response?: UebaScoreResponse,
  error?: string
): MlScoreResult {
  if (!response) {
    return {
      anomalyScore: 0,
      isAnomaly: false,
      mlUnavailable: true,
      error,
    };
  }

  return {
    anomalyScore: response.anomalyScore,
    isAnomaly: response.isAnomaly,
  };
}

export function validateUebaResponse(value: unknown): UebaScoreResponse {
  const response = requireRecord(value, "response");
  if (response.schemaVersion !== UEBA_SCHEMA_VERSION) {
    throw new Error(`Unsupported UEBA schema version: ${String(response.schemaVersion)}`);
  }
  if (typeof response.modelVersion !== "string" || response.modelVersion.length === 0) {
    throw new Error("UEBA response modelVersion must be a non-empty string");
  }

  const detectorScores = requireRecord(response.detectorScores, "detectorScores");
  const topReasons = requireArray(response.topReasons, "topReasons").map(validateReason);

  return {
    schemaVersion: UEBA_SCHEMA_VERSION,
    modelVersion: response.modelVersion,
    behaviorScore: requireNumberInRange(response.behaviorScore, "behaviorScore", 0, 100),
    anomalyScore: requireNumberInRange(response.anomalyScore, "anomalyScore", 0, 1),
    isAnomaly: requireBoolean(response.isAnomaly, "isAnomaly"),
    detectorScores: {
      isolationForest: requireNumberInRange(
        detectorScores.isolationForest,
        "detectorScores.isolationForest",
        0,
        1
      ),
      ecod: requireNumberInRange(detectorScores.ecod, "detectorScores.ecod", 0, 1),
      copod: requireNumberInRange(detectorScores.copod, "detectorScores.copod", 0, 1),
    },
    topReasons,
  };
}

function validateReason(value: unknown, index: number): UebaFeatureReason {
  const reason = requireRecord(value, `topReasons[${index}]`);
  if (typeof reason.feature !== "string" || reason.feature.length === 0) {
    throw new Error(`topReasons[${index}].feature must be a non-empty string`);
  }
  if (reason.direction !== "high" && reason.direction !== "low") {
    throw new Error(`topReasons[${index}].direction must be high or low`);
  }
  return {
    feature: reason.feature,
    value: requireFiniteNumber(reason.value, `topReasons[${index}].value`),
    baseline: requireFiniteNumber(reason.baseline, `topReasons[${index}].baseline`),
    direction: reason.direction,
    contribution: requireNumberInRange(
      reason.contribution,
      `topReasons[${index}].contribution`,
      0,
      1
    ),
  };
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  return value;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }
  return value;
}

function requireFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
  return value;
}

function requireNumberInRange(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number
): number {
  const number = requireFiniteNumber(value, field);
  if (number < minimum || number > maximum) {
    throw new Error(`${field} must be between ${minimum} and ${maximum}`);
  }
  return number;
}

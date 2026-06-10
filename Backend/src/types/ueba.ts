export const UEBA_SCHEMA_VERSION = "1" as const;

export type UebaSchemaVersion = typeof UEBA_SCHEMA_VERSION;
export type UebaBaselineMaturity = "bootstrap" | "tenant";
export type UebaFeatureDirection = "high" | "low";

export const UEBA_FEATURE_NAMES = [
  "eventCount",
  "failedLogins",
  "successfulLogins",
  "mfaFailures",
  "privilegedEvents",
  "apiKeyCreations",
  "dataExports",
  "durationSeconds",
  "failuresPerMinute",
  "failureToSuccessFlag",
  "hourSin",
  "hourCos",
  "offHoursFlag",
  "newIpForUserFlag",
  "distinctIpsForUser24h",
  "distinctUsersForIp24h",
  "apiKeysForUser24h",
  "dataExportsForUser24h",
  "privilegeChangesForUser24h",
  "userFailureRate24h",
  "tenantFailureRate24h",
] as const;

export type UebaFeatureName = (typeof UEBA_FEATURE_NAMES)[number];
export type UebaFeatureVector = Record<UebaFeatureName, number>;

export interface UebaFeatureReason {
  feature: string;
  value: number;
  baseline: number;
  direction: UebaFeatureDirection;
  contribution: number;
}

export interface UebaDetectorScores {
  isolationForest: number;
  ecod: number;
  copod: number;
}

export interface UebaScoreRequest {
  schemaVersion: UebaSchemaVersion;
  projectId: string;
  sessionId: string;
  user: string;
  ip: string;
  service: string;
  eventIds: string[];
  features: UebaFeatureVector;
}

export interface UebaScoreResponse {
  schemaVersion: UebaSchemaVersion;
  modelVersion: string;
  behaviorScore: number;
  anomalyScore: number;
  isAnomaly: boolean;
  detectorScores: UebaDetectorScores;
  topReasons: UebaFeatureReason[];
}

export interface UebaSessionScore extends UebaScoreResponse {
  sessionId: string;
  user: string;
  ip: string;
  service: string;
  eventIds: string[];
}

export interface UebaScoreSummary {
  schemaVersion: UebaSchemaVersion;
  modelVersion: string;
  scoredAt: string;
  baselineMaturity: UebaBaselineMaturity;
  behaviorScore: number;
  selectedSessionId?: string;
  sessionScores: UebaSessionScore[];
  mlUnavailable?: boolean;
  error?: string;
}

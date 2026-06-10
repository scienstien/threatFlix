// ---------------------------------------------------------------------------
// ThreatFlix — API Client
// Centralized HTTP client with JWT injection for all backend calls.
// ---------------------------------------------------------------------------

export const API_BASE = "http://localhost:8000/api";

/** Get the stored JWT token */
function getToken(): string | null {
  try {
    const auth = localStorage.getItem("threatflix_auth");
    if (!auth) return null;
    return JSON.parse(auth).token;
  } catch {
    return null;
  }
}

/** Make an authenticated fetch request */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface SecurityEvent {
  id: string;
  projectId: string;
  event: string;
  user?: string;
  ip?: string;
  service?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export async function getLatestEvents(
  projectId: string
): Promise<{ events: SecurityEvent[]; total: number }> {
  return apiFetch(`/events/latest?projectId=${projectId}&limit=50`);
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export interface Alert {
  id: string;
  projectId: string;
  source?: "legacy_alert" | "investigation";
  attack: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: number;
  mitre: string;
  mitreName?: string;
  reasoning: string;
  recommendation: string;
  eventCount: number;
  timestamp: string;
  status?: string;
  relatedEventIds?: string[];
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

export interface Evidence {
  id: string;
  investigationId: string;
  projectId: string;
  ruleId: string;
  weight: number;
  description: string;
  eventIds: string[];
  createdAt: string;
  deterministic?: {
    stage: string;
    score: number;
    confidence: number;
    techniques?: Array<{ id: string; name?: string; tactic?: string }>;
    startTime?: string;
    endTime?: string;
  };
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

export interface DeterministicChainEdge {
  fromRuleId: string;
  toRuleId: string;
  sharedKeys: string[];
  minutesBetween: number;
  transitionScore: number;
}

export interface UebaFeatureReason {
  feature: string;
  value: number;
  baseline: number;
  direction: "high" | "low";
  contribution: number;
}

export interface UebaSessionScore {
  schemaVersion: "1";
  modelVersion: string;
  behaviorScore: number;
  anomalyScore: number;
  isAnomaly: boolean;
  detectorScores: {
    isolationForest: number;
    ecod: number;
    copod: number;
  };
  topReasons: UebaFeatureReason[];
  sessionId: string;
  user: string;
  ip: string;
  service: string;
  eventIds: string[];
}

export interface UebaScoreSummary {
  schemaVersion: "1";
  modelVersion: string;
  scoredAt: string;
  baselineMaturity: "bootstrap" | "tenant";
  behaviorScore: number;
  selectedSessionId?: string;
  sessionScores: UebaSessionScore[];
  mlUnavailable?: boolean;
  error?: string;
}

export type LlmReportStatus = "pending" | "running" | "completed" | "failed";

export interface LlmInvestigationReport {
  schemaVersion: "1";
  contextVersion: number;
  provider: "ollama";
  model: string;
  generatedAt: string;
  executiveSummary: string;
  likelyIncident: string;
  whatLikelyHappened: string[];
  evidenceAssessment: Array<{
    sourceType: "telemetry" | "deterministic" | "ueba" | "graph" | "graph_similarity";
    referenceIds: string[];
    observation: string;
    significance: string;
  }>;
  recommendedActions: Array<{
    priority: "immediate" | "next" | "monitor";
    action: string;
    rationale: string;
  }>;
  uncertainty: string[];
  openQuestions: string[];
}

export interface LlmReportRecord {
  id: string;
  investigationId: string;
  projectId: string;
  contextVersion: number;
  trigger: "initial" | "manual" | "recovery";
  status: LlmReportStatus;
  attemptCount: number;
  provider: "ollama";
  model: string;
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

export interface GraphSimilaritySignals {
  rules: string[];
  stages: string[];
  techniques: string[];
  eventTypes: string[];
}

export interface SimilarIncidentMatch {
  investigationId: string;
  title?: string;
  severity?: string;
  mitre?: string;
  createdAt?: string;
  similarity: number;
  mode: "bootstrap" | "tenant_tfidf";
  relation: "strong" | "related" | "weak";
  scoreBreakdown: {
    semantic: number;
    localStructure: number;
    extendedStructure: number;
  };
  sharedSignals: GraphSimilaritySignals;
  differentSignals: GraphSimilaritySignals;
  entityOverlap: {
    sameUsers: string[];
    sameIps: string[];
    sameServices: string[];
    sameSessions: string[];
  };
}

export interface SimilarIncidentsResponse {
  schemaVersion: "1";
  algorithmVersion: "wl-subtree-cosine-v1";
  investigationId: string;
  matches: SimilarIncidentMatch[];
  unavailable?: boolean;
}

export async function getAlerts(
  projectId: string
): Promise<{ alerts: Alert[] }> {
  return apiFetch(`/alerts?projectId=${projectId}`);
}

export async function getAlertById(id: string): Promise<Alert> {
  return apiFetch(`/alerts/${id}`);
}

export async function getInvestigationReport(id: string): Promise<LlmReportRecord> {
  return apiFetch(`/investigations/${id}/report`);
}

export async function getSimilarIncidents(id: string, limit: number = 5): Promise<SimilarIncidentsResponse> {
  return apiFetch(`/investigations/${id}/similar?limit=${limit}`);
}

export async function regenerateInvestigationReport(id: string): Promise<LlmReportRecord> {
  return apiFetch(`/investigations/${id}/report/regenerate`, { method: "POST" });
}

export async function getInvestigationChat(id: string): Promise<{ messages: LlmChatMessage[] }> {
  return apiFetch(`/investigations/${id}/chat`);
}

export async function sendInvestigationChat(
  id: string,
  message: string
): Promise<{ message: LlmChatMessage; response: { answer: string; citedSourceIds: string[]; uncertainty: string[] } }> {
  return apiFetch(`/investigations/${id}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function resolveAlert(
  id: string
): Promise<{ success: boolean }> {
  return apiFetch(`/alerts/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "resolved" }),
  });
}

// ---------------------------------------------------------------------------
// API Keys
// ---------------------------------------------------------------------------

export interface ApiKey {
  key: string;
  projectId: string;
  label: string;
  createdAt: string;
  revoked?: boolean;
}

export async function getApiKeys(): Promise<{ keys: ApiKey[] }> {
  return apiFetch("/apikeys");
}

export async function createApiKey(
  label: string
): Promise<{ key: string; projectId: string }> {
  return apiFetch("/apikeys", {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export interface Webhook {
  id: string;
  url: string;
  projectId: string;
  createdAt: string;
}

export async function getWebhooks(): Promise<{ webhooks: Webhook[] }> {
  return apiFetch("/webhooks");
}

export async function createWebhook(url: string): Promise<Webhook> {
  return apiFetch("/webhooks", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function deleteWebhook(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/webhooks/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface PlatformStats {
  totalEvents: number;
  totalTenants: number;
  totalAlerts: number;
  severityDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

export interface ProjectInfo {
  projectId: string;
  createdAt: string;
  totalEvents: number;
  totalAlerts: number;
}

export async function getAdminStats(): Promise<PlatformStats> {
  return apiFetch("/admin/stats");
}

export async function getAdminProjects(): Promise<{ projects: ProjectInfo[] }> {
  return apiFetch("/admin/projects");
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export async function triggerAnalysis(
  projectId: string,
  timeWindowMinutes: number = 5
): Promise<Alert> {
  const response = await apiFetch<{ alert: Alert }>("/analyze", {
    method: "POST",
    body: JSON.stringify({ projectId, timewindow_minutes: timeWindowMinutes }),
  });
  return response.alert;
}

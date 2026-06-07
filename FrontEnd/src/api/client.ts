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
  attack: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: number;
  mitre: string;
  reasoning: string;
  recommendation: string;
  eventCount: number;
  timestamp: string;
  status?: string;
}

export async function getAlerts(
  projectId: string
): Promise<{ alerts: Alert[] }> {
  return apiFetch(`/alerts?projectId=${projectId}`);
}

export async function getAlertById(id: string): Promise<Alert> {
  return apiFetch(`/alerts/${id}`);
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
  return apiFetch("/analyze", {
    method: "POST",
    body: JSON.stringify({ projectId, timewindow_minutes: timeWindowMinutes }),
  });
}

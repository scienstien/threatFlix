// ---------------------------------------------------------------------------
// Alert / threat analysis types — output of the AI engine.
// Forward-compat: status workflow, assignees, webhook delivery tracking.
// ---------------------------------------------------------------------------

export type Severity = "Critical" | "High" | "Medium" | "Low" | "Info";
export type AlertStatus = "open" | "acknowledged" | "resolved" | "false_positive";

/** The structured output we demand from the LLM. */
export interface AIAnalysisResult {
  attack: string;
  severity: Severity;
  confidence: number;           // 0.0 – 1.0
  mitre: string;                // e.g. "T1110"
  mitreName: string;            // e.g. "Brute Force"
  reasoning: string;
  recommendation: string;
}

/** A persisted alert (AI result + metadata). */
export interface ThreatAlert extends AIAnalysisResult {
  id: string;
  projectId: string;
  relatedEventIds: string[];
  createdAt: string;
  // Forward-compat:
  status: AlertStatus;
  assignee?: string;
  webhookDelivered: boolean;
}

/** Webhook configuration for a project (forward-compat). */
export interface WebhookConfig {
  id: string;
  projectId: string;
  url: string;
  secret?: string;              // HMAC signing secret
  events: string[];             // e.g. ["alert.created", "alert.resolved"]
  active: boolean;
  createdAt: string;
}

/** The payload we POST to external webhook URLs (n8n / Zapier / Slack). */
export interface WebhookPayload<T = ThreatAlert> {
  event: string;                // e.g. "alert.created"
  projectId: string;
  data: T;
  timestamp: string;
}

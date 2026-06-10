// ---------------------------------------------------------------------------
// LLM prompt templates — versioned for future A/B testing.
// ---------------------------------------------------------------------------

import type { SecurityEvent } from "../types/events.ts";
import type { EvidenceFinding } from "./evidenceEngine.ts";
import type { IdentityFeatureVector } from "./featureExtractor.ts";
import type { IncidentGraph } from "../types/investigations.ts";
import { MITRE_TECHNIQUES } from "./mitre.ts";

/** Current prompt version — bump this when you change the prompt structure. */
export const PROMPT_VERSION = "1.0.0";

export interface InvestigationPromptInput {
  projectId: string;
  events: SecurityEvent[];
  graph: IncidentGraph;
  evidence: EvidenceFinding[];
  features: IdentityFeatureVector;
  mlScore: {
    anomalyScore: number;
    isAnomaly: boolean;
    mlUnavailable?: boolean;
  };
}

/** System prompt that instructs the LLM how to behave. */
export const SYSTEM_PROMPT = `You are a cybersecurity analyst AI. Your job is to analyze sequences of security events from application logs and identify potential attacks or threats.

You MUST respond with ONLY valid JSON matching this exact schema — no markdown, no explanations outside the JSON:

{
  "attack": "string — name of the detected attack or threat (e.g., 'Brute Force', 'Credential Stuffing', 'Privilege Escalation')",
  "severity": "string — one of: Critical, High, Medium, Low, Info",
  "confidence": "number — 0.0 to 1.0, how confident you are in this assessment",
  "mitre": "string — the MITRE ATT&CK technique ID (e.g., 'T1110', 'T1078')",
  "mitreName": "string — the human-readable name of the MITRE technique",
  "reasoning": "string — 2-4 sentences explaining what you observed and why it's suspicious",
  "recommendation": "string — 1-3 actionable steps the developer should take immediately"
}

Rules:
1. ALWAYS output valid JSON. Never wrap it in markdown code blocks.
2. Be specific in your reasoning — mention exact usernames, IPs, and event counts.
3. If the events look benign, set severity to "Info" and confidence below 0.3.
4. Map to the most specific MITRE sub-technique when possible.
5. Keep recommendations actionable and developer-friendly.

Known MITRE ATT&CK techniques you can reference:
${Object.values(MITRE_TECHNIQUES)
  .map((t) => `- ${t.id}: ${t.name} (${t.tactic})`)
  .join("\n")}
`;

export const INVESTIGATION_SYSTEM_PROMPT = `You are a cybersecurity analyst AI. Analyze the supplied incident graph, deterministic evidence, and anomaly score.

You MUST respond with ONLY valid JSON matching this exact schema:

{
  "attack": "string - name of the detected attack or suspicious activity",
  "severity": "string - one of: Critical, High, Medium, Low, Info",
  "confidence": "number - 0.0 to 1.0",
  "mitre": "string - MITRE ATT&CK technique ID",
  "mitreName": "string - human-readable MITRE technique name",
  "reasoning": "string - concise analyst summary grounded in the graph and evidence",
  "recommendation": "string - concrete next actions"
}

Rules:
1. Output JSON only.
2. Do not invent nodes, users, IPs, services, or events that are absent from the graph.
3. Treat deterministic evidence as higher priority than the anomaly score.
4. If ML is unavailable, ignore it and rely on evidence plus graph context.
5. If evidence is weak, use Low or Info severity and confidence below 0.4.

Known MITRE ATT&CK techniques:
${Object.values(MITRE_TECHNIQUES)
  .map((t) => `- ${t.id}: ${t.name} (${t.tactic})`)
  .join("\n")}
`;

/** Build the user prompt from a timeline of events. */
export function buildUserPrompt(events: SecurityEvent[], projectId: string): string {
  const timeline = events
    .map(
      (e, i) =>
        `[${i + 1}] ${e.timestamp} | event=${e.event} | user=${e.user} | ip=${e.ip} | service=${e.service}${
          e.metadata && Object.keys(e.metadata).length > 0
            ? ` | metadata=${JSON.stringify(e.metadata)}`
            : ""
        }`
    )
    .join("\n");

  return `Analyze the following timeline of ${events.length} security events for project "${projectId}".
Determine if these events indicate an attack, assess severity, and map to a MITRE ATT&CK technique.

EVENT TIMELINE:
${timeline}

Respond with the JSON analysis.`;
}

export function buildInvestigationPrompt(input: InvestigationPromptInput): string {
  return JSON.stringify(
    {
      projectId: input.projectId,
      eventCount: input.events.length,
      graph: input.graph,
      evidence: input.evidence,
      features: input.features,
      mlScore: input.mlScore,
    },
    null,
    2
  );
}

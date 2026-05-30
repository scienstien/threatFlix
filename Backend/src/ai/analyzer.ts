// ---------------------------------------------------------------------------
// AI Analyzer — Gemini LLM integration with batching, cooldowns, and retries.
// Forward-compat: provider interface for swapping to OpenAI/Anthropic.
// ---------------------------------------------------------------------------

import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.ts";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts.ts";
import { enrichMitre } from "./mitre.ts";
import { canRunAnalysis, recordAnalysis } from "../middleware/rateLimit.ts";
import { eventRepo } from "../db/repositories/eventRepository.ts";
import { alertRepo } from "../db/repositories/alertRepository.ts";
import type { SecurityEvent } from "../types/events.ts";
import type { AIAnalysisResult, ThreatAlert } from "../types/alerts.ts";
import { emitWebhook } from "../webhooks/emitter.ts";

// ---------------------------------------------------------------------------
// Provider interface (forward-compat)
// ---------------------------------------------------------------------------

export interface AIProvider {
  analyze(events: SecurityEvent[], projectId: string): Promise<AIAnalysisResult>;
}

// ---------------------------------------------------------------------------
// Gemini provider
// ---------------------------------------------------------------------------

class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async analyze(events: SecurityEvent[], projectId: string): Promise<AIAnalysisResult> {
    const model = this.client.getGenerativeModel({
      model: config.geminiModel,
      generationConfig: {
        temperature: 0.2,       // low temp for consistent structured output
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    });

    const prompt = buildUserPrompt(events, projectId);

    let lastError: Error | null = null;

    // Retry with exponential backoff
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
        });

        const text = result.response.text();
        const parsed = JSON.parse(text) as AIAnalysisResult;

        // Validate required fields
        if (!parsed.attack || !parsed.severity || parsed.confidence === undefined) {
          throw new Error("LLM response missing required fields");
        }

        // Clamp confidence to [0, 1]
        parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

        // Enrich MITRE data
        const mitre = enrichMitre(parsed.mitre, parsed.mitreName);
        parsed.mitre = mitre.mitre;
        parsed.mitreName = mitre.mitreName;

        return parsed;
      } catch (err) {
        lastError = err as Error;
        console.error(`  ⚠️  Gemini attempt ${attempt + 1} failed:`, (err as Error).message);

        if (attempt < 2) {
          const delay = 1000 * Math.pow(2, attempt); // 1s, 2s
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`AI analysis failed after 3 attempts: ${lastError?.message}`);
  }
}

// ---------------------------------------------------------------------------
// Fallback rule-based analyzer (when LLM is unavailable or rate-limited)
// ---------------------------------------------------------------------------

class FallbackProvider implements AIProvider {
  async analyze(events: SecurityEvent[], _projectId: string): Promise<AIAnalysisResult> {
    const failedLogins = events.filter((e) => e.event === "failed_login").length;
    const successLogins = events.filter((e) => e.event === "successful_login").length;
    const uniqueIps = new Set(events.map((e) => e.ip)).size;
    const uniqueUsers = new Set(events.map((e) => e.user)).size;

    // Simple heuristics
    if (failedLogins >= 5 && successLogins >= 1) {
      return {
        attack: "Brute Force (Rule-based Detection)",
        severity: "High",
        confidence: 0.75,
        mitre: "T1110",
        mitreName: "Brute Force",
        reasoning: `Detected ${failedLogins} failed login attempts followed by ${successLogins} successful login(s) from ${uniqueIps} IP(s). This pattern is consistent with a brute force attack.`,
        recommendation: "Force password reset for affected accounts, enable MFA, and review the source IPs.",
      };
    }

    if (failedLogins >= 3 && uniqueUsers >= 3 && uniqueIps <= 2) {
      return {
        attack: "Credential Stuffing (Rule-based Detection)",
        severity: "Medium",
        confidence: 0.65,
        mitre: "T1110.004",
        mitreName: "Credential Stuffing",
        reasoning: `Detected ${failedLogins} failed logins across ${uniqueUsers} different users from only ${uniqueIps} IP(s). This pattern suggests automated credential testing.`,
        recommendation: "Implement CAPTCHA, rate-limit login attempts per IP, and check credentials against known breach databases.",
      };
    }

    const hasPrivEsc = events.some((e) => e.event === "privilege_escalation");
    const hasDataExport = events.some((e) => e.event === "data_export");

    if (hasPrivEsc || hasDataExport) {
      return {
        attack: "Suspicious Activity (Rule-based Detection)",
        severity: hasDataExport ? "Critical" : "High",
        confidence: 0.6,
        mitre: hasDataExport ? "T1048" : "T1068",
        mitreName: hasDataExport ? "Exfiltration Over Alternative Protocol" : "Exploitation for Privilege Escalation",
        reasoning: `Detected ${hasPrivEsc ? "privilege escalation" : ""}${hasPrivEsc && hasDataExport ? " and " : ""}${hasDataExport ? "data export" : ""} events. These activities warrant immediate investigation.`,
        recommendation: "Audit the affected user accounts, check for unauthorized access, and review data access logs.",
      };
    }

    return {
      attack: "Suspicious Activity",
      severity: "Low",
      confidence: 0.3,
      mitre: "T1078",
      mitreName: "Valid Accounts",
      reasoning: `Observed ${events.length} events with ${failedLogins} failed logins. The pattern does not strongly indicate a specific attack but warrants monitoring.`,
      recommendation: "Continue monitoring. Consider enabling additional logging for these accounts.",
    };
  }
}

// ---------------------------------------------------------------------------
// Main analyzer — selects provider, enforces rate limits
// ---------------------------------------------------------------------------

let provider: AIProvider | null = null;
let fallback: AIProvider = new FallbackProvider();

function getProvider(): AIProvider {
  if (provider) return provider;

  if (config.geminiApiKey && config.geminiApiKey !== "your-gemini-api-key-here") {
    provider = new GeminiProvider(config.geminiApiKey);
    return provider;
  }

  console.warn("  ⚠️  No Gemini API key configured — using rule-based fallback analyzer.");
  return fallback;
}

/** Run AI analysis on a set of events. Enforces rate limits and cooldowns. */
export async function analyzeEvents(
  projectId: string,
  events?: SecurityEvent[]
): Promise<ThreatAlert> {
  // Rate limit check
  const rateCheck = canRunAnalysis(projectId);
  if (!rateCheck.allowed) {
    throw new Error(rateCheck.reason ?? "Analysis rate limit reached.");
  }

  // Get events if not provided
  const timeline = events ?? eventRepo.getUnanalysed(projectId, 50);

  if (timeline.length === 0) {
    throw new Error("No events to analyze.");
  }

  // Sort by timestamp ascending
  timeline.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  console.log(`  🧠 Analyzing ${timeline.length} events for project ${projectId}...`);

  let result: AIAnalysisResult;
  try {
    result = await getProvider().analyze(timeline, projectId);
  } catch (err) {
    console.warn(`  ⚠️  LLM failed, falling back to rule-based analysis: ${(err as Error).message}`);
    result = await fallback.analyze(timeline, projectId);
  }

  // Record the analysis for rate limiting
  recordAnalysis(projectId);

  // Build the alert
  const alert: ThreatAlert = {
    id: crypto.randomUUID(),
    projectId,
    ...result,
    relatedEventIds: timeline.map((e) => e.id),
    createdAt: new Date().toISOString(),
    status: "open",
    webhookDelivered: false,
  };

  // Persist
  alertRepo.insert(alert);
  console.log(`  🚨 Alert created: ${alert.attack} (${alert.severity}) — ${alert.mitre}`);

  // Fire webhook (non-blocking)
  emitWebhook(projectId, "alert.created", alert).catch((err) =>
    console.error("  ⚠️  Webhook delivery failed:", err)
  );

  return alert;
}

/** Check if analysis should auto-trigger for a project (called after event ingestion). */
export function shouldAutoAnalyze(projectId: string): boolean {
  const recentCount = eventRepo.countRecent(projectId, config.analysisCooldownMs);
  return recentCount >= config.analysisEventThreshold;
}

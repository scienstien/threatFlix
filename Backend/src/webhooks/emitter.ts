// ---------------------------------------------------------------------------
// Webhook emitter — POSTs alert payloads to configured URLs (n8n, Zapier, etc.)
// Forward-compat: HMAC signing, retry queue, delivery logs.
// ---------------------------------------------------------------------------

import { getDb } from "../db/database.ts";
import { alertRepo } from "../db/repositories/alertRepository.ts";
import { investigationRepo } from "../db/repositories/investigationRepository.ts";
import type { ThreatAlert, WebhookPayload } from "../types/alerts.ts";
import type { ThreatInvestigation } from "../types/investigations.ts";

/** Emit a webhook for a project event. Non-blocking — fire and forget. */
export async function emitWebhook(
  projectId: string,
  eventType: string,
  data: ThreatAlert | ThreatInvestigation
): Promise<void> {
  const db = getDb();

  // Find active webhooks for this project that subscribe to this event
  const webhooks = db
    .query(
      "SELECT * FROM webhooks WHERE project_id = ? AND active = 1"
    )
    .all(projectId) as any[];

  if (webhooks.length === 0) return;

  const payload: WebhookPayload<ThreatAlert | ThreatInvestigation> = {
    event: eventType,
    projectId,
    data,
    timestamp: new Date().toISOString(),
  };

  const body = JSON.stringify(payload);

  for (const webhook of webhooks) {
    // Check if this webhook subscribes to this event type
    const subscribedEvents: string[] = safeJson(webhook.events, ["alert.created"]);
    if (!subscribedEvents.includes(eventType)) continue;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "ThreatFlix-Webhook/1.0",
        "X-ThreatFlix-Event": eventType,
        "X-ThreatFlix-Delivery": crypto.randomUUID(),
      };

      // HMAC signature if secret is configured (forward-compat)
      if (webhook.secret) {
        const signature = await hmacSign(body, webhook.secret);
        headers["X-ThreatFlix-Signature"] = `sha256=${signature}`;
      }

      const res = await fetch(webhook.url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10_000), // 10s timeout
      });

      if (res.ok) {
        console.log(`  📤 Webhook delivered to ${webhook.url} (${res.status})`);
        if (eventType.startsWith("investigation.")) {
          investigationRepo.markWebhookDelivered(data.id);
        } else {
          alertRepo.markWebhookDelivered(data.id);
        }
      } else {
        console.warn(`  ⚠️  Webhook to ${webhook.url} returned ${res.status}`);
      }
    } catch (err) {
      console.error(`  ❌ Webhook delivery to ${webhook.url} failed:`, (err as Error).message);
      // Forward-compat: add to retry queue
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeJson<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

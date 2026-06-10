import { describe, expect, test } from "bun:test";
import { buildLlmIncidentContext } from "./llmContext.ts";
import type { SecurityEvent } from "../types/events.ts";
import type { ThreatInvestigation } from "../types/investigations.ts";

describe("LLM incident context", () => {
  test("bounds telemetry and reserves graph similarity context", () => {
    const context = buildLlmIncidentContext(investigation(), events(105), 2, [{
      investigationId: "similar-1", similarity: 0.82, mode: "bootstrap", relation: "strong",
      scoreBreakdown: { semantic: 0.8, localStructure: 0.82, extendedStructure: 0.84 },
      sharedSignals: { rules: ["brute_force_10_failures_5m"], stages: ["access_pressure"], techniques: ["T1110"], eventTypes: ["failed_login"] },
      differentSignals: { rules: [], stages: [], techniques: [], eventTypes: [] },
    }]);

    expect(context.contextVersion).toBe(2);
    expect(context.telemetry).toHaveLength(100);
    expect(context.telemetry[0]?.id).toBe("e5");
    expect(context.similarIncidents).toHaveLength(1);
    expect(context.similarIncidents[0]?.investigationId).toBe("similar-1");
    expect(context.uebaSummary?.sessionScores).toHaveLength(0);
  });
});

function investigation(): ThreatInvestigation {
  return {
    id: "i1", projectId: "p1", title: "Brute Force", severity: "High", confidence: 0.8,
    mitre: "T1110", mitreName: "Brute Force", summary: "summary", recommendation: "action",
    graph: { nodes: [], edges: [] }, features: {}, relatedEventIds: [], createdAt: "2026-01-01T00:00:00Z",
    status: "open", webhookDelivered: false, evidence: [],
    uebaSummary: { schemaVersion: "1", modelVersion: "m1", scoredAt: "2026-01-01T00:00:00Z", baselineMaturity: "bootstrap", behaviorScore: 0, sessionScores: [] },
  };
}

function events(count: number): SecurityEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `e${index}`, projectId: "p1", event: "failed_login", user: "alice", ip: "1.1.1.1",
    service: "auth", timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    receivedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(), metadata: {},
  }));
}

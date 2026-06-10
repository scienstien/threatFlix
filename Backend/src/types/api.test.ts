import { describe, expect, test } from "bun:test";
import { toAlertApiView, toInvestigationApiView } from "./api.ts";
import type { ThreatAlert } from "./alerts.ts";

describe("API alert mapper", () => {
  test("normalizes legacy alerts for the dashboard contract", () => {
    const view = toAlertApiView({
      id: "alert-1",
      projectId: "project",
      attack: "Brute Force",
      severity: "High",
      confidence: 0.82,
      mitre: "T1110",
      mitreName: "Brute Force",
      reasoning: "reason",
      recommendation: "recommendation",
      relatedEventIds: ["a", "b"],
      createdAt: "2026-01-01T00:00:00.000Z",
      status: "open",
      webhookDelivered: false,
    } satisfies ThreatAlert);

    expect(view.severity).toBe("high");
    expect(view.confidence).toBe(82);
    expect(view.eventCount).toBe(2);
    expect(view.timestamp).toBe("2026-01-01T00:00:00.000Z");
  });
});

test("exposes persisted UEBA and LLM report state", () => {
  const view = toInvestigationApiView({
    id: "i1", projectId: "p1", title: "Brute Force", severity: "High", confidence: 0.8,
    mitre: "T1110", mitreName: "Brute Force", summary: "summary", recommendation: "action",
    graph: { nodes: [], edges: [] }, features: {}, relatedEventIds: [], createdAt: "2026-01-01T00:00:00Z",
    status: "open", webhookDelivered: false, evidence: [], llmReportStatus: "pending",
    uebaSummary: { schemaVersion: "1", modelVersion: "m1", scoredAt: "2026-01-01T00:00:00Z", baselineMaturity: "bootstrap", behaviorScore: 80, sessionScores: [] },
  });

  expect(view.llmReportStatus).toBe("pending");
  expect(view.uebaSummary?.behaviorScore).toBe(80);
});

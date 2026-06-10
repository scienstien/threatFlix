import { describe, expect, test } from "bun:test";
import { OllamaGemmaProvider } from "./ollamaProvider.ts";
import { buildLlmIncidentContext } from "./llmContext.ts";
import type { ThreatInvestigation } from "../types/investigations.ts";

describe("Ollama Gemma provider", () => {
  test("requests structured non-streamed report output", async () => {
    let requestBody: any;
    const provider = new OllamaGemmaProvider(async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return Response.json({ message: { content: JSON.stringify(validReport()) } });
    });

    const report = await provider.generateReport(buildLlmIncidentContext(investigation(), [], 1));

    expect(requestBody.stream).toBe(false);
    expect(requestBody.think).toBe(false);
    expect(requestBody.format.type).toBe("object");
    expect(report.provider).toBe("ollama");
    expect(report.contextVersion).toBe(1);
  });
});

function validReport() {
  return {
    executiveSummary: "Summary", likelyIncident: "Brute Force", whatLikelyHappened: ["Attempts"],
    evidenceAssessment: [], recommendedActions: [], uncertainty: [], openQuestions: [],
  };
}

function investigation(): ThreatInvestigation {
  return {
    id: "i1", projectId: "p1", title: "Brute Force", severity: "High", confidence: 0.8,
    mitre: "T1110", mitreName: "Brute Force", summary: "summary", recommendation: "action",
    graph: { nodes: [], edges: [] }, features: {}, relatedEventIds: [], createdAt: "2026-01-01T00:00:00Z",
    status: "open", webhookDelivered: false, evidence: [],
  };
}

import { describe, expect, test } from "bun:test";
import { buildIncidentGraph } from "../incidentGraph.ts";
import { buildCanonicalIncidentGraph } from "./canonicalGraph.ts";
import { compareFingerprints } from "./similarity.ts";
import { buildWlFingerprint } from "./wlFingerprint.ts";
import type { SecurityEvent } from "../../types/events.ts";
import type { CanonicalGraphBuildInput } from "../../types/graphSimilarity.ts";

describe("WL graph similarity", () => {
  test("identical attack structures score one despite different identities", () => {
    const leftInput = scenario("left", "alice", "10.0.0.1", true);
    const rightInput = scenario("right", "bob", "203.0.113.5", true);
    const left = buildWlFingerprint(buildCanonicalIncidentGraph(leftInput));
    const right = buildWlFingerprint(buildCanonicalIncidentGraph(rightInput));
    const match = compareFingerprints(left, right, "right", [], leftInput.graph, rightInput.graph);

    expect(match.similarity).toBe(1);
    expect(match.relation).toBe("strong");
    expect(match.entityOverlap.sameUsers).toEqual([]);
    expect(match.sharedSignals.stages).toEqual(["access_pressure", "access_success", "persistence"]);
  });

  test("partial attack progression scores below the full progression", () => {
    const source = fingerprint(scenario("source", "alice", "10.0.0.1", true));
    const full = fingerprint(scenario("full", "bob", "10.0.0.2", true));
    const partial = fingerprint(scenario("partial", "carol", "10.0.0.3", false));

    expect(compareFingerprints(source, full, "full").similarity).toBeGreaterThan(
      compareFingerprints(source, partial, "partial").similarity
    );
  });

  test("sublinear term frequency keeps repeated activity from dominating progression", () => {
    const source = fingerprint(scenario("source", "alice", "10.0.0.1", true));
    const repeatedInput = scenario("repeated", "bob", "10.0.0.2", true);
    const first = repeatedInput.graph.nodes.find((node) => node.type === "event" && node.label === "failed_login")!;
    const firstEventId = String(first.metadata?.eventId);
    const relatedEdges = repeatedInput.graph.edges.filter(
      (edge) => edge.source === first.id || edge.target === first.id
    );
    for (let index = 0; index < 20; index++) {
      const sourceNodeId = `${first.id}-copy-${index}`;
      const eventId = `${firstEventId}-copy-${index}`;
      repeatedInput.graph.nodes.push({
        ...first,
        id: sourceNodeId,
        metadata: { ...first.metadata, eventId },
      });
      repeatedInput.graph.edges.push(...relatedEdges.map((edge) => ({
        ...edge,
        id: `${edge.id}-copy-${index}`,
        source: edge.source === first.id ? sourceNodeId : edge.source,
        target: edge.target === first.id ? sourceNodeId : edge.target,
        eventId,
      })));
      repeatedInput.selectedEventIds.push(eventId);
      repeatedInput.findings[0]!.eventIds.push(eventId);
    }
    const repeated = fingerprint(repeatedInput);

    expect(compareFingerprints(source, repeated, "repeated").similarity).toBeGreaterThan(0.6);
  });

  test("uses tenant TF-IDF mode once enough compatible fingerprints exist", () => {
    const source = fingerprint(scenario("source", "alice", "10.0.0.1", true));
    const candidate = fingerprint(scenario("candidate", "bob", "10.0.0.2", true));
    const corpus = Array.from({ length: 5 }, (_, index) =>
      fingerprint(scenario(`corpus-${index}`, `user-${index}`, `10.0.1.${index}`, index === 0))
    );

    expect(compareFingerprints(source, candidate, "candidate", corpus).mode).toBe("tenant_tfidf");
  });

  test("reports raw entity overlap without changing structural similarity", () => {
    const sourceInput = scenario("source", "alice", "10.0.0.1", true);
    const sameInput = scenario("same", "alice", "10.0.0.1", true);
    const differentInput = scenario("different", "bob", "10.0.0.2", true);
    const source = fingerprint(sourceInput);
    const same = compareFingerprints(source, fingerprint(sameInput), "same", [], sourceInput.graph, sameInput.graph);
    const different = compareFingerprints(source, fingerprint(differentInput), "different", [], sourceInput.graph, differentInput.graph);

    expect(same.similarity).toBe(different.similarity);
    expect(same.entityOverlap.sameUsers).toEqual(["alice"]);
    expect(different.entityOverlap.sameUsers).toEqual([]);
  });
});

function fingerprint(input: CanonicalGraphBuildInput) {
  return buildWlFingerprint(buildCanonicalIncidentGraph(input));
}

function scenario(prefix: string, user: string, ip: string, includePersistence: boolean): CanonicalGraphBuildInput {
  const events = [
    event(`${prefix}-fail`, "failed_login", user, ip, 0),
    event(`${prefix}-success`, "successful_login", user, ip, 2),
    ...(includePersistence ? [event(`${prefix}-key`, "api_key_created", user, ip, 4)] : []),
  ];
  const findings: CanonicalGraphBuildInput["findings"] = [
    { ruleId: "brute_force_10_failures_5m", eventIds: [events[0]!.id], deterministic: { stage: "access_pressure", techniques: [{ id: "T1110" }] } },
    { ruleId: "success_after_fail_5_to_1_10m", eventIds: [events[0]!.id, events[1]!.id], deterministic: { stage: "access_success", techniques: [{ id: "T1078" }] } },
  ];
  const chainEdges: CanonicalGraphBuildInput["chainEdges"] = [
    { fromRuleId: "brute_force_10_failures_5m", toRuleId: "success_after_fail_5_to_1_10m", sharedKeys: [], minutesBetween: 2, transitionScore: 0.9 },
  ];
  if (includePersistence) {
    findings.push({ ruleId: "persistence_establishment", eventIds: [events[2]!.id], deterministic: { stage: "persistence", techniques: [{ id: "T1098.001" }] } });
    chainEdges.push({ fromRuleId: "success_after_fail_5_to_1_10m", toRuleId: "persistence_establishment", sharedKeys: [], minutesBetween: 2, transitionScore: 0.8 });
  }
  return {
    sourceInvestigationId: prefix,
    graph: buildIncidentGraph(events),
    selectedEventIds: events.map((item) => item.id),
    findings,
    chainEdges,
  };
}

function event(id: string, eventType: string, user: string, ip: string, minute: number): SecurityEvent {
  const timestamp = new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString();
  return {
    id, projectId: "project", event: eventType, user, ip, service: "identity",
    sessionId: `${id.split("-")[0]}-session`, timestamp, receivedAt: timestamp, metadata: {},
  };
}

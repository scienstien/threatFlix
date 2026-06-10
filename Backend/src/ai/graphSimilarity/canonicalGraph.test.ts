import { describe, expect, test } from "bun:test";
import { buildIncidentGraph } from "../incidentGraph.ts";
import type { SecurityEvent } from "../../types/events.ts";
import type {
  CanonicalGraphBuildInput,
  CanonicalGraphFinding,
} from "../../types/graphSimilarity.ts";
import { bucketGapMinutes, buildCanonicalIncidentGraph } from "./canonicalGraph.ts";

describe("canonical incident graph", () => {
  test("produces the same structure for the same attack against different identities", () => {
    const first = buildCanonicalIncidentGraph(
      scenario("first", "alice@example.com", "10.0.0.1", "identity-a", 0)
    );
    const second = buildCanonicalIncidentGraph(
      scenario("second", "bob@example.com", "203.0.113.90", "identity-b", 180)
    );

    expect(first.sourceDigest).toBe(second.sourceDigest);
    expect(first.nodes).toEqual(second.nodes);
    expect(first.edges).toEqual(second.edges);
    expect(first.summary).toEqual(second.summary);
  });

  test("is stable when source arrays arrive in a different order", () => {
    const input = scenario("stable", "alice", "10.0.0.1", "identity", 0);
    const reversed = {
      ...input,
      graph: {
        nodes: [...input.graph.nodes].reverse(),
        edges: [...input.graph.edges].reverse(),
      },
      selectedEventIds: [...input.selectedEventIds].reverse(),
      findings: [...input.findings].reverse(),
      chainEdges: [...input.chainEdges].reverse(),
    };

    expect(buildCanonicalIncidentGraph(input).sourceDigest).toBe(
      buildCanonicalIncidentGraph(reversed).sourceDigest
    );
  });

  test("changes when the observed attack progression changes", () => {
    const normal = scenario("normal", "alice", "10.0.0.1", "identity", 0);
    const changed = scenario("changed", "alice", "10.0.0.1", "identity", 0);
    const success = changed.graph.nodes.find((node) => node.metadata?.eventId === "changed-success");
    const apiKey = changed.graph.nodes.find((node) => node.metadata?.eventId === "changed-api-key");
    if (!success?.metadata || !apiKey?.metadata) throw new Error("test event nodes missing");
    success.metadata.timestamp = timestamp(0, 8);
    apiKey.metadata.timestamp = timestamp(0, 3);

    expect(buildCanonicalIncidentGraph(normal).sourceDigest).not.toBe(
      buildCanonicalIncidentGraph(changed).sourceDigest
    );
  });

  test("adds provenance, semantic, deterministic-transition, and chronological edges", () => {
    const canonical = buildCanonicalIncidentGraph(
      scenario("edges", "alice", "10.0.0.1", "identity", 0)
    );
    const edgeTypes = new Set(canonical.edges.map((edge) => edge.type));

    for (const expected of [
      "performed",
      "originated",
      "targeted",
      "contains",
      "supports",
      "has_stage",
      "maps_to",
      "transitions_to:short",
      "next_in_session:short",
    ]) {
      expect(edgeTypes.has(expected as any)).toBe(true);
    }
  });

  test("removes literal identities, metadata, and uncontrolled labels", () => {
    const event = makeEvent({
      id: "event-secret",
      event: "tenant_private_event_name",
      user: "private.user@example.com",
      ip: "198.51.100.88",
      service: "secret-payroll-service",
      sessionId: "private-session-token",
      timestamp: timestamp(0, 0),
      metadata: { password: "do-not-leak", customer: "private-customer-name" },
    });
    const input: CanonicalGraphBuildInput = {
      sourceInvestigationId: "investigation-safe-id",
      graph: buildIncidentGraph([event]),
      selectedEventIds: [event.id],
      findings: [
        {
          ruleId: "tenant-private-rule",
          eventIds: [event.id],
          deterministic: {
            stage: "access_pressure",
            techniques: [{ id: "tenant-private-technique" }],
          },
        },
      ],
      chainEdges: [],
    };

    const canonical = buildCanonicalIncidentGraph(input);
    const serialized = JSON.stringify(canonical);

    for (const secret of [
      event.user,
      event.ip,
      event.service,
      event.sessionId!,
      "tenant_private_event_name",
      "tenant-private-rule",
      "tenant-private-technique",
      "do-not-leak",
      "private-customer-name",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(canonical.summary.eventTypes).toEqual(["other"]);
    expect(canonical.summary.rules).toEqual(["other"]);
    expect(canonical.summary.techniques).toEqual(["other"]);
  });

  test("includes only events and findings from the selected deterministic scope", () => {
    const input = scenario("scope", "alice", "10.0.0.1", "identity", 0);
    const unrelated = makeEvent({
      id: "scope-unrelated-export",
      event: "data_export",
      user: "unrelated-user",
      ip: "192.0.2.44",
      service: "unrelated-service",
      sessionId: "unrelated-session",
      timestamp: timestamp(60, 0),
    });
    input.graph = buildIncidentGraph([
      ...eventsForScenario("scope", "alice", "10.0.0.1", "identity", 0),
      unrelated,
    ]);
    input.findings.push(
      finding("data_exfiltration", [unrelated.id], "objective_action", "T1041")
    );
    input.chainEdges.push({
      fromRuleId: "persistence_establishment",
      toRuleId: "data_exfiltration",
      sharedKeys: [],
      minutesBetween: 50,
      transitionScore: 0.8,
    });

    const canonical = buildCanonicalIncidentGraph(input);

    expect(canonical.summary.eventTypes).not.toContain("data_export");
    expect(canonical.summary.rules).not.toContain("data_exfiltration");
    expect(canonical.summary.stages).not.toContain("objective_action");
    expect(canonical.summary.techniques).not.toContain("T1041");
    expect(canonical.summary.entityCounts).toEqual({
      users: 1,
      ips: 1,
      services: 1,
      sessions: 1,
    });
  });

  test("preserves entity multiplicity without preserving entity values", () => {
    const first = makeEvent({
      id: "spray-1",
      event: "failed_login",
      user: "alice",
      ip: "10.0.0.1",
      service: "identity",
      sessionId: "spray",
      timestamp: timestamp(0, 0),
    });
    const second = makeEvent({
      id: "spray-2",
      event: "failed_login",
      user: "bob",
      ip: "10.0.0.1",
      service: "identity",
      sessionId: "spray",
      timestamp: timestamp(0, 1),
    });
    const canonical = buildCanonicalIncidentGraph({
      sourceInvestigationId: "spray-investigation",
      graph: buildIncidentGraph([first, second]),
      selectedEventIds: [first.id, second.id],
      findings: [
        finding(
          "password_spray_10_users_15m",
          [first.id, second.id],
          "access_pressure",
          "T1110.003"
        ),
      ],
      chainEdges: [],
    });

    expect(canonical.summary.entityCounts.users).toBe(2);
    expect(canonical.summary.entityCounts.ips).toBe(1);
    expect(canonical.nodes.filter((node) => node.label === "entity:user")).toHaveLength(2);
    expect(JSON.stringify(canonical)).not.toContain("alice");
    expect(JSON.stringify(canonical)).not.toContain("bob");
  });
});

describe("canonical graph time buckets", () => {
  test("uses the locked coarse gap boundaries", () => {
    expect(bucketGapMinutes(1)).toBe("immediate");
    expect(bucketGapMinutes(1.01)).toBe("short");
    expect(bucketGapMinutes(5)).toBe("short");
    expect(bucketGapMinutes(5.01)).toBe("medium");
    expect(bucketGapMinutes(30)).toBe("medium");
    expect(bucketGapMinutes(30.01)).toBe("long");
    expect(bucketGapMinutes(Number.NaN)).toBe("long");
  });
});

function scenario(
  prefix: string,
  user: string,
  ip: string,
  service: string,
  baseMinute: number
): CanonicalGraphBuildInput {
  const events = eventsForScenario(prefix, user, ip, service, baseMinute);
  const [failure, success, apiKey] = events;
  if (!failure || !success || !apiKey) throw new Error("scenario events missing");

  return {
    sourceInvestigationId: `${prefix}-investigation`,
    graph: buildIncidentGraph(events),
    selectedEventIds: events.map((event) => event.id),
    findings: [
      finding("brute_force_10_failures_5m", [failure.id], "access_pressure", "T1110"),
      finding(
        "success_after_fail_5_to_1_10m",
        [failure.id, success.id],
        "access_success",
        "T1078"
      ),
      finding(
        "persistence_establishment",
        [apiKey.id],
        "persistence",
        "T1098.001"
      ),
    ],
    chainEdges: [
      {
        fromRuleId: "brute_force_10_failures_5m",
        toRuleId: "success_after_fail_5_to_1_10m",
        sharedKeys: [`user:${user}`, `ip:${ip}`],
        minutesBetween: 2,
        transitionScore: 0.9,
      },
      {
        fromRuleId: "success_after_fail_5_to_1_10m",
        toRuleId: "persistence_establishment",
        sharedKeys: [`user:${user}`, `ip:${ip}`],
        minutesBetween: 3,
        transitionScore: 0.85,
      },
    ],
  };
}

function eventsForScenario(
  prefix: string,
  user: string,
  ip: string,
  service: string,
  baseMinute: number
): SecurityEvent[] {
  return [
    makeEvent({
      id: `${prefix}-failure`,
      event: "failed_login",
      user,
      ip,
      service,
      sessionId: `${prefix}-session`,
      timestamp: timestamp(baseMinute, 0),
    }),
    makeEvent({
      id: `${prefix}-success`,
      event: "successful_login",
      user,
      ip,
      service,
      sessionId: `${prefix}-session`,
      timestamp: timestamp(baseMinute, 2),
    }),
    makeEvent({
      id: `${prefix}-api-key`,
      event: "api_key_created",
      user,
      ip,
      service,
      sessionId: `${prefix}-session`,
      timestamp: timestamp(baseMinute, 5),
    }),
  ];
}

function finding(
  ruleId: string,
  eventIds: string[],
  stage: NonNullable<CanonicalGraphFinding["deterministic"]>["stage"],
  techniqueId: string
): CanonicalGraphFinding {
  return {
    ruleId,
    eventIds,
    deterministic: {
      stage,
      techniques: [{ id: techniqueId }],
    },
  };
}

function makeEvent(input: {
  id: string;
  event: string;
  user: string;
  ip: string;
  service: string;
  sessionId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}): SecurityEvent {
  return {
    ...input,
    projectId: "project",
    receivedAt: input.timestamp,
    metadata: input.metadata ?? {},
  };
}

function timestamp(baseMinute: number, offsetMinute: number): string {
  return new Date(Date.UTC(2026, 0, 1, 0, baseMinute + offsetMinute)).toISOString();
}

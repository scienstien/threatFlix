import { createHash } from "node:crypto";
import type { IncidentGraphEdge, IncidentGraphNode } from "../../types/investigations.ts";
import {
  GRAPH_SIMILARITY_SCHEMA_VERSION,
  type CanonicalGraphBuildInput,
  type CanonicalGraphEdge,
  type CanonicalGraphEdgeType,
  type CanonicalGraphFinding,
  type CanonicalGraphNode,
  type CanonicalGraphSummary,
  type CanonicalIncidentGraph,
  type GraphTimeGapBucket,
} from "../../types/graphSimilarity.ts";

const KNOWN_EVENT_TYPES = new Set([
  "failed_login",
  "successful_login",
  "password_reset",
  "suspicious_ip",
  "log",
  "mfa_challenge",
  "mfa_failure",
  "mfa_success",
  "mfa_disabled",
  "privilege_escalation",
  "data_export",
  "api_key_created",
  "session_created",
  "session_ended",
  "role_changed",
  "permission_granted",
  "permission_revoked",
]);

const KNOWN_RULE_IDS = new Set([
  "brute_force_10_failures_5m",
  "password_spray_10_users_15m",
  "credential_stuffing_10_users_3_ips_15m",
  "success_after_fail_5_to_1_10m",
  "mfa_bypass_3_failures_then_success_15m",
  "mfa_disabled",
  "privilege_change",
  "persistence_establishment",
  "account_access_removal",
  "data_exfiltration",
]);

const PROVENANCE_EDGE_TYPES = new Set(["performed", "originated", "targeted", "contains"]);
const ENTITY_TYPES = new Set(["user", "ip", "service", "session"]);

interface SelectedEvent {
  sourceNodeId: string;
  eventId: string;
  eventType: string;
  timestamp?: string;
  canonicalId?: string;
}

interface IncludedEntity {
  sourceNodeId: string;
  entityType: "user" | "ip" | "service" | "session";
  signature: string;
  canonicalId?: string;
}

interface IncludedRule {
  ruleId: string;
  ruleLabel: string;
  eventIds: string[];
  findings: CanonicalGraphFinding[];
  signature: string;
  canonicalId?: string;
}

export function buildCanonicalIncidentGraph(
  input: CanonicalGraphBuildInput
): CanonicalIncidentGraph {
  const selectedEventIdSet = new Set(input.selectedEventIds);
  const selectedEvents = collectSelectedEvents(input.graph.nodes, selectedEventIdSet);
  assignEventIds(selectedEvents);

  const eventBySourceNode = new Map(
    selectedEvents.map((event) => [event.sourceNodeId, event] as const)
  );
  const eventByEventId = new Map(selectedEvents.map((event) => [event.eventId, event] as const));
  const includedEntities = collectIncludedEntities(input.graph.nodes, input.graph.edges, eventBySourceNode);
  assignEntityIds(includedEntities);

  const includedRules = collectIncludedRules(input.findings, selectedEventIdSet, eventByEventId);
  assignRuleIds(includedRules);

  const nodes: CanonicalGraphNode[] = [
    ...selectedEvents.map((event) => ({
      id: required(event.canonicalId),
      type: "event" as const,
      label: `event:${event.eventType}`,
    })),
    ...includedEntities.map((entity) => ({
      id: required(entity.canonicalId),
      type: "entity" as const,
      label: `entity:${entity.entityType}`,
    })),
    ...includedRules.map((rule) => ({
      id: required(rule.canonicalId),
      type: "rule" as const,
      label: `rule:${rule.ruleLabel}`,
    })),
  ];
  const edges = new Map<string, CanonicalGraphEdge>();

  addProvenanceEdges(edges, input.graph.edges, eventBySourceNode, includedEntities);
  addSemanticNodesAndEdges(nodes, edges, includedRules, eventByEventId);
  addRuleTransitionEdges(edges, input.chainEdges, includedRules);
  addSessionProgressionEdges(edges, input.graph.edges, selectedEvents, includedEntities);

  const sortedNodes = nodes.sort(compareNodes);
  const sortedEdges = [...edges.values()].sort(compareEdges);
  const summary = buildSummary(selectedEvents, includedEntities, includedRules);
  const sourceDigest = digestCanonicalGraph(sortedNodes, sortedEdges, summary);

  return {
    schemaVersion: GRAPH_SIMILARITY_SCHEMA_VERSION,
    sourceInvestigationId: input.sourceInvestigationId,
    sourceDigest,
    nodes: sortedNodes,
    edges: sortedEdges,
    summary,
  };
}

function collectSelectedEvents(
  nodes: IncidentGraphNode[],
  selectedEventIds: Set<string>
): SelectedEvent[] {
  return nodes
    .filter((node) => node.type === "event")
    .map((node): SelectedEvent | null => {
      const eventId = getEventId(node);
      if (!eventId || !selectedEventIds.has(eventId)) return null;
      return {
        sourceNodeId: node.id,
        eventId,
        eventType: normalizeEventType(node.label),
        timestamp: getString(node.metadata?.timestamp),
      };
    })
    .filter((event): event is SelectedEvent => Boolean(event));
}

function assignEventIds(events: SelectedEvent[]): void {
  events.sort((left, right) =>
    compareOptionalTimestamp(left.timestamp, right.timestamp) ||
    left.eventType.localeCompare(right.eventType) ||
    left.eventId.localeCompare(right.eventId)
  );
  events.forEach((event, index) => {
    event.canonicalId = `event:${pad(index)}`;
  });
}

function collectIncludedEntities(
  nodes: IncidentGraphNode[],
  edges: IncidentGraphEdge[],
  eventBySourceNode: Map<string, SelectedEvent>
): IncludedEntity[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const neighborhoodByEntity = new Map<string, string[]>();

  for (const edge of edges) {
    if (!PROVENANCE_EDGE_TYPES.has(edge.type)) continue;
    const sourceEvent = eventBySourceNode.get(edge.source);
    const targetEvent = eventBySourceNode.get(edge.target);
    const entityNodeId = sourceEvent ? edge.target : targetEvent ? edge.source : undefined;
    const event = sourceEvent ?? targetEvent;
    const entityNode = entityNodeId ? nodeById.get(entityNodeId) : undefined;
    if (!event || !entityNode || !ENTITY_TYPES.has(entityNode.type)) continue;

    const direction = sourceEvent ? "out" : "in";
    const tokens = neighborhoodByEntity.get(entityNode.id) ?? [];
    tokens.push(`${direction}:${edge.type}:${required(event.canonicalId)}`);
    neighborhoodByEntity.set(entityNode.id, tokens);
  }

  return [...neighborhoodByEntity.entries()].map(([sourceNodeId, tokens]) => {
    const node = nodeById.get(sourceNodeId);
    if (!node || !ENTITY_TYPES.has(node.type)) {
      throw new Error(`Canonical graph entity node is missing: ${sourceNodeId}`);
    }
    const entityType = node.type as IncludedEntity["entityType"];
    return {
      sourceNodeId,
      entityType,
      signature: `${entityType}|${tokens.sort().join("|")}`,
    };
  });
}

function assignEntityIds(entities: IncludedEntity[]): void {
  entities.sort((left, right) =>
    left.entityType.localeCompare(right.entityType) ||
    left.signature.localeCompare(right.signature) ||
    left.sourceNodeId.localeCompare(right.sourceNodeId)
  );
  const counts = new Map<IncludedEntity["entityType"], number>();
  for (const entity of entities) {
    const index = counts.get(entity.entityType) ?? 0;
    entity.canonicalId = `entity:${entity.entityType}:${pad(index)}`;
    counts.set(entity.entityType, index + 1);
  }
}

function collectIncludedRules(
  findings: CanonicalGraphFinding[],
  selectedEventIds: Set<string>,
  eventByEventId: Map<string, SelectedEvent>
): IncludedRule[] {
  const byRuleId = new Map<string, CanonicalGraphFinding[]>();
  for (const finding of findings) {
    if (!finding.eventIds.some((eventId) => selectedEventIds.has(eventId))) continue;
    const existing = byRuleId.get(finding.ruleId) ?? [];
    existing.push(finding);
    byRuleId.set(finding.ruleId, existing);
  }

  return [...byRuleId.entries()]
    .map(([ruleId, groupedFindings]) => {
      const eventIds = unique(
        groupedFindings.flatMap((finding) =>
          finding.eventIds.filter((eventId) => eventByEventId.has(eventId))
        )
      ).sort((left, right) =>
        required(eventByEventId.get(left)?.canonicalId).localeCompare(
          required(eventByEventId.get(right)?.canonicalId)
        )
      );
      const stages = unique(
        groupedFindings
          .map((finding) => finding.deterministic?.stage)
          .filter((stage): stage is NonNullable<typeof stage> => Boolean(stage))
      ).sort();
      const techniques = unique(
        groupedFindings.flatMap((finding) =>
          finding.deterministic?.techniques?.map((technique) => normalizeTechniqueId(technique.id)) ?? []
        )
      ).sort();
      const ruleLabel = normalizeRuleId(ruleId);

      return {
        ruleId,
        ruleLabel,
        eventIds,
        findings: groupedFindings,
        signature: `${ruleLabel}|${eventIds.map((eventId) => required(eventByEventId.get(eventId)?.canonicalId)).join(",")}|${stages.join(",")}|${techniques.join(",")}`,
      };
    })
    .filter((rule) => rule.eventIds.length > 0);
}

function assignRuleIds(rules: IncludedRule[]): void {
  rules.sort((left, right) =>
    left.signature.localeCompare(right.signature) ||
    left.ruleId.localeCompare(right.ruleId)
  );
  rules.forEach((rule, index) => {
    rule.canonicalId = `rule:${pad(index)}`;
  });
}

function addProvenanceEdges(
  result: Map<string, CanonicalGraphEdge>,
  sourceEdges: IncidentGraphEdge[],
  eventBySourceNode: Map<string, SelectedEvent>,
  entities: IncludedEntity[]
): void {
  const entityBySourceNode = new Map(entities.map((entity) => [entity.sourceNodeId, entity] as const));

  for (const edge of sourceEdges) {
    if (!PROVENANCE_EDGE_TYPES.has(edge.type)) continue;
    const source = eventBySourceNode.get(edge.source)?.canonicalId ??
      entityBySourceNode.get(edge.source)?.canonicalId;
    const target = eventBySourceNode.get(edge.target)?.canonicalId ??
      entityBySourceNode.get(edge.target)?.canonicalId;
    if (!source || !target) continue;
    addEdge(result, source, target, edge.type as CanonicalGraphEdgeType);
  }
}

function addSemanticNodesAndEdges(
  nodes: CanonicalGraphNode[],
  edges: Map<string, CanonicalGraphEdge>,
  rules: IncludedRule[],
  eventByEventId: Map<string, SelectedEvent>
): void {
  const stages = unique(
    rules.flatMap((rule) =>
      rule.findings
        .map((finding) => finding.deterministic?.stage)
        .filter((stage): stage is NonNullable<typeof stage> => Boolean(stage))
    )
  ).sort();
  const techniques = unique(
    rules.flatMap((rule) =>
      rule.findings.flatMap((finding) =>
        finding.deterministic?.techniques?.map((technique) => normalizeTechniqueId(technique.id)) ?? []
      )
    )
  ).sort();
  const stageIds = new Map(stages.map((stage, index) => [stage, `stage:${pad(index)}`] as const));
  const techniqueIds = new Map(
    techniques.map((technique, index) => [technique, `technique:${pad(index)}`] as const)
  );

  nodes.push(
    ...stages.map((stage) => ({
      id: required(stageIds.get(stage)),
      type: "stage" as const,
      label: `stage:${stage}`,
    })),
    ...techniques.map((technique) => ({
      id: required(techniqueIds.get(technique)),
      type: "technique" as const,
      label: `technique:${technique}`,
    }))
  );

  for (const rule of rules) {
    const ruleId = required(rule.canonicalId);
    for (const eventId of rule.eventIds) {
      const event = eventByEventId.get(eventId);
      if (event?.canonicalId) addEdge(edges, event.canonicalId, ruleId, "supports");
    }
    for (const finding of rule.findings) {
      const stage = finding.deterministic?.stage;
      if (stage) addEdge(edges, ruleId, required(stageIds.get(stage)), "has_stage");
      for (const technique of finding.deterministic?.techniques ?? []) {
        const techniqueId = normalizeTechniqueId(technique.id);
        addEdge(edges, ruleId, required(techniqueIds.get(techniqueId)), "maps_to");
      }
    }
  }
}

function addRuleTransitionEdges(
  result: Map<string, CanonicalGraphEdge>,
  chainEdges: CanonicalGraphBuildInput["chainEdges"],
  rules: IncludedRule[]
): void {
  const ruleBySourceId = new Map(rules.map((rule) => [rule.ruleId, rule] as const));
  for (const edge of chainEdges) {
    const source = ruleBySourceId.get(edge.fromRuleId)?.canonicalId;
    const target = ruleBySourceId.get(edge.toRuleId)?.canonicalId;
    if (!source || !target) continue;
    addEdge(result, source, target, `transitions_to:${bucketGapMinutes(edge.minutesBetween)}`);
  }
}

function addSessionProgressionEdges(
  result: Map<string, CanonicalGraphEdge>,
  sourceEdges: IncidentGraphEdge[],
  events: SelectedEvent[],
  entities: IncludedEntity[]
): void {
  const sessionSourceIds = new Set(
    entities.filter((entity) => entity.entityType === "session").map((entity) => entity.sourceNodeId)
  );
  const eventBySourceNode = new Map(events.map((event) => [event.sourceNodeId, event] as const));
  const eventsBySession = new Map<string, SelectedEvent[]>();

  for (const edge of sourceEdges) {
    if (edge.type !== "contains" || !sessionSourceIds.has(edge.source)) continue;
    const event = eventBySourceNode.get(edge.target);
    if (!event) continue;
    const sessionEvents = eventsBySession.get(edge.source) ?? [];
    sessionEvents.push(event);
    eventsBySession.set(edge.source, sessionEvents);
  }

  for (const sessionEvents of eventsBySession.values()) {
    sessionEvents.sort((left, right) =>
      compareOptionalTimestamp(left.timestamp, right.timestamp) ||
      required(left.canonicalId).localeCompare(required(right.canonicalId))
    );
    for (let index = 0; index < sessionEvents.length - 1; index++) {
      const current = sessionEvents[index];
      const next = sessionEvents[index + 1];
      if (!current?.canonicalId || !next?.canonicalId) continue;
      addEdge(
        result,
        current.canonicalId,
        next.canonicalId,
        `next_in_session:${bucketTimestampGap(current.timestamp, next.timestamp)}`
      );
    }
  }
}

function buildSummary(
  events: SelectedEvent[],
  entities: IncludedEntity[],
  rules: IncludedRule[]
): CanonicalGraphSummary {
  return {
    eventTypes: unique(events.map((event) => event.eventType)).sort(),
    rules: unique(rules.map((rule) => rule.ruleLabel)).sort(),
    stages: unique(
      rules.flatMap((rule) =>
        rule.findings
          .map((finding) => finding.deterministic?.stage)
          .filter((stage): stage is NonNullable<typeof stage> => Boolean(stage))
      )
    ).sort(),
    techniques: unique(
      rules.flatMap((rule) =>
        rule.findings.flatMap((finding) =>
          finding.deterministic?.techniques?.map((technique) => normalizeTechniqueId(technique.id)) ?? []
        )
      )
    ).sort(),
    entityCounts: {
      users: entities.filter((entity) => entity.entityType === "user").length,
      ips: entities.filter((entity) => entity.entityType === "ip").length,
      services: entities.filter((entity) => entity.entityType === "service").length,
      sessions: entities.filter((entity) => entity.entityType === "session").length,
    },
  };
}

function digestCanonicalGraph(
  nodes: CanonicalGraphNode[],
  edges: CanonicalGraphEdge[],
  summary: CanonicalGraphSummary
): string {
  const value = JSON.stringify({
    schemaVersion: GRAPH_SIMILARITY_SCHEMA_VERSION,
    nodes,
    edges,
    summary,
  });
  return createHash("sha256").update(value).digest("hex");
}

function addEdge(
  edges: Map<string, CanonicalGraphEdge>,
  source: string,
  target: string,
  type: CanonicalGraphEdgeType
): void {
  const id = `${source}->${target}:${type}`;
  edges.set(id, { id, source, target, type });
}

function getEventId(node: IncidentGraphNode): string | undefined {
  const metadataEventId = getString(node.metadata?.eventId);
  if (metadataEventId) return metadataEventId;
  return node.id.startsWith("event:") ? node.id.slice("event:".length) : undefined;
}

function normalizeEventType(value: string): string {
  return KNOWN_EVENT_TYPES.has(value) ? value : "other";
}

function normalizeRuleId(value: string): string {
  return KNOWN_RULE_IDS.has(value) ? value : "other";
}

function normalizeTechniqueId(value: string): string {
  const normalized = value.trim().toUpperCase();
  return /^T\d{4}(?:\.\d{3})?$/.test(normalized) ? normalized : "other";
}

function bucketTimestampGap(left: string | undefined, right: string | undefined): GraphTimeGapBucket {
  const leftMs = left ? Date.parse(left) : Number.NaN;
  const rightMs = right ? Date.parse(right) : Number.NaN;
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return "long";
  return bucketGapMinutes(Math.max(0, rightMs - leftMs) / 60_000);
}

export function bucketGapMinutes(minutes: number): GraphTimeGapBucket {
  if (!Number.isFinite(minutes) || minutes > 30) return "long";
  if (minutes <= 1) return "immediate";
  if (minutes <= 5) return "short";
  return "medium";
}

function compareOptionalTimestamp(left: string | undefined, right: string | undefined): number {
  const leftMs = left ? Date.parse(left) : Number.NaN;
  const rightMs = right ? Date.parse(right) : Number.NaN;
  if (Number.isFinite(leftMs) && Number.isFinite(rightMs)) return leftMs - rightMs;
  if (Number.isFinite(leftMs)) return -1;
  if (Number.isFinite(rightMs)) return 1;
  return 0;
}

function compareNodes(left: CanonicalGraphNode, right: CanonicalGraphNode): number {
  return left.id.localeCompare(right.id) || left.label.localeCompare(right.label);
}

function compareEdges(left: CanonicalGraphEdge, right: CanonicalGraphEdge): number {
  return left.id.localeCompare(right.id);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function pad(index: number): string {
  return String(index).padStart(4, "0");
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Canonical graph invariant violated");
  return value;
}

import { createHash } from "node:crypto";
import {
  GRAPH_SIMILARITY_ALGORITHM_VERSION,
  GRAPH_SIMILARITY_ITERATIONS,
  GRAPH_SIMILARITY_SCHEMA_VERSION,
  type CanonicalIncidentGraph,
  type IncidentGraphFingerprint,
} from "../../types/graphSimilarity.ts";

export function buildWlFingerprint(graph: CanonicalIncidentGraph): IncidentGraphFingerprint {
  const incoming = new Map<string, Array<{ edgeType: string; nodeId: string }>>();
  const outgoing = new Map<string, Array<{ edgeType: string; nodeId: string }>>();
  for (const edge of graph.edges) {
    const incomingEdges = incoming.get(edge.target) ?? [];
    incomingEdges.push({ edgeType: edge.type, nodeId: edge.source });
    incoming.set(edge.target, incomingEdges);
    const outgoingEdges = outgoing.get(edge.source) ?? [];
    outgoingEdges.push({ edgeType: edge.type, nodeId: edge.target });
    outgoing.set(edge.source, outgoingEdges);
  }

  let labels = new Map(graph.nodes.map((node) => [node.id, node.label] as const));
  const histograms = [toHistogram(labels.values())];

  for (let iteration = 0; iteration < GRAPH_SIMILARITY_ITERATIONS; iteration++) {
    const nextLabels = new Map<string, string>();
    for (const node of graph.nodes) {
      const tokens = [
        ...(incoming.get(node.id) ?? []).map((neighbor) => neighborToken("in", neighbor, labels)),
        ...(outgoing.get(node.id) ?? []).map((neighbor) => neighborToken("out", neighbor, labels)),
      ].sort();
      nextLabels.set(node.id, hash(`${labels.get(node.id) ?? node.label}|${tokens.join("|")}`));
    }
    labels = nextLabels;
    histograms.push(toHistogram(labels.values()));
  }

  return {
    schemaVersion: GRAPH_SIMILARITY_SCHEMA_VERSION,
    algorithmVersion: GRAPH_SIMILARITY_ALGORITHM_VERSION,
    iterations: GRAPH_SIMILARITY_ITERATIONS,
    sourceDigest: graph.sourceDigest,
    histograms,
    summary: graph.summary,
  };
}

function neighborToken(
  direction: "in" | "out",
  neighbor: { edgeType: string; nodeId: string },
  labels: Map<string, string>
): string {
  return `${direction}:${neighbor.edgeType}:${labels.get(neighbor.nodeId) ?? "missing"}`;
}

function toHistogram(values: Iterable<string>): Record<string, number> {
  const histogram: Record<string, number> = {};
  for (const value of values) histogram[value] = (histogram[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(histogram).sort(([left], [right]) => left.localeCompare(right)));
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

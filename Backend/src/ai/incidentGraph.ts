import type { SecurityEvent } from "../types/events.ts";
import type {
  IncidentGraph,
  IncidentGraphEdge,
  IncidentGraphNode,
} from "../types/investigations.ts";

export function buildIncidentGraph(events: SecurityEvent[]): IncidentGraph {
  const nodes = new Map<string, IncidentGraphNode>();
  const edges = new Map<string, IncidentGraphEdge>();

  for (const event of events) {
    const eventNodeId = `event:${event.id}`;
    const userNodeId = `user:${event.user}`;
    const ipNodeId = `ip:${event.ip}`;
    const serviceNodeId = `service:${event.service}`;

    addNode(nodes, {
      id: eventNodeId,
      type: "event",
      label: event.event,
      metadata: {
        eventId: event.id,
        timestamp: event.timestamp,
        metadata: event.metadata,
      },
    });
    addNode(nodes, { id: userNodeId, type: "user", label: event.user });
    addNode(nodes, { id: ipNodeId, type: "ip", label: event.ip });
    addNode(nodes, { id: serviceNodeId, type: "service", label: event.service });

    if (event.sessionId) {
      const sessionNodeId = `session:${event.sessionId}`;
      addNode(nodes, { id: sessionNodeId, type: "session", label: event.sessionId });
      addEdge(edges, sessionNodeId, eventNodeId, "contains", event);
    }

    addEdge(edges, userNodeId, eventNodeId, "performed", event);
    addEdge(edges, ipNodeId, eventNodeId, "originated", event);
    addEdge(edges, eventNodeId, serviceNodeId, "targeted", event);
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
  };
}

function addNode(nodes: Map<string, IncidentGraphNode>, node: IncidentGraphNode): void {
  if (!nodes.has(node.id)) {
    nodes.set(node.id, node);
  }
}

function addEdge(
  edges: Map<string, IncidentGraphEdge>,
  source: string,
  target: string,
  type: string,
  event: SecurityEvent
): void {
  const id = `${source}->${target}:${type}:${event.id}`;
  if (!edges.has(id)) {
    edges.set(id, {
      id,
      source,
      target,
      type,
      eventId: event.id,
      timestamp: event.timestamp,
      weight: 1,
    });
  }
}

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Alert, IncidentGraph, IncidentGraphNode, SimilarIncidentMatch } from "../../api/client";

const VIEWBOX_WIDTH = 1600;
const LANE_X: Record<IncidentGraphNode["type"], number> = {
  session: 150,
  user: 420,
  ip: 680,
  event: 1010,
  service: 1370,
};
const NODE_WIDTH: Record<IncidentGraphNode["type"], number> = {
  session: 190,
  user: 210,
  ip: 190,
  event: 240,
  service: 200,
};
const NODE_HEIGHT = 54;
const EDGE_TYPES = ["all", "contains", "performed", "originated", "targeted"] as const;
const TYPE_LABELS: Record<IncidentGraphNode["type"], string> = {
  session: "Sessions",
  user: "Identities",
  ip: "Sources",
  event: "Observed events",
  service: "Services",
};

type EdgeFilter = typeof EDGE_TYPES[number];

interface PositionedNode extends IncidentGraphNode {
  x: number;
  y: number;
}

interface IncidentGraphExplorerProps {
  graph: IncidentGraph;
  investigation: Pick<Alert, "id" | "attack" | "mitre" | "severity">;
  comparison?: {
    graph: IncidentGraph;
    investigation: Pick<Alert, "id" | "attack" | "mitre" | "severity">;
    match: SimilarIncidentMatch;
  };
  onClose: () => void;
}

export default function IncidentGraphExplorer({
  graph,
  investigation,
  comparison,
  onClose,
}: IncidentGraphExplorerProps) {
  const [comparisonSide, setComparisonSide] = useState<"current" | "matched">("current");
  const activeGraph = comparisonSide === "matched" && comparison ? comparison.graph : graph;
  const activeInvestigation = comparisonSide === "matched" && comparison ? comparison.investigation : investigation;
  const oppositeGraph = comparisonSide === "matched" ? graph : comparison?.graph;
  const layout = useMemo(() => buildLayout(activeGraph), [activeGraph]);
  const oppositeNodeSignatures = useMemo(
    () => new Set(oppositeGraph?.nodes.map(comparisonNodeSignature) ?? []),
    [oppositeGraph]
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [edgeFilter, setEdgeFilter] = useState<EdgeFilter>("all");
  const [zoom, setZoom] = useState(0.82);
  const [revealCount, setRevealCount] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  const selectedNode = layout.nodes.find((node) => node.id === selectedNodeId);
  const selectedEdges = selectedNodeId
    ? activeGraph.edges.filter((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId)
    : [];
  const connectedIds = useMemo(
    () => new Set(selectedEdges.flatMap((edge) => [edge.source, edge.target])),
    [selectedEdges]
  );
  const eventIndexById = useMemo(
    () => new Map(layout.eventNodes.map((node, index) => [node.id, index])),
    [layout.eventNodes]
  );

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    if (!playing || revealCount >= layout.eventNodes.length) {
      if (revealCount >= layout.eventNodes.length) setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setRevealCount((count) => count + 1), 180);
    return () => window.clearTimeout(timer);
  }, [layout.eventNodes.length, playing, revealCount]);

  const visibleEdges = activeGraph.edges.filter((edge) => {
    if (edgeFilter !== "all" && edge.type !== edgeFilter) return false;
    const eventIndex = edge.eventId ? eventIndexById.get(`event:${edge.eventId}`) : undefined;
    return eventIndex === undefined || eventIndex < revealCount;
  });
  const visibleNodeIds = new Set(visibleEdges.flatMap((edge) => [edge.source, edge.target]));
  for (const eventNode of layout.eventNodes.slice(0, revealCount)) visibleNodeIds.add(eventNode.id);

  function togglePlayback() {
    if (revealCount >= layout.eventNodes.length) setRevealCount(0);
    setPlaying((value) => !value);
  }

  function selectComparisonSide(side: "current" | "matched") {
    setSelectedNodeId(undefined);
    setRevealCount(0);
    setPlaying(true);
    setComparisonSide(side);
  }

  return createPortal(
    <div className={`graph-explorer-shell ${comparison ? "is-comparison" : ""}`} role="dialog" aria-modal="true" aria-label={comparison ? "Incident topology comparison" : "Incident topology"}>
      <header className="graph-explorer-header">
        <div className="graph-explorer-title">
          <span>{comparison ? "Cross-incident structural comparison" : "Raw provenance graph"} / {activeInvestigation.mitre}</span>
          <h2>{comparison ? "Topology comparison" : "Incident topology"}</h2>
          <p>{activeInvestigation.attack} · {activeGraph.nodes.length} nodes · {activeGraph.edges.length} directed relationships</p>
        </div>
        <div className="graph-explorer-header-actions">
          <button type="button" onClick={togglePlayback}>
            <ControlIcon name={playing ? "pause" : "play"} />
            {playing ? "Pause trace" : revealCount >= layout.eventNodes.length ? "Replay trace" : "Continue trace"}
          </button>
          <button type="button" onClick={onClose}>
            <ControlIcon name="close" />
            Close
          </button>
        </div>
      </header>

      {comparison ? (
        <div className="graph-comparison-band">
          <div className="graph-comparison-score">
            <span>{comparison.match.relation} structural match</span>
            <strong>{Math.round(comparison.match.similarity * 100)}%</strong>
          </div>
          <div className="graph-comparison-breakdown">
            <span>Semantics <strong>{Math.round(comparison.match.scoreBreakdown.semantic * 100)}%</strong></span>
            <span>Local shape <strong>{Math.round(comparison.match.scoreBreakdown.localStructure * 100)}%</strong></span>
            <span>Progression <strong>{Math.round(comparison.match.scoreBreakdown.extendedStructure * 100)}%</strong></span>
          </div>
          <div className="graph-comparison-switch" aria-label="Compared investigation">
            <button className={comparisonSide === "current" ? "is-active" : ""} onClick={() => selectComparisonSide("current")} type="button">
              Current / {investigation.id.slice(0, 8)}
            </button>
            <button className={comparisonSide === "matched" ? "is-active" : ""} onClick={() => selectComparisonSide("matched")} type="button">
              Matched / {comparison.investigation.id.slice(0, 8)}
            </button>
          </div>
        </div>
      ) : null}

      <div className="graph-explorer-toolbar">
        <div className="graph-filter-group" aria-label="Relationship filter">
          {EDGE_TYPES.map((type) => (
            <button
              className={edgeFilter === type ? "is-active" : ""}
              key={type}
              onClick={() => setEdgeFilter(type)}
              type="button"
            >
              {type}
              <span>{type === "all" ? activeGraph.edges.length : activeGraph.edges.filter((edge) => edge.type === type).length}</span>
            </button>
          ))}
        </div>
        <div className="graph-view-controls">
          <button type="button" onClick={() => setShowLabels((value) => !value)}>
            {showLabels ? "Hide edge labels" : "Show edge labels"}
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.55, value - 0.1))}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.4, value + 0.1))}>+</button>
          <button type="button" onClick={() => setZoom(0.82)}>Fit</button>
        </div>
      </div>

      <div className="graph-explorer-body">
        <div className="graph-stage">
          <div className="graph-stage-scroll">
            <svg
              className="incident-node-graph"
              style={{ width: `${zoom * 100}%` }}
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${layout.height}`}
              role="img"
              aria-label="Directed raw incident node graph"
            >
              <defs>
                <marker id="graph-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" />
                </marker>
                <linearGradient id="graph-edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#54545b" />
                  <stop offset="55%" stopColor="#c9c9cf" />
                  <stop offset="100%" stopColor="#777780" />
                </linearGradient>
                <pattern id="graph-grid" width="36" height="36" patternUnits="userSpaceOnUse">
                  <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#242429" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={VIEWBOX_WIDTH} height={layout.height} fill="url(#graph-grid)" />
              {Object.entries(TYPE_LABELS).map(([type, label]) => (
                <g className="graph-lane-label" key={type}>
                  <line x1={LANE_X[type as IncidentGraphNode["type"]]} y1="58" x2={LANE_X[type as IncidentGraphNode["type"]]} y2={layout.height - 40} />
                  <text x={LANE_X[type as IncidentGraphNode["type"]]} y="35">{label}</text>
                </g>
              ))}
              <g className="graph-edges">
                {visibleEdges.map((edge, index) => {
                  const source = layout.nodeById.get(edge.source);
                  const target = layout.nodeById.get(edge.target);
                  if (!source || !target) return null;
                  const active = Boolean(selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId));
                  const muted = Boolean(selectedNodeId && !active);
                  return (
                    <g className={`graph-edge graph-edge-${edge.type} ${active ? "is-active" : ""} ${muted ? "is-muted" : ""}`} key={edge.id}>
                      <path
                        d={edgePath(source, target)}
                        markerEnd="url(#graph-arrow)"
                        style={{ animationDelay: `${Math.min(index * 14, 500)}ms` }}
                      />
                      {showLabels && (active || zoom >= 0.9) ? (
                        <text>
                          <textPath href={`#${safeSvgId(edge.id)}`} startOffset="50%">{edge.type}</textPath>
                        </text>
                      ) : null}
                      <path id={safeSvgId(edge.id)} d={edgePath(source, target)} className="graph-edge-label-path" />
                    </g>
                  );
                })}
              </g>
              <g className="graph-nodes">
                {layout.nodes.map((node, index) => {
                  const visible = visibleNodeIds.has(node.id);
                  const active = selectedNodeId === node.id;
                  const muted = Boolean(selectedNodeId && !active && !connectedIds.has(node.id));
                  const shared = Boolean(comparison && oppositeNodeSignatures.has(comparisonNodeSignature(node)));
                  return (
                    <g
                      className={`graph-node graph-node-${node.type} ${visible ? "is-visible" : ""} ${active ? "is-active" : ""} ${muted ? "is-muted" : ""} ${shared ? "is-comparison-shared" : comparison ? "is-comparison-unique" : ""}`}
                      key={node.id}
                      onClick={() => setSelectedNodeId(active ? undefined : node.id)}
                      role="button"
                      style={{ transitionDelay: `${Math.min(index * 16, 360)}ms` }}
                      tabIndex={0}
                    >
                      <rect
                        x={node.x - NODE_WIDTH[node.type] / 2}
                        y={node.y - NODE_HEIGHT / 2}
                        width={NODE_WIDTH[node.type]}
                        height={NODE_HEIGHT}
                        rx="3"
                      />
                      <circle cx={node.x - NODE_WIDTH[node.type] / 2 + 17} cy={node.y} r="4" />
                      <text className="graph-node-type" x={node.x - NODE_WIDTH[node.type] / 2 + 30} y={node.y - 7}>{node.type}</text>
                      <text className="graph-node-label" x={node.x - NODE_WIDTH[node.type] / 2 + 30} y={node.y + 13}>{truncate(node.label, node.type === "event" ? 27 : 23)}</text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
          <div className="graph-trace-progress">
            <span style={{ width: `${layout.eventNodes.length ? (revealCount / layout.eventNodes.length) * 100 : 100}%` }} />
          </div>
        </div>

        <aside className="graph-inspector">
          <div className="graph-inspector-status">
            <span className={`severity-text-${activeInvestigation.severity}`}>{activeInvestigation.severity}</span>
            <strong>{selectedNode ? "Node selected" : comparison ? "Similarity context" : "Trace overview"}</strong>
          </div>
          {selectedNode ? (
            <>
              <div className="graph-inspector-node">
                <span>{selectedNode.type}</span>
                <h3>{selectedNode.label}</h3>
                <code>{selectedNode.id}</code>
              </div>
              <div className="graph-inspector-section">
                <span>Connected relationships</span>
                {selectedEdges.map((edge) => (
                  <button key={edge.id} type="button" onClick={() => setSelectedNodeId(edge.source === selectedNode.id ? edge.target : edge.source)}>
                    <strong>{edge.type}</strong>
                    <small>{labelForNode(layout.nodeById.get(edge.source === selectedNode.id ? edge.target : edge.source))}</small>
                  </button>
                ))}
              </div>
              {selectedNode.metadata ? (
                <div className="graph-inspector-section">
                  <span>Raw metadata</span>
                  <pre>{JSON.stringify(selectedNode.metadata, null, 2)}</pre>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <p className="graph-inspector-copy">
                This is the persisted provenance graph. Every line is derived from raw telemetry; no similarity or LLM inference creates these links.
              </p>
              <div className="graph-inspector-counts">
                {Object.entries(TYPE_LABELS).map(([type, label]) => (
                  <div key={type}>
                    <span>{label}</span>
                    <strong>{activeGraph.nodes.filter((node) => node.type === type).length}</strong>
                  </div>
                ))}
              </div>
              {comparison ? <ComparisonInspector match={comparison.match} /> : null}
              <div className="graph-inspector-section graph-legend">
                <span>Relationship grammar</span>
                <p><i className="edge-key edge-key-contains" /> Session contains event</p>
                <p><i className="edge-key edge-key-performed" /> Identity performed event</p>
                <p><i className="edge-key edge-key-originated" /> Source originated event</p>
                <p><i className="edge-key edge-key-targeted" /> Event targeted service</p>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>,
    document.body
  );
}

function ComparisonInspector({ match }: { match: SimilarIncidentMatch }) {
  const shared = [
    ...match.sharedSignals.stages,
    ...match.sharedSignals.techniques,
    ...match.sharedSignals.eventTypes,
  ];
  const different = [
    ...match.differentSignals.stages,
    ...match.differentSignals.eventTypes,
  ];
  return (
    <div className="graph-inspector-section graph-comparison-inspector">
      <span>Structural comparison</span>
      <p><i className="comparison-key is-shared" /> Shared raw event semantics are outlined brightly.</p>
      <p><i className="comparison-key is-unique" /> Incident-specific raw nodes remain dimmed.</p>
      <strong>Shared signals</strong>
      <small>{shared.length ? shared.slice(0, 8).map(humanizeGraphSignal).join(" / ") : "None"}</small>
      <strong>Important differences</strong>
      <small>{different.length ? different.slice(0, 8).map(humanizeGraphSignal).join(" / ") : "None"}</small>
      <em>Similarity indicates structural resemblance, not common attribution.</em>
    </div>
  );
}

function buildLayout(graph: IncidentGraph) {
  const nodes = graph.nodes.map((node) => ({ ...node, x: LANE_X[node.type], y: 0 }));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const eventNodes = nodes
    .filter((node) => node.type === "event")
    .sort((left, right) => timestampForNode(left).localeCompare(timestampForNode(right)) || left.id.localeCompare(right.id));
  const rowGap = eventNodes.length > 18 ? 72 : 86;
  eventNodes.forEach((node, index) => { node.y = 105 + index * rowGap; });

  for (const type of ["session", "user", "ip", "service"] as const) {
    const laneNodes = nodes.filter((node) => node.type === type);
    for (const node of laneNodes) {
      const connectedEventY = graph.edges.flatMap((edge) => {
        if (edge.source !== node.id && edge.target !== node.id) return [];
        const other = nodeById.get(edge.source === node.id ? edge.target : edge.source);
        return other?.type === "event" ? [other.y] : [];
      });
      node.y = connectedEventY.length
        ? connectedEventY.reduce((total, value) => total + value, 0) / connectedEventY.length
        : 105;
    }
    spreadLane(laneNodes);
  }
  const height = Math.max(760, 190 + Math.max(0, eventNodes.length - 1) * rowGap);
  return { nodes, eventNodes, nodeById, height };
}

function spreadLane(nodes: PositionedNode[]) {
  const sorted = [...nodes].sort((left, right) => left.y - right.y || left.id.localeCompare(right.id));
  const minimumGap = 68;
  for (let index = 1; index < sorted.length; index++) {
    sorted[index]!.y = Math.max(sorted[index]!.y, sorted[index - 1]!.y + minimumGap);
  }
}

function edgePath(source: PositionedNode, target: PositionedNode): string {
  const sourceWidth = NODE_WIDTH[source.type];
  const targetWidth = NODE_WIDTH[target.type];
  const direction = target.x >= source.x ? 1 : -1;
  const startX = source.x + direction * sourceWidth / 2;
  const endX = target.x - direction * targetWidth / 2;
  const curvature = Math.max(55, Math.abs(endX - startX) * 0.42);
  return `M ${startX} ${source.y} C ${startX + direction * curvature} ${source.y}, ${endX - direction * curvature} ${target.y}, ${endX} ${target.y}`;
}

function timestampForNode(node: IncidentGraphNode): string {
  return typeof node.metadata?.timestamp === "string" ? node.metadata.timestamp : "";
}

function comparisonNodeSignature(node: IncidentGraphNode): string {
  return `${node.type}:${node.label.toLowerCase()}`;
}

function humanizeGraphSignal(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function safeSvgId(value: string): string {
  return `edge-${value.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function labelForNode(node?: IncidentGraphNode): string {
  return node ? `${node.type} / ${node.label}` : "Unknown node";
}

function ControlIcon({ name }: { name: "play" | "pause" | "close" }) {
  if (name === "play") return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.8 13 8l-9 5.2Z" /></svg>;
  if (name === "pause") return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zm5 0h3v10H9z" /></svg>;
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 3.5 9 9m0-9-9 9" /></svg>;
}

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  regenerateInvestigationReport,
  getAlertById,
  getSimilarIncidents,
  type Alert,
  type SecurityEvent,
  type SimilarIncidentMatch,
  type SimilarIncidentsResponse,
  type UebaSessionScore,
} from "../../api/client";
import { SocChatDrawer } from "./SocChatDrawer";

const IncidentGraphExplorer = lazy(() => import("./IncidentGraphExplorer"));

interface InvestigationWorkspaceProps {
  investigation: Alert | null;
  events: SecurityEvent[];
  loading: boolean;
  onRefresh: () => void;
  onOpenInvestigation?: (id: string) => void;
}

export function InvestigationWorkspace({
  investigation,
  events,
  loading,
  onRefresh,
  onOpenInvestigation,
}: InvestigationWorkspaceProps) {
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const [regenerating, setRegenerating] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [graphComparison, setGraphComparison] = useState<{ investigation: Alert; match: SimilarIncidentMatch }>();
  const [comparingId, setComparingId] = useState<string>();
  const [comparisonError, setComparisonError] = useState<string>();

  const relatedEvents = useMemo(() => {
    if (!investigation) return [];
    const relatedIds = new Set(investigation.relatedEventIds ?? []);
    const matching = events.filter((event) => relatedIds.has(event.id));
    return matching.length ? matching : events.slice(0, Math.max(investigation.eventCount, 12));
  }, [events, investigation]);

  useEffect(() => {
    setSelectedEventId(undefined);
    setGraphOpen(false);
    setGraphComparison(undefined);
    setComparisonError(undefined);
  }, [investigation?.id]);

  if (!investigation) {
    return <main className="investigation-empty">{loading ? "Loading case files..." : "Select an investigation to begin."}</main>;
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      await regenerateInvestigationReport(investigation!.id);
      onRefresh();
    } finally {
      setRegenerating(false);
    }
  }

  async function compareTopology(match: SimilarIncidentMatch) {
    setComparingId(match.investigationId);
    setComparisonError(undefined);
    try {
      const candidate = await getAlertById(match.investigationId);
      if (!candidate.graph) throw new Error("The matched investigation has no persisted provenance graph.");
      setGraphComparison({ investigation: candidate, match });
      setGraphOpen(true);
    } catch (reason) {
      setComparisonError((reason as Error).message);
    } finally {
      setComparingId(undefined);
    }
  }

  const selectedEvidence = investigation.evidence?.filter((item) =>
    selectedEventId ? item.eventIds.includes(selectedEventId) : true
  );

  return (
    <main className="investigation-workspace">
      <header className="case-header">
        <div>
          <div className="case-breadcrumb">Cases / {investigation.id.slice(0, 12)}</div>
          <h1>{investigation.attack}</h1>
          <div className="case-facts">
            <span>Status: {investigation.status ?? "open"}</span>
            <span>Severity: <strong className={`severity-text-${investigation.severity}`}>{investigation.severity}</strong></span>
            <span>MITRE: {investigation.mitre}</span>
            <span>Confidence: {investigation.confidence}%</span>
          </div>
        </div>
        <div className="case-header-actions">
          <button className="secondary-action" onClick={onRefresh} type="button">Refresh case</button>
          {investigation.graph?.nodes.length ? (
            <button className="graph-open-action" onClick={() => setGraphOpen(true)} type="button">
              <span>View topology</span>
              <small>{investigation.graph.nodes.length}N / {investigation.graph.edges.length}E</small>
            </button>
          ) : null}
          {investigation.source === "investigation" ? (
            <button className="secondary-action" onClick={regenerate} disabled={regenerating} type="button">
              {regenerating ? "Queued..." : "Regenerate report"}
            </button>
          ) : null}
        </div>
      </header>

      <section className="workspace-columns">
        <div className="workspace-column workspace-column-primary">
          <TelemetryPanel events={relatedEvents} selectedEventId={selectedEventId} onSelect={setSelectedEventId} />
          <InterpretationReport investigation={investigation} />
        </div>
        <div className="workspace-column workspace-column-secondary">
          <EvidencePanel investigation={investigation} evidence={selectedEvidence ?? []} selectedEventId={selectedEventId} />
          <UebaPanel investigation={investigation} />
          {investigation.source === "investigation" ? (
            <SimilarIncidentsPanel
              investigation={investigation}
              onCompare={compareTopology}
              onOpen={onOpenInvestigation}
              comparingId={comparingId}
              comparisonError={comparisonError}
            />
          ) : null}
        </div>
      </section>

      <SocChatDrawer investigation={investigation} />
      {graphOpen && investigation.graph ? (
        <Suspense fallback={<div className="graph-explorer-loading">Preparing incident topology...</div>}>
          <IncidentGraphExplorer
            graph={investigation.graph}
            investigation={investigation}
            comparison={graphComparison ? {
              graph: graphComparison.investigation.graph!,
              investigation: graphComparison.investigation,
              match: graphComparison.match,
            } : undefined}
            onClose={() => {
              setGraphOpen(false);
              setGraphComparison(undefined);
            }}
          />
        </Suspense>
      ) : null}
    </main>
  );
}

function SimilarIncidentsPanel({
  investigation,
  onCompare,
  onOpen,
  comparingId,
  comparisonError,
}: {
  investigation: Alert;
  onCompare: (match: SimilarIncidentMatch) => void;
  onOpen?: (id: string) => void;
  comparingId?: string;
  comparisonError?: string;
}) {
  const [result, setResult] = useState<SimilarIncidentsResponse>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setResult(undefined);
    setError(undefined);
    getSimilarIncidents(investigation.id)
      .then((value) => active && setResult(value))
      .catch((reason) => active && setError((reason as Error).message));
    return () => { active = false; };
  }, [investigation.id]);

  return (
    <section className="work-panel resizable-panel similarity-panel">
      <div className="section-heading">
        <div><span className="section-index">06</span><h2>Similar incidents</h2></div>
        <span className="quiet-count">{result?.matches.length ?? 0} structural matches</span>
      </div>
      {!result && !error ? <p className="quiet-state">Comparing attack structure...</p> : null}
      {error || result?.unavailable ? (
        <p className="quiet-state">Structural comparison is currently unavailable.</p>
      ) : null}
      {result && result.matches.length === 0 ? (
        <p className="quiet-state">No earlier incident crosses the related-pattern threshold.</p>
      ) : null}
      {comparisonError ? <p className="comparison-error">{comparisonError}</p> : null}
      <div className="similarity-list">
        {result?.matches.map((match) => (
          <article
            className="similarity-match"
            key={match.investigationId}
          >
            <button className="similarity-match-open" onClick={() => onOpen?.(match.investigationId)} type="button">
              <div className="similarity-match-head">
                <div>
                  <span>{match.relation} structural match</span>
                  <strong>{match.title ?? match.investigationId}</strong>
                </div>
                <b>{Math.round(match.similarity * 100)}%</b>
              </div>
              <div className="similarity-score-breakdown">
                <span>Semantics {Math.round(match.scoreBreakdown.semantic * 100)}%</span>
                <span>Local shape {Math.round(match.scoreBreakdown.localStructure * 100)}%</span>
                <span>Progression {Math.round(match.scoreBreakdown.extendedStructure * 100)}%</span>
              </div>
              <SignalRow label="Shared stages" values={match.sharedSignals.stages} />
              <SignalRow label="Shared techniques" values={match.sharedSignals.techniques} />
              <SignalRow label="Important differences" values={[
                ...match.differentSignals.stages,
                ...match.differentSignals.eventTypes,
              ]} />
              <div className="similarity-meta">
                <span>{match.mode === "tenant_tfidf" ? "Tenant-weighted comparison" : "Bootstrap comparison"}</span>
                {match.createdAt ? <span>{new Date(match.createdAt).toLocaleDateString()}</span> : null}
              </div>
            </button>
            <div className="similarity-card-actions">
              <button onClick={() => onCompare(match)} disabled={comparingId === match.investigationId} type="button">
                {comparingId === match.investigationId ? "Loading comparison..." : "Compare topologies"}
              </button>
              <button onClick={() => onOpen?.(match.investigationId)} type="button">Open matched case</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SignalRow({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="similarity-signals">
      <span>{label}</span>
      <p>{values.length ? values.slice(0, 5).map(humanize).join(" / ") : "None"}</p>
    </div>
  );
}

function TelemetryPanel({
  events,
  selectedEventId,
  onSelect,
}: {
  events: SecurityEvent[];
  selectedEventId?: string;
  onSelect: (id?: string) => void;
}) {
  const selected = events.find((event) => event.id === selectedEventId);
  return (
    <section className="work-panel resizable-panel telemetry-panel">
      <div className="section-heading">
        <div><span className="section-index">02</span><h2>Raw telemetry</h2></div>
        <span className="quiet-count">{events.length} related events</span>
      </div>
      <div className="telemetry-table-wrap">
        <table className="telemetry-table">
          <thead><tr><th>Time</th><th>Event</th><th>User</th><th>IP</th><th>Service</th></tr></thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.id}
                className={selectedEventId === event.id ? "is-selected" : ""}
                onClick={() => onSelect(selectedEventId === event.id ? undefined : event.id)}
              >
                <td>{formatTime(event.timestamp)}</td>
                <td><span className="event-marker" />{event.event}</td>
                <td>{event.user ?? "-"}</td>
                <td>{event.ip ?? "-"}</td>
                <td>{event.service ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected ? (
        <div className="telemetry-inspector">
          <div><span>Event ID</span><code>{selected.id}</code></div>
          <div><span>Raw metadata</span><code>{JSON.stringify(selected.metadata ?? {})}</code></div>
        </div>
      ) : null}
    </section>
  );
}

function EvidencePanel({
  investigation,
  evidence,
  selectedEventId,
}: {
  investigation: Alert;
  evidence: NonNullable<Alert["evidence"]>;
  selectedEventId?: string;
}) {
  const score = investigation.deterministicScore;
  return (
    <section className="work-panel resizable-panel evidence-panel">
      <div className="section-heading">
        <div><span className="section-index">03</span><h2>Deterministic evidence</h2></div>
        <span className="quiet-count">{evidence.length} findings</span>
      </div>
      {score ? (
        <div className="deterministic-summary">
          <div><span>Deterministic score</span><strong>{Math.round(score.finalScore)}</strong></div>
          <div><span>Rule strength</span><strong>{Math.round(score.ruleStrength)}</strong></div>
          <div><span>Chain coherence</span><strong>{Math.round(score.chainCoherence)}</strong></div>
        </div>
      ) : null}
      {selectedEventId ? <div className="selection-note">Filtered by event {selectedEventId.slice(0, 12)}</div> : null}
      <div className="evidence-ledger">
        {evidence.length === 0 ? <p className="quiet-state">No deterministic evidence linked to this event.</p> : evidence.map((item, index) => (
          <article className="evidence-entry" key={item.id}>
            <div className="evidence-entry-top">
              <span>{String(index + 1).padStart(2, "0")} / {item.ruleId}</span>
              <strong>+{item.weight}</strong>
            </div>
            <p>{item.description}</p>
            <div className="evidence-refs">
              <span>{item.eventIds.length} supporting event{item.eventIds.length === 1 ? "" : "s"}</span>
              {item.deterministic?.stage ? <span>{humanize(item.deterministic.stage)}</span> : null}
            </div>
          </article>
        ))}
      </div>
      {investigation.deterministicChain?.length ? (
        <div className="chain-strip">
          <span>Observed progression</span>
          {investigation.deterministicChain.slice(0, 6).map((edge) => (
            <div key={`${edge.fromRuleId}-${edge.toRuleId}`}>
              <strong>{humanizeRule(edge.fromRuleId)}</strong>
              <span>then</span>
              <strong>{humanizeRule(edge.toRuleId)}</strong>
              <small>{formatMinutes(edge.minutesBetween)}</small>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function InterpretationReport({ investigation }: { investigation: Alert }) {
  const report = investigation.llmReport;
  return (
    <section className="work-panel resizable-panel report-panel">
      <div className="section-heading">
        <div><span className="section-index">04</span><h2>Interpretation report</h2></div>
        <span className={`report-status report-status-${investigation.llmReportStatus ?? "pending"}`}>
          {investigation.llmReportStatus ?? "not requested"}
        </span>
      </div>
      {!report ? (
        <div className="quiet-state report-empty">
          {investigation.llmReportError ?? "The deterministic case remains available while the interpretation report is prepared."}
        </div>
      ) : (
        <div className="report-content">
          <div className="report-summary"><h3>Executive summary</h3><p>{report.executiveSummary}</p></div>
          <div><h3>Likely incident</h3><p>{report.likelyIncident}</p></div>
          <div><h3>What likely happened</h3><ol>{report.whatLikelyHappened.map((item) => <li key={item}>{item}</li>)}</ol></div>
          <div><h3>Recommended actions</h3>{report.recommendedActions.map((item) => (
            <div className="report-action" key={`${item.priority}-${item.action}`}>
              <span>{item.priority}</span><p><strong>{item.action}</strong><br />{item.rationale}</p>
            </div>
          ))}</div>
          {report.uncertainty.length ? <div><h3>Uncertainty</h3><ul>{report.uncertainty.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
        </div>
      )}
    </section>
  );
}

function UebaPanel({ investigation }: { investigation: Alert }) {
  const summary = investigation.uebaSummary;
  const selected = summary?.sessionScores.find((score) => score.sessionId === summary.selectedSessionId) ?? summary?.sessionScores[0];
  return (
    <section className="work-panel resizable-panel ueba-panel">
      <div className="section-heading">
        <div><span className="section-index">05</span><h2>ML / UEBA analysis</h2></div>
        <span className="quiet-count">{summary?.modelVersion ?? "unavailable"}</span>
      </div>
      {!summary || summary.mlUnavailable ? (
        <p className="quiet-state">{summary?.error ?? "Behavioral scoring is unavailable."}</p>
      ) : (
        <>
          <div className="ueba-explanation">
            <strong>{behaviorVerdict(summary.behaviorScore)}</strong>
            <p>
              This session is compared with the identity's normal behavior. ML supports prioritization;
              deterministic evidence remains the reason this investigation exists.
            </p>
          </div>
          <div className="ueba-score-line">
            <span>Behavioral deviation</span><strong>{Math.round(summary.behaviorScore)}</strong><small>/ 100</small>
          </div>
          <div className="ueba-meter"><span style={{ width: `${Math.min(100, summary.behaviorScore)}%` }} /></div>
          <div className="detector-grid">
            {selected ? Object.entries(selected.detectorScores).map(([name, value]) => (
              <div key={name}>
                <span>{formatDetector(name)}</span>
                <strong>{Math.round(value * 100)}%</strong>
                <small>{detectorMeaning(name)}</small>
              </div>
            )) : null}
          </div>
          <TopReasons session={selected} />
        </>
      )}
    </section>
  );
}

function TopReasons({ session }: { session?: UebaSessionScore }) {
  if (!session?.topReasons.length) return null;
  return <div className="ueba-reasons"><h3>Top deviations</h3>{session.topReasons.slice(0, 4).map((reason) => (
    <div key={reason.feature}>
      <span>{humanize(reason.feature)}</span>
      <p>{reason.direction === "high" ? "Higher" : "Lower"} than normal: <strong>{formatFeatureValue(reason.value)}</strong> vs baseline {formatFeatureValue(reason.baseline)}</p>
    </div>
  ))}</div>;
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("en-GB", { hour12: false });
}

function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

function formatDetector(value: string) {
  return value === "isolationForest" ? "Isolation forest" : value.toUpperCase();
}

function detectorMeaning(value: string) {
  if (value === "isolationForest") return "Unusual combination";
  if (value === "ecod") return "Extreme feature values";
  return "Unusual feature tails";
}

function behaviorVerdict(score: number) {
  if (score >= 90) return "Strong behavioral anomaly";
  if (score >= 70) return "Material behavioral anomaly";
  if (score >= 40) return "Moderate behavioral deviation";
  return "Near expected behavior";
}

function humanizeRule(value: string) {
  return humanize(value.replace(/_\d+.*$/, ""));
}

function formatMinutes(value: number) {
  return value < 1 ? `${Math.max(1, Math.round(value * 60))} sec later` : `${value.toFixed(1)} min later`;
}

function formatFeatureValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

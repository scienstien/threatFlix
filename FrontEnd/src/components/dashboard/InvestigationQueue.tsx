import type { Alert } from "../../api/client";

interface InvestigationQueueProps {
  alerts: Alert[];
  selectedId?: string;
  loading: boolean;
  onSelect: (alert: Alert) => void;
  onResolve: (id: string) => void;
}

export function InvestigationQueue({
  alerts,
  selectedId,
  loading,
  onSelect,
  onResolve,
}: InvestigationQueueProps) {
  const activeAlerts = alerts.filter((alert) => alert.status !== "resolved");

  return (
    <aside className="case-queue">
      <div className="section-heading">
        <div>
          <span className="section-index">01</span>
          <h2>Investigation queue</h2>
        </div>
        <span className="quiet-count">{activeAlerts.length} open</span>
      </div>

      <div className="case-list">
        {loading ? (
          <div className="quiet-state">Loading investigations...</div>
        ) : activeAlerts.length === 0 ? (
          <div className="quiet-state">No active investigations.</div>
        ) : (
          activeAlerts.map((alert) => (
            <button
              className={`case-row${selectedId === alert.id ? " is-selected" : ""}`}
              key={alert.id}
              onClick={() => onSelect(alert)}
              type="button"
            >
              <span className={`severity-line severity-line-${alert.severity}`} />
              <span className="case-row-main">
                <span className="case-row-title">{alert.attack}</span>
                <span className="case-row-meta">
                  {alert.mitre} / {alert.eventCount} events / {formatAge(alert.timestamp)}
                </span>
              </span>
              <span className="case-row-confidence">{alert.confidence}%</span>
            </button>
          ))
        )}
      </div>

      {selectedId ? (
        <button className="text-action queue-resolve" onClick={() => onResolve(selectedId)} type="button">
          Mark selected investigation resolved
        </button>
      ) : null}
    </aside>
  );
}

function formatAge(timestamp: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

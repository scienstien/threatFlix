import { useCallback, useEffect, useState } from "react";
import {
  getAlertById,
  getAlerts,
  getLatestEvents,
  resolveAlert,
  type Alert,
  type SecurityEvent,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { InvestigationQueue } from "../components/dashboard/InvestigationQueue";
import { InvestigationWorkspace } from "../components/dashboard/InvestigationWorkspace";

export function DashboardPage() {
  const { auth } = useAuth();
  const projectId = auth?.projectId ?? "";
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [selected, setSelected] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (preferredId?: string) => {
    if (!projectId) return;
    setError(null);
    try {
      const [{ alerts: nextAlerts }, { events: nextEvents }] = await Promise.all([
        getAlerts(projectId),
        getLatestEvents(projectId),
      ]);
      setAlerts(nextAlerts);
      setEvents(nextEvents);
      const selectedId = preferredId ?? nextAlerts.find((alert) => alert.status !== "resolved")?.id;
      if (selectedId) {
        const detail = await getAlertById(selectedId);
        setSelected(detail);
      } else {
        setSelected(null);
      }
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function selectInvestigation(alert: Alert) {
    setSelected(alert);
    try {
      setSelected(await getAlertById(alert.id));
    } catch {
      // The queue snapshot remains useful if the detail request fails.
    }
  }

  async function openInvestigation(id: string) {
    try {
      setSelected(await getAlertById(id));
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function resolve(id: string) {
    await resolveAlert(id);
    const remaining = alerts.filter((alert) => alert.id !== id);
    setAlerts(remaining);
    setSelected(remaining.find((alert) => alert.status !== "resolved") ?? null);
  }

  return (
    <div className="case-layout">
      <InvestigationQueue
        alerts={alerts}
        selectedId={selected?.id}
        loading={loading}
        onSelect={selectInvestigation}
        onResolve={resolve}
      />
      <InvestigationWorkspace
        investigation={selected}
        events={events}
        loading={loading}
        onRefresh={() => load(selected?.id)}
        onOpenInvestigation={openInvestigation}
      />
      {error ? <div className="global-error">{error}</div> : null}
    </div>
  );
}

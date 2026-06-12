import { useCallback, useEffect, useRef, useState } from "react";
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
  const [notification, setNotification] = useState<Alert | null>(null);
  const knownAlertIds = useRef<Set<string>>(new Set());

  const load = useCallback(async (preferredId?: string, silent = false) => {
    if (!projectId) return;
    if (!silent) setError(null);
    try {
      const [{ alerts: nextAlerts }, { events: nextEvents }] = await Promise.all([
        getAlerts(projectId),
        getLatestEvents(projectId),
      ]);
      const newest = nextAlerts.find((alert) => !knownAlertIds.current.has(alert.id));
      if (knownAlertIds.current.size > 0 && newest) setNotification(newest);
      knownAlertIds.current = new Set(nextAlerts.map((alert) => alert.id));
      setAlerts(nextAlerts);
      setEvents(nextEvents);
      if (silent) {
        setError(null);
        return;
      }
      const selectedId = preferredId ?? nextAlerts.find((alert) => alert.status !== "resolved")?.id;
      if (selectedId) {
        const detail = await getAlertById(selectedId);
        setSelected(detail);
      } else {
        setSelected(null);
      }
      setError(null);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => load(undefined, true), 2_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => setNotification(null), 9_000);
    return () => window.clearTimeout(timer);
  }, [notification]);

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
      {notification ? (
        <button
          className={`investigation-notification severity-${notification.severity}`}
          onClick={() => {
            openInvestigation(notification.id);
            setNotification(null);
          }}
        >
          <span>New investigation</span>
          <strong>{notification.attack}</strong>
          <small>{notification.severity} · open in workspace</small>
        </button>
      ) : null}
      {error ? <div className="global-error">{error}</div> : null}
    </div>
  );
}

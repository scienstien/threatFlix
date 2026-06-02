// ---------------------------------------------------------------------------
// ThreatFlix — DashboardPage
// Main user dashboard assembling stats, alerts, event feed, and integrations.
// ---------------------------------------------------------------------------

import { useRef, useState, useEffect, useCallback } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useAuth } from "../context/AuthContext";
import { getAlerts, resolveAlert, type Alert } from "../api/client";
import { StatCards } from "../components/dashboard/StatCards";
import { AlertCard } from "../components/dashboard/AlertCard";
import { AlertDetailPanel } from "../components/dashboard/AlertDetailPanel";
import { EventFeed } from "../components/dashboard/EventFeed";
import { IntegrationPanel } from "../components/dashboard/IntegrationPanel";

export function DashboardPage() {
  const { auth } = useAuth();
  const projectId = auth?.projectId ?? "";
  const pageRef = useRef<HTMLDivElement>(null);
  const alertGridRef = useRef<HTMLDivElement>(null);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch alerts ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const { alerts: fetched } = await getAlerts(projectId);
        setAlerts(fetched || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  // ── Computed stats ────────────────────────────────────────────────────────

  const totalEvents = alerts.reduce((sum, a) => sum + a.eventCount, 0);
  const activeThreats = alerts.filter(
    (a) => a.status !== "resolved"
  ).length;
  const criticalAlerts = alerts.filter(
    (a) => a.severity === "critical"
  ).length;

  // ── Resolve handler ───────────────────────────────────────────────────────

  const handleResolve = useCallback(
    async (id: string) => {
      try {
        await resolveAlert(id);

        // Animate the card out then remove from state
        if (alertGridRef.current) {
          const cardEl = alertGridRef.current.querySelector(
            `[data-alert-id="${id}"]`
          );
          if (cardEl) {
            gsap.to(cardEl, {
              opacity: 0,
              scale: 0.9,
              y: -10,
              duration: 0.35,
              ease: "power2.in",
              onComplete: () => {
                setAlerts((prev) => prev.filter((a) => a.id !== id));
              },
            });
            return;
          }
        }
        // Fallback: just remove
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      } catch {
        // ignore
      }
    },
    []
  );

  // ── Section entrance stagger ──────────────────────────────────────────────

  useGSAP(
    () => {
      const sections = pageRef.current?.querySelectorAll(".dash-section");
      if (!sections?.length) return;

      gsap.from(sections, {
        y: 30,
        opacity: 0,
        duration: 0.5,
        stagger: 0.15,
        ease: "power2.out",
        clearProps: "all",
      });
    },
    { scope: pageRef, dependencies: [loading] }
  );

  return (
    <div
      ref={pageRef}
      style={{
        padding: "24px 28px",
        maxWidth: 1400,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      {/* ─── Stat Cards ──────────────────────────────────────────────── */}
      <section className="dash-section">
        <StatCards
          totalEvents={totalEvents}
          activeThreats={activeThreats}
          criticalAlerts={criticalAlerts}
        />
      </section>

      {/* ─── Main Content: Alerts + Event Feed ───────────────────────── */}
      <section
        className="dash-section"
        style={{ display: "flex", gap: 24, minHeight: 460 }}
      >
        {/* Left: Threat Alert Center (60%) */}
        <div style={{ flex: "0 0 60%", minWidth: 0 }}>
          <h2
            style={{
              fontFamily: "var(--font-primary)",
              fontWeight: 700,
              fontSize: "1.15rem",
              color: "var(--text-primary)",
              margin: "0 0 16px 0",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 4,
                height: 20,
                borderRadius: 2,
                backgroundColor: "var(--ember-hot)",
              }}
            />
            Threat Alert Center
          </h2>

          <div
            ref={alertGridRef}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {alerts
              .filter((a) => a.status !== "resolved")
              .map((alert) => (
                <div key={alert.id} data-alert-id={alert.id}>
                  <AlertCard
                    alert={alert}
                    onResolve={handleResolve}
                    onViewDetails={setSelectedAlert}
                  />
                </div>
              ))}

            {!loading && alerts.filter((a) => a.status !== "resolved").length === 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  padding: "48px 16px",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.85rem",
                }}
              >
                No active threats — all clear 🛡️
              </div>
            )}

            {loading && (
              <>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="skeleton"
                    style={{ height: 200, borderRadius: "var(--radius-lg)" }}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right: Event Feed (40%) */}
        <div style={{ flex: "0 0 38%", minWidth: 0 }}>
          <EventFeed />
        </div>
      </section>

      {/* ─── Integration Panel ───────────────────────────────────────── */}
      <section className="dash-section">
        <h2
          style={{
            fontFamily: "var(--font-primary)",
            fontWeight: 700,
            fontSize: "1.15rem",
            color: "var(--text-primary)",
            margin: "0 0 16px 0",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 4,
              height: 20,
              borderRadius: 2,
              backgroundColor: "var(--ember-warm)",
            }}
          />
          Integrations
        </h2>
        <IntegrationPanel />
      </section>

      {/* ─── Alert Detail Overlay ────────────────────────────────────── */}
      <AlertDetailPanel
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
      />
    </div>
  );
}

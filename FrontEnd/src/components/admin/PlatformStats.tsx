// ---------------------------------------------------------------------------
// ThreatFlix — Platform Stats (Admin)
// Fetches and displays platform-wide statistics with charts.
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useAuth } from "../../context/AuthContext";
import { getAdminStats, type PlatformStats as PlatformStatsType } from "../../api/client";
import { GlassCard } from "../ui/GlassCard";
import { SplitFlapCounter } from "../ui/SplitFlapCounter";
import { SeverityPieChart } from "../charts/SeverityPieChart";
import { ThreatBarChart } from "../charts/ThreatBarChart";

const MOCK_THREATS = [
  { attack: "Brute Force", count: 34 },
  { attack: "Lateral Movement", count: 18 },
  { attack: "Privilege Escalation", count: 12 },
  { attack: "Credential Stuffing", count: 28 },
  { attack: "Suspicious IP", count: 8 },
];

export function PlatformStats() {
  const { auth } = useAuth();
  const [stats, setStats] = useState<PlatformStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement[]>([]);

  // Fetch admin stats
  useEffect(() => {
    if (!auth) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getAdminStats()
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load stats");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [auth]);

  // Entrance stagger animation
  useGSAP(
    () => {
      if (loading || !sectionsRef.current.length) return;

      gsap.fromTo(
        sectionsRef.current.filter(Boolean),
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.12,
          ease: "power2.out",
        }
      );
    },
    { dependencies: [loading], scope: containerRef }
  );

  const addSectionRef = (el: HTMLDivElement | null, index: number) => {
    if (el) sectionsRef.current[index] = el;
  };

  if (loading) {
    return (
      <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Skeleton: counter row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <GlassCard key={i} level="light" className="p-6">
              <div
                className="skeleton"
                style={{ height: 48, width: "60%", margin: "0 auto 12px" }}
              />
              <div
                className="skeleton"
                style={{ height: 12, width: "40%", margin: "0 auto" }}
              />
            </GlassCard>
          ))}
        </div>
        {/* Skeleton: chart row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <GlassCard level="light" className="p-6">
            <div className="skeleton" style={{ height: 280, width: "100%" }} />
          </GlassCard>
          <GlassCard level="light" className="p-6">
            <div className="skeleton" style={{ height: 280, width: "100%" }} />
          </GlassCard>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard level="light" className="p-6">
        <div
          style={{
            textAlign: "center",
            color: "var(--severity-critical)",
            fontFamily: "var(--font-primary)",
          }}
        >
          <span style={{ fontSize: "1.2rem", fontWeight: 600 }}>
            Failed to load platform stats
          </span>
          <p style={{ color: "var(--text-secondary)", marginTop: 8, fontSize: "0.875rem" }}>
            {error}
          </p>
        </div>
      </GlassCard>
    );
  }

  if (!stats) return null;

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Counter cards row */}
      <div
        ref={(el) => addSectionRef(el, 0)}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          opacity: 0,
        }}
      >
        <GlassCard level="light" className="p-6">
          <SplitFlapCounter
            value={stats.totalEvents}
            label="Total Events Processed"
            accentColor="var(--ember-warm)"
          />
        </GlassCard>
        <GlassCard level="light" className="p-6">
          <SplitFlapCounter
            value={stats.totalTenants}
            label="Active Tenants"
            accentColor="var(--severity-info)"
          />
        </GlassCard>
        <GlassCard level="light" className="p-6">
          <SplitFlapCounter
            value={stats.totalAlerts}
            label="Total Alerts Generated"
            accentColor="var(--severity-critical)"
          />
        </GlassCard>
      </div>

      {/* Charts row */}
      <div
        ref={(el) => addSectionRef(el, 1)}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          opacity: 0,
        }}
      >
        <GlassCard level="light" className="p-5">
          <h3
            style={{
              fontFamily: "var(--font-primary)",
              fontWeight: 600,
              fontSize: "0.95rem",
              color: "var(--text-primary)",
              marginBottom: 12,
            }}
          >
            Severity Distribution
          </h3>
          <SeverityPieChart data={stats.severityDistribution || { critical: 0, high: 0, medium: 0, low: 0, info: 0 }} />
        </GlassCard>
        <GlassCard level="light" className="p-5">
          <h3
            style={{
              fontFamily: "var(--font-primary)",
              fontWeight: 600,
              fontSize: "0.95rem",
              color: "var(--text-primary)",
              marginBottom: 12,
            }}
          >
            Top Threat Types
          </h3>
          <ThreatBarChart alerts={MOCK_THREATS} />
        </GlassCard>
      </div>
    </div>
  );
}

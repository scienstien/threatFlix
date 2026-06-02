// ---------------------------------------------------------------------------
// ThreatFlix — AlertCard
// Single threat alert card with glitch-scan entrance and sonar pulse.
// ---------------------------------------------------------------------------

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { Alert } from "../../api/client";
import { MagneticCard } from "../ui/MagneticCard";

interface AlertCardProps {
  alert: Alert;
  onResolve: (id: string) => void;
  onViewDetails: (alert: Alert) => void;
}

const severityColors: Record<string, string> = {
  critical: "var(--severity-critical)",
  high: "var(--severity-high)",
  medium: "var(--severity-medium)",
  low: "var(--severity-low)",
  info: "var(--severity-info)",
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AlertCard({ alert, onResolve, onViewDetails }: AlertCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const severityColor = severityColors[alert.severity] || "var(--ember-ash)";
  const hasSonar = alert.severity === "critical" || alert.severity === "high";

  useGSAP(
    () => {
      const el = cardRef.current;
      if (!el) return;

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

      // 1. Start invisible with clipPath hiding from bottom
      tl.set(el, { opacity: 1, clipPath: "inset(0 0 100% 0)" });

      // 2. Reveal via clipPath
      tl.to(el, {
        clipPath: "inset(0 0 0% 0)",
        duration: 0.3,
      });

      // 3. Quick horizontal glitch shakes
      tl.to(el, {
        x: 4,
        duration: 0.025,
        repeat: 5,
        yoyo: true,
        ease: "none",
      });

      // 4. Settle
      tl.to(el, {
        x: 0,
        duration: 0.05,
        clearProps: "x,clipPath",
      });
    },
    { scope: cardRef }
  );

  return (
    <MagneticCard intensity={0.3}>
      <div
        ref={cardRef}
        style={{
          opacity: 0,
          borderTop: `3px solid ${severityColor}`,
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-surface)",
          padding: "20px",
          position: "relative",
          transition:
            "transform var(--transition-base), box-shadow var(--transition-base)",
          cursor: "default",
          willChange: "transform",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-6px)";
          e.currentTarget.style.boxShadow =
            "0 16px 48px rgba(0, 0, 0, 0.5), 0 0 24px rgba(255, 107, 53, 0.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Severity badge + Sonar */}
        <div className="flex items-center gap-2 mb-3" style={{ position: "relative" }}>
          <span className={`severity-badge severity-${alert.severity}`}>
            {alert.severity}
          </span>

          {hasSonar && (
            <div
              className={`sonar-pulse severity-${alert.severity}`}
              style={{
                position: "relative",
                top: 0,
                left: -8,
              }}
            />
          )}
        </div>

        {/* Title */}
        <h3
          style={{
            fontFamily: "var(--font-primary)",
            fontWeight: 600,
            fontSize: "1.1rem",
            color: "var(--text-primary)",
            margin: "0 0 8px 0",
            lineHeight: 1.3,
          }}
        >
          {alert.attack}
        </h3>

        {/* MITRE tag */}
        <span
          style={{
            display: "inline-block",
            fontFamily: "var(--font-mono)",
            fontSize: "0.7rem",
            fontWeight: 500,
            background: "var(--bg-hover)",
            color: "var(--text-secondary)",
            padding: "3px 10px",
            borderRadius: "6px",
            marginBottom: 8,
            letterSpacing: "0.03em",
          }}
        >
          {alert.mitre}
        </span>

        {/* Confidence */}
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.8rem",
            color: severityColor,
            margin: "6px 0",
            fontWeight: 500,
          }}
        >
          {alert.confidence}% confidence
        </p>

        {/* Event count + timestamp */}
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--text-muted)",
            margin: "4px 0 8px 0",
          }}
        >
          {alert.eventCount} event{alert.eventCount !== 1 ? "s" : ""} &middot;{" "}
          {formatTimestamp(alert.timestamp)}
        </p>

        {/* AI Reasoning */}
        <p
          className="line-clamp-2"
          style={{
            fontSize: "0.82rem",
            fontStyle: "italic",
            color: "var(--text-secondary)",
            margin: "0 0 16px 0",
            lineHeight: 1.5,
          }}
        >
          {alert.reasoning}
        </p>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => onViewDetails(alert)}
            style={{
              flex: 1,
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--ember-ash)",
              background: "transparent",
              color: "var(--ember-ash)",
              fontFamily: "var(--font-primary)",
              fontSize: "0.8rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all var(--transition-fast)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "rgba(196, 149, 106, 0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            View Details
          </button>
          <button
            onClick={() => onResolve(alert.id)}
            style={{
              flex: 1,
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--severity-low)",
              background: "transparent",
              color: "var(--severity-low)",
              fontFamily: "var(--font-primary)",
              fontSize: "0.8rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all var(--transition-fast)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "rgba(126, 184, 126, 0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Resolve
          </button>
        </div>
      </div>
    </MagneticCard>
  );
}

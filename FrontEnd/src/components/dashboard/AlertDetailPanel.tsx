// ---------------------------------------------------------------------------
// ThreatFlix — AlertDetailPanel
// Full-screen modal overlay with confidence gauge and typewriter reasoning.
// ---------------------------------------------------------------------------

import { useRef, useState, useEffect, useCallback } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { Alert } from "../../api/client";

interface AlertDetailPanelProps {
  alert: Alert | null;
  onClose: () => void;
}

const severityColors: Record<string, string> = {
  critical: "#ff4d4d",
  high: "#ff6b35",
  medium: "#e8943a",
  low: "#7eb87e",
  info: "#6b9dbd",
};

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AlertDetailPanel({ alert, onClose }: AlertDetailPanelProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);
  const reasoningRef = useRef<HTMLParagraphElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Track alert to animate in when a new alert arrives
  useEffect(() => {
    if (alert) {
      setIsVisible(true);
    }
  }, [alert]);

  const handleClose = useCallback(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        setIsVisible(false);
        onClose();
      },
    });
    tl.to(cardRef.current, {
      scale: 0.9,
      opacity: 0,
      duration: 0.25,
      ease: "power2.in",
    });
    tl.to(
      overlayRef.current,
      {
        opacity: 0,
        duration: 0.2,
        ease: "power2.in",
      },
      "<0.05"
    );
  }, [onClose]);

  // Entrance + confidence gauge + typewriter
  useGSAP(
    () => {
      if (!isVisible || !alert) return;

      const overlay = overlayRef.current;
      const card = cardRef.current;
      const arc = arcRef.current;
      const reasoningEl = reasoningRef.current;
      if (!overlay || !card) return;

      // Build entrance timeline
      const tl = gsap.timeline();
      tlRef.current = tl;

      // Overlay fade in
      tl.fromTo(
        overlay,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: "power2.out" }
      );

      // Card scale in
      tl.fromTo(
        card,
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(1.4)" },
        "<0.1"
      );

      // Confidence arc animation
      if (arc) {
        const radius = 54;
        const circumference = Math.PI * radius; // semi-circle
        const target = circumference * (1 - alert.confidence / 100);

        gsap.set(arc, { strokeDashoffset: circumference });
        tl.to(
          arc,
          {
            strokeDashoffset: target,
            duration: 1,
            ease: "power2.out",
          },
          "-=0.15"
        );
      }

      // Typewriter effect for reasoning
      if (reasoningEl && alert.reasoning) {
        const fullText = alert.reasoning;
        const duration = fullText.length / 40; // ~40 chars/sec
        const proxy = { length: 0 };

        reasoningEl.textContent = "";
        reasoningEl.classList.add("typewriter-cursor");

        tl.to(
          proxy,
          {
            length: fullText.length,
            duration: duration,
            ease: `steps(${fullText.length})`,
            onUpdate: () => {
              reasoningEl.textContent = fullText.slice(
                0,
                Math.round(proxy.length)
              );
            },
            onComplete: () => {
              reasoningEl.classList.remove("typewriter-cursor");
            },
          },
          "-=0.3"
        );
      }
    },
    { dependencies: [isVisible, alert], scope: overlayRef }
  );

  if (!isVisible || !alert) return null;

  const color = severityColors[alert.severity] || "#c4956a";
  const radius = 54;
  const circumference = Math.PI * radius;

  return (
    <div
      ref={overlayRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10, 8, 6, 0.75)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        opacity: 0,
      }}
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
    >
      <div
        ref={cardRef}
        className="glass-heavy glass-card"
        style={{
          width: "min(600px, 92vw)",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: "32px",
          position: "relative",
          opacity: 0,
        }}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "1px solid var(--glass-border)",
            background: "var(--bg-hover)",
            color: "var(--text-secondary)",
            fontSize: "1.1rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-primary)";
            e.currentTarget.style.borderColor = "var(--ember-ash)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-secondary)";
            e.currentTarget.style.borderColor = "var(--glass-border)";
          }}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Attack Name */}
        <h2
          style={{
            fontFamily: "var(--font-primary)",
            fontWeight: 700,
            fontSize: "1.5rem",
            color: "var(--text-primary)",
            margin: "0 0 12px 0",
            paddingRight: 40,
            lineHeight: 1.3,
          }}
        >
          {alert.attack}
        </h2>

        {/* Severity Badge (large) */}
        <span
          className={`severity-badge severity-${alert.severity}`}
          style={{ fontSize: "0.8rem", padding: "5px 16px", marginBottom: 20, display: "inline-flex" }}
        >
          {alert.severity}
        </span>

        {/* Confidence Gauge — SVG semi-circle arc */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            margin: "24px 0",
          }}
        >
          <svg
            width="140"
            height="80"
            viewBox="0 0 140 80"
            style={{ overflow: "visible" }}
          >
            {/* Background arc */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="var(--bg-hover)"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={0}
              strokeLinecap="round"
              transform="rotate(180, 70, 70)"
            />
            {/* Animated foreground arc */}
            <circle
              ref={arcRef}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={circumference}
              strokeLinecap="round"
              transform="rotate(180, 70, 70)"
            />
            {/* Percentage text */}
            <text
              x="70"
              y="60"
              textAnchor="middle"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "1.3rem",
                fontWeight: 600,
                fill: color,
              }}
            >
              {alert.confidence}%
            </text>
            <text
              x="70"
              y="76"
              textAnchor="middle"
              style={{
                fontFamily: "var(--font-primary)",
                fontSize: "0.6rem",
                fill: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              confidence
            </text>
          </svg>
        </div>

        {/* MITRE Tag */}
        <div style={{ marginBottom: 16 }}>
          <span className="text-label" style={{ display: "block", marginBottom: 6 }}>
            MITRE ATT&CK
          </span>
          <span
            style={{
              display: "inline-block",
              fontFamily: "var(--font-mono)",
              fontSize: "0.78rem",
              fontWeight: 500,
              background: "var(--bg-hover)",
              color: "var(--text-secondary)",
              padding: "5px 14px",
              borderRadius: "8px",
              letterSpacing: "0.03em",
            }}
          >
            {alert.mitre}
          </span>
        </div>

        {/* AI Reasoning — typewriter */}
        <div style={{ marginBottom: 16 }}>
          <span className="text-label" style={{ display: "block", marginBottom: 6 }}>
            AI Reasoning
          </span>
          <p
            ref={reasoningRef}
            style={{
              fontSize: "0.88rem",
              fontStyle: "italic",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              margin: 0,
              minHeight: "2.8em",
            }}
          >
            {alert.reasoning}
          </p>
        </div>

        {/* Recommendation */}
        <div style={{ marginBottom: 16 }}>
          <span className="text-label" style={{ display: "block", marginBottom: 6 }}>
            Recommendation
          </span>
          <p
            style={{
              fontSize: "0.88rem",
              color: "var(--text-primary)",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {alert.recommendation}
          </p>
        </div>

        {/* Footer row: event count + timestamp */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--glass-border)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.78rem",
              color: "var(--text-muted)",
            }}
          >
            {alert.eventCount} event{alert.eventCount !== 1 ? "s" : ""} analyzed
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.78rem",
              color: "var(--text-muted)",
            }}
          >
            {formatTimestamp(alert.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
}

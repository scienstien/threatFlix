// ---------------------------------------------------------------------------
// ThreatFlix — StatCards
// Row of 3 animated stat cards with split-flap counters and trend indicators.
// ---------------------------------------------------------------------------

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { GlassCard } from "../ui/GlassCard";
import { MagneticCard } from "../ui/MagneticCard";
import { SplitFlapCounter } from "../ui/SplitFlapCounter";

interface StatCardsProps {
  totalEvents: number;
  activeThreats: number;
  criticalAlerts: number;
}

interface StatConfig {
  value: number;
  label: string;
  accentColor: string;
  trend: string;
  prefix?: string;
}

export function StatCards({
  totalEvents,
  activeThreats,
  criticalAlerts,
}: StatCardsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const stats: StatConfig[] = [
    {
      value: totalEvents,
      label: "Total Events",
      accentColor: "var(--severity-low)",
      trend: "▲ +23% today",
    },
    {
      value: activeThreats,
      label: "Active Threats",
      accentColor: "var(--ember-warm)",
      trend: "▲ +8% today",
    },
    {
      value: criticalAlerts,
      label: "Critical Alerts",
      accentColor: "var(--ember-hot)",
      trend: "▼ -5% today",
    },
  ];

  useGSAP(
    () => {
      const cards = containerRef.current?.querySelectorAll(".stat-card-item");
      if (!cards?.length) return;

      gsap.from(cards, {
        y: -40,
        opacity: 0,
        duration: 0.5,
        stagger: 0.12,
        ease: "power2.out",
        clearProps: "all",
      });
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="flex flex-row gap-6 w-full">
      {stats.map((stat, i) => (
        <div key={i} className="stat-card-item flex-1 will-change-transform">
          <GlassCard level="medium" glow>
            <MagneticCard intensity={0.5}>
              <div className="flex items-start gap-4 p-5">
                {/* Left accent border */}
                <div
                  style={{
                    width: 4,
                    minHeight: 64,
                    borderRadius: 4,
                    backgroundColor: stat.accentColor,
                    flexShrink: 0,
                  }}
                />

                <div className="flex flex-col gap-1">
                  <SplitFlapCounter
                    value={stat.value}
                    label={stat.label}
                    accentColor={stat.accentColor}
                    prefix={stat.prefix}
                  />
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: stat.accentColor,
                      fontFamily: "var(--font-mono)",
                      fontWeight: 500,
                    }}
                  >
                    {stat.trend}
                  </span>
                </div>
              </div>
            </MagneticCard>
          </GlassCard>
        </div>
      ))}
    </div>
  );
}

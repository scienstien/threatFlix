// ---------------------------------------------------------------------------
// ThreatFlix — Threat Bar Chart
// Horizontal bar chart showing counts by attack type.
// ---------------------------------------------------------------------------

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { useState, useCallback } from "react";

interface ThreatBarChartProps {
  alerts: Array<{ attack: string; count: number }>;
}

/* ---- Custom tooltip ---- */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 14px",
        fontFamily: "'Outfit', system-ui, sans-serif",
        color: "var(--text-primary)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.8rem",
          color: "#e8943a",
        }}
      >
        {payload[0].value} alerts
      </div>
    </div>
  );
}

export function ThreatBarChart({ alerts }: ThreatBarChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const height = Math.max(alerts.length * 60 + 40, 160);

  const handleMouseEnter = useCallback((_: any, index: number) => {
    setActiveIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={alerts}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(196, 149, 106, 0.08)"
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{
            fill: "var(--text-secondary)",
            fontFamily: "'Outfit', system-ui, sans-serif",
            fontSize: "0.75rem",
          }}
          axisLine={{ stroke: "rgba(196, 149, 106, 0.1)" }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="attack"
          width={140}
          tick={{
            fill: "var(--text-secondary)",
            fontFamily: "'Outfit', system-ui, sans-serif",
            fontSize: "0.75rem",
          }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(196, 149, 106, 0.06)" }} />
        <Bar
          dataKey="count"
          radius={[0, 4, 4, 0]}
          animationBegin={300}
          animationDuration={1000}
          animationEasing="ease-out"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {alerts.map((_entry, index) => (
            <Cell
              key={`bar-${index}`}
              fill={activeIndex === index ? "#ff6b35" : "#e8943a"}
              style={{ transition: "fill 0.2s ease-out", outline: "none" }}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

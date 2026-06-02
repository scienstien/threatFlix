// ---------------------------------------------------------------------------
// ThreatFlix — Severity Pie Chart
// Recharts-based pie chart showing alert severity distribution.
// ---------------------------------------------------------------------------

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, Sector } from "recharts";
import { useState, useCallback } from "react";

interface SeverityPieChartProps {
  data: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

interface SeverityEntry {
  name: string;
  value: number;
  color: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "#ff4d4d",
  High: "#ff6b35",
  Medium: "#e8943a",
  Low: "#7eb87e",
  Info: "#6b9dbd",
};

function toChartData(data: SeverityPieChartProps["data"]): SeverityEntry[] {
  return [
    { name: "Critical", value: data.critical, color: SEVERITY_COLORS.Critical },
    { name: "High", value: data.high, color: SEVERITY_COLORS.High },
    { name: "Medium", value: data.medium, color: SEVERITY_COLORS.Medium },
    { name: "Low", value: data.low, color: SEVERITY_COLORS.Low },
    { name: "Info", value: data.info, color: SEVERITY_COLORS.Info },
  ].filter((entry) => entry.value > 0);
}

/* ---- Custom active shape with glow expansion ---- */
function renderActiveShape(props: any) {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
  } = props;

  return (
    <g>
      <defs>
        <filter id="pie-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        filter="url(#pie-glow)"
        style={{ opacity: 1 }}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ opacity: 0.3 }}
      />
    </g>
  );
}

/* ---- Custom tooltip ---- */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;

  const entry = payload[0];
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "4px",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: entry.payload.color,
            display: "inline-block",
          }}
        />
        <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
          {entry.name}
        </span>
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.8rem",
          color: "var(--text-secondary)",
        }}
      >
        {entry.value} alerts
      </div>
    </div>
  );
}

/* ---- Custom legend renderer ---- */
function CustomLegend({ payload }: any) {
  if (!payload) return null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "16px",
        flexWrap: "wrap",
        paddingTop: "8px",
      }}
    >
      {payload.map((entry: any, index: number) => (
        <div
          key={`legend-${index}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontFamily: "'Outfit', system-ui, sans-serif",
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: entry.color,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          {entry.value}
        </div>
      ))}
    </div>
  );
}

/* ---- Main component ---- */
export function SeverityPieChart({ data }: SeverityPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const chartData = toChartData(data);

  const onMouseEnter = useCallback((_: any, index: number) => {
    setActiveIndex(index);
  }, []);

  const onMouseLeave = useCallback(() => {
    setActiveIndex(undefined);
  }, []);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={95}
          paddingAngle={3}
          dataKey="value"
          nameKey="name"
          animationBegin={200}
          animationDuration={1200}
          animationEasing="ease-out"
          activeIndex={activeIndex}
          activeShape={renderActiveShape}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color}
              stroke="none"
              style={{ outline: "none" }}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} verticalAlign="bottom" />
      </PieChart>
    </ResponsiveContainer>
  );
}

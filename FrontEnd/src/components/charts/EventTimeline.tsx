// ---------------------------------------------------------------------------
// ThreatFlix — Event Timeline
// Stacked area chart showing event success/failure over time with brush zoom.
// ---------------------------------------------------------------------------

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Brush,
} from "recharts";

interface EventTimelineProps {
  events: Array<{
    time: string;
    count: number;
    failed: number;
    success: number;
  }>;
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
        padding: "12px 16px",
        fontFamily: "'Outfit', system-ui, sans-serif",
        color: "var(--text-primary)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        backdropFilter: "blur(12px)",
        minWidth: 140,
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: "0.8rem",
          marginBottom: 8,
          color: "var(--text-secondary)",
        }}
      >
        {label}
      </div>
      {payload.map((entry: any, index: number) => (
        <div
          key={index}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 2,
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: entry.color,
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: "0.8rem", textTransform: "capitalize" }}>
              {entry.dataKey}
            </span>
          </div>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.8rem",
              fontWeight: 600,
            }}
          >
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function EventTimeline({ events }: EventTimelineProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart
        data={events}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ff4d4d" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ff4d4d" stopOpacity={0.03} />
          </linearGradient>
          <linearGradient id="gradSuccess" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#7eb87e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#7eb87e" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(196, 149, 106, 0.08)"
          vertical={false}
        />
        <XAxis
          dataKey="time"
          tick={{
            fill: "var(--text-secondary)",
            fontFamily: "'Outfit', system-ui, sans-serif",
            fontSize: "0.7rem",
          }}
          axisLine={{ stroke: "rgba(196, 149, 106, 0.1)" }}
          tickLine={false}
        />
        <YAxis
          tick={{
            fill: "var(--text-secondary)",
            fontFamily: "'Outfit', system-ui, sans-serif",
            fontSize: "0.7rem",
          }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="failed"
          stackId="1"
          stroke="#ff4d4d"
          strokeWidth={1.5}
          fill="url(#gradFailed)"
          animationBegin={200}
          animationDuration={1200}
          animationEasing="ease-out"
        />
        <Area
          type="monotone"
          dataKey="success"
          stackId="1"
          stroke="#7eb87e"
          strokeWidth={1.5}
          fill="url(#gradSuccess)"
          animationBegin={400}
          animationDuration={1200}
          animationEasing="ease-out"
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#e8943a"
          strokeWidth={2}
          fill="none"
          strokeDasharray="4 4"
          animationBegin={600}
          animationDuration={1000}
          animationEasing="ease-out"
        />
        <Brush
          dataKey="time"
          height={24}
          stroke="rgba(196, 149, 106, 0.2)"
          fill="var(--bg-surface)"
          travellerWidth={8}
          tickFormatter={() => ""}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

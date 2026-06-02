// ---------------------------------------------------------------------------
// ThreatFlix — Confidence Gauge
// SVG semi-circular gauge showing AI confidence percentage with GSAP animation.
// ---------------------------------------------------------------------------

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

interface ConfidenceGaugeProps {
  value: number; // 0 – 100
  size?: number; // default 160
}

function getArcColor(value: number): string {
  if (value <= 40) return "#7eb87e"; // --severity-low
  if (value <= 70) return "#e8943a"; // --severity-medium
  return "#ff6b35"; // --severity-high
}

/**
 * Describes a semi-circular arc (180° from left to right) as an SVG path.
 * cx, cy = center; r = radius
 */
function describeArc(cx: number, cy: number, r: number): string {
  const startX = cx - r;
  const startY = cy;
  const endX = cx + r;
  const endY = cy;
  return `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`;
}

export function ConfidenceGauge({ value, size = 160 }: ConfidenceGaugeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const arcRef = useRef<SVGPathElement>(null);
  const textRef = useRef<SVGTextElement>(null);

  const cx = size / 2;
  const cy = size * 0.55;
  const radius = size * 0.38;
  const strokeWidth = size * 0.07;
  const arcPath = describeArc(cx, cy, radius);

  // Total semi-circle length = π * r
  const totalLength = Math.PI * radius;
  const targetOffset = totalLength * (1 - value / 100);
  const arcColor = getArcColor(value);

  useGSAP(
    () => {
      const arc = arcRef.current;
      const text = textRef.current;
      if (!arc || !text) return;

      // Set initial state
      gsap.set(arc, {
        attr: {
          "stroke-dasharray": totalLength,
          "stroke-dashoffset": totalLength,
          stroke: arcColor,
        },
      });

      // Animate dashoffset from full to target
      gsap.to(arc, {
        attr: { "stroke-dashoffset": targetOffset },
        duration: 1.6,
        ease: "power2.out",
        delay: 0.3,
      });

      // Animate the number counting up
      const obj = { val: 0 };
      gsap.to(obj, {
        val: value,
        duration: 1.6,
        ease: "power2.out",
        delay: 0.3,
        onUpdate: () => {
          text.textContent = `${Math.round(obj.val)}%`;
        },
      });
    },
    { dependencies: [value, totalLength, targetOffset, arcColor], scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: size,
      }}
    >
      <svg
        width={size}
        height={size * 0.65}
        viewBox={`0 0 ${size} ${size * 0.65}`}
        style={{ overflow: "visible" }}
      >
        {/* Background arc */}
        <path
          d={arcPath}
          fill="none"
          stroke="var(--bg-hover)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Animated foreground arc */}
        <path
          ref={arcRef}
          d={arcPath}
          fill="none"
          stroke={arcColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={totalLength}
          strokeDashoffset={totalLength}
          style={{ filter: `drop-shadow(0 0 6px ${arcColor}55)` }}
        />
        {/* Center text */}
        <text
          ref={textRef}
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontFamily: "'Outfit', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: size * 0.18,
            fill: "var(--text-primary)",
          }}
        >
          0%
        </text>
      </svg>
      <span
        className="text-label"
        style={{ marginTop: -4, fontSize: "0.7rem" }}
      >
        AI Confidence
      </span>
    </div>
  );
}

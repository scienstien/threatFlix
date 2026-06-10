// ---------------------------------------------------------------------------
// ThreatFlix — GlassCard
// Reusable glass-morphism card wrapper with optional ember glow on hover.
// ---------------------------------------------------------------------------

import type { ReactNode, CSSProperties } from "react";

interface GlassCardProps {
  level?: "light" | "medium" | "heavy";
  className?: string;
  children: ReactNode;
  glow?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
}

const glassClassMap = {
  light: "glass-light",
  medium: "glass-medium",
  heavy: "glass-heavy",
} as const;

export function GlassCard({
  level = "medium",
  className = "",
  children,
  glow = false,
  style,
  onClick,
}: GlassCardProps) {
  const glassClass = glassClassMap[level];

  return (
    <div
      className={`${glassClass} glass-card ${className}`}
      onClick={onClick}
      style={{
        transition: "border-color var(--transition-base)",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (glow) {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#55555c";
        }
      }}
      onMouseLeave={(e) => {
        if (glow) {
          (e.currentTarget as HTMLDivElement).style.borderColor =
            "var(--glass-border)";
        }
      }}
    >
      {children}
    </div>
  );
}

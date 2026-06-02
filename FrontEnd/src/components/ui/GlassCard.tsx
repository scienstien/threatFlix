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
        transition:
          "box-shadow var(--transition-base), transform var(--transition-base)",
        ...(glow
          ? { cursor: "pointer" }
          : {}),
        ...style,
      }}
      onMouseEnter={(e) => {
        if (glow) {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 var(--glass-shine), 0 0 30px rgba(255,107,53,0.15), 0 0 60px rgba(255,107,53,0.08)";
        }
      }}
      onMouseLeave={(e) => {
        if (glow) {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 var(--glass-shine)";
        }
      }}
    >
      {children}
    </div>
  );
}

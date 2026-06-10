import type { CSSProperties, ReactNode } from "react";

interface MagneticCardProps {
  className?: string;
  children: ReactNode;
  intensity?: number;
  style?: CSSProperties;
}

// Compatibility wrapper: existing auth call sites keep their behavior without decorative tilt.
export function MagneticCard({ className = "", children, style }: MagneticCardProps) {
  return <div className={className} style={style}>{children}</div>;
}

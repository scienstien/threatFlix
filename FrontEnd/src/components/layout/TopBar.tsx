import { useLocation } from "react-router-dom";

export function TopBar() {
  const location = useLocation();
  const label = location.pathname.startsWith("/admin") ? "Platform administration" : "Investigation desk";

  return (
    <header className="top-bar">
      <div><span>ThreatFlix</span><strong>{label}</strong></div>
      <div className="connection-state"><span />Telemetry connected</div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// ThreatFlix — AppShell
// Main authenticated layout: Sidebar + TopBar + routed content area.
// ---------------------------------------------------------------------------

import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  const { isAuthenticated } = useAuth();
  const demoEmbed =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("embedDemo") === "1";

  if (!isAuthenticated) {
    if (demoEmbed) {
      return <div className="demo-embed-loading">Connecting judge demo to ThreatFlix...</div>;
    }
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <TopBar />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

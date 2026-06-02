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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep)" }}>
      {/* Fixed sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div style={{ marginLeft: "240px" }}>
        {/* Sticky top bar */}
        <TopBar />

        {/* Page content */}
        <main
          style={{
            padding: "24px",
            minHeight: "calc(100vh - 64px)",
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

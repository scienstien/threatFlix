// ---------------------------------------------------------------------------
// ThreatFlix — TopBar
// Sticky top navigation with breadcrumb, live status, and user avatar.
// ---------------------------------------------------------------------------

import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/alerts": "Alerts",
  "/dashboard/events": "Events",
  "/dashboard/api-keys": "API Keys",
  "/dashboard/webhooks": "Webhooks",
  "/admin": "Admin",
  "/admin/stats": "Stats",
  "/admin/tenants": "Tenants",
};

export function TopBar() {
  const location = useLocation();
  const { auth } = useAuth();

  const currentLabel =
    routeLabels[location.pathname] || location.pathname.split("/").pop() || "Home";

  const avatarLetter = auth?.email ? auth.email.charAt(0).toUpperCase() : "?";

  return (
    <header
      className="glass-light"
      style={{
        position: "sticky",
        top: 0,
        left: "240px",
        right: 0,
        height: "64px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        zIndex: 40,
        borderBottom: "1px solid var(--glass-border)",
        marginLeft: "240px",
      }}
    >
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-2">
        <span
          style={{
            color: "var(--text-muted)",
            fontSize: "0.85rem",
            fontWeight: 400,
          }}
        >
          ThreatFlix
        </span>
        <span
          style={{
            color: "var(--text-muted)",
            fontSize: "0.75rem",
          }}
        >
          /
        </span>
        <span
          style={{
            color: "var(--text-primary)",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          {currentLabel}
        </span>
      </div>

      {/* Right: Status + Avatar */}
      <div className="flex items-center gap-6">
        {/* Live status */}
        <div className="flex items-center gap-2">
          <span
            className="pulse-dot"
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--severity-low)",
              display: "inline-block",
              boxShadow: "0 0 6px var(--severity-low)",
            }}
          />
          <span
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.8rem",
              fontWeight: 400,
            }}
          >
            Connected
          </span>
        </div>

        {/* User avatar */}
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "var(--bg-hover)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: "0.85rem",
            color: "var(--text-primary)",
            fontFamily: "var(--font-primary)",
            border: "1px solid var(--glass-border)",
          }}
          title={auth?.email || "User"}
        >
          {avatarLetter}
        </div>
      </div>
    </header>
  );
}

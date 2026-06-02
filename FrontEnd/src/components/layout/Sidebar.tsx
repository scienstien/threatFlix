// ---------------------------------------------------------------------------
// ThreatFlix — Sidebar
// Fixed left navigation with route-aware active states and role-based items.
// ---------------------------------------------------------------------------

import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const userNavItems: NavItem[] = [
  { path: "/dashboard", label: "Dashboard", icon: "🛡️" },
];

const adminNavItems: NavItem[] = [
  { path: "/admin", label: "Admin Portal", icon: "📊" },
];

export function Sidebar() {
  const { auth, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside
      className="glass-light"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "240px",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        zIndex: 50,
        borderRight: "1px solid var(--glass-border)",
      }}
    >
      {/* Wordmark */}
      <div
        style={{
          padding: "24px 20px 20px",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        <Link
          to="/"
          style={{
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "2px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-primary)",
              fontWeight: 800,
              fontSize: "1.5rem",
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            THREAT
          </span>
          <span
            style={{
              fontFamily: "var(--font-primary)",
              fontWeight: 800,
              fontSize: "1.5rem",
              background: "linear-gradient(to right, var(--ember-hot), var(--ember-warm))",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.02em",
            }}
          >
            FLIX
          </span>
          <span className="spark-dot" style={{ fontSize: "0.5rem", marginLeft: "2px" }}>
            ●
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        {/* User section */}
        {userNavItems.map((item) => (
          <NavLink key={item.path} item={item} active={isActive(item.path)} />
        ))}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div
              style={{
                height: "1px",
                background: "var(--glass-border)",
                margin: "12px 8px",
              }}
            />
            {adminNavItems.map((item) => (
              <NavLink key={item.path} item={item} active={isActive(item.path)} />
            ))}
          </>
        )}
      </nav>

      {/* Bottom: user info + logout */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: "1px solid var(--glass-border)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {auth?.email && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {auth.email}
          </span>
        )}
        <button
          onClick={handleLogout}
          style={{
            background: "transparent",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-secondary)",
            padding: "8px 16px",
            fontFamily: "var(--font-primary)",
            fontSize: "0.85rem",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all var(--transition-fast)",
            width: "100%",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.background = "var(--bg-hover)";
            el.style.color = "var(--text-primary)";
            el.style.borderColor = "var(--ember-ash)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.background = "transparent";
            el.style.color = "var(--text-secondary)";
            el.style.borderColor = "var(--glass-border)";
          }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}

/* Individual nav link item */
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.path}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 20px",
        borderRadius: "var(--radius-sm)",
        textDecoration: "none",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: active ? 600 : 400,
        fontSize: "0.9rem",
        position: "relative",
        background: active ? "var(--bg-hover)" : "transparent",
        transition: "all var(--transition-fast)",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLAnchorElement).style.background =
            "var(--bg-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLAnchorElement).style.background =
            "transparent";
        }
      }}
    >
      {/* Active indicator bar */}
      {active && (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: "3px",
            height: "60%",
            borderRadius: "0 3px 3px 0",
            background: "var(--ember-hot)",
            boxShadow: "0 0 8px var(--ember-hot), 0 0 16px rgba(255,107,53,0.3)",
          }}
        />
      )}
      <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

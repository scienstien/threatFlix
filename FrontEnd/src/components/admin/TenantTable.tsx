// ---------------------------------------------------------------------------
// ThreatFlix — Tenant Table (Admin)
// Displays all tenant projects in a styled table with GSAP row entrance.
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { getAdminProjects, type ProjectInfo } from "../../api/client";
import { GlassCard } from "../ui/GlassCard";

export function TenantTable() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLTableRowElement[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getAdminProjects()
      .then((data) => {
        if (!cancelled) {
          setProjects(data.projects || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load tenants");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Row entrance animation
  useGSAP(
    () => {
      if (loading || !rowsRef.current.length) return;

      gsap.fromTo(
        rowsRef.current.filter(Boolean),
        { x: -20, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.5,
          stagger: 0.06,
          ease: "power2.out",
        }
      );
    },
    { dependencies: [loading, projects], scope: tableRef }
  );

  const addRowRef = (el: HTMLTableRowElement | null, index: number) => {
    if (el) rowsRef.current[index] = el;
  };

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  }

  /* ---- Skeleton loading rows ---- */
  if (loading) {
    return (
      <GlassCard level="light" className="p-5">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Project ID", "Created", "Events", "Alerts", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-label"
                    style={{
                      padding: "12px 16px",
                      textAlign: h === "Events" || h === "Alerts" ? "right" : "left",
                      borderBottom: "1px solid var(--glass-border)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  {[0, 1, 2, 3, 4].map((j) => (
                    <td key={j} style={{ padding: "14px 16px" }}>
                      <div
                        className="skeleton"
                        style={{
                          height: 14,
                          width: j === 0 ? "70%" : j < 3 ? "50%" : "40%",
                          marginLeft: j === 2 || j === 3 ? "auto" : undefined,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard level="light" className="p-6">
        <div
          style={{
            textAlign: "center",
            color: "var(--severity-critical)",
            fontFamily: "var(--font-primary)",
          }}
        >
          <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>
            Failed to load tenants
          </span>
          <p style={{ color: "var(--text-secondary)", marginTop: 8, fontSize: "0.875rem" }}>
            {error}
          </p>
        </div>
      </GlassCard>
    );
  }

  const headerStyle: React.CSSProperties = {
    padding: "12px 16px",
    borderBottom: "1px solid var(--glass-border)",
    whiteSpace: "nowrap",
  };

  const cellStyle: React.CSSProperties = {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(196, 149, 106, 0.07)",
    whiteSpace: "nowrap",
  };

  return (
    <GlassCard level="light" className="p-5">
      <div ref={tableRef} style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th className="text-label" style={{ ...headerStyle, textAlign: "left" }}>
                Project ID
              </th>
              <th className="text-label" style={{ ...headerStyle, textAlign: "left" }}>
                Created
              </th>
              <th className="text-label" style={{ ...headerStyle, textAlign: "right" }}>
                Events
              </th>
              <th className="text-label" style={{ ...headerStyle, textAlign: "right" }}>
                Alerts
              </th>
              <th className="text-label" style={{ ...headerStyle, textAlign: "left" }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project, index) => {
              const isActive = project.totalEvents > 0;

              return (
                <tr
                  key={project.projectId}
                  ref={(el) => addRowRef(el, index)}
                  style={{
                    opacity: 0,
                    transition:
                      "background-color var(--transition-fast), transform var(--transition-fast)",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) => {
                    const row = e.currentTarget;
                    row.style.backgroundColor = "var(--bg-hover)";
                    row.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    const row = e.currentTarget;
                    row.style.backgroundColor = "transparent";
                    row.style.transform = "translateY(0)";
                  }}
                >
                  <td
                    style={{
                      ...cellStyle,
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.8rem",
                      color: "var(--ember-ash)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {project.projectId}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      color: "var(--text-secondary)",
                      fontSize: "0.85rem",
                    }}
                  >
                    {formatDate(project.createdAt)}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: "right",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.85rem",
                      color: "var(--text-primary)",
                    }}
                  >
                    {project.totalEvents.toLocaleString()}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: "right",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.85rem",
                      color:
                        project.totalAlerts > 0
                          ? "var(--ember-warm)"
                          : "var(--text-secondary)",
                    }}
                  >
                    {project.totalAlerts.toLocaleString()}
                  </td>
                  <td style={cellStyle}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: isActive ? "#7eb87e" : "#e8943a",
                          display: "inline-block",
                          boxShadow: isActive
                            ? "0 0 6px rgba(126,184,126,0.4)"
                            : "0 0 6px rgba(232,148,58,0.3)",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 500,
                          color: isActive
                            ? "var(--severity-low)"
                            : "var(--ember-warm)",
                        }}
                      >
                        {isActive ? "Active" : "New"}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: "32px 16px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: "0.9rem",
                  }}
                >
                  No tenants found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

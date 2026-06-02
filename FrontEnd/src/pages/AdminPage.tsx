// ---------------------------------------------------------------------------
// ThreatFlix — Admin Portal Page
// Platform-wide intelligence overview with stats, charts, and tenant table.
// ---------------------------------------------------------------------------

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useAuth } from "../context/AuthContext";
import { PlatformStats } from "../components/admin/PlatformStats";
import { TenantTable } from "../components/admin/TenantTable";
import { GlassCard } from "../components/ui/GlassCard";

export function AdminPage() {
  const { isAdmin } = useAuth();
  const pageRef = useRef<HTMLDivElement>(null);

  // Page entrance animation
  useGSAP(
    () => {
      const sections = pageRef.current?.querySelectorAll(".admin-section");
      if (!sections?.length) return;

      gsap.fromTo(
        sections,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.15,
          ease: "power2.out",
        }
      );
    },
    { scope: pageRef }
  );

  // Access denied for non-admins
  if (!isAdmin) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          padding: 24,
        }}
      >
        <GlassCard level="medium" className="p-8" style={{ maxWidth: 420, textAlign: "center" }}>
          <div
            style={{
              fontSize: "3rem",
              marginBottom: 16,
            }}
          >
            🔒
          </div>
          <h2
            style={{
              fontFamily: "var(--font-primary)",
              fontWeight: 700,
              fontSize: "1.5rem",
              color: "var(--text-primary)",
              margin: "0 0 8px 0",
            }}
          >
            Access Denied
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.9rem",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Admin privileges are required to view this page.
            Sign in with admin credentials to access platform-wide analytics.
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div
      ref={pageRef}
      style={{
        padding: "24px 28px",
        maxWidth: 1400,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      {/* ─── Page Header ──────────────────────────────────────────────── */}
      <section className="admin-section">
        <h1
          style={{
            fontFamily: "var(--font-primary)",
            fontWeight: 800,
            fontSize: "2rem",
            color: "var(--text-primary)",
            margin: "0 0 4px 0",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 5,
              height: 28,
              borderRadius: 3,
              backgroundColor: "var(--ember-hot)",
              boxShadow: "0 0 12px rgba(255, 107, 53, 0.3)",
            }}
          />
          Admin Portal
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.95rem",
            margin: "0 0 0 17px",
            fontWeight: 300,
          }}
        >
          Platform-wide intelligence overview
        </p>
      </section>

      {/* ─── Platform Statistics + Charts ──────────────────────────────── */}
      <section className="admin-section">
        <PlatformStats />
      </section>

      {/* ─── Tenant Management ────────────────────────────────────────── */}
      <section className="admin-section">
        <h2
          style={{
            fontFamily: "var(--font-primary)",
            fontWeight: 700,
            fontSize: "1.15rem",
            color: "var(--text-primary)",
            margin: "0 0 16px 0",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 4,
              height: 20,
              borderRadius: 2,
              backgroundColor: "var(--severity-info)",
            }}
          />
          Tenant Management
        </h2>
        <TenantTable />
      </section>
    </div>
  );
}

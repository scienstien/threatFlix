import type { ReactNode } from "react";

export function AuthFrame({
  mode,
  title,
  description,
  children,
}: {
  mode: "Sign in" | "Create account";
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand-top">
          <span className="auth-wordmark">THREATFLIX</span>
          <span className="auth-system-state"><i /> Identity telemetry online</span>
        </div>
        <div className="auth-brand-copy">
          <span className="auth-kicker">Ground truth first</span>
          <h1>Investigate identity attacks from evidence to action.</h1>
          <p>
            Deterministic findings, raw telemetry, behavioral deviation, and grounded interpretation
            in one analyst workspace.
          </p>
        </div>
        <div className="auth-telemetry-scene" aria-hidden="true">
          <div className="auth-scene-head"><span>LIVE CASE PREVIEW</span><span>04:51:54 IST</span></div>
          {[
            ["failed_login", "priya.sharma", "185.220.101.42"],
            ["successful_login", "priya.sharma", "185.220.101.42"],
            ["mfa_disabled", "priya.sharma", "185.220.101.42"],
            ["api_key_created", "priya.sharma", "185.220.101.42"],
            ["data_export", "18,420 records", "critical chain"],
          ].map(([event, entity, context], index) => (
            <div className={`auth-scene-row auth-scene-row-${index}`} key={event}>
              <span>{String(index + 1).padStart(2, "0")}</span><strong>{event}</strong><span>{entity}</span><span>{context}</span>
            </div>
          ))}
          <div className="auth-scene-verdict">
            <span>DETERMINISTIC CHAIN</span>
            <strong>Account takeover / persistence / export</strong>
          </div>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <span className="auth-mode">{mode}</span>
          <h2>{title}</h2>
          <p className="auth-description">{description}</p>
          {children}
        </div>
        <footer className="auth-footer">ThreatFlix / Forensic identity investigation</footer>
      </section>
    </main>
  );
}

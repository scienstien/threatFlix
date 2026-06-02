// ---------------------------------------------------------------------------
// ThreatFlix — LoginPage
// Full-screen login with ember particle background, magnetic card, typewriter
// tagline, admin + OAuth login, and entrance animations.
// ---------------------------------------------------------------------------

import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useAuth } from "../context/AuthContext";
import { EmberParticleField } from "../components/ui/EmberParticleField";
import { MagneticCard } from "../components/ui/MagneticCard";
import { GlassCard } from "../components/ui/GlassCard";

export function LoginPage() {
  const { loginAdmin, loginOAuth, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const cardWrapperRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLSpanElement>(null);

  // Redirect if already logged in (only happens after a successful login action)
  const [hasLoggedIn, setHasLoggedIn] = useState(false);

  useGSAP(() => {
    if (hasLoggedIn && isAuthenticated) {
      navigate(isAdmin ? "/admin" : "/dashboard", { replace: true });
    }
  }, { dependencies: [isAuthenticated, hasLoggedIn] });

  // Entrance animation + typewriter
  useGSAP(
    () => {
      if (!cardWrapperRef.current) return;

      // Card entrance
      gsap.fromTo(
        cardWrapperRef.current,
        { scale: 0.95, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.8, ease: "power2.out" }
      );

      // Typewriter effect on the tagline
      if (taglineRef.current) {
        const text = taglineRef.current.textContent || "";
        taglineRef.current.textContent = "";
        taglineRef.current.style.visibility = "visible";

        const chars = text.split("");
        let html = "";
        chars.forEach((char) => {
          html += `<span style="opacity:0;display:inline-block">${char === " " ? "&nbsp;" : char}</span>`;
        });
        taglineRef.current.innerHTML = html;

        const spans = taglineRef.current.querySelectorAll("span");
        gsap.to(spans, {
          opacity: 1,
          duration: 0.02,
          stagger: 0.045,
          ease: "none",
          delay: 0.6,
        });
      }
    },
    { scope: cardWrapperRef }
  );

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await loginAdmin(email, password);
      setHasLoggedIn(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async () => {
    setError("");
    setOauthLoading(true);

    try {
      // Open Google OAuth consent screen in a popup
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com` +
          `&redirect_uri=${encodeURIComponent(window.location.origin + "/auth/callback")}` +
          `&response_type=token` +
          `&scope=${encodeURIComponent("email profile")}` +
          `&prompt=select_account`,
        "google-login",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      // Listen for the popup to return with the OAuth token
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== "oauth_callback") return;

        window.removeEventListener("message", handleMessage);
        popup?.close();

        const { email: oauthEmail, name } = event.data;
        if (oauthEmail && name) {
          try {
            await loginOAuth(oauthEmail, name);
            setHasLoggedIn(true);
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : "OAuth login failed.";
            setError(message);
          }
        }
        setOauthLoading(false);
      };

      window.addEventListener("message", handleMessage);

      // Timeout: if popup closed without completing
      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          window.removeEventListener("message", handleMessage);
          setOauthLoading(false);
        }
      }, 500);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "OAuth login failed.";
      setError(message);
      setOauthLoading(false);
    }
  };

  // Shared input styles
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    background: "var(--bg-deep)",
    border: "1px solid var(--glass-border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    fontFamily: "var(--font-primary)",
    fontSize: "0.9rem",
    outline: "none",
    transition: "border-color var(--transition-fast)",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background */}
      <EmberParticleField />

      {/* Login card */}
      <div
        ref={cardWrapperRef}
        style={{ position: "relative", zIndex: 10, opacity: 0 }}
      >
        <MagneticCard intensity={0.5}>
          <GlassCard level="heavy" glow style={{ padding: "40px", width: "420px", maxWidth: "90vw" }}>
            {/* Wordmark */}
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
              <span
                style={{
                  fontFamily: "var(--font-primary)",
                  fontWeight: 800,
                  fontSize: "2.5rem",
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
                  fontSize: "2.5rem",
                  background:
                    "linear-gradient(to right, var(--ember-hot), var(--ember-warm))",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: "-0.02em",
                }}
              >
                FLIX
              </span>
              <span
                className="spark-dot"
                style={{ fontSize: "0.6rem", marginLeft: "3px" }}
              >
                ●
              </span>
            </div>

            {/* Tagline with typewriter */}
            <div
              style={{
                textAlign: "center",
                marginBottom: "32px",
                minHeight: "1.6em",
              }}
            >
              <span
                ref={taglineRef}
                className="typewriter-cursor"
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                  fontWeight: 300,
                  visibility: "hidden",
                }}
              >
                Your security, in cinematic clarity
              </span>
            </div>

            {/* Admin Login Form */}
            <form onSubmit={handleAdminLogin}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label
                    className="text-label"
                    style={{ display: "block", marginBottom: "6px" }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--ember-ash)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--glass-border)";
                    }}
                    required
                    autoComplete="email"
                    placeholder="admin@threatflix.dev"
                  />
                </div>
                <div>
                  <label
                    className="text-label"
                    style={{ display: "block", marginBottom: "6px" }}
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--ember-ash)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--glass-border)";
                    }}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                  />
                </div>

                {/* Error */}
                {error && (
                  <div
                    style={{
                      color: "var(--severity-critical)",
                      fontSize: "0.82rem",
                      fontWeight: 500,
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm)",
                      background: "rgba(255,77,77,0.08)",
                      border: "1px solid rgba(255,77,77,0.2)",
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "var(--ember-hot)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    fontFamily: "var(--font-primary)",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                    transition:
                      "box-shadow var(--transition-fast), transform var(--transition-fast), opacity var(--transition-fast)",
                    boxShadow: "0 4px 16px rgba(255,107,53,0.25)",
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      const el = e.currentTarget;
                      el.style.boxShadow =
                        "0 4px 24px rgba(255,107,53,0.4), 0 0 40px rgba(255,107,53,0.15)";
                      el.style.transform = "scale(1.02)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.boxShadow = "0 4px 16px rgba(255,107,53,0.25)";
                    el.style.transform = "scale(1)";
                  }}
                >
                  {loading ? "Signing in…" : "Sign in as Admin"}
                </button>
              </div>
            </form>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                margin: "24px 0",
              }}
            >
              <span
                style={{
                  flex: 1,
                  height: "1px",
                  background: "var(--glass-border)",
                }}
              />
              <span
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.8rem",
                  fontWeight: 400,
                  whiteSpace: "nowrap",
                }}
              >
                — or —
              </span>
              <span
                style={{
                  flex: 1,
                  height: "1px",
                  background: "var(--glass-border)",
                }}
              />
            </div>

            {/* OAuth */}
            <button
              type="button"
              onClick={handleOAuthLogin}
              disabled={oauthLoading}
              style={{
                width: "100%",
                padding: "12px",
                background: "transparent",
                color: "var(--text-secondary)",
                border: "1px solid var(--glass-border)",
                borderRadius: "var(--radius-sm)",
                fontFamily: "var(--font-primary)",
                fontSize: "0.9rem",
                fontWeight: 500,
                cursor: oauthLoading ? "not-allowed" : "pointer",
                opacity: oauthLoading ? 0.7 : 1,
                transition:
                  "all var(--transition-fast)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
              onMouseEnter={(e) => {
                if (!oauthLoading) {
                  const el = e.currentTarget;
                  el.style.borderColor = "var(--ember-warm)";
                  el.style.color = "var(--ember-warm)";
                  el.style.background = "rgba(232,148,58,0.06)";
                }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = "var(--glass-border)";
                el.style.color = "var(--text-secondary)";
                el.style.background = "transparent";
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path
                  fill="#FFC107"
                  d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                />
              </svg>
              {oauthLoading ? "Signing in…" : "Sign in with Google"}
            </button>
          </GlassCard>
        </MagneticCard>
      </div>
    </div>
  );
}

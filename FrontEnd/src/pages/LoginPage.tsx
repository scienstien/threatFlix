import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../api/client";
import { useGoogleLogin } from "@react-oauth/google";
import { EmberParticleField } from "../components/ui/EmberParticleField";
import { MagneticCard } from "../components/ui/MagneticCard";
import { GlassCard } from "../components/ui/GlassCard";

const authInputStyle: React.CSSProperties = {
  background: "rgba(26, 20, 16, 0.7)",
  border: "1px solid rgba(196, 149, 106, 0.25)",
  color: "#f5efe6",
  padding: "12px 14px",
  borderRadius: "8px",
  fontSize: "0.9rem",
  fontFamily: "var(--font-primary)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box" as const,
  transition: "border-color 0.2s ease",
};

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailEl = document.getElementById("login-email") as HTMLInputElement | null;
    const passwordEl = document.getElementById("login-password") as HTMLInputElement | null;
    
    const email = emailEl?.value.trim() ?? "";
    const password = passwordEl?.value ?? "";

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? "Invalid credentials.");
        return;
      }

      login({
        token: data.token,
        name: data.name,
        email: data.email,
        role: data.role,
        projectId: data.projectId,
      });

      if (data.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: tokenResponse.access_token }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data?.error ?? "OAuth login failed.");
          return;
        }

        login({
          token: data.token,
          name: data.name,
          email: data.email,
          role: data.role,
          projectId: data.projectId,
        });

        if (data.role === "admin") {
          navigate("/admin");
        } else {
          navigate("/dashboard");
        }
      } catch {
        setError("Could not reach the server during OAuth.");
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      setError("Google Login failed or was cancelled.");
    },
  });

  return (
    <>
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
      <style>{`
        .auth-input::placeholder { color: rgba(196, 149, 106, 0.55); }
        .auth-input:focus { border-color: rgba(232, 148, 58, 0.6); box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.12); }
      `}</style>
      <EmberParticleField />

      <div style={{ position: "relative", zIndex: 10 }}>
        <MagneticCard intensity={0.3}>
          <GlassCard level="heavy" glow style={{ padding: "40px", width: "420px", maxWidth: "90vw" }}>
            <div style={{ textAlign: "center", marginBottom: "12px" }}>
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
            </div>

            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 14 }}>
              <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    id="login-email"
                    className="auth-input"
                    type="text"
                    placeholder="Email"
                    style={authInputStyle}
                  />
                  <input
                    id="login-password"
                    className="auth-input"
                    type="password"
                    placeholder="Password"
                    style={authInputStyle}
                  />
                  
                  {error && (
                    <p
                      style={{
                        color: "var(--severity-critical)",
                        fontSize: "0.82rem",
                        margin: 0,
                        textAlign: "left",
                        padding: "8px 12px",
                        background: "rgba(255, 77, 77, 0.1)",
                        border: "1px solid rgba(255, 77, 77, 0.25)",
                        borderRadius: "6px",
                      }}
                    >
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      background: loading 
                        ? "var(--bg-elevated)" 
                        : "linear-gradient(135deg, var(--ember-hot), var(--ember-warm))",
                      color: loading ? "var(--text-muted)" : "white",
                      border: "none",
                      padding: "12px",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      cursor: loading ? "not-allowed" : "pointer",
                      transition: "var(--transition-fast)",
                    }}
                  >
                    {loading ? "Signing in..." : "Sign In"}
                  </button>
                </div>
              </form>

              {/* ---- Divider ---- */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>or</span>
                <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
              </div>

              {/* ---- OAuth Login ---- */}
              <button
                type="button"
                onClick={() => handleOAuthLogin()}
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--glass-border)",
                  padding: "12px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "var(--transition-fast)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M47.532 24.552c0-1.636-.132-3.2-.388-4.704H24.48v8.896h12.984c-.56 3.016-2.256 5.572-4.804 7.284v6.052h7.776c4.548-4.188 7.096-10.36 7.096-17.528z" fill="#4285F4"/>
                  <path d="M24.48 48c6.516 0 11.984-2.16 15.98-5.856l-7.776-6.052c-2.16 1.448-4.924 2.308-8.204 2.308-6.308 0-11.648-4.26-13.556-9.988H3.008v6.244C6.988 42.82 15.16 48 24.48 48z" fill="#34A853"/>
                  <path d="M10.924 28.412A14.88 14.88 0 0 1 10.16 24c0-1.532.264-3.02.764-4.412v-6.244H3.008A23.956 23.956 0 0 0 .48 24c0 3.868.928 7.528 2.528 10.656l7.916-6.244z" fill="#FBBC05"/>
                  <path d="M24.48 9.6c3.556 0 6.748 1.224 9.264 3.628l6.944-6.944C36.456 2.392 30.988 0 24.48 0 15.16 0 6.988 5.18 3.008 13.344l7.916 6.244C12.832 13.86 18.172 9.6 24.48 9.6z" fill="#EA4335"/>
                </svg>
                Continue with OAuth
              </button>

              {/* ---- Sign Up link ---- */}
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: 0 }}>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/signup")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--ember-warm)",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    padding: 0,
                    textDecoration: "underline",
                    textUnderlineOffset: "3px",
                  }}
                >
                  Sign Up
                </button>
              </p>
            </div>
          </GlassCard>
        </MagneticCard>
      </div>
    </div>
    </>
  );
}

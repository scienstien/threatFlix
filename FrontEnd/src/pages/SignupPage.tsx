import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../api/client";
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

export function SignupPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);

  const handleEmailBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const email = e.target.value.trim();
    if (!email) {
      setEmailAvailable(null);
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      setEmailAvailable(null);
      return;
    }

    setCheckingEmail(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/check-email?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        setEmailAvailable(data.available);
        if (!data.available) {
          setError("This email is already registered.");
        }
      }
    } catch {
      // Ignore network errors here so we don't block the user, 
      // the final submit will catch it anyway.
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleSignUp = async () => {
    setError(null);

    // Read values — getElementById can return null if id is missing on the element
    const nameEl = document.getElementById("signup-name") as HTMLInputElement | null;
    const emailEl = document.getElementById("signup-email") as HTMLInputElement | null;
    const passwordEl = document.getElementById("signup-password") as HTMLInputElement | null;
    const confirmEl = document.getElementById("signup-confirm") as HTMLInputElement | null;

    const name = nameEl?.value.trim() ?? "";
    const email = emailEl?.value.trim() ?? "";
    const password = passwordEl?.value ?? "";
    const confirmPassword = confirmEl?.value ?? "";

    if (emailAvailable === false) {
      setError("This email is already registered.");
      return;
    }

    // Client-side validation
    if (!name || !email || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
        // NOTE: role is intentionally NOT sent — backend assigns it
      });

      const data = await response.json();

      if (!response.ok) {
        // Use server error message if provided, otherwise a generic fallback
        setError(data?.error ?? `Registration failed (${response.status}).`);
        return;
      }

      // Save token + user info into AuthContext → auto-persisted to localStorage
      login({
        token: data.token,
        name: data.name,
        email: data.email,
        role: data.role,
        projectId: data.projectId,
      });

      navigate("/dashboard");
    } catch {
      // Network error — fetch itself threw (no internet, server down, CORS etc.)
      setError("Could not reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

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
                    background: "linear-gradient(to right, var(--ember-hot), var(--ember-warm))",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    letterSpacing: "-0.02em",
                  }}
                >
                  FLIX
                </span>
              </div>

              <p
                style={{
                  textAlign: "center",
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                  margin: "0 0 8px",
                }}
              >
                Create your account
              </p>

              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    id="signup-name"
                    className="auth-input"
                    type="text"
                    placeholder="Full Name"
                    style={authInputStyle}
                  />
                  <div style={{ position: "relative" }}>
                    <input
                      id="signup-email"
                      className="auth-input"
                      type="text"
                      placeholder="Email"
                      onBlur={handleEmailBlur}
                      style={{
                        ...authInputStyle,
                        borderColor: emailAvailable === false 
                          ? "rgba(255, 77, 77, 0.5)" 
                          : emailAvailable === true 
                            ? "rgba(77, 255, 100, 0.5)" 
                            : authInputStyle.border?.toString(),
                      }}
                    />
                    {checkingEmail && (
                      <div style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: "0.8rem",
                        color: "var(--text-muted)"
                      }}>
                        Checking...
                      </div>
                    )}
                  </div>
                  <input
                    id="signup-password"
                    className="auth-input"
                    type="password"
                    placeholder="Password"
                    style={authInputStyle}
                  />
                  <input
                    id="signup-confirm"
                    className="auth-input"
                    type="password"
                    placeholder="Confirm Password"
                    style={authInputStyle}
                  />

                  {/* ---- Error message ---- */}
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
                    onClick={handleSignUp}
                    disabled={loading || checkingEmail || emailAvailable === false}
                    style={{
                      background: (loading || checkingEmail || emailAvailable === false)
                        ? "var(--bg-elevated)"
                        : "linear-gradient(135deg, var(--ember-hot), var(--ember-warm))",
                      color: (loading || checkingEmail || emailAvailable === false) ? "var(--text-muted)" : "white",
                      border: "none",
                      padding: "12px",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      cursor: (loading || checkingEmail || emailAvailable === false) ? "not-allowed" : "pointer",
                      transition: "var(--transition-fast)",
                    }}
                  >
                    {loading ? "Creating account…" : "Sign Up"}
                  </button>
                </div>

                {/* ---- Back to Sign In ---- */}
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: 0 }}>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
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
                    Sign In
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

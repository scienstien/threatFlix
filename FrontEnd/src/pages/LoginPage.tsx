import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../api/client";
import { AuthFrame } from "../components/auth/AuthFrame";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const email = (document.getElementById("login-email") as HTMLInputElement | null)?.value.trim() ?? "";
    const password = (document.getElementById("login-password") as HTMLInputElement | null)?.value ?? "";
    if (!email || !password) return setError("Email and password are required.");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data?.error ?? "Invalid credentials.");
      login({ token: data.token, name: data.name, email: data.email, role: data.role, projectId: data.projectId });
      navigate(data.role === "admin" ? "/admin" : "/dashboard");
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  const handleOAuthLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/auth/google`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken: tokenResponse.access_token }),
        });
        const data = await response.json();
        if (!response.ok) return setError(data?.error ?? "OAuth login failed.");
        login({ token: data.token, name: data.name, email: data.email, role: data.role, projectId: data.projectId });
        navigate(data.role === "admin" ? "/admin" : "/dashboard");
      } catch {
        setError("Could not reach the server during OAuth.");
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError("Google Login failed or was cancelled."),
  });

  return (
    <AuthFrame mode="Sign in" title="Return to the investigation desk." description="Review active cases, raw telemetry, evidence, and analyst reports.">
      <form className="auth-form" onSubmit={handleSignIn}>
        <label>Email address<input id="login-email" type="email" placeholder="analyst@company.com" autoComplete="email" /></label>
        <label>Password<input id="login-password" type="password" placeholder="Enter password" autoComplete="current-password" /></label>
        {error ? <p className="auth-error">{error}</p> : null}
        <button className="auth-primary" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
      </form>
      <div className="auth-divider"><span>or</span></div>
      <button className="auth-secondary" type="button" onClick={() => handleOAuthLogin()}>Continue with Google</button>
      <p className="auth-switch">New to ThreatFlix? <button type="button" onClick={() => navigate("/signup")}>Create an account</button></p>
    </AuthFrame>
  );
}

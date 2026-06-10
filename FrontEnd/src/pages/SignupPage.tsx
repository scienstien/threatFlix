import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../api/client";
import { AuthFrame } from "../components/auth/AuthFrame";

export function SignupPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);

  async function handleEmailBlur(event: React.FocusEvent<HTMLInputElement>) {
    const email = event.target.value.trim();
    if (!email) return setEmailAvailable(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailAvailable(null);
      return setError("Please enter a valid email address.");
    }
    setCheckingEmail(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/auth/check-email?email=${encodeURIComponent(email)}`);
      if (response.ok) {
        const data = await response.json();
        setEmailAvailable(data.available);
        if (!data.available) setError("This email is already registered.");
      }
    } catch {
      // Final registration still performs authoritative server validation.
    } finally {
      setCheckingEmail(false);
    }
  }

  async function handleSignUp() {
    setError(null);
    const name = (document.getElementById("signup-name") as HTMLInputElement | null)?.value.trim() ?? "";
    const email = (document.getElementById("signup-email") as HTMLInputElement | null)?.value.trim() ?? "";
    const password = (document.getElementById("signup-password") as HTMLInputElement | null)?.value ?? "";
    const confirmPassword = (document.getElementById("signup-confirm") as HTMLInputElement | null)?.value ?? "";
    if (emailAvailable === false) return setError("This email is already registered.");
    if (!name || !email || !password || !confirmPassword) return setError("All fields are required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Please enter a valid email address.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data?.error ?? `Registration failed (${response.status}).`);
      login({ token: data.token, name: data.name, email: data.email, role: data.role, projectId: data.projectId });
      navigate("/dashboard");
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame mode="Create account" title="Open a new investigation workspace." description="Connect identity telemetry and begin building evidence-grounded cases.">
      <div className="auth-form">
        <label>Full name<input id="signup-name" type="text" placeholder="Your name" autoComplete="name" /></label>
        <label>Email address
          <span className="auth-input-state">{checkingEmail ? "Checking..." : emailAvailable === true ? "Available" : ""}</span>
          <input id="signup-email" type="email" placeholder="analyst@company.com" onBlur={handleEmailBlur} autoComplete="email" />
        </label>
        <label>Password<input id="signup-password" type="password" placeholder="Minimum 8 characters" autoComplete="new-password" /></label>
        <label>Confirm password<input id="signup-confirm" type="password" placeholder="Repeat password" autoComplete="new-password" /></label>
        {error ? <p className="auth-error">{error}</p> : null}
        <button className="auth-primary" type="button" onClick={handleSignUp} disabled={loading || checkingEmail || emailAvailable === false}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </div>
      <p className="auth-switch">Already have an account? <button type="button" onClick={() => navigate("/login")}>Sign in</button></p>
    </AuthFrame>
  );
}

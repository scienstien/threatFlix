// ---------------------------------------------------------------------------
// ThreatFlix — Auth Context
// Global authentication state with JWT storage and role-based access.
// ---------------------------------------------------------------------------

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { API_BASE } from "../api/client";

export type Role = "admin" | "user";

interface AuthState {
  token: string;
  name: string;
  role: Role;
  email: string;
  projectId?: string;
}

interface AuthContextValue {
  auth: AuthState | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (auth: AuthState) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "threatflix_auth";

function loadAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

function saveAuth(auth: AuthState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

function clearAuth(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(loadAuth);
  const demoEmbed =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("embedDemo") === "1";

  // Sync to localStorage whenever auth changes
  useEffect(() => {
    if (auth) {
      saveAuth(auth);
    } else {
      clearAuth();
    }
  }, [auth]);

  useEffect(() => {
    if (!demoEmbed || auth) return;
    fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "judge.demo@threatflix.local",
        password: "JudgeDemo!2026",
      }),
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Demo login failed")))
      .then((data) => {
        const nextAuth = {
          token: data.token,
          name: data.name,
          email: data.email,
          role: data.role,
          projectId: data.projectId,
        } satisfies AuthState;
        saveAuth(nextAuth);
        setAuth(nextAuth);
      })
      .catch(() => {
        // AppShell keeps the embed waiting instead of exposing a broken login frame.
      });
  }, [auth, demoEmbed]);

  const login = (newAuth: AuthState) => {
    saveAuth(newAuth);
    setAuth(newAuth);
  };

  const logout = () => {
    setAuth(null);
  };

  const value: AuthContextValue = {
    auth,
    isAuthenticated: auth !== null,
    isAdmin: auth?.role === "admin",
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

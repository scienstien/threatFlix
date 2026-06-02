// ---------------------------------------------------------------------------
// ThreatFlix — Auth Context
// Global authentication state with JWT storage and role-based access.
// ---------------------------------------------------------------------------

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  loginAdmin as apiLoginAdmin,
  loginOAuth as apiLoginOAuth,
  type LoginResponse,
} from "../api/client";

export type Role = "admin" | "user";

interface AuthState {
  token: string;
  role: Role;
  email: string;
  projectId?: string;
}

interface AuthContextValue {
  auth: AuthState | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loginAdmin: (email: string, password: string) => Promise<void>;
  loginOAuth: (email: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "threatflix_auth";

function loadAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
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

  // Sync to localStorage whenever auth changes
  useEffect(() => {
    if (auth) {
      saveAuth(auth);
    } else {
      clearAuth();
    }
  }, [auth]);

  const handleLoginResponse = useCallback((res: LoginResponse) => {
    const state: AuthState = {
      token: res.token,
      role: res.role,
      email: res.email,
      projectId: res.projectId,
    };
    setAuth(state);
  }, []);

  const loginAdmin = useCallback(
    async (email: string, password: string) => {
      const res = await apiLoginAdmin(email, password);
      handleLoginResponse(res);
    },
    [handleLoginResponse]
  );

  const loginOAuth = useCallback(
    async (email: string, name: string) => {
      const res = await apiLoginOAuth(email, name);
      handleLoginResponse(res);
    },
    [handleLoginResponse]
  );

  const logout = useCallback(() => {
    setAuth(null);
  }, []);

  const value: AuthContextValue = {
    auth,
    isAuthenticated: auth !== null,
    isAdmin: auth?.role === "admin",
    loginAdmin,
    loginOAuth,
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

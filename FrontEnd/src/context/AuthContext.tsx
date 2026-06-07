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

  // Sync to localStorage whenever auth changes
  useEffect(() => {
    if (auth) {
      saveAuth(auth);
    } else {
      clearAuth();
    }
  }, [auth]);

  const login = (newAuth: AuthState) => {
    setAuth(newAuth); // useEffect above will persist it to localStorage
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

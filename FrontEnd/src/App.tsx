// ---------------------------------------------------------------------------
// ThreatFlix — Main App with Router
// ---------------------------------------------------------------------------

import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AdminPage } from "./pages/AdminPage";
import { IntegrationPage } from "./pages/IntegrationPage";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/signup",
    element: <SignupPage />,
  },
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "integration",
        element: <IntegrationPage />,
      },
      {
        path: "admin",
        element: <AdminPage />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);

import { GoogleOAuthProvider } from "@react-oauth/google";

export function App() {
  const application = (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );

  // Google Identity's observer does not support an authenticated dashboard
  // mounted inside the judge-demo iframe. Normal top-level auth keeps OAuth.
  const demoEmbed =
    import.meta.env.DEV &&
    window.self !== window.top &&
    new URLSearchParams(window.location.search).get("embedDemo") === "1";
  const authenticatedEmbed =
    window.self !== window.top && Boolean(localStorage.getItem("threatflix_auth"));
  return demoEmbed || authenticatedEmbed ? application : (
    <GoogleOAuthProvider clientId="913174819290-ut5ag77u0s5cibi9sr0v7m32qqon969f.apps.googleusercontent.com">
      {application}
    </GoogleOAuthProvider>
  );
}

export default App;

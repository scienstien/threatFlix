import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function Sidebar() {
  const { auth, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  function signOut() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="app-sidebar">
      <Link className="wordmark" to="/">THREATFLIX</Link>
      <nav className="sidebar-nav">
        <span className="sidebar-label">Investigations</span>
        <Link className={location.pathname.startsWith("/dashboard") ? "is-active" : ""} to="/dashboard">
          <span className="nav-glyph">[]</span><span>Case desk</span>
        </Link>
        {isAdmin ? (
          <>
            <span className="sidebar-label">Platform</span>
            <Link className={location.pathname.startsWith("/admin") ? "is-active" : ""} to="/admin">
              <span className="nav-glyph">::</span><span>Administration</span>
            </Link>
          </>
        ) : null}
      </nav>
      <div className="sidebar-user">
        <span>{auth?.email}</span>
        <button type="button" onClick={signOut}>Sign out</button>
      </div>
    </aside>
  );
}

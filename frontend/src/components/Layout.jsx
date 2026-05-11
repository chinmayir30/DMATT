import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
// theme removed
import "./Layout.css";
import {
  FaChartLine,
  FaFileAlt,
  FaUsers,
  FaUser,
  FaGoogle,
  FaSearch,
  FaLinkedin,
  FaFacebook,
  FaYoutube,
  FaBullhorn,
} from "react-icons/fa";

function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  // theme removed

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => {
    return location.pathname.startsWith(path);
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-header-top">
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
              <div className="brand-text">
                <h1 style={{ fontSize: "28px", margin: "0 0 4px 0", fontWeight: "bold", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>DMAT</h1>
                <p style={{ fontSize: "14px", color: "#a0aec0", margin: 0 }}>Marketing Automation</p>
              </div>
              <div className="brand" style={{ background: "rgba(255, 255, 255, 0.05)", padding: "8px 10px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                <img src="/innovate-logo.png" alt="Innovate Electronics" className="brand-logo" style={{ borderRadius: "6px", background: "#fff", padding: "2px", width: "36px", height: "36px" }} />
                <div className="brand-text">
                  <h2 style={{ fontSize: "14px", color: "#fff", margin: 0, fontWeight: "500", lineHeight: "1.2" }}>Innovate<br/>Electronics</h2>
                </div>
              </div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <Link
            to="/dashboard"
            className={`nav-item ${isActive("/dashboard") ? "active" : ""}`}
          >
            <span className="nav-icon" aria-hidden="true">
              <FaChartLine />
            </span>
            <span>Dashboard</span>
          </Link>

          <Link
            to="/landing-pages"
            className={`nav-item ${isActive("/landing-pages") ? "active" : ""}`}
          >
            <span className="nav-icon" aria-hidden="true">
              <FaFileAlt />
            </span>
            <span>Landing Pages</span>
          </Link>

          <Link
            to="/leads"
            className={`nav-item ${isActive("/leads") ? "active" : ""}`}
          >
            <span className="nav-icon" aria-hidden="true">
              <FaUsers />
            </span>
            <span>Leads</span>
          </Link>

          <Link
            to="/users"
            className={`nav-item ${isActive("/users") ? "active" : ""}`}
          >
            <span className="nav-icon" aria-hidden="true">
              <FaUser />
            </span>
            <span>Users</span>
          </Link>

          <Link
            to="/google-account"
            className={`nav-item ${isActive("/google-account") ? "active" : ""}`}
          >
            <span className="nav-icon" aria-hidden="true">
              <FaGoogle />
            </span>
            <span>Google Account</span>
          </Link>

          <Link
            to="/seo-dashboard"
            className={`nav-item ${isActive("/seo-dashboard") ? "active" : ""}`}
          >
            <span className="nav-icon" aria-hidden="true">
              <FaSearch />
            </span>
            <span>SEO Insights</span>
          </Link>

          <Link
            to="/linkedin"
            className={`nav-item ${isActive("/linkedin") ? "active" : ""}`}
          >
            <span className="nav-icon" aria-hidden="true">
              <FaLinkedin />
            </span>
            <span>LinkedIn</span>
          </Link>
          <Link
            to="/facebook"
            className={`nav-item ${isActive("/facebook") ? "active" : ""}`}
          >
            <span className="nav-icon" aria-hidden="true">
              <FaFacebook />
            </span>
            <span>Facebook</span>
          </Link>
          {/* WhatsApp removed */}
          <Link
            to="/youtube"
            className={`nav-item ${isActive("/youtube") ? "active" : ""}`}
          >
            <span className="nav-icon" aria-hidden="true">
              <FaYoutube />
            </span>
            <span>YouTube</span>
          </Link>
          {/* Chatbot link removed */}
          <Link
            to="/social-hub"
            className={`nav-item ${isActive("/social-hub") ? "active" : ""}`}
          >
            <span className="nav-icon" aria-hidden="true">
              <FaBullhorn />
            </span>
            <span>Social Hub</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="user-details">
              <div className="user-name">{user?.name || "User"}</div>
              <div className="user-role">{user?.role || "User"}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}

export default Layout;

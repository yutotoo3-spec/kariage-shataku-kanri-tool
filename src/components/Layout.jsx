import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const C = {
  sidebar: "#1E293B",
  sidebarActive: "#3B82F6",
  sidebarText: "#CBD5E1",
  sidebarHover: "#334155",
};

const navItems = [
  { to: "/", label: "ダッシュボード" },
  { to: "/applications", label: "申請一覧" },
  { to: "/application-drafts", label: "申請フォーム受付" },
  { to: "/tenants", label: "入居者台帳" },
  { to: "/monthly", label: "月次処理" },
];

export default function Layout({ children }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="app-shell" style={{ display: "flex", minHeight: "100vh" }}>
      {/* サイドバー */}
      <aside className="app-sidebar" style={{
        width: 220, background: C.sidebar, color: "#fff",
        display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, height: "100vh",
        zIndex: 100,
      }}>
        <div className="app-sidebar-header" style={{ padding: "20px 16px 16px", borderBottom: "1px solid #334155" }}>
          <div>
            <div style={{ fontSize: 11, color: C.sidebarText, letterSpacing: "0.08em", marginBottom: 4 }}>
              ATHENA TECHNOLOGIES
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
              借上社宅管理
            </div>
          </div>
          <button onClick={handleLogout} className="app-logout-mobile" style={{
            padding: "6px 12px",
            background: "transparent", border: "1px solid #334155",
            color: C.sidebarText, borderRadius: 6, fontSize: 12,
          }}>
            ログアウト
          </button>
        </div>

        <nav className="app-nav" style={{ flex: 1, padding: "8px 0" }}>
          {navItems.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === "/"} className="app-nav-link" style={({ isActive }) => ({
              display: "block",
              padding: "10px 16px",
              color: isActive ? "#fff" : C.sidebarText,
              background: isActive ? C.sidebarActive : "transparent",
              fontSize: 13, fontWeight: isActive ? 600 : 500,
              borderRadius: 6, margin: "1px 8px",
              transition: "all 0.15s",
            })}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="app-logout-section" style={{ padding: "12px 16px", borderTop: "1px solid #334155" }}>
          <button onClick={handleLogout} style={{
            width: "100%", padding: "8px 12px",
            background: "transparent", border: "1px solid #334155",
            color: C.sidebarText, borderRadius: 6, fontSize: 12,
            transition: "all 0.15s",
          }}>
            ログアウト
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="app-main" style={{ marginLeft: 220, flex: 1, padding: "28px 32px", minHeight: "100vh" }}>
        {children}
      </main>
    </div>
  );
}

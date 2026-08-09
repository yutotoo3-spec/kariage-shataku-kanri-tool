import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const C = {
  sidebar: "#1E293B",
  sidebarActive: "#3B82F6",
  sidebarText: "#94A3B8",
  sidebarHover: "#334155",
};

const navItems = [
  { to: "/", label: "ダッシュボード", icon: "🏠" },
  { to: "/applications", label: "申請一覧", icon: "📋" },
  { to: "/applications/new", label: "申請登録", icon: "➕" },
  { to: "/application-drafts", label: "申請フォーム受付", icon: "📥" },
  { to: "/tenants", label: "入居者台帳", icon: "👤" },
  { to: "/monthly", label: "月次処理", icon: "📅" },
];

export default function Layout({ children }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* サイドバー */}
      <aside style={{
        width: 220, background: C.sidebar, color: "#fff",
        display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, height: "100vh",
        zIndex: 100,
      }}>
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #334155" }}>
          <div style={{ fontSize: 11, color: C.sidebarText, letterSpacing: "0.08em", marginBottom: 4 }}>
            ATHENA TECHNOLOGIES
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
            借上社宅管理
          </div>
        </div>

        <nav style={{ flex: 1, padding: "8px 0" }}>
          {navItems.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to === "/"} style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 16px",
              color: isActive ? "#fff" : C.sidebarText,
              background: isActive ? C.sidebarActive : "transparent",
              fontSize: 13, fontWeight: isActive ? 600 : 400,
              borderRadius: 6, margin: "1px 8px",
              transition: "all 0.15s",
            })}>
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: "12px 16px", borderTop: "1px solid #334155" }}>
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
      <main style={{ marginLeft: 220, flex: 1, padding: "28px 32px", minHeight: "100vh" }}>
        {children}
      </main>
    </div>
  );
}

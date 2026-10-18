import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import InvitePage from "./pages/InvitePage";
import Dashboard from "./pages/Dashboard";
import ApplicationList from "./pages/ApplicationList";
import ApplicationDetail from "./pages/ApplicationDetail";
import PublicApply from "./pages/PublicApply";
import TenantLedger from "./pages/TenantLedger";
import TenantDetail from "./pages/TenantDetail";
import MonthlyProcess from "./pages/MonthlyProcess";
import Settings from "./pages/Settings";
import PlatformAdmin from "./pages/PlatformAdmin";

function ProtectedRoute({ children, session }) {
  if (!session) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // サインアップ直後（メール確認不要な設定）または確認メール経由の初回ログイン時に、
      // 保留中の企業作成（companies/profiles/settings）をまとめて行う。既に所属企業がある場合は何もしない
      if (event === "SIGNED_IN") {
        supabase.rpc("create_company_and_owner").catch(() => {});
        // 招待経由のサインアップ（メール確認必須な設定での初回ログイン含む）の保留中の承認を行う。
        // 招待が無い通常ログインでは "invite metadata missing" で無視されるだけ
        supabase.rpc("accept_invite").catch(() => {});
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>
        読み込み中...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/apply/:companySlug" element={<PublicApply />} />
        <Route path="/apply" element={<PublicApply />} />
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/signup" element={session ? <Navigate to="/" replace /> : <Signup />} />
        <Route path="/invite/:token" element={session ? <Navigate to="/" replace /> : <InvitePage />} />
        <Route path="/" element={<ProtectedRoute session={session}><Dashboard /></ProtectedRoute>} />
        <Route path="/applications" element={<ProtectedRoute session={session}><ApplicationList /></ProtectedRoute>} />
        <Route path="/applications/:id" element={<ProtectedRoute session={session}><ApplicationDetail /></ProtectedRoute>} />
        <Route path="/tenants" element={<ProtectedRoute session={session}><TenantLedger /></ProtectedRoute>} />
        <Route path="/tenants/:id" element={<ProtectedRoute session={session}><TenantDetail /></ProtectedRoute>} />
        <Route path="/monthly" element={<ProtectedRoute session={session}><MonthlyProcess /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute session={session}><Settings /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute session={session}><PlatformAdmin /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

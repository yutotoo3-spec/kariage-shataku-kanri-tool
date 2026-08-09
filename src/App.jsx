import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ApplicationList from "./pages/ApplicationList";
import ApplicationNew from "./pages/ApplicationNew";
import ApplicationDetail from "./pages/ApplicationDetail";
import ApplicationDraftList from "./pages/ApplicationDraftList";
import ApplicationDraftDetail from "./pages/ApplicationDraftDetail";
import PublicApply from "./pages/PublicApply";
import TenantLedger from "./pages/TenantLedger";
import TenantDetail from "./pages/TenantDetail";
import MonthlyProcess from "./pages/MonthlyProcess";
import PropertyList from "./pages/PropertyList";
import PropertyNew from "./pages/PropertyNew";
import PropertyDetail from "./pages/PropertyDetail";

function ProtectedRoute({ children, session }) {
  if (!session) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
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
        <Route path="/apply" element={<PublicApply />} />
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<ProtectedRoute session={session}><Dashboard /></ProtectedRoute>} />
        <Route path="/applications" element={<ProtectedRoute session={session}><ApplicationList /></ProtectedRoute>} />
        <Route path="/applications/new" element={<ProtectedRoute session={session}><ApplicationNew /></ProtectedRoute>} />
        <Route path="/applications/:id" element={<ProtectedRoute session={session}><ApplicationDetail /></ProtectedRoute>} />
        <Route path="/application-drafts" element={<ProtectedRoute session={session}><ApplicationDraftList /></ProtectedRoute>} />
        <Route path="/application-drafts/:id" element={<ProtectedRoute session={session}><ApplicationDraftDetail /></ProtectedRoute>} />
        <Route path="/tenants" element={<ProtectedRoute session={session}><TenantLedger /></ProtectedRoute>} />
        <Route path="/tenants/:id" element={<ProtectedRoute session={session}><TenantDetail /></ProtectedRoute>} />
        <Route path="/monthly" element={<ProtectedRoute session={session}><MonthlyProcess /></ProtectedRoute>} />
        <Route path="/properties" element={<ProtectedRoute session={session}><PropertyList /></ProtectedRoute>} />
        <Route path="/properties/new" element={<ProtectedRoute session={session}><PropertyNew /></ProtectedRoute>} />
        <Route path="/properties/:id" element={<ProtectedRoute session={session}><PropertyDetail /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

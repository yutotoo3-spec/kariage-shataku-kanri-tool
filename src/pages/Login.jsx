import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("メールアドレスまたはパスワードが正しくありません");
    } else {
      navigate("/");
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#F1F5F9",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16,
        padding: "40px 36px", width: 380, maxWidth: "100%",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: "#64748B", letterSpacing: "0.08em", marginBottom: 6 }}>
            ATHENA TECHNOLOGIES
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>
            借上社宅管理システム
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>人事担当者専用</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>メールアドレス</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required style={inputStyle} placeholder="hr@athena-tech.com"
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>パスワード</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required style={inputStyle} placeholder="••••••••"
            />
          </div>
          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "12px",
            background: loading ? "#93C5FD" : "#3B82F6",
            color: "#fff", border: "none", borderRadius: 10,
            fontSize: 14, fontWeight: 600,
            transition: "background 0.2s",
          }}>
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 600,
  color: "#475569", marginBottom: 6,
};
const inputStyle = {
  width: "100%", padding: "10px 12px",
  border: "1px solid #E2E8F0", borderRadius: 8,
  fontSize: 14, color: "#1E293B",
  outline: "none",
};

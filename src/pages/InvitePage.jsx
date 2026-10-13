import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const ROLE_LABELS = { owner: "管理者", member: "メンバー" };

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(undefined);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  useEffect(() => {
    supabase.rpc("get_invite_by_token", { p_token: token }).then(({ data }) => {
      setInvite(data?.[0] || null);
    });
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) { setError("パスワードは8文字以上で入力してください"); return; }

    setSubmitting(true);
    setError("");

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: invite.email, password,
      options: { data: { invite_token: token } },
    });

    if (signUpError) {
      setError(signUpError.message.includes("already registered")
        ? "このメールアドレスは既にアカウント登録済みです。ログインしてください"
        : "登録に失敗しました: " + signUpError.message);
      setSubmitting(false);
      return;
    }

    if (!data.session) {
      setAwaitingConfirmation(true);
      setSubmitting(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc("accept_invite");
    if (rpcError) {
      setError("招待の承認に失敗しました: " + rpcError.message);
      setSubmitting(false);
      return;
    }

    navigate("/");
  }

  if (invite === undefined) {
    return <AuthShell><p style={{ textAlign: "center", color: "#94A3B8" }}>読み込み中...</p></AuthShell>;
  }

  if (invite === null || !invite.valid) {
    return (
      <AuthShell>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", marginBottom: 10 }}>この招待は無効です</h1>
          <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.7 }}>
            招待の期限が切れているか、既に使用済み・取り消し済みです。招待した担当者にご確認ください。
          </p>
        </div>
      </AuthShell>
    );
  }

  if (awaitingConfirmation) {
    return (
      <AuthShell>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", marginBottom: 10 }}>確認メールを送信しました</h1>
          <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.7 }}>
            {invite.email} 宛に確認メールを送信しました。メール内のリンクをクリックしてから、ログインしてください。
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>{invite.company_name} への招待</div>
        <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>
          {ROLE_LABELS[invite.role]}として参加します。パスワードを設定してください
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>メールアドレス</label>
          <input value={invite.email} disabled style={{ ...inputStyle, background: "#F8FAFC", color: "#64748B" }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>パスワード</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            style={inputStyle} placeholder="8文字以上" required />
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting} style={{
          width: "100%", padding: "12px",
          background: submitting ? "#93C5FD" : "#3B82F6",
          color: "#fff", border: "none", borderRadius: 10,
          fontSize: 14, fontWeight: 600,
        }}>
          {submitting ? "処理中..." : "参加する"}
        </button>
      </form>
    </AuthShell>
  );
}

function AuthShell({ children }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#F1F5F9",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16,
        padding: "40px 36px", width: 420, maxWidth: "100%",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      }}>
        {children}
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 };
const inputStyle = {
  width: "100%", padding: "10px 12px",
  border: "1px solid #E2E8F0", borderRadius: 8,
  fontSize: 14, color: "#1E293B",
  outline: "none",
};

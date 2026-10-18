import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { pageStyle, cardStyle, labelStyle, inputStyle, errorStyle, buttonStyle } from "../utils/authStyles";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // 送信回数の上限に達した場合のみエラーを出す。メールアドレスが未登録でも成功と同じ表示にし、
    // 登録の有無を第三者に知られないようにする
    if (error && error.status === 429) {
      setError("短時間に送信しすぎています。しばらく待ってから再度お試しください");
      return;
    }
    setSent(true);
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1E293B" }}>パスワードの再設定</div>
        </div>

        {sent ? (
          <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.8 }}>
            入力されたメールアドレスが登録されている場合、パスワード再設定用のメールを送信しました。
            メールのリンクから新しいパスワードを設定してください。
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 16, lineHeight: 1.7 }}>
              登録済みのメールアドレスを入力してください。再設定用のリンクをお送りします。
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>メールアドレス</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            </div>
            {error && <div style={errorStyle}>{error}</div>}
            <button type="submit" disabled={loading} style={buttonStyle(loading)}>
              {loading ? "送信中..." : "再設定メールを送る"}
            </button>
          </form>
        )}

        <p style={{ textAlign: "center", fontSize: 12, marginTop: 20 }}>
          <Link to="/login" style={{ color: "#3B82F6" }}>ログイン画面に戻る</Link>
        </p>
      </div>
    </div>
  );
}

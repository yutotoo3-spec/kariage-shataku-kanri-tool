import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { isRecoverySession } from "../utils/auth";
import { pageStyle, cardStyle, labelStyle, inputStyle, errorStyle, buttonStyle } from "../utils/authStyles";

export default function ResetPassword({ session }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("パスワードは8文字以上で入力してください"); return; }
    if (password !== confirm) { setError("確認用のパスワードが一致しません"); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.code === "weak_password"
        ? "このパスワードは使用できません。過去に流出したパスワードや推測されやすいパスワードは避けてください"
        : error.code === "same_password"
          ? "現在と同じパスワードは設定できません"
          : "パスワードの変更に失敗しました: " + error.message);
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1E293B" }}>新しいパスワードの設定</div>
        </div>

        {!isRecoverySession(session) ? (
          <>
            <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.8 }}>
              リンクが無効か、有効期限が切れています。お手数ですが、もう一度再設定メールを送信してください。
            </p>
            <p style={{ textAlign: "center", fontSize: 12, marginTop: 20 }}>
              <Link to="/forgot-password" style={{ color: "#3B82F6" }}>再設定メールを送る</Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>新しいパスワード</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                required style={inputStyle} placeholder="8文字以上" autoComplete="new-password" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>新しいパスワード（確認）</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                required style={inputStyle} autoComplete="new-password" />
            </div>
            {error && <div style={errorStyle}>{error}</div>}
            <button type="submit" disabled={loading} style={buttonStyle(loading)}>
              {loading ? "変更中..." : "パスワードを変更する"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

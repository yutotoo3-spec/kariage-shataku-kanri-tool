import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { pageStyle, cardStyle, labelStyle, inputStyle, errorStyle, buttonStyle } from "../utils/authStyles";

// 二要素認証を設定済みのユーザーが、パスワードでログインした後に6桁のコードを入力する画面
export default function MfaVerify() {
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const factor = (data?.totp || []).find(f => f.status === "verified");
      if (!cancelled) setFactorId(factor?.id ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    // 成功するとログイン情報が二要素認証済み（aal2）に更新され、App が通常の画面に切り替える
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setLoading(false);
    if (error) setError("コードが正しくありません。認証アプリに表示されている最新の6桁を入力してください");
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1E293B" }}>二要素認証</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>認証アプリに表示されている6桁のコードを入力してください</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>確認コード</label>
            <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code"
              pattern="[0-9]{6}" maxLength={6} required autoFocus placeholder="123456"
              style={{ ...inputStyle, letterSpacing: 4, fontSize: 18, textAlign: "center" }} />
          </div>
          {error && <div style={errorStyle}>{error}</div>}
          <button type="submit" disabled={loading || !factorId} style={buttonStyle(loading)}>
            {loading ? "確認中..." : "確認する"}
          </button>
        </form>
        <p style={{ textAlign: "center", fontSize: 12, marginTop: 20 }}>
          <button onClick={() => supabase.auth.signOut()} style={{ background: "none", border: "none", color: "#3B82F6", fontSize: 12 }}>
            ログアウトする
          </button>
        </p>
        <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 12, lineHeight: 1.7 }}>
          スマートフォンを紛失した場合は、運営者に二要素認証の解除を依頼してください
        </p>
      </div>
    </div>
  );
}

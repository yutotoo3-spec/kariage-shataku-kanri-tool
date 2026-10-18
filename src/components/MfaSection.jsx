import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// 設定画面の「二要素認証」欄。認証アプリ（Google Authenticator・Microsoft Authenticator など）を登録・解除する
export default function MfaSection() {
  const [factors, setFactors] = useState(null);
  const [enrolling, setEnrolling] = useState(null); // { id, qr, secret }
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function fetchFactors() {
    const { data } = await supabase.auth.mfa.listFactors();
    return (data?.totp || []).filter(f => f.status === "verified");
  }

  useEffect(() => {
    let cancelled = false;
    fetchFactors().then(list => { if (!cancelled) setFactors(list); });
    return () => { cancelled = true; };
  }, []);

  async function startEnroll() {
    setError("");
    setBusy(true);
    // 前回途中でやめた未確認の登録が残っていると新規登録できないことがあるため、先に削除する
    const { data: all } = await supabase.auth.mfa.listFactors();
    for (const f of all?.all || []) {
      if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `認証アプリ ${new Date().toISOString()}` });
    setBusy(false);
    if (error) { setError("登録を開始できませんでした: " + error.message); return; }
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setCode("");
  }

  async function confirmEnroll(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code: code.trim() });
    setBusy(false);
    if (error) { setError("コードが正しくありません。認証アプリに表示されている最新の6桁を入力してください"); return; }
    setEnrolling(null);
    setFactors(await fetchFactors());
  }

  async function cancelEnroll() {
    if (enrolling) await supabase.auth.mfa.unenroll({ factorId: enrolling.id });
    setEnrolling(null);
    setError("");
  }

  async function handleUnenroll(factor) {
    if (!window.confirm("二要素認証を解除しますか？解除するとパスワードだけでログインできるようになります")) return;
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    if (error) { setError("解除できませんでした: " + error.message); return; }
    // 解除後はログイン情報（認証レベル）を更新する
    await supabase.auth.refreshSession();
    setFactors(await fetchFactors());
  }

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>二要素認証</h2>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
          ログイン時に、パスワードに加えて認証アプリに表示される6桁のコードの入力を求めます。パスワードが漏れても不正ログインを防げます
        </p>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", padding: "20px 24px" }}>
        {factors === null ? (
          <div style={{ fontSize: 13, color: "#94A3B8" }}>読み込み中...</div>
        ) : enrolling ? (
          <form onSubmit={confirmEnroll}>
            <p style={{ fontSize: 13, color: "#475569", marginBottom: 12, lineHeight: 1.7 }}>
              1. スマートフォンの認証アプリで、下の QR コードを読み取ってください。<br />
              2. 認証アプリに表示された6桁のコードを入力してください。
            </p>
            <img src={enrolling.qr} alt="認証アプリ登録用のQRコード" style={{ width: 180, height: 180, display: "block", marginBottom: 8 }} />
            <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 16, wordBreak: "break-all" }}>
              読み取れない場合は次のキーを手入力：{enrolling.secret}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code"
                pattern="[0-9]{6}" maxLength={6} required placeholder="123456"
                style={{ width: 140, padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 14, letterSpacing: 2 }} />
              <button type="submit" disabled={busy} style={primaryButton}>{busy ? "確認中..." : "登録する"}</button>
              <button type="button" onClick={cancelEnroll} style={secondaryButton}>やめる</button>
            </div>
          </form>
        ) : factors.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: "#15803D", fontWeight: 600 }}>有効（認証アプリ登録済み）</div>
            <button onClick={() => handleUnenroll(factors[0])} disabled={busy} style={secondaryButton}>解除する</button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: "#64748B" }}>未設定</div>
            <button onClick={startEnroll} disabled={busy} style={primaryButton}>{busy ? "準備中..." : "設定する"}</button>
          </div>
        )}
        {error && <div style={{ marginTop: 12, fontSize: 12, color: "#DC2626" }}>{error}</div>}
      </div>
    </div>
  );
}

const primaryButton = {
  padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
  background: "#3B82F6", color: "#fff", border: "none",
};
const secondaryButton = {
  padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
  background: "#fff", color: "#475569", border: "1px solid #E2E8F0",
};

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function suggestSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function Signup() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  function handleCompanyNameChange(val) {
    setCompanyName(val);
    if (!slugEdited) setSlug(suggestSlug(val));
  }

  function handleSlugChange(val) {
    setSlugEdited(true);
    setSlug(val.toLowerCase());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!companyName) { setError("会社名を入力してください"); return; }
    if (!SLUG_PATTERN.test(slug)) { setError("会社URLは半角英小文字・数字・ハイフンのみ使用できます"); return; }
    if (password.length < 8) { setError("パスワードは8文字以上で入力してください"); return; }

    setLoading(true);

    const { data: existing } = await supabase.from("companies").select("id").eq("slug", slug).maybeSingle();
    if (existing) {
      setError("このURLは既に使用されています。別のURLを指定してください");
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { data: { company_name: companyName, company_slug: slug } },
    });

    if (signUpError) {
      setError(signUpError.message.includes("already registered")
        ? "このメールアドレスは既に登録されています"
        : "登録に失敗しました: " + signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      // メール確認が必要な設定の場合。確認後、初回ログイン時に自動で企業が作成される
      setAwaitingConfirmation(true);
      setLoading(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc("create_company_and_owner");
    if (rpcError) {
      setError("企業情報の作成に失敗しました: " + rpcError.message);
      setLoading(false);
      return;
    }

    navigate("/");
  }

  if (awaitingConfirmation) {
    return (
      <AuthShell>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", marginBottom: 10 }}>確認メールを送信しました</h1>
          <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.7 }}>
            {email} 宛に確認メールを送信しました。メール内のリンクをクリックしてから、ログインしてください。
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>企業アカウントの新規登録</div>
        <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>借上社宅管理システムを貴社でご利用いただけます</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Field label="会社名">
          <input value={companyName} onChange={e => handleCompanyNameChange(e.target.value)}
            style={inputStyle} placeholder="株式会社サンプル" required />
        </Field>
        <Field label="会社URL">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>/apply/</span>
            <input value={slug} onChange={e => handleSlugChange(e.target.value)}
              style={{ ...inputStyle, flex: 1 }} placeholder="sample-inc" required />
          </div>
          <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>申請フォームのURLに使われます（半角英数字・ハイフン）</p>
        </Field>
        <Field label="管理者メールアドレス">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            style={inputStyle} placeholder="admin@sample-inc.com" required />
        </Field>
        <Field label="パスワード">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            style={inputStyle} placeholder="8文字以上" required />
        </Field>

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
        }}>
          {loading ? "登録中..." : "登録する"}
        </button>
      </form>

      <p style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: 20 }}>
        既にアカウントをお持ちの方は <Link to="/login" style={{ color: "#3B82F6", fontWeight: 600 }}>ログイン</Link>
      </p>
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

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 12px",
  border: "1px solid #E2E8F0", borderRadius: 8,
  fontSize: 14, color: "#1E293B",
  outline: "none",
};

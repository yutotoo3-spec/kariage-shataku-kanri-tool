import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { usePlatformAdmin } from "../hooks/usePlatformAdmin";

const STATUS_LABELS = {
  pending: { label: "招待中", color: "#D97706", bg: "#FFFBEB" },
  used: { label: "登録済み", color: "#1D4ED8", bg: "#EFF6FF" },
  revoked: { label: "取り消し済み", color: "#64748B", bg: "#F1F5F9" },
  expired: { label: "期限切れ", color: "#64748B", bg: "#F1F5F9" },
};

function displayStatus(invite) {
  if (invite.status === "pending" && new Date(invite.expires_at) < new Date()) return "expired";
  return invite.status;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("ja-JP") : "";
}

const COMPANY_STATUS_LABELS = {
  active: { label: "利用中", color: "#15803D", bg: "#F0FDF4" },
  suspended: { label: "停止中", color: "#DC2626", bg: "#FEF2F2" },
};

function CompanyList() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  function applyResult({ data, error: rpcError }) {
    if (rpcError) setError("企業一覧の取得に失敗しました: " + rpcError.message);
    setCompanies(data || []);
    setLoading(false);
  }

  async function load() {
    applyResult(await supabase.rpc("admin_list_companies"));
  }

  useEffect(() => {
    supabase.rpc("admin_list_companies").then(applyResult);
  }, []);

  async function handleToggle(company) {
    const next = company.status === "active" ? "suspended" : "active";
    const message = next === "suspended"
      ? `${company.name} を利用停止しますか？\n\n停止すると、この会社の申請フォームが使えなくなり、社員もデータを閲覧できなくなります（データは削除されません）。`
      : `${company.name} の利用を再開しますか？`;
    if (!confirm(message)) return;
    setUpdatingId(company.id);
    const { error: rpcError } = await supabase.rpc("admin_set_company_status", { p_company_id: company.id, p_status: next });
    if (rpcError) {
      alert(rpcError.message.includes("cannot suspend your own company")
        ? "自分が所属している会社は停止できません"
        : "変更に失敗しました: " + rpcError.message);
    }
    await load();
    setUpdatingId(null);
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>利用企業</h2>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
          登録済みの企業と利用状況です。入居者数は退去済みを除いた人数です
        </p>
      </div>
      {error && <p style={{ fontSize: 12, color: "#DC2626", marginBottom: 10 }}>{error}</p>}
      {loading ? (
        <div style={{ color: "#94A3B8", padding: 20 }}>読み込み中...</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          {companies.map((c, i) => {
            const st = COMPANY_STATUS_LABELS[c.status] || COMPANY_STATUS_LABELS.active;
            return (
              <div key={c.id} style={{
                padding: "14px 20px",
                borderBottom: i < companies.length - 1 ? "1px solid #F1F5F9" : "none",
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              }}>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2, overflowWrap: "anywhere" }}>
                    /apply/{c.slug} ／ 登録 {formatDate(c.created_at)}
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2, overflowWrap: "anywhere" }}>
                    管理者：{c.owner_emails || "なし"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#475569" }}>
                  <span>ユーザー {c.member_count}</span>
                  <span>申請 {c.application_count}</span>
                  <span>入居者 {c.tenancy_count}</span>
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", minWidth: 110 }}>
                  最終申請 {c.last_application_at ? formatDate(c.last_application_at) : "—"}
                </div>
                <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                  {st.label}
                </span>
                <button onClick={() => handleToggle(c)} disabled={updatingId === c.id} style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#fff",
                  color: c.status === "active" ? "#DC2626" : "#15803D",
                  border: `1px solid ${c.status === "active" ? "#FECACA" : "#BBF7D0"}`,
                }}>
                  {updatingId === c.id ? "変更中..." : c.status === "active" ? "利用停止" : "再開"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PlatformAdmin() {
  const { isPlatformAdmin, loading: checking } = usePlatformAdmin();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => { if (isPlatformAdmin) load(); }, [isPlatformAdmin]);

  async function load() {
    const { data } = await supabase.from("company_invites").select("*").order("created_at", { ascending: false });
    setInvites(data || []);
    setLoading(false);
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("create_company_invite", { p_email: email });
    if (rpcError) { setError("招待の発行に失敗しました: " + rpcError.message); setSending(false); return; }
    setEmail("");
    await load();
    setSending(false);
  }

  async function handleRevoke(id) {
    if (!confirm("この招待を取り消しますか？")) return;
    await supabase.rpc("revoke_company_invite", { p_invite_id: id });
    await load();
  }

  async function handleCopy(invite) {
    const url = `${window.location.origin}/signup?invite=${invite.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (checking) return <div style={{ color: "#94A3B8", padding: 40 }}>読み込み中...</div>;
  if (!isPlatformAdmin) return <div style={{ color: "#94A3B8", padding: 40 }}>このページを表示する権限がありません</div>;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>運営者メニュー</h1>
      </div>

      <CompanyList />

      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>企業登録の招待</h2>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
          企業登録は招待制です。招待URLを発行して、利用企業の管理者に送ってください（有効期限14日・1回のみ使用可）
        </p>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", padding: "20px 24px", marginBottom: 16 }}>
        <form onSubmit={handleInvite} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 240px" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>企業の管理者メールアドレス</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#1E293B", outline: "none" }}
              placeholder="admin@sample-inc.com" />
          </div>
          <button type="submit" disabled={sending} style={{
            padding: "9px 20px", background: sending ? "#93C5FD" : "#3B82F6", color: "#fff",
            border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13,
          }}>
            {sending ? "発行中..." : "招待URLを発行"}
          </button>
        </form>
        {error && <p style={{ fontSize: 12, color: "#DC2626", marginTop: 10 }}>{error}</p>}
      </div>

      {!loading && invites.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          {invites.map((inv, i) => {
            const status = displayStatus(inv);
            const st = STATUS_LABELS[status];
            return (
              <div key={inv.id} style={{
                padding: "14px 20px",
                borderBottom: i < invites.length - 1 ? "1px solid #F1F5F9" : "none",
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", overflowWrap: "anywhere" }}>{inv.email}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                    発行 {formatDate(inv.created_at)}
                    {status === "used" ? ` ／ 登録 ${formatDate(inv.used_at)}` : ` ／ 期限 ${formatDate(inv.expires_at)}`}
                  </div>
                </div>
                <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                  {st.label}
                </span>
                {status === "pending" && (
                  <>
                    <button onClick={() => handleCopy(inv)} style={{
                      padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: "#fff", color: "#475569", border: "1px solid #E2E8F0",
                    }}>
                      {copiedId === inv.id ? "コピーしました" : "招待URLをコピー"}
                    </button>
                    <button onClick={() => handleRevoke(inv.id)} style={{
                      padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: "#fff", color: "#DC2626", border: "1px solid #FECACA",
                    }}>
                      取り消す
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

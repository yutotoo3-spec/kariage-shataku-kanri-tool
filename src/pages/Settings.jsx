import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCompany } from "../hooks/useCompany";
import MfaSection from "../components/MfaSection";
import RetentionSection from "../components/RetentionSection";

const SETTINGS_META = [
  { key: "company_burden_rate", label: "会社負担率", type: "percent", desc: "第11条2項(1) 実賃料が限度額以内のときの会社負担割合" },
  { key: "personal_burden_rate", label: "本人負担率", type: "percent", desc: "第11条2項(1) 同・本人負担割合" },
  { key: "subsidy_ratio_single", label: "単身者の限度額割合", type: "percent", desc: "第9条1項(1) 基本報酬月額に対する割合" },
  { key: "subsidy_ratio_family", label: "家族帯同者の限度額割合", type: "percent", desc: "第9条1項(2) 基本報酬月額に対する割合" },
  { key: "rent_ceiling_multiplier", label: "実賃料の上限倍率", type: "number", desc: "第11条2項※ 限度額に対する倍率。超過時は会社が借上げを拒否できる" },
  { key: "floor_area_limit", label: "床面積の上限（㎡）", type: "number", desc: "第8条1項" },
  { key: "building_tax_rate", label: "賃貸料相当額：建物課税標準額の率", type: "percent", desc: "第4条3項(1)（現在未使用・下の項目が「する」の場合のみ使用）" },
  { key: "land_tax_rate", label: "賃貸料相当額：土地課税標準額の率", type: "percent", desc: "第4条3項(3)（現在未使用・下の項目が「する」の場合のみ使用）" },
  { key: "floor_area_unit_price", label: "賃貸料相当額：床面積単価（円）", type: "number", desc: "第4条3項(2) 12円 ×（総床面積㎡ ÷ 3.3）（現在未使用・下の項目が「する」の場合のみ使用）" },
  { key: "prorate_first_month", label: "初月を日割りする", type: "boolean", desc: "規程に定めのない運用ルール（現在未使用）" },
  { key: "deemed_rent_check_enabled", label: "賃貸料相当額の下限チェックを使う", type: "boolean", desc: "第11条1項ただし書き。有効にすると物件ごとに課税標準額の入力が必要（現在未使用）" },
  { key: "privacy_contact", label: "申請フォームの問い合わせ窓口", type: "text", desc: "申請フォームの「個人情報の取扱いについて」に表示します（例：人事部 hr@example.com）。誰でも見られる欄なので公開してよい内容だけ入力してください" },
];

export default function Settings() {
  const { company, role, loading: companyLoading } = useCompany();
  const isOwner = role === "owner";
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [savedKey, setSavedKey] = useState(null);

  useEffect(() => {
    if (!company?.id) return;
    async function load() {
      const { data } = await supabase.from("settings").select("key, value").eq("company_id", company.id);
      const map = {};
      (data || []).forEach(row => { map[row.key] = row.value; });
      setValues(map);
      setLoading(false);
    }
    load();
  }, [company?.id]);

  function setDraft(key, val) {
    setValues(v => ({ ...v, [key]: val }));
  }

  async function handleSave(meta) {
    setSavingKey(meta.key);
    const { data: { session } } = await supabase.auth.getSession();
    const updaterEmail = session?.user?.email || null;
    const value = values[meta.key];

    const { error } = await supabase.from("settings")
      .update({ value, updated_at: new Date().toISOString(), updated_by: updaterEmail })
      .eq("company_id", company.id)
      .eq("key", meta.key);

    if (error) { alert("保存に失敗しました: " + error.message); setSavingKey(null); return; }

    await supabase.from("audit_logs").insert([{
      company_id: company.id,
      action: "update_setting",
      target_type: "settings",
      target_id: null,
      details: { key: meta.key, new_value: value },
    }]);

    setSavingKey(null);
    setSavedKey(meta.key);
    setTimeout(() => setSavedKey(null), 2000);
  }

  if (!companyLoading && !company) return <NoCompanyNotice />;
  if (loading) return <div style={{ color: "#94A3B8", padding: 40 }}>読み込み中...</div>;

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>設定</h1>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
          借上社宅管理規程に基づく料率・上限値です。変更するとアプリ全体の計算にすぐ反映されます
        </p>
        {!isOwner && (
          <p style={{ fontSize: 12, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 12px", marginTop: 12 }}>
            設定の変更は管理者（owner）のみ可能です。閲覧のみできます
          </p>
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {SETTINGS_META.map((meta, i) => (
          <div key={meta.key} style={{
            padding: "16px 20px",
            borderBottom: i < SETTINGS_META.length - 1 ? "1px solid #F1F5F9" : "none",
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
          }}>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{meta.label}</div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{meta.desc}</div>
            </div>
            <SettingInput meta={meta} value={values[meta.key]} onChange={val => setDraft(meta.key, val)} disabled={!isOwner} />
            {isOwner && <button onClick={() => handleSave(meta)} disabled={savingKey === meta.key} style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: savedKey === meta.key ? "#EFF6FF" : "#fff",
              color: savedKey === meta.key ? "#1D4ED8" : "#475569",
              border: `1px solid ${savedKey === meta.key ? "#BFDBFE" : "#E2E8F0"}`,
            }}>
              {savingKey === meta.key ? "保存中..." : savedKey === meta.key ? "保存しました" : "保存"}
            </button>}
          </div>
        ))}
      </div>

      {isOwner && <TeamSection />}

      {isOwner && <RetentionSection />}

      <MfaSection />
    </div>
  );
}

// 所属企業がないアカウント（企業登録・招待の承認が完了していない等）でログインしている場合の案内
function NoCompanyNotice() {
  return (
    <div style={{ maxWidth: 560, background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", padding: "24px 28px" }}>
      <h1 style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", marginBottom: 8 }}>所属している企業がありません</h1>
      <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.7 }}>
        このアカウントはどの企業にも所属していないため、設定を表示できません。
        企業の管理者から届いた招待リンク、または運営者から届いた企業登録の招待リンクから登録を完了してください。
      </p>
    </div>
  );
}

const ROLE_LABELS = { owner: "管理者", member: "メンバー" };
const INVITE_STATUS_LABELS = {
  pending: { label: "招待中", color: "#D97706", bg: "#FFFBEB" },
  accepted: { label: "参加済み", color: "#1D4ED8", bg: "#EFF6FF" },
  revoked: { label: "取り消し済み", color: "#64748B", bg: "#F1F5F9" },
};

// 所属メンバーの一覧。退職・異動した担当者を会社から外したり、権限を変更したりする
function MemberList() {
  const [members, setMembers] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function fetchMembers() {
    const { data, error } = await supabase.rpc("list_company_members");
    if (error) throw error;
    return data || [];
  }

  useEffect(() => {
    let cancelled = false;
    fetchMembers()
      .then(list => { if (!cancelled) setMembers(list); })
      .catch(e => { if (!cancelled) setError("メンバー一覧を取得できませんでした: " + e.message); });
    return () => { cancelled = true; };
  }, []);

  async function reload() {
    try { setMembers(await fetchMembers()); }
    catch (e) { setError("メンバー一覧を取得できませんでした: " + e.message); }
  }

  async function handleRoleChange(member, newRole) {
    setError("");
    setBusyId(member.user_id);
    const { error } = await supabase.rpc("set_member_role", { p_user_id: member.user_id, p_role: newRole });
    if (error) setError("権限を変更できませんでした: " + error.message);
    await reload();
    setBusyId(null);
  }

  async function handleRemove(member) {
    if (!window.confirm(`${member.email} を会社から外しますか？\n外すと、このユーザーはすぐに自社のデータを見られなくなります。`)) return;
    setError("");
    setBusyId(member.user_id);
    const { error } = await supabase.rpc("remove_company_member", { p_user_id: member.user_id });
    if (error) setError("メンバーを外せませんでした: " + error.message);
    await reload();
    setBusyId(null);
  }

  if (members === null && !error) return null;

  return (
    <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid #F1F5F9", fontSize: 12, fontWeight: 700, color: "#475569" }}>
        所属メンバー
      </div>
      {(members || []).map((m, i, list) => (
        <div key={m.user_id} style={{
          padding: "14px 20px",
          borderBottom: i < list.length - 1 ? "1px solid #F1F5F9" : "none",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", wordBreak: "break-all" }}>
              {m.email}{m.is_me && <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 400 }}>（あなた）</span>}
            </div>
          </div>
          {m.is_me ? (
            <span style={{ fontSize: 12, color: "#475569" }}>{ROLE_LABELS[m.role]}</span>
          ) : (
            <>
              <select value={m.role} disabled={busyId === m.user_id} onChange={e => handleRoleChange(m, e.target.value)}
                style={{ padding: "6px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, color: "#1E293B" }}>
                <option value="member">メンバー</option>
                <option value="owner">管理者</option>
              </select>
              <button onClick={() => handleRemove(m)} disabled={busyId === m.user_id} style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: "#fff", color: "#DC2626", border: "1px solid #FECACA",
              }}>
                会社から外す
              </button>
            </>
          )}
        </div>
      ))}
      {error && <p style={{ fontSize: 12, color: "#DC2626", padding: "10px 20px" }}>{error}</p>}
    </div>
  );
}

function TeamSection() {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("invites").select("*").order("created_at", { ascending: false });
    setInvites(data || []);
    setLoading(false);
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("create_invite", { p_email: email, p_role: role });
    if (rpcError) { setError("招待の送信に失敗しました: " + rpcError.message); setSending(false); return; }
    setEmail("");
    await load();
    setSending(false);
  }

  async function handleRevoke(id) {
    await supabase.rpc("revoke_invite", { p_invite_id: id });
    await load();
  }

  async function handleCopy(invite) {
    const url = `${window.location.origin}/invite/${invite.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>チームメンバー</h2>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
          他の担当者を招待すると、同じ企業のデータを一緒に管理できます
        </p>
      </div>

      <MemberList />

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", padding: "20px 24px", marginBottom: 16 }}>
        <form onSubmit={handleInvite} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 240px" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>メールアドレス</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#1E293B", outline: "none" }}
              placeholder="colleague@example.com" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>権限</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              style={{ padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#1E293B", outline: "none" }}>
              <option value="member">メンバー</option>
              <option value="owner">管理者</option>
            </select>
          </div>
          <button type="submit" disabled={sending} style={{
            padding: "9px 20px", background: sending ? "#93C5FD" : "#3B82F6", color: "#fff",
            border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13,
          }}>
            {sending ? "送信中..." : "招待する"}
          </button>
        </form>
        {error && <p style={{ fontSize: 12, color: "#DC2626", marginTop: 10 }}>{error}</p>}
      </div>

      {!loading && invites.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          {invites.map((inv, i) => {
            const st = INVITE_STATUS_LABELS[inv.status];
            return (
              <div key={inv.id} style={{
                padding: "14px 20px",
                borderBottom: i < invites.length - 1 ? "1px solid #F1F5F9" : "none",
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              }}>
                <div style={{ flex: "1 1 200px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{inv.email}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{ROLE_LABELS[inv.role]}</div>
                </div>
                <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                  {st.label}
                </span>
                {inv.status === "pending" && (
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

function SettingInput({ meta, value, onChange, disabled }) {
  const inputStyle = { width: 140, padding: "7px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#1E293B", outline: "none" };

  if (meta.type === "boolean") {
    return (
      <select value={value ? "true" : "false"} onChange={e => onChange(e.target.value === "true")} disabled={disabled} style={inputStyle}>
        <option value="false">しない</option>
        <option value="true">する</option>
      </select>
    );
  }

  if (meta.type === "text") {
    return (
      <input type="text" value={value ?? ""} maxLength={500} placeholder="未設定（社内の人事担当部署）"
        onChange={e => onChange(e.target.value)} disabled={disabled} style={{ ...inputStyle, width: 260 }} />
    );
  }

  if (meta.type === "percent") {
    const percentValue = value != null ? Math.round(value * 1000) / 10 : "";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="number" value={percentValue} step={0.1}
          onChange={e => onChange(e.target.value === "" ? null : parseFloat(e.target.value) / 100)}
          disabled={disabled} style={inputStyle} />
        <span style={{ fontSize: 12, color: "#64748B" }}>%</span>
      </div>
    );
  }

  return (
    <input type="number" value={value ?? ""} step="any"
      onChange={e => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
      disabled={disabled} style={inputStyle} />
  );
}

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCompany } from "../hooks/useCompany";

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
];

export default function Settings() {
  const { company, role } = useCompany();
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

  if (loading) return <div style={{ color: "#94A3B8", padding: 40 }}>読み込み中...</div>;

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>設定</h1>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
          借上社宅管理規程に基づく料率・上限値です。変更するとアプリ全体の計算にすぐ反映されます
        </p>
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
            <SettingInput meta={meta} value={values[meta.key]} onChange={val => setDraft(meta.key, val)} />
            <button onClick={() => handleSave(meta)} disabled={savingKey === meta.key} style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: savedKey === meta.key ? "#EFF6FF" : "#fff",
              color: savedKey === meta.key ? "#1D4ED8" : "#475569",
              border: `1px solid ${savedKey === meta.key ? "#BFDBFE" : "#E2E8F0"}`,
            }}>
              {savingKey === meta.key ? "保存中..." : savedKey === meta.key ? "保存しました" : "保存"}
            </button>
          </div>
        ))}
      </div>

      {role === "owner" && <TeamSection />}
    </div>
  );
}

const ROLE_LABELS = { owner: "管理者", member: "メンバー" };
const INVITE_STATUS_LABELS = {
  pending: { label: "招待中", color: "#D97706", bg: "#FFFBEB" },
  accepted: { label: "参加済み", color: "#1D4ED8", bg: "#EFF6FF" },
  revoked: { label: "取り消し済み", color: "#64748B", bg: "#F1F5F9" },
};

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

function SettingInput({ meta, value, onChange }) {
  const inputStyle = { width: 140, padding: "7px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#1E293B", outline: "none" };

  if (meta.type === "boolean") {
    return (
      <select value={value ? "true" : "false"} onChange={e => onChange(e.target.value === "true")} style={inputStyle}>
        <option value="false">しない</option>
        <option value="true">する</option>
      </select>
    );
  }

  if (meta.type === "percent") {
    const percentValue = value != null ? Math.round(value * 1000) / 10 : "";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="number" value={percentValue} step={0.1}
          onChange={e => onChange(e.target.value === "" ? null : parseFloat(e.target.value) / 100)}
          style={inputStyle} />
        <span style={{ fontSize: 12, color: "#64748B" }}>%</span>
      </div>
    );
  }

  return (
    <input type="number" value={value ?? ""} step="any"
      onChange={e => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
      style={inputStyle} />
  );
}

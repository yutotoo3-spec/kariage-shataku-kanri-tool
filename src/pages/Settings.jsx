import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [savedKey, setSavedKey] = useState(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("settings").select("key, value");
      const map = {};
      (data || []).forEach(row => { map[row.key] = row.value; });
      setValues(map);
      setLoading(false);
    }
    load();
  }, []);

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
      .eq("key", meta.key);

    if (error) { alert("保存に失敗しました: " + error.message); setSavingKey(null); return; }

    await supabase.from("audit_logs").insert([{
      user_email: updaterEmail,
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

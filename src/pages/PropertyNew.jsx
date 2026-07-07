import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const INITIAL = {
  property_name: "", property_address: "", building_type: "mansion", floor_area: "",
  owner_name: "", management_company: "", management_phone: "",
  company_contract_start: "", company_contract_end: "",
  monthly_rent: "", notice_period_months: "1",
  cancellation_penalty: "", cancellation_notes: "", notes: "",
};

export default function PropertyNew() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function validate() {
    const e = {};
    if (!form.property_name) e.property_name = "必須";
    if (!form.property_address) e.property_address = "必須";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    const { error } = await supabase.from("properties").insert([{
      property_name: form.property_name,
      property_address: form.property_address,
      building_type: form.building_type,
      floor_area: form.floor_area ? parseFloat(form.floor_area) : null,
      owner_name: form.owner_name || null,
      management_company: form.management_company || null,
      management_phone: form.management_phone || null,
      company_contract_start: form.company_contract_start || null,
      company_contract_end: form.company_contract_end || null,
      monthly_rent: form.monthly_rent ? parseInt(form.monthly_rent) : null,
      notice_period_months: form.notice_period_months ? parseInt(form.notice_period_months) : 1,
      cancellation_penalty: form.cancellation_penalty || null,
      cancellation_notes: form.cancellation_notes || null,
      notes: form.notes || null,
      status: "active",
    }]);

    if (error) { alert("登録に失敗しました: " + error.message); setSubmitting(false); return; }
    navigate("/properties");
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => navigate("/properties")} style={{ background: "none", border: "none", color: "#3B82F6", fontSize: 13, padding: 0, cursor: "pointer" }}>
          ← 物件台帳に戻る
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B", marginTop: 8 }}>物件を登録</h1>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>物件情報・解約条件を登録してください</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Section title="物件情報">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="物件名" required error={errors.property_name}>
              <input value={form.property_name} onChange={e => set("property_name", e.target.value)}
                style={inputStyle(errors.property_name)} placeholder="○○マンション 101号室" />
            </Field>
            <Field label="建物種別">
              <select value={form.building_type} onChange={e => set("building_type", e.target.value)} style={inputStyle()}>
                <option value="mansion">マンション・アパート</option>
                <option value="house">戸建</option>
                <option value="other">その他</option>
              </select>
            </Field>
            <Field label="物件住所" required error={errors.property_address} style={{ gridColumn: "1 / -1" }}>
              <input value={form.property_address} onChange={e => set("property_address", e.target.value)}
                style={inputStyle(errors.property_address)} placeholder="東京都渋谷区○○1-2-3" />
            </Field>
            <Field label="床面積（㎡）">
              <input type="number" value={form.floor_area} onChange={e => set("floor_area", e.target.value)}
                style={inputStyle()} placeholder="50" min={0} step={0.01} />
            </Field>
          </div>
        </Section>

        <Section title="貸主・管理会社情報">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="貸主名（オーナー）">
              <input value={form.owner_name} onChange={e => set("owner_name", e.target.value)}
                style={inputStyle()} placeholder="株式会社○○" />
            </Field>
            <Field label="管理会社名">
              <input value={form.management_company} onChange={e => set("management_company", e.target.value)}
                style={inputStyle()} placeholder="△△管理株式会社" />
            </Field>
            <Field label="管理会社電話番号">
              <input value={form.management_phone} onChange={e => set("management_phone", e.target.value)}
                style={inputStyle()} placeholder="03-xxxx-xxxx" />
            </Field>
          </div>
        </Section>

        <Section title="会社の賃貸借契約情報">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="会社契約開始日">
              <input type="date" value={form.company_contract_start} onChange={e => set("company_contract_start", e.target.value)} style={inputStyle()} />
            </Field>
            <Field label="会社契約終了日">
              <input type="date" value={form.company_contract_end} onChange={e => set("company_contract_end", e.target.value)} style={inputStyle()} />
            </Field>
            <Field label="月額賃料（円）">
              <input type="number" value={form.monthly_rent} onChange={e => set("monthly_rent", e.target.value)}
                style={inputStyle()} placeholder="150000" min={0} />
            </Field>
          </div>
        </Section>

        <Section title="解約条件">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="解約予告期間">
              <select value={form.notice_period_months} onChange={e => set("notice_period_months", e.target.value)} style={inputStyle()}>
                {[1, 2, 3, 4, 6].map(n => <option key={n} value={n}>{n}ヶ月前</option>)}
              </select>
            </Field>
            <Field label="違約金条件">
              <input value={form.cancellation_penalty} onChange={e => set("cancellation_penalty", e.target.value)}
                style={inputStyle()} placeholder="例：1年未満は賃料2ヶ月分" />
            </Field>
            <Field label="解約条件メモ" style={{ gridColumn: "1 / -1" }}>
              <textarea value={form.cancellation_notes} onChange={e => set("cancellation_notes", e.target.value)}
                style={{ ...inputStyle(), height: 80, resize: "vertical" }}
                placeholder="その他の解約に関する条件・注意事項" />
            </Field>
          </div>
        </Section>

        <Section title="備考">
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
            style={{ ...inputStyle(), height: 80, resize: "vertical", width: "100%" }}
            placeholder="その他の特記事項" />
        </Section>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
          <button type="button" onClick={() => navigate("/properties")} style={{
            padding: "10px 20px", border: "1px solid #E2E8F0", borderRadius: 8,
            background: "#fff", color: "#64748B", fontWeight: 500, cursor: "pointer",
          }}>
            キャンセル
          </button>
          <button type="submit" disabled={submitting} style={{
            padding: "10px 28px", background: submitting ? "#93C5FD" : "#3B82F6",
            color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>
            {submitting ? "登録中..." : "物件を登録する"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 16, letterSpacing: "0.04em" }}>{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, required, error, children, style }) {
  return (
    <div style={style}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
        {label} {required && <span style={{ color: "#EF4444" }}>*</span>}
      </label>
      {children}
      {error && <p style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>{error}</p>}
    </div>
  );
}

const inputStyle = (hasError) => ({
  width: "100%", padding: "9px 12px",
  border: `1px solid ${hasError ? "#FECACA" : "#E2E8F0"}`,
  borderRadius: 8, fontSize: 14, color: "#1E293B",
  background: hasError ? "#FFF5F5" : "#fff", outline: "none",
});

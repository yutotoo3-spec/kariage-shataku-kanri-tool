import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { calcSubsidyLimit, calcBurden } from "../utils/calc";
import CalcPreview from "../components/CalcPreview";

const INITIAL = {
  scene: "new_hire",
  name: "", email: "", basic_salary: "", family_type: "single",
  join_date: "",
  property_name: "", property_address: "",
  floor_area: "", actual_rent: "",
  desired_move_in: "",
  note: "",
};

export default function ApplicationNew() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function validate() {
    const e = {};
    if (!form.name) e.name = "必須";
    if (!form.basic_salary || form.basic_salary <= 0) e.basic_salary = "必須";
    if (!form.property_name) e.property_name = "必須";
    if (!form.property_address) e.property_address = "必須";
    if (!form.actual_rent || form.actual_rent <= 0) e.actual_rent = "必須";
    if (form.floor_area && form.floor_area > 99) e.floor_area = "99㎡以下でなければなりません";
    if (!form.desired_move_in) e.desired_move_in = "必須";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    const salary = parseInt(form.basic_salary);
    const rent = parseInt(form.actual_rent);
    const subsidyLimit = calcSubsidyLimit(salary, form.family_type);
    const { companyBurden, personalBurden } = calcBurden(rent, subsidyLimit);

    // 同一住所の重複チェック
    const { data: dup } = await supabase
      .from("tenancies")
      .select("id, name")
      .eq("property_address", form.property_address)
      .eq("status", "active");

    const { error } = await supabase.from("applications").insert([{
      scene: form.scene,
      name: form.name,
      email: form.email || null,
      basic_salary: salary,
      family_type: form.family_type,
      join_date: form.join_date || null,
      property_name: form.property_name,
      property_address: form.property_address,
      floor_area: form.floor_area ? parseFloat(form.floor_area) : null,
      actual_rent: rent,
      desired_move_in: form.desired_move_in,
      note: form.note || null,
      subsidy_limit: subsidyLimit,
      company_burden: companyBurden,
      personal_burden: personalBurden,
      status: "pending",
    }]);

    if (error) { alert("登録に失敗しました: " + error.message); setSubmitting(false); return; }

    if (dup && dup.length > 0) {
      alert(`⚠️ 同一住所に入居中の方がいます（${dup.map(d => d.name).join(", ")}）。\n登録は完了しましたが、審査時に確認してください。`);
    }

    navigate("/applications");
  }

  const salary = parseInt(form.basic_salary) || 0;
  const rent = parseInt(form.actual_rent) || 0;

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>新規申請登録</h1>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>対象者の情報と物件情報を入力してください</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* シーン選択 */}
        <Section title="申請シーン">
          <div style={{ display: "flex", gap: 12 }}>
            {[["new_hire", "採用時（新入社員）"], ["existing", "既存社員"]].map(([v, l]) => (
              <label key={v} style={{
                flex: 1, padding: "12px 16px",
                border: `2px solid ${form.scene === v ? "#3B82F6" : "#E2E8F0"}`,
                borderRadius: 10, cursor: "pointer",
                background: form.scene === v ? "#EFF6FF" : "#fff",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <input type="radio" name="scene" value={v} checked={form.scene === v}
                  onChange={() => set("scene", v)} style={{ display: "none" }} />
                <div style={{
                  width: 16, height: 16, borderRadius: "50%",
                  border: `2px solid ${form.scene === v ? "#3B82F6" : "#CBD5E1"}`,
                  background: form.scene === v ? "#3B82F6" : "transparent",
                }} />
                <span style={{ fontSize: 13, fontWeight: form.scene === v ? 600 : 400 }}>{l}</span>
              </label>
            ))}
          </div>
        </Section>

        {/* 対象者情報 */}
        <Section title="対象者情報">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="氏名" required error={errors.name}>
              <input value={form.name} onChange={e => set("name", e.target.value)}
                style={inputStyle(errors.name)} placeholder="山田 太郎" />
            </Field>
            <Field label="通知用メールアドレス" error={errors.email}>
              <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
                style={inputStyle()} placeholder="taro@example.com" />
            </Field>
            <Field label="基本給月額（円）" required error={errors.basic_salary}>
              <input type="number" value={form.basic_salary} onChange={e => set("basic_salary", e.target.value)}
                style={inputStyle(errors.basic_salary)} placeholder="300000" min={0} />
            </Field>
            <Field label="家族区分" required>
              <select value={form.family_type} onChange={e => set("family_type", e.target.value)} style={inputStyle()}>
                <option value="single">単身者（限度額 = 基本給÷5）</option>
                <option value="family">家族帯同者（限度額 = 基本給÷4）</option>
              </select>
            </Field>
            {form.scene === "new_hire" && (
              <Field label="入社日" error={errors.join_date}>
                <input type="date" value={form.join_date} onChange={e => set("join_date", e.target.value)}
                  style={inputStyle()} />
              </Field>
            )}
          </div>
        </Section>

        {/* 物件情報 */}
        <Section title="物件情報">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="物件名" required error={errors.property_name}>
              <input value={form.property_name} onChange={e => set("property_name", e.target.value)}
                style={inputStyle(errors.property_name)} placeholder="○○マンション 101号室" />
            </Field>
            <Field label="床面積（㎡）" error={errors.floor_area}>
              <input type="number" value={form.floor_area} onChange={e => set("floor_area", e.target.value)}
                style={inputStyle(errors.floor_area)} placeholder="50" min={0} max={99} step={0.01} />
              {form.floor_area > 99 && (
                <p style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>規程上99㎡以下が条件です</p>
              )}
            </Field>
            <Field label="物件住所" required error={errors.property_address} style={{ gridColumn: "1 / -1" }}>
              <input value={form.property_address} onChange={e => set("property_address", e.target.value)}
                style={inputStyle(errors.property_address)} placeholder="東京都渋谷区○○1-2-3" />
            </Field>
            <Field label="実賃料（月額・円）" required error={errors.actual_rent}>
              <input type="number" value={form.actual_rent} onChange={e => set("actual_rent", e.target.value)}
                style={inputStyle(errors.actual_rent)} placeholder="150000" min={0} />
              <p style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>家賃＋共益費＋管理費の合計</p>
            </Field>
            <Field label="入居希望日" required error={errors.desired_move_in}>
              <input type="date" value={form.desired_move_in} onChange={e => set("desired_move_in", e.target.value)}
                style={inputStyle(errors.desired_move_in)} />
            </Field>
          </div>

          {/* 自動計算プレビュー */}
          {salary > 0 && rent > 0 && (
            <div style={{ marginTop: 16 }}>
              <CalcPreview basicSalary={salary} familyType={form.family_type} actualRent={rent} />
            </div>
          )}
        </Section>

        {/* 備考 */}
        <Section title="備考">
          <textarea value={form.note} onChange={e => set("note", e.target.value)}
            style={{ ...inputStyle(), height: 80, resize: "vertical" }}
            placeholder="申請理由・特記事項など" />
        </Section>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
          <button type="button" onClick={() => navigate("/applications")}
            style={{ padding: "10px 20px", border: "1px solid #E2E8F0", borderRadius: 8, background: "#fff", color: "#64748B", fontWeight: 500 }}>
            キャンセル
          </button>
          <button type="submit" disabled={submitting} style={{
            padding: "10px 28px", background: submitting ? "#93C5FD" : "#3B82F6",
            color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14,
          }}>
            {submitting ? "登録中..." : "申請を登録する"}
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
  background: hasError ? "#FFF5F5" : "#fff",
  outline: "none",
});

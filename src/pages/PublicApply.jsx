import { useState } from "react";
import { supabase } from "../lib/supabase";
import { calcSubsidyLimit, calcBurden, calcActualRent, calcTotalPersonalDeduction, yen } from "../utils/calc";
import { useSettings } from "../hooks/useSettings";
import { MONTHLY_COST_FIELDS, emptyMonthlyCosts, parseMonthlyCosts } from "../utils/monthlyCosts";
import CalcPreview from "../components/CalcPreview";

const INITIAL = {
  scene: "new_hire",
  name: "", email: "", basic_salary: "", family_type: "single",
  join_date: "",
  property_name: "", property_address: "",
  floor_area: "",
  ...emptyMonthlyCosts(),
  desired_move_in: "",
  note: "",
};

export default function PublicApply() {
  const { settings } = useSettings();
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function validate() {
    const e = {};
    if (!form.name) e.name = "必須";
    if (!form.basic_salary || form.basic_salary <= 0) e.basic_salary = "必須";
    if (!form.property_name) e.property_name = "必須";
    if (!form.property_address) e.property_address = "必須";
    if (!form.rent || form.rent <= 0) e.rent = "必須";
    if (form.common_fee === "") e.common_fee = "必須（なければ0）";
    if (form.management_fee === "") e.management_fee = "必須（なければ0）";
    if (form.floor_area && form.floor_area > settings.floor_area_limit) e.floor_area = `${settings.floor_area_limit}㎡以下でなければなりません`;
    if (!form.desired_move_in) e.desired_move_in = "必須";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    const salary = parseInt(form.basic_salary);
    const costs = parseMonthlyCosts(form);
    const actualRent = calcActualRent(costs);
    const subsidyLimit = calcSubsidyLimit(salary, form.family_type, settings);
    const { companyBurden, personalBurden } = calcBurden(actualRent, subsidyLimit, settings);

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
      ...costs,
      actual_rent: actualRent,
      desired_move_in: form.desired_move_in,
      note: form.note || null,
      subsidy_limit: subsidyLimit,
      company_burden: companyBurden,
      personal_burden: personalBurden,
      status: "pending",
    }]);

    if (error) { alert("送信に失敗しました: " + error.message); setSubmitting(false); return; }
    setDone(true);
  }

  const salary = parseInt(form.basic_salary) || 0;
  const costs = parseMonthlyCosts(form);
  const actualRent = calcActualRent(costs);

  if (done) {
    return (
      <PageShell>
        <div style={{ textAlign: "center", padding: "24px 4px" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", marginBottom: 10 }}>送信が完了しました</h1>
          <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.7 }}>
            申請を受け付けました。人事担当者が内容を確認します。<br />
            審査状況は追ってご連絡します。
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: "#64748B", letterSpacing: "0.08em", marginBottom: 6 }}>
          ATHENA TECHNOLOGIES
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>
          借上社宅 入居申請フォーム
        </div>
        <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>
          入居を希望される物件の情報をご記入ください。送信後、人事担当者が内容を確認します。
        </p>
      </div>

      <form onSubmit={handleSubmit}>
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

        <Section title="ご本人情報">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <Field label="氏名" required error={errors.name}>
              <input value={form.name} onChange={e => set("name", e.target.value)}
                style={inputStyle(errors.name)} placeholder="山田 太郎" />
            </Field>
            <Field label="連絡用メールアドレス" error={errors.email}>
              <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
                style={inputStyle()} placeholder="taro@example.com" />
            </Field>
            <Field label="基本給月額（円）" required error={errors.basic_salary}>
              <input type="number" value={form.basic_salary} onChange={e => set("basic_salary", e.target.value)}
                style={inputStyle(errors.basic_salary)} placeholder="300000" min={0} />
            </Field>
            <Field label="家族区分" required>
              <select value={form.family_type} onChange={e => set("family_type", e.target.value)} style={inputStyle()}>
                <option value="single">単身者（限度額 = 基本給÷{Math.round(1 / settings.subsidy_ratio_single)}）</option>
                <option value="family">家族帯同者（限度額 = 基本給÷{Math.round(1 / settings.subsidy_ratio_family)}）</option>
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

        <Section title="物件情報">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <Field label="物件名" required error={errors.property_name}>
              <input value={form.property_name} onChange={e => set("property_name", e.target.value)}
                style={inputStyle(errors.property_name)} placeholder="○○マンション 101号室" />
            </Field>
            <Field label="床面積（㎡）" error={errors.floor_area}>
              <input type="number" value={form.floor_area} onChange={e => set("floor_area", e.target.value)}
                style={inputStyle(errors.floor_area)} placeholder="50" min={0} max={settings.floor_area_limit} step={0.01} />
              {form.floor_area > settings.floor_area_limit && (
                <p style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>規程上{settings.floor_area_limit}㎡以下が条件です</p>
              )}
            </Field>
            <Field label="物件住所" required error={errors.property_address} style={{ gridColumn: "1 / -1" }}>
              <input value={form.property_address} onChange={e => set("property_address", e.target.value)}
                style={inputStyle(errors.property_address)} placeholder="東京都渋谷区○○1-2-3" />
            </Field>
            <Field label="入居希望日" required error={errors.desired_move_in}>
              <input type="date" value={form.desired_move_in} onChange={e => set("desired_move_in", e.target.value)}
                style={inputStyle(errors.desired_move_in)} />
            </Field>
          </div>
        </Section>

        <Section title="毎月の費用">
          <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 16 }}>
            家賃・共益費・管理費は必須です。それ以外は該当がなければ空欄のままで構いません（0として扱います）
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {MONTHLY_COST_FIELDS.map(f => (
              <Field key={f.key} label={f.label} required={f.required} error={errors[f.key]}>
                <input type="number" value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                  style={inputStyle(errors[f.key])} placeholder={f.placeholder || "0"} min={0} />
                {f.note && <p style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>{f.note}</p>}
              </Field>
            ))}
          </div>

          {salary > 0 && actualRent > 0 && (
            <div style={{ marginTop: 16 }}>
              <CalcPreview basicSalary={salary} familyType={form.family_type} actualRent={actualRent} settings={settings} />
              <MonthlyDeductionNote costs={costs} salary={salary} familyType={form.family_type} actualRent={actualRent} settings={settings} />
            </div>
          )}
        </Section>

        <Section title="備考">
          <textarea value={form.note} onChange={e => set("note", e.target.value)}
            style={{ ...inputStyle(), height: 80, resize: "vertical" }}
            placeholder="申請理由・特記事項など" />
        </Section>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button type="submit" disabled={submitting} style={{
            padding: "12px 32px", background: submitting ? "#93C5FD" : "#3B82F6",
            color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14,
          }}>
            {submitting ? "送信中..." : "送信する"}
          </button>
        </div>
      </form>
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", padding: "40px 16px" }}>
      <div style={{
        maxWidth: 700, margin: "0 auto", background: "#fff", borderRadius: 16,
        padding: "40px 36px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      }}>
        {children}
      </div>
    </div>
  );
}

function MonthlyDeductionNote({ costs, salary, familyType, actualRent, settings }) {
  const subsidyLimit = calcSubsidyLimit(salary, familyType, settings);
  const { personalBurden } = calcBurden(actualRent, subsidyLimit, settings);
  const total = calcTotalPersonalDeduction(personalBurden, costs);
  return (
    <p style={{ fontSize: 11, color: "#64748B", marginTop: 8 }}>
      ※ 上記に加えて駐車場代・町内会費等の本人負担の毎月費用を含めた、給与からの控除見込み合計は <strong>{yen(total)}</strong> です
    </p>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
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

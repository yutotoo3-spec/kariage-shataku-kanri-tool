import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { calcSubsidyLimit, calcBurden } from "../utils/calc";
import CalcPreview from "../components/CalcPreview";

const FAMILY_LABELS = { single: "単身者（限度額 = 基本給÷5）", family: "家族帯同者（限度額 = 基本給÷4）" };

export default function ApplicationDraftDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [form, setForm] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [showDismiss, setShowDismiss] = useState(false);
  const [dismissNote, setDismissNote] = useState("");

  useEffect(() => {
    supabase.from("application_drafts").select("*").eq("id", id).single()
      .then(({ data }) => { if (data) { setDraft(data); setForm(data); } });
  }, [id]);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleRegister() {
    setProcessing(true);
    const salary = parseInt(form.basic_salary);
    const rent = parseInt(form.actual_rent);
    const subsidyLimit = calcSubsidyLimit(salary, form.family_type);
    const { companyBurden, personalBurden } = calcBurden(rent, subsidyLimit);

    const { data: { session } } = await supabase.auth.getSession();
    const reviewerEmail = session?.user?.email || null;

    const { data: app, error } = await supabase.from("applications").insert([{
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
    }]).select("id").single();

    if (error) { alert("申請登録に失敗しました: " + error.message); setProcessing(false); return; }

    await supabase.from("application_drafts").update({
      status: "converted",
      converted_application_id: app.id,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerEmail,
    }).eq("id", id);

    await supabase.from("audit_logs").insert([{
      user_email: reviewerEmail,
      action: "convert_draft_to_application",
      target_type: "application",
      target_id: app.id,
      details: { draft_id: id, name: form.name },
    }]);

    navigate(`/applications/${app.id}`);
  }

  async function handleDismiss() {
    setProcessing(true);
    const { data: { session } } = await supabase.auth.getSession();
    const reviewerEmail = session?.user?.email || null;

    await supabase.from("application_drafts").update({
      status: "dismissed",
      review_note: dismissNote || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerEmail,
    }).eq("id", id);

    navigate("/application-drafts");
  }

  if (!draft || !form) return <div style={{ color: "#94A3B8", padding: 40 }}>読み込み中...</div>;

  const editable = draft.status === "submitted";
  const salary = parseInt(form.basic_salary) || 0;
  const rent = parseInt(form.actual_rent) || 0;

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate("/application-drafts")} style={{ background: "none", border: "none", color: "#3B82F6", fontSize: 13, padding: 0 }}>
          ← 一覧に戻る
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>{draft.name}さんの送信内容</h1>
      </div>

      {!editable && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", borderRadius: 8, fontSize: 13,
          background: draft.status === "converted" ? "#F0FDF4" : "#F8FAFC",
          color: draft.status === "converted" ? "#15803D" : "#64748B",
        }}>
          {draft.status === "converted" ? "✅ この受付はすでに申請登録済みです" : "この受付は却下済みです"}
          {draft.review_note && ` — ${draft.review_note}`}
        </div>
      )}

      <Card title="内容確認・修正">
        <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 16 }}>
          本人からの送信内容です。表記ゆれ・誤字があれば修正してから登録してください
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="氏名">
            <input value={form.name} onChange={e => set("name", e.target.value)} style={inputStyle} disabled={!editable} />
          </Field>
          <Field label="メール">
            <input value={form.email || ""} onChange={e => set("email", e.target.value)} style={inputStyle} disabled={!editable} />
          </Field>
          <Field label="基本給月額（円）">
            <input type="number" value={form.basic_salary} onChange={e => set("basic_salary", e.target.value)} style={inputStyle} disabled={!editable} />
          </Field>
          <Field label="家族区分">
            <select value={form.family_type} onChange={e => set("family_type", e.target.value)} style={inputStyle} disabled={!editable}>
              {Object.entries(FAMILY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          {form.scene === "new_hire" && (
            <Field label="入社日">
              <input type="date" value={form.join_date || ""} onChange={e => set("join_date", e.target.value)} style={inputStyle} disabled={!editable} />
            </Field>
          )}
          <Field label="物件名">
            <input value={form.property_name} onChange={e => set("property_name", e.target.value)} style={inputStyle} disabled={!editable} />
          </Field>
          <Field label="床面積（㎡）">
            <input type="number" value={form.floor_area || ""} onChange={e => set("floor_area", e.target.value)} style={inputStyle} disabled={!editable} />
          </Field>
          <Field label="物件住所" full>
            <input value={form.property_address} onChange={e => set("property_address", e.target.value)} style={inputStyle} disabled={!editable} />
          </Field>
          <Field label="実賃料（月額・円）">
            <input type="number" value={form.actual_rent} onChange={e => set("actual_rent", e.target.value)} style={inputStyle} disabled={!editable} />
          </Field>
          <Field label="入居希望日">
            <input type="date" value={form.desired_move_in} onChange={e => set("desired_move_in", e.target.value)} style={inputStyle} disabled={!editable} />
          </Field>
        </div>

        {form.note && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 4 }}>備考</div>
            <div style={{ fontSize: 13, color: "#475569", whiteSpace: "pre-wrap" }}>{form.note}</div>
          </div>
        )}

        {salary > 0 && rent > 0 && (
          <div style={{ marginTop: 16 }}>
            <CalcPreview basicSalary={salary} familyType={form.family_type} actualRent={rent} />
          </div>
        )}
      </Card>

      {editable && (
        <Card title="対応">
          {!showDismiss ? (
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setShowDismiss(true)} style={btnSecondary}>却下する</button>
              <button onClick={handleRegister} disabled={processing} style={btnPrimary}>
                {processing ? "登録中..." : "確認して申請登録する"}
              </button>
            </div>
          ) : (
            <div>
              <label style={labelStyle}>却下理由（任意・社内メモ用）</label>
              <textarea value={dismissNote} onChange={e => setDismissNote(e.target.value)}
                style={{ ...inputStyle, height: 70, resize: "vertical", marginBottom: 12 }}
                placeholder="重複送信・条件不適合など" />
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button onClick={() => setShowDismiss(false)} style={btnSecondary}>キャンセル</button>
                <button onClick={handleDismiss} disabled={processing} style={{ ...btnPrimary, background: "#EF4444" }}>
                  {processing ? "処理中..." : "却下を確定する"}
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 16, letterSpacing: "0.04em" }}>{title}</h2>
      {children}
    </div>
  );
}
function Field({ label, children, full }) {
  return (
    <div style={full ? { gridColumn: "1 / -1" } : undefined}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 };
const inputStyle = { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 14, color: "#1E293B", outline: "none" };
const btnPrimary = { padding: "10px 24px", background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" };
const btnSecondary = { padding: "10px 20px", border: "1px solid #E2E8F0", borderRadius: 8, background: "#fff", color: "#64748B", fontWeight: 500, cursor: "pointer" };

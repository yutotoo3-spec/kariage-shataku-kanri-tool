import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { calcSubsidyLimit, calcBurden, yen } from "../utils/calc";

const FAMILY_LABELS = { single: "単身者（基本給÷5）", family: "家族帯同者（基本給÷4）" };

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [rentHistory, setRentHistory] = useState([]);
  const [showRentModal, setShowRentModal] = useState(false);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showMoveOutModal, setShowMoveOutModal] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    const [{ data: t }, { data: hist }] = await Promise.all([
      supabase.from("tenancies").select("*").eq("id", id).single(),
      supabase.from("rent_history").select("*").eq("tenancy_id", id).order("effective_date", { ascending: false }),
    ]);
    setTenant(t);
    setRentHistory(hist || []);
  }

  const current = rentHistory[0];

  if (!tenant) return <div style={{ color: "#94A3B8", padding: 40 }}>読み込み中...</div>;

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <button onClick={() => navigate("/tenants")} style={{ background: "none", border: "none", color: "#3B82F6", fontSize: 13, padding: 0 }}>
          ← 台帳に戻る
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>{tenant.name}さん</h1>
        <StatusBadge status={tenant.status} />
      </div>

      {/* 基本情報 */}
      <Card title="基本情報">
        <Grid>
          <Item label="氏名" value={tenant.name} bold />
          <Item label="メール" value={tenant.email || "—"} />
          <Item label="基本給月額" value={yen(tenant.basic_salary)} />
          <Item label="家族区分" value={FAMILY_LABELS[tenant.family_type]} />
          <Item label="物件名" value={tenant.property_name} />
          <Item label="床面積" value={tenant.floor_area ? `${tenant.floor_area}㎡` : "—"} />
          <Item label="物件住所" value={tenant.property_address} style={{ gridColumn: "1 / -1" }} />
          <Item label="契約開始日" value={tenant.contract_start} />
          <Item label="契約満了日" value={tenant.contract_end || "—"} />
        </Grid>
        {tenant.status === "active" && (
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <ActionBtn label="基本給を更新（4月）" onClick={() => setShowSalaryModal(true)} />
            <ActionBtn label="家族区分を変更" onClick={() => setShowFamilyModal(true)} />
            <ActionBtn label="実賃料を変更" onClick={() => setShowRentModal(true)} />
            <ActionBtn label="退去申請" onClick={() => setShowMoveOutModal(true)} variant="danger" />
          </div>
        )}
      </Card>

      {/* 現在の負担額 */}
      {current && (
        <Card title="現在の負担額">
          <Grid>
            <Item label="実賃料（月額）" value={yen(current.actual_rent)} />
            <Item label="補助対象限度額" value={yen(current.subsidy_limit)} />
            <Item label="会社負担額（月）" value={yen(current.company_burden)} bold />
            <Item label="本人負担額（月）" value={yen(current.personal_burden)} bold />
            <Item label="適用開始日" value={current.effective_date} />
          </Grid>
        </Card>
      )}

      {/* 実賃料変更履歴 */}
      <Card title="実賃料変更履歴">
        {rentHistory.length === 0 ? (
          <p style={{ fontSize: 13, color: "#94A3B8" }}>履歴がありません</p>
        ) : (
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  {["適用開始日", "実賃料", "限度額", "会社負担", "本人負担", "変更日時"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rentHistory.map((h, i) => (
                  <tr key={h.id} style={{ borderBottom: "1px solid #F1F5F9", background: i === 0 ? "#EFF6FF" : undefined }}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{h.effective_date} {i === 0 && <span style={{ fontSize: 10, color: "#3B82F6", fontWeight: 700 }}>現在</span>}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{yen(h.actual_rent)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{yen(h.subsidy_limit)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{yen(h.company_burden)}</td>
                    <td style={{ ...td, fontWeight: 600, whiteSpace: "nowrap" }}>{yen(h.personal_burden)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{h.changed_at?.slice(0, 16).replace("T", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 退去情報 */}
      {tenant.status !== "active" && (
        <Card title="退去情報">
          <Grid>
            <Item label="退去予定日" value={tenant.move_out_date || "—"} />
            <Item label="退去理由" value={tenant.move_out_reason || "—"} />
            <Item label="原状回復費用（入居者負担分）" value={yen(tenant.restoration_cost)} />
          </Grid>
        </Card>
      )}

      {/* モーダル群 */}
      {showRentModal && <RentModal tenant={tenant} onClose={() => setShowRentModal(false)} onSave={loadData} />}
      {showFamilyModal && <FamilyModal tenant={tenant} onClose={() => setShowFamilyModal(false)} onSave={loadData} />}
      {showMoveOutModal && <MoveOutModal tenant={tenant} onClose={() => setShowMoveOutModal(false)} onSave={() => { loadData(); navigate("/tenants"); }} />}
      {showSalaryModal && <SalaryModal tenant={tenant} rentHistory={rentHistory} onClose={() => setShowSalaryModal(false)} onSave={loadData} />}
    </div>
  );
}

// 実賃料変更モーダル
function RentModal({ tenant, onClose, onSave }) {
  const [effectiveDate, setEffectiveDate] = useState("");
  const [newRent, setNewRent] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handle() {
    if (!effectiveDate || !newRent) { alert("適用開始日と新しい実賃料を入力してください"); return; }
    setSaving(true);
    const subsidyLimit = calcSubsidyLimit(tenant.basic_salary, tenant.family_type);
    const { companyBurden, personalBurden } = calcBurden(parseInt(newRent), subsidyLimit);
    await supabase.from("rent_history").insert([{
      tenancy_id: tenant.id,
      effective_date: effectiveDate,
      actual_rent: parseInt(newRent),
      subsidy_limit: subsidyLimit,
      company_burden: companyBurden,
      personal_burden: personalBurden,
      note: note || null,
    }]);
    await supabase.from("audit_logs").insert([{
      action: "update_rent", target_type: "tenancy", target_id: tenant.id,
      details: { new_rent: newRent, effective_date: effectiveDate },
    }]);
    setSaving(false);
    onSave();
    onClose();
  }

  return <Modal title="実賃料を変更" onClose={onClose}>
    <Field label="適用開始日">
      <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} style={inputStyle} />
    </Field>
    <Field label="新しい実賃料（月額・円）">
      <input type="number" value={newRent} onChange={e => setNewRent(e.target.value)} style={inputStyle} placeholder="165000" />
    </Field>
    <Field label="変更理由（任意）">
      <input value={note} onChange={e => setNote(e.target.value)} style={inputStyle} placeholder="管理費値上げ等" />
    </Field>
    <button onClick={handle} disabled={saving} style={btnPrimary}>{saving ? "保存中..." : "変更を保存"}</button>
  </Modal>;
}

// 家族区分変更モーダル
function FamilyModal({ tenant, onClose, onSave }) {
  const [familyType, setFamilyType] = useState(tenant.family_type);
  const [saving, setSaving] = useState(false);

  async function handle() {
    setSaving(true);
    await supabase.from("tenancies").update({ family_type: familyType }).eq("id", tenant.id);
    await supabase.from("audit_logs").insert([{
      action: "update_family_type", target_type: "tenancy", target_id: tenant.id,
      details: { old: tenant.family_type, new: familyType },
    }]);
    setSaving(false);
    onSave();
    onClose();
  }

  return <Modal title="家族区分を変更" onClose={onClose}>
    <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>結婚・出産等で家族区分が変わった場合は変更してください。次の月次処理から新しい限度額が反映されます。</p>
    <Field label="新しい家族区分">
      <select value={familyType} onChange={e => setFamilyType(e.target.value)} style={inputStyle}>
        <option value="single">単身者（限度額 = 基本給÷5）</option>
        <option value="family">家族帯同者（限度額 = 基本給÷4）</option>
      </select>
    </Field>
    <button onClick={handle} disabled={saving} style={btnPrimary}>{saving ? "保存中..." : "変更を保存"}</button>
  </Modal>;
}

// 基本給更新モーダル（4月用）
function SalaryModal({ tenant, rentHistory, onClose, onSave }) {
  const [newSalary, setNewSalary] = useState(tenant.basic_salary);
  const [saving, setSaving] = useState(false);
  const current = rentHistory[0];

  const newSubsidyLimit = calcSubsidyLimit(parseInt(newSalary) || 0, tenant.family_type);
  const newBurden = current ? calcBurden(current.actual_rent, newSubsidyLimit) : null;

  async function handle() {
    if (!newSalary) return;
    setSaving(true);
    await supabase.from("tenancies").update({ basic_salary: parseInt(newSalary) }).eq("id", tenant.id);
    // 4月1日から有効な新しい家賃履歴を追加
    if (current) {
      const april = `${new Date().getFullYear()}-04-01`;
      await supabase.from("rent_history").insert([{
        tenancy_id: tenant.id,
        effective_date: april,
        actual_rent: current.actual_rent,
        subsidy_limit: newSubsidyLimit,
        company_burden: newBurden.companyBurden,
        personal_burden: newBurden.personalBurden,
        note: `4月見直し（基本給変更: ${yen(tenant.basic_salary)} → ${yen(parseInt(newSalary))}）`,
      }]);
    }
    await supabase.from("audit_logs").insert([{
      action: "update_salary_april", target_type: "tenancy", target_id: tenant.id,
      details: { old: tenant.basic_salary, new: newSalary },
    }]);
    setSaving(false);
    onSave();
    onClose();
  }

  return <Modal title="基本給を更新（4月見直し）" onClose={onClose}>
    <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>4月1日時点の基本給に更新します。4月分の控除から新しい限度額が適用されます。</p>
    <Field label="新しい基本給月額（円）">
      <input type="number" value={newSalary} onChange={e => setNewSalary(e.target.value)} style={inputStyle} />
    </Field>
    {newBurden && (
      <div style={{ background: "#EFF6FF", borderRadius: 8, padding: "12px 16px", margin: "12px 0", fontSize: 13 }}>
        <div style={{ color: "#64748B", marginBottom: 6 }}>変更後の負担額（4月〜）</div>
        <div style={{ display: "flex", gap: 20 }}>
          <div><span style={{ color: "#94A3B8" }}>限度額</span> <strong>{yen(newSubsidyLimit)}</strong></div>
          <div><span style={{ color: "#94A3B8" }}>会社負担</span> <strong>{yen(newBurden.companyBurden)}</strong></div>
          <div><span style={{ color: "#94A3B8" }}>本人負担</span> <strong>{yen(newBurden.personalBurden)}</strong></div>
        </div>
      </div>
    )}
    <button onClick={handle} disabled={saving} style={btnPrimary}>{saving ? "更新中..." : "4月分として保存"}</button>
  </Modal>;
}

// 退去申請モーダル
function MoveOutModal({ tenant, onClose, onSave }) {
  const [moveOutDate, setMoveOutDate] = useState("");
  const [reason, setReason] = useState("");
  const [restorationCost, setRestorationCost] = useState("0");
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const twoWeeksLater = new Date(today.getTime() + 14 * 86400000);
  const isValidDate = moveOutDate && new Date(moveOutDate) >= twoWeeksLater;

  async function handle() {
    if (!moveOutDate) { alert("退去希望日を入力してください"); return; }
    if (!isValidDate) {
      const ok = window.confirm("退去日は2週間前までの申請が必要です（規程第15条）。\n期限外ですが登録しますか？");
      if (!ok) return;
    }
    setSaving(true);
    await supabase.from("tenancies").update({
      status: "move_out_pending",
      move_out_date: moveOutDate,
      move_out_reason: reason || null,
      restoration_cost: parseInt(restorationCost) || 0,
    }).eq("id", tenant.id);
    await supabase.from("audit_logs").insert([{
      action: "move_out_request", target_type: "tenancy", target_id: tenant.id,
      details: { move_out_date: moveOutDate },
    }]);
    setSaving(false);
    onSave();
    onClose();
  }

  return <Modal title="退去申請" onClose={onClose}>
    <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>退去日は2週間前までの申請が必要です（規程第15条）。</p>
    <Field label="退去希望日">
      <input type="date" value={moveOutDate} onChange={e => setMoveOutDate(e.target.value)} style={inputStyle} />
      {moveOutDate && !isValidDate && (
        <p style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>⚠️ 2週間前を切っています（規程違反）</p>
      )}
    </Field>
    <Field label="退去理由">
      <input value={reason} onChange={e => setReason(e.target.value)} style={inputStyle} placeholder="退職・転勤・自己都合等" />
    </Field>
    <Field label="原状回復費用（入居者負担分・円）">
      <input type="number" value={restorationCost} onChange={e => setRestorationCost(e.target.value)} style={inputStyle} />
      <p style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>故意・重過失・通常使用範囲外の損耗分のみ</p>
    </Field>
    <button onClick={handle} disabled={saving} style={{ ...btnPrimary, background: "#EF4444" }}>{saving ? "登録中..." : "退去申請を登録"}</button>
  </Modal>;
}

function Modal({ title, children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", width: 480, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#94A3B8", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {children}
        </div>
      </div>
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
function Grid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px 20px" }}>{children}</div>;
}
function Item({ label, value, bold, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#1E293B", fontWeight: bold ? 700 : 400 }}>{value}</div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
function ActionBtn({ label, onClick, variant = "default" }) {
  const danger = variant === "danger";
  return (
    <button onClick={onClick} style={{
      padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
      background: danger ? "#FEF2F2" : "#fff",
      color: danger ? "#DC2626" : "#475569",
      border: `1px solid ${danger ? "#FECACA" : "#E2E8F0"}`,
    }}>
      {label}
    </button>
  );
}
function StatusBadge({ status }) {
  const map = { active: ["入居中", "#3B82F6", "#EFF6FF"], move_out_pending: ["退去手続き中", "#F59E0B", "#FFFBEB"], moved_out: ["退去済", "#94A3B8", "#F8FAFC"] };
  const [l, c, bg] = map[status] || map.moved_out;
  return <span style={{ padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: bg, color: c }}>{l}</span>;
}

const td = { padding: "10px 12px", fontSize: 13, color: "#475569" };
const inputStyle = { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 14, color: "#1E293B", outline: "none" };
const btnPrimary = { padding: "10px 24px", background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer", width: "100%" };

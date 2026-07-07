import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { calcNoticeDeadline } from "../utils/calc";

const DOC_TYPES = {
  lease_contract: "賃貸借契約書",
  important_matters: "重要事項説明書",
  resident_contract: "入居者利用契約書",
  video_link: "重要事項説明動画",
  other: "その他",
};

const BUILDING_LABELS = { mansion: "マンション・アパート", house: "戸建", other: "その他" };

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: prop } = await supabase.from("properties").select("*").eq("id", id).single();
    if (!prop) { setLoading(false); return; }
    setProperty(prop);

    const [{ data: docs }, { data: t1 }] = await Promise.all([
      supabase.from("property_documents").select("*").eq("property_id", id).order("uploaded_at", { ascending: false }),
      supabase.from("tenancies").select("id, name, status, contract_start, contract_end")
        .eq("property_id", prop.id).eq("status", "active").limit(1),
    ]);

    let activeTenant = t1?.[0] || null;
    if (!activeTenant) {
      const { data: t2 } = await supabase.from("tenancies")
        .select("id, name, status, contract_start, contract_end")
        .eq("property_address", prop.property_address).eq("status", "active").limit(1);
      activeTenant = t2?.[0] || null;
    }

    setTenant(activeTenant);
    setDocuments(docs || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  function getNoticeInfo() {
    if (!property || property.status !== "active") return null;
    return calcNoticeDeadline(property.company_contract_end, property.notice_period_months);
  }

  async function handleDeleteDoc(docId) {
    if (!confirm("この書類を削除しますか？")) return;
    await supabase.from("property_documents").delete().eq("id", docId);
    load();
  }

  async function handleCancelProperty() {
    if (!confirm("この物件を解約済みにしますか？")) return;
    await supabase.from("properties").update({ status: "cancelled" }).eq("id", id);
    setProperty(p => ({ ...p, status: "cancelled" }));
  }

  if (loading) return <div style={{ color: "#94A3B8", padding: 40 }}>読み込み中...</div>;
  if (!property) return <div style={{ color: "#94A3B8", padding: 40 }}>物件が見つかりません</div>;

  const notice = getNoticeInfo();
  const isExpired = notice && notice.daysLeft < 0;
  const isWarning = notice && notice.daysLeft >= 0 && notice.daysLeft <= 90;
  const docsByType = Object.keys(DOC_TYPES).reduce((acc, type) => {
    acc[type] = documents.filter(d => d.document_type === type);
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate("/properties")} style={{ background: "none", border: "none", color: "#3B82F6", fontSize: 13, padding: 0, cursor: "pointer" }}>
          ← 物件台帳に戻る
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>{property.property_name}</h1>
        <span style={{
          fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
          background: property.status === "active" ? "#DCFCE7" : "#F1F5F9",
          color: property.status === "active" ? "#15803D" : "#64748B",
        }}>
          {property.status === "active" ? "運用中" : "解約済"}
        </span>
      </div>

      {(isExpired || isWarning) && (
        <div style={{
          marginBottom: 16, padding: "12px 16px",
          background: isExpired ? "#FEF2F2" : "#FFFBEB",
          border: `1px solid ${isExpired ? "#FECACA" : "#FDE68A"}`,
          borderRadius: 10, fontSize: 13, fontWeight: 600,
          color: isExpired ? "#DC2626" : "#D97706",
        }}>
          {isExpired
            ? `⚠ 解約通知期限を${Math.abs(notice.daysLeft)}日超過しています（期限：${notice.deadlineStr}）`
            : `⚠ 解約通知期限まであと${notice.daysLeft}日 — ${notice.deadlineStr}までに通知が必要です`}
        </div>
      )}

      {/* 物件基本情報 */}
      <Card title="物件基本情報" action={
        <button onClick={() => setShowEditModal(true)} style={btnOutline}>編集</button>
      }>
        <Grid>
          <Item label="物件名" value={property.property_name} bold />
          <Item label="建物種別" value={BUILDING_LABELS[property.building_type] || "—"} />
          <Item label="物件住所" value={property.property_address} style={{ gridColumn: "1 / -1" }} />
          {property.floor_area && <Item label="床面積" value={`${property.floor_area}㎡`} />}
          <Item label="貸主名" value={property.owner_name || "—"} />
          <Item label="管理会社" value={property.management_company || "—"} />
          {property.management_phone && <Item label="管理会社電話" value={property.management_phone} />}
        </Grid>
      </Card>

      {/* 契約・解約条件 */}
      <Card title="契約・解約条件">
        <Grid>
          <Item label="会社契約開始" value={property.company_contract_start || "—"} />
          <Item label="会社契約終了" value={property.company_contract_end || "—"} />
          <Item label="月額賃料" value={property.monthly_rent ? `¥${property.monthly_rent.toLocaleString()}` : "—"} />
          <Item label="解約予告期間" value={property.notice_period_months ? `${property.notice_period_months}ヶ月前` : "—"} bold />
          {property.cancellation_penalty && (
            <Item label="違約金条件" value={property.cancellation_penalty} style={{ gridColumn: "1 / -1" }} />
          )}
          {property.cancellation_notes && (
            <Item label="解約条件メモ" value={property.cancellation_notes} style={{ gridColumn: "1 / -1" }} />
          )}
        </Grid>
        {notice && (
          <div style={{ marginTop: 12, padding: "8px 12px", background: "#F8FAFC", borderRadius: 8, fontSize: 12, color: "#64748B" }}>
            解約通知期限：<strong>{notice.deadlineStr}</strong>（契約終了の{property.notice_period_months}ヶ月前）
          </div>
        )}
      </Card>

      {/* 現入居者 */}
      <Card title="現入居者">
        {tenant ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", marginBottom: 4 }}>{tenant.name}</div>
              <div style={{ fontSize: 12, color: "#64748B" }}>
                入居開始：{tenant.contract_start || "—"}
                {tenant.contract_end && `　満了：${tenant.contract_end}`}
              </div>
            </div>
            <Link to={`/tenants/${tenant.id}`} style={{
              padding: "7px 16px", background: "#EFF6FF", color: "#3B82F6",
              borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none",
            }}>
              台帳を見る →
            </Link>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#94A3B8" }}>現在の入居者はいません</div>
        )}
      </Card>

      {/* 書類管理 */}
      <Card title="書類管理" action={
        <button onClick={() => setShowDocModal(true)} style={{
          padding: "7px 16px", background: "#3B82F6", color: "#fff",
          border: "none", borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: "pointer",
        }}>
          + 書類を追加
        </button>
      }>
        {documents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#94A3B8", fontSize: 13 }}>
            書類が登録されていません。「書類を追加」から登録してください。
          </div>
        ) : (
          <div>
            {Object.entries(DOC_TYPES).map(([type, label]) => {
              const docs = docsByType[type];
              if (!docs || docs.length === 0) return null;
              return (
                <div key={type} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
                    {label}
                    <span style={{ fontWeight: 400, color: "#94A3B8", marginLeft: 6 }}>（{docs.length}件）</span>
                  </div>
                  {docs.map(doc => (
                    <div key={doc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F8FAFC" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#1E293B" }}>{doc.document_name}</div>
                        {doc.notes && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{doc.notes}</div>}
                        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{doc.uploaded_at?.slice(0, 10)} 登録</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {doc.external_url && (
                          <a href={doc.external_url} target="_blank" rel="noopener noreferrer" style={{
                            padding: "5px 12px", background: "#EFF6FF", color: "#3B82F6",
                            borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: "none",
                          }}>
                            開く →
                          </a>
                        )}
                        <button onClick={() => handleDeleteDoc(doc.id)} style={{
                          padding: "5px 10px", background: "transparent", color: "#94A3B8",
                          border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 12, cursor: "pointer",
                        }}>
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {property.notes && (
        <Card title="備考">
          <p style={{ fontSize: 13, color: "#475569", whiteSpace: "pre-wrap" }}>{property.notes}</p>
        </Card>
      )}

      {property.status === "active" && (
        <div style={{ marginTop: 8, textAlign: "right" }}>
          <button onClick={handleCancelProperty} style={{
            padding: "8px 20px", background: "transparent", color: "#DC2626",
            border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, cursor: "pointer",
          }}>
            この物件を解約済みにする
          </button>
        </div>
      )}

      {showDocModal && (
        <DocModal propertyId={id} onClose={() => setShowDocModal(false)} onSaved={() => { load(); setShowDocModal(false); }} />
      )}
      {showEditModal && (
        <EditPropertyModal property={property} onClose={() => setShowEditModal(false)} onSaved={() => { load(); setShowEditModal(false); }} />
      )}
    </div>
  );
}

function DocModal({ propertyId, onClose, onSaved }) {
  const [form, setForm] = useState({ document_type: "lease_contract", document_name: "", external_url: "", notes: "" });
  const [saving, setSaving] = useState(false);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.document_name) { alert("書類名を入力してください"); return; }
    setSaving(true);
    const { error } = await supabase.from("property_documents").insert([{
      property_id: propertyId,
      document_type: form.document_type,
      document_name: form.document_name,
      external_url: form.external_url || null,
      notes: form.notes || null,
    }]);
    if (error) { alert("登録に失敗しました: " + error.message); setSaving(false); return; }
    onSaved();
  }

  return (
    <Modal title="書類を追加" onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <label style={lStyle}>書類種別</label>
        <select value={form.document_type} onChange={e => set("document_type", e.target.value)} style={iStyle()}>
          {Object.entries(DOC_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={lStyle}>書類名・タイトル <span style={{ color: "#EF4444" }}>*</span></label>
        <input value={form.document_name} onChange={e => set("document_name", e.target.value)}
          style={iStyle()} placeholder="例：賃貸借契約書（2024年4月更新版）" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={lStyle}>リンクURL（Google Drive・YouTube など）</label>
        <input value={form.external_url} onChange={e => set("external_url", e.target.value)}
          style={iStyle()} placeholder="https://drive.google.com/..." />
        <p style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
          PDFはGoogleドライブ、動画はYouTube/DriveのURLを貼り付けてください
        </p>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={lStyle}>メモ</label>
        <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
          style={{ ...iStyle(), height: 60, resize: "vertical" }} placeholder="補足情報など" />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={btnOutline}>キャンセル</button>
        <button onClick={handleSave} disabled={saving} style={{
          padding: "9px 24px", background: "#3B82F6", color: "#fff",
          border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer",
        }}>
          {saving ? "保存中..." : "保存する"}
        </button>
      </div>
    </Modal>
  );
}

function EditPropertyModal({ property, onClose, onSaved }) {
  const [form, setForm] = useState({
    property_name: property.property_name || "",
    property_address: property.property_address || "",
    building_type: property.building_type || "mansion",
    floor_area: property.floor_area || "",
    owner_name: property.owner_name || "",
    management_company: property.management_company || "",
    management_phone: property.management_phone || "",
    company_contract_start: property.company_contract_start || "",
    company_contract_end: property.company_contract_end || "",
    monthly_rent: property.monthly_rent || "",
    notice_period_months: property.notice_period_months || 1,
    cancellation_penalty: property.cancellation_penalty || "",
    cancellation_notes: property.cancellation_notes || "",
    notes: property.notes || "",
  });
  const [saving, setSaving] = useState(false);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.property_name || !form.property_address) { alert("物件名と住所は必須です"); return; }
    setSaving(true);
    const { error } = await supabase.from("properties").update({
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
      notice_period_months: parseInt(form.notice_period_months) || 1,
      cancellation_penalty: form.cancellation_penalty || null,
      cancellation_notes: form.cancellation_notes || null,
      notes: form.notes || null,
    }).eq("id", property.id);
    if (error) { alert("更新に失敗しました: " + error.message); setSaving(false); return; }
    onSaved();
  }

  return (
    <Modal title="物件情報を編集" onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label style={lStyle}>物件名</label>
          <input value={form.property_name} onChange={e => set("property_name", e.target.value)} style={iStyle()} />
        </div>
        <div>
          <label style={lStyle}>建物種別</label>
          <select value={form.building_type} onChange={e => set("building_type", e.target.value)} style={iStyle()}>
            <option value="mansion">マンション・アパート</option>
            <option value="house">戸建</option>
            <option value="other">その他</option>
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lStyle}>物件住所</label>
          <input value={form.property_address} onChange={e => set("property_address", e.target.value)} style={iStyle()} />
        </div>
        <div>
          <label style={lStyle}>床面積（㎡）</label>
          <input type="number" value={form.floor_area} onChange={e => set("floor_area", e.target.value)} style={iStyle()} />
        </div>
        <div>
          <label style={lStyle}>貸主名</label>
          <input value={form.owner_name} onChange={e => set("owner_name", e.target.value)} style={iStyle()} />
        </div>
        <div>
          <label style={lStyle}>管理会社名</label>
          <input value={form.management_company} onChange={e => set("management_company", e.target.value)} style={iStyle()} />
        </div>
        <div>
          <label style={lStyle}>管理会社電話</label>
          <input value={form.management_phone} onChange={e => set("management_phone", e.target.value)} style={iStyle()} />
        </div>
        <div>
          <label style={lStyle}>会社契約開始日</label>
          <input type="date" value={form.company_contract_start} onChange={e => set("company_contract_start", e.target.value)} style={iStyle()} />
        </div>
        <div>
          <label style={lStyle}>会社契約終了日</label>
          <input type="date" value={form.company_contract_end} onChange={e => set("company_contract_end", e.target.value)} style={iStyle()} />
        </div>
        <div>
          <label style={lStyle}>月額賃料（円）</label>
          <input type="number" value={form.monthly_rent} onChange={e => set("monthly_rent", e.target.value)} style={iStyle()} />
        </div>
        <div>
          <label style={lStyle}>解約予告期間</label>
          <select value={form.notice_period_months} onChange={e => set("notice_period_months", e.target.value)} style={iStyle()}>
            {[1, 2, 3, 4, 6].map(n => <option key={n} value={n}>{n}ヶ月前</option>)}
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lStyle}>違約金条件</label>
          <input value={form.cancellation_penalty} onChange={e => set("cancellation_penalty", e.target.value)} style={iStyle()} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lStyle}>解約条件メモ</label>
          <textarea value={form.cancellation_notes} onChange={e => set("cancellation_notes", e.target.value)}
            style={{ ...iStyle(), height: 70, resize: "vertical" }} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lStyle}>備考</label>
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
            style={{ ...iStyle(), height: 60, resize: "vertical" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
        <button onClick={onClose} style={btnOutline}>キャンセル</button>
        <button onClick={handleSave} disabled={saving} style={{
          padding: "9px 24px", background: "#3B82F6", color: "#fff",
          border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer",
        }}>
          {saving ? "保存中..." : "更新する"}
        </button>
      </div>
    </Modal>
  );
}

function Card({ title, children, action }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "#475569", letterSpacing: "0.04em" }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>{children}</div>;
}

function Item({ label, value, bold, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#1E293B", fontWeight: bold ? 700 : 400 }}>{value || "—"}</div>
    </div>
  );
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: 28,
        width: wide ? 680 : 480, maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#94A3B8", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const lStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 };
const iStyle = () => ({
  width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0",
  borderRadius: 8, fontSize: 14, color: "#1E293B", background: "#fff", outline: "none",
});
const btnOutline = {
  padding: "9px 20px", background: "#fff", color: "#64748B",
  border: "1px solid #E2E8F0", borderRadius: 8, fontWeight: 500, fontSize: 13, cursor: "pointer",
};

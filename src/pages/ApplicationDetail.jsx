import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { yen } from "../utils/calc";

const STATUS_LABELS = {
  pending: "審査待ち", reviewing: "審査中",
  approved: "承認済", rejected: "差戻し", contract_pending: "契約手続き中",
};
const FAMILY_LABELS = { single: "単身者", family: "家族帯同者" };
const SCENE_LABELS = { new_hire: "採用時（新入社員）", existing: "既存社員" };

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [comment, setComment] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [contractStart, setContractStart] = useState("");
  const [contractEnd, setContractEnd] = useState("");

  useEffect(() => {
    supabase.from("applications").select("*").eq("id", id).single()
      .then(({ data }) => { if (data) { setApp(data); setNewStatus(data.status); } });
  }, [id]);

  async function handleUpdateStatus() {
    if (!newStatus) return;
    setSaving(true);
    const { error } = await supabase.from("applications").update({
      status: newStatus,
      review_comment: comment || null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (!error) {
      setApp(a => ({ ...a, status: newStatus, review_comment: comment }));
      await supabase.from("audit_logs").insert([{
        action: "update_application_status", target_type: "application", target_id: id,
        details: { old: app.status, new: newStatus, comment: comment || null },
      }]);
    }
    setSaving(false);
  }

  async function handleConvertToTenancy() {
    if (!contractStart) { alert("契約開始日を入力してください"); return; }
    setConverting(true);

    const { data: tenancy, error: tErr } = await supabase.from("tenancies").insert([{
      application_id: app.id,
      name: app.name,
      email: app.email,
      basic_salary: app.basic_salary,
      family_type: app.family_type,
      property_name: app.property_name,
      property_address: app.property_address,
      floor_area: app.floor_area,
      contract_start: contractStart,
      contract_end: contractEnd || null,
      status: "active",
    }]).select("id").single();

    if (tErr) { alert("入居者登録に失敗しました: " + tErr.message); setConverting(false); return; }

    // 最初の家賃履歴を登録
    await supabase.from("rent_history").insert([{
      tenancy_id: tenancy.id,
      effective_date: contractStart,
      actual_rent: app.actual_rent,
      subsidy_limit: app.subsidy_limit,
      company_burden: app.company_burden,
      personal_burden: app.personal_burden,
    }]);

    await supabase.from("applications").update({ status: "approved" }).eq("id", id);
    await supabase.from("audit_logs").insert([{
      action: "convert_to_tenancy", target_type: "application", target_id: id,
      details: { name: app.name, contract_start: contractStart },
    }]);

    alert(`${app.name}さんを入居者台帳に登録しました`);
    navigate("/tenants");
  }

  if (!app) return <div style={{ color: "#94A3B8", padding: 40 }}>読み込み中...</div>;

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate("/applications")} style={{ background: "none", border: "none", color: "#3B82F6", fontSize: 13, padding: 0 }}>
          ← 一覧に戻る
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>{app.name}さんの申請</h1>
      </div>

      {/* 申請内容 */}
      <Card title="申請内容">
        <Grid>
          <Item label="申請シーン" value={SCENE_LABELS[app.scene]} />
          <Item label="申請日" value={app.created_at?.slice(0, 10)} />
          <Item label="氏名" value={app.name} bold />
          <Item label="メール" value={app.email || "—"} />
          <Item label="基本給月額" value={yen(app.basic_salary)} />
          <Item label="家族区分" value={FAMILY_LABELS[app.family_type]} />
          {app.join_date && <Item label="入社日" value={app.join_date} />}
        </Grid>
      </Card>

      {/* 物件情報 */}
      <Card title="物件情報">
        <Grid>
          <Item label="物件名" value={app.property_name} bold />
          <Item label="床面積" value={app.floor_area ? `${app.floor_area}㎡` : "—"} />
          <Item label="物件住所" value={app.property_address} style={{ gridColumn: "1 / -1" }} />
          <Item label="実賃料（月額）" value={yen(app.actual_rent)} />
          <Item label="入居希望日" value={app.desired_move_in} />
        </Grid>
        {app.floor_area > 99 && (
          <div style={{ marginTop: 12, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
            ⚠️ 床面積が99㎡を超えています（規程第7条）
          </div>
        )}
      </Card>

      {/* 計算結果 */}
      <Card title="計算結果">
        <Grid>
          <Item label="補助対象限度額" value={yen(app.subsidy_limit)} />
          <Item label="会社負担額（月）" value={yen(app.company_burden)} bold />
          <Item label="本人負担額（月）" value={yen(app.personal_burden)} bold />
        </Grid>
        {app.actual_rent > app.subsidy_limit * 1.5 && (
          <div style={{ marginTop: 12, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
            ⚠️ 実賃料が限度額の1.5倍（{yen(Math.floor(app.subsidy_limit * 1.5))}）を超えています（規程上、承認は推奨されません）
          </div>
        )}
      </Card>

      {/* 備考 */}
      {app.note && (
        <Card title="備考">
          <p style={{ fontSize: 13, color: "#475569", whiteSpace: "pre-wrap" }}>{app.note}</p>
        </Card>
      )}

      {/* 審査操作 */}
      {!["approved", "rejected"].includes(app.status) && (
        <Card title="審査">
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>ステータスを変更</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)} style={inputStyle}>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>コメント（差戻し理由など）</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              style={{ ...inputStyle, height: 80, resize: "vertical" }}
              placeholder="承認コメント・差戻し理由など" />
          </div>
          <button onClick={handleUpdateStatus} disabled={saving} style={btnPrimary}>
            {saving ? "更新中..." : "ステータスを更新"}
          </button>
        </Card>
      )}

      {/* 入居者台帳への転記 */}
      {app.status === "contract_pending" && (
        <Card title="入居者台帳へ登録">
          <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>
            契約締結後、以下を入力して入居者台帳に登録してください。
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>契約開始日 <span style={{ color: "#EF4444" }}>*</span></label>
              <input type="date" value={contractStart} onChange={e => setContractStart(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>契約満了日（任意）</label>
              <input type="date" value={contractEnd} onChange={e => setContractEnd(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <button onClick={handleConvertToTenancy} disabled={converting} style={{ ...btnPrimary, background: "#10B981" }}>
            {converting ? "登録中..." : "入居者台帳に登録する"}
          </button>
        </Card>
      )}

      {/* 審査済みの場合 */}
      {app.status === "approved" && (
        <Card title="審査結果">
          <div style={{ padding: "10px 14px", background: "#F0FDF4", borderRadius: 8, fontSize: 13, color: "#15803D" }}>
            ✅ 承認済みです。入居者台帳への登録が完了しています。
          </div>
          {app.review_comment && (
            <div style={{ marginTop: 10, fontSize: 13, color: "#475569" }}>コメント: {app.review_comment}</div>
          )}
        </Card>
      )}
      {app.status === "rejected" && (
        <Card title="審査結果">
          <div style={{ padding: "10px 14px", background: "#FEF2F2", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>
            ❌ 差戻し
          </div>
          {app.review_comment && (
            <div style={{ marginTop: 10, fontSize: 13, color: "#475569" }}>理由: {app.review_comment}</div>
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
function Grid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>{children}</div>;
}
function Item({ label, value, bold, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#1E293B", fontWeight: bold ? 700 : 400 }}>{value}</div>
    </div>
  );
}
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 };
const inputStyle = { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 14, color: "#1E293B", outline: "none" };
const btnPrimary = { padding: "10px 24px", background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" };

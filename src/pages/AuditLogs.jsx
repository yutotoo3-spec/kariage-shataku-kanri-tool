import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCompany } from "../hooks/useCompany";
import { yen } from "../utils/calc";

const PAGE_SIZE = 100;

const APPLICATION_STATUS_LABELS = {
  pending: "審査待ち", reviewing: "審査中", approved: "承認済", rejected: "差戻し", contract_pending: "契約手続き中",
};
const FAMILY_LABELS = { single: "単身者", family: "家族帯同者" };
const COMPANY_STATUS_LABELS = { active: "利用中", suspended: "利用停止" };

// 操作の種類ごとの表示名と、詳細（details）の要約
const ACTIONS = {
  update_application_status: {
    label: "申請のステータス変更",
    summary: d => `${APPLICATION_STATUS_LABELS[d.old] || d.old} → ${APPLICATION_STATUS_LABELS[d.new] || d.new}${d.comment ? `（コメント：${d.comment}）` : ""}`,
  },
  convert_to_tenancy: {
    label: "入居者台帳へ登録",
    summary: d => `${d.name}さん／契約開始 ${d.contract_start}`,
  },
  update_rent: {
    label: "家賃の変更",
    summary: d => `実賃料 ${yen(Number(d.new_rent))}（${d.effective_date}から）`,
  },
  update_family_type: {
    label: "家族区分の変更",
    summary: d => `${FAMILY_LABELS[d.old] || d.old} → ${FAMILY_LABELS[d.new] || d.new}`,
  },
  update_salary_april: {
    label: "基本給の改定",
    summary: d => `${yen(Number(d.old))} → ${yen(Number(d.new))}`,
  },
  move_out_request: {
    label: "退去手続き",
    summary: d => `退去予定日 ${d.move_out_date}`,
  },
  update_setting: {
    label: "設定の変更",
    summary: d => `${d.key}：${JSON.stringify(d.new_value)}`,
  },
  remove_member: {
    label: "メンバーを会社から外す",
    summary: d => `${d.email}（${d.role === "owner" ? "管理者" : "メンバー"}）`,
  },
  change_member_role: {
    label: "メンバーの権限変更",
    summary: d => `${d.email}：${d.old === "owner" ? "管理者" : "メンバー"} → ${d.new === "owner" ? "管理者" : "メンバー"}`,
  },
  purge_personal_data: {
    label: "保存期間を過ぎた個人情報の削除",
    summary: d => `申請 ${d.applications}件・入居者 ${d.tenancies}件・仮申請 ${d.drafts}件`,
  },
  admin_set_company_status: {
    label: "企業の利用状態の変更（運営者）",
    summary: d => COMPANY_STATUS_LABELS[d.status] || d.status,
  },
};

function summarize(log) {
  const def = ACTIONS[log.action];
  try {
    return def ? def.summary(log.details || {}) : JSON.stringify(log.details ?? {});
  } catch {
    return JSON.stringify(log.details ?? {});
  }
}

function targetLink(log) {
  if (!log.target_id) return null;
  if (log.target_type === "application") return `/applications/${log.target_id}`;
  if (log.target_type === "tenancy") return `/tenants/${log.target_id}`;
  return null;
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// 日付（YYYY-MM-DD）を日本時間のその日の0時として扱い、ISO文字列にする
function startOfDayJst(date) {
  return new Date(`${date}T00:00:00+09:00`).toISOString();
}
function nextDayJst(date) {
  const d = new Date(`${date}T00:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

export default function AuditLogs() {
  const { role, loading: companyLoading } = useCompany();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ from: "", to: "", action: "" });

  function buildQuery(offset) {
    let query = supabase.from("audit_logs")
      .select("id, created_at, user_email, action, target_type, target_id, details")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (filters.from) query = query.gte("created_at", startOfDayJst(filters.from));
    if (filters.to) query = query.lt("created_at", nextDayJst(filters.to));
    if (filters.action) query = query.eq("action", filters.action);
    return query;
  }

  function applyPage(offset, { data, error: queryError }) {
    if (queryError) { setError("監査ログの取得に失敗しました: " + queryError.message); setLoading(false); return; }
    setError("");
    setLogs(prev => (offset === 0 ? data : [...prev, ...data]));
    setHasMore(data.length === PAGE_SIZE);
    setLoading(false);
  }

  useEffect(() => {
    if (role !== "owner") return;
    buildQuery(0).then(result => applyPage(0, result));
    // 絞り込み条件が変わったら先頭から読み直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, filters]);

  async function loadMore() {
    setLoading(true);
    applyPage(logs.length, await buildQuery(logs.length));
  }

  function setFilter(key, value) {
    setLoading(true);
    setFilters(f => ({ ...f, [key]: value }));
  }

  if (companyLoading) return <div style={{ color: "#94A3B8", padding: 40 }}>読み込み中...</div>;
  if (role !== "owner") return <div style={{ color: "#94A3B8", padding: 40 }}>監査ログは管理者（owner）のみ閲覧できます</div>;

  const inputStyle = { padding: "7px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#1E293B", outline: "none", background: "#fff" };

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>監査ログ</h1>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
          誰が・いつ・何を変更したかの記録です。記録は変更・削除できません
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: "#475569", display: "flex", flexDirection: "column", gap: 4 }}>
          期間（から）
          <input type="date" value={filters.from} onChange={e => setFilter("from", e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: "#475569", display: "flex", flexDirection: "column", gap: 4 }}>
          期間（まで）
          <input type="date" value={filters.to} onChange={e => setFilter("to", e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: "#475569", display: "flex", flexDirection: "column", gap: 4 }}>
          操作の種類
          <select value={filters.action} onChange={e => setFilter("action", e.target.value)} style={inputStyle}>
            <option value="">すべて</option>
            {Object.entries(ACTIONS).map(([key, def]) => <option key={key} value={key}>{def.label}</option>)}
          </select>
        </label>
        {(filters.from || filters.to || filters.action) && (
          <button onClick={() => { setLoading(true); setFilters({ from: "", to: "", action: "" }); }} style={{
            padding: "7px 12px", borderRadius: 8, fontSize: 12, background: "#fff", color: "#475569", border: "1px solid #E2E8F0",
          }}>
            条件をクリア
          </button>
        )}
      </div>

      {error && <p style={{ fontSize: 12, color: "#DC2626", marginBottom: 12 }}>{error}</p>}

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {logs.length === 0 && !loading && (
          <div style={{ padding: 32, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>該当する記録はありません</div>
        )}
        {logs.map((log, i) => {
          const link = targetLink(log);
          return (
            <div key={log.id} style={{
              padding: "12px 20px", borderBottom: i < logs.length - 1 ? "1px solid #F1F5F9" : "none",
              display: "flex", gap: 16, flexWrap: "wrap", alignItems: "baseline",
            }}>
              <div style={{ fontSize: 12, color: "#64748B", minWidth: 130, whiteSpace: "nowrap" }}>{formatDateTime(log.created_at)}</div>
              <div style={{ fontSize: 12, color: "#475569", minWidth: 160, overflowWrap: "anywhere" }}>{log.user_email || "（不明）"}</div>
              <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>
                  {ACTIONS[log.action]?.label || log.action}
                  {link && <Link to={link} style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: "#3B82F6" }}>対象を開く</Link>}
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2, overflowWrap: "anywhere" }}>{summarize(log)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {loading && <div style={{ color: "#94A3B8", padding: 16, textAlign: "center", fontSize: 13 }}>読み込み中...</div>}
      {!loading && hasMore && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={loadMore} style={{
            padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#fff", color: "#475569", border: "1px solid #E2E8F0",
          }}>
            さらに読み込む
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { calcProration, yen } from "../utils/calc";

export default function MonthlyProcess() {
  const today = new Date();
  const [yearMonth, setYearMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [salaryChecked, setSalaryChecked] = useState(false);

  const isApril = yearMonth?.endsWith("-04");

  async function loadRows() {
    setLoading(true);
    const { data: tenants } = await supabase
      .from("tenancies")
      .select("*, rent_history(actual_rent, personal_burden, company_burden, subsidy_limit, effective_date)")
      .in("status", ["active", "move_out_pending"]);

    const newRows = (tenants || []).map(t => {
      const hist = (t.rent_history || []).sort((a, b) => b.effective_date.localeCompare(a.effective_date));
      const rent = hist[0] || {};
      const isMovingOut = t.status === "move_out_pending" && t.move_out_date?.startsWith(yearMonth);
      return {
        tenancy_id: t.id,
        name: t.name,
        property_name: t.property_name,
        actual_rent: rent.actual_rent || 0,
        personal_burden: rent.personal_burden || 0,
        company_burden: rent.company_burden || 0,
        is_moving_out: isMovingOut,
        move_out_date: t.move_out_date,
        proration_days: null,
        adjusted_personal: null,
        note: isMovingOut ? "退去月" : "",
      };
    });

    setRows(newRows);
    setLoading(false);
  }

  useEffect(() => { if (yearMonth) loadRows(); }, [yearMonth]);

  function updateRow(idx, key, val) {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [key]: val };
      if (key === "proration_days" && val && updated.personal_burden) {
        const daysInMonth = new Date(yearMonth.split("-")[0], parseInt(yearMonth.split("-")[1]), 0).getDate();
        updated.adjusted_personal = calcProration(updated.personal_burden, daysInMonth, parseInt(val));
      }
      return updated;
    }));
  }

  function exportCSV() {
    const esc = v => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = "氏名,物件名,実賃料,本人負担額,会社負担額,備考\n";
    const body = rows.map(r => {
      const personal = r.adjusted_personal ?? r.personal_burden;
      const company = r.actual_rent - personal;
      return [r.name, r.property_name, r.actual_rent, personal, company, r.note || ""].map(esc).join(",");
    }).join("\n");
    const blob = new Blob(["\uFEFF" + header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `社宅控除_${yearMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalCompany = rows.reduce((s, r) => s + (r.actual_rent - (r.adjusted_personal ?? r.personal_burden)), 0);
  const totalPersonal = rows.reduce((s, r) => s + (r.adjusted_personal ?? r.personal_burden), 0);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>月次処理</h1>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>月ごとの控除額を確認してCSV出力します</p>
      </div>

      {/* 月選択 */}
      <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginRight: 10 }}>対象月</label>
          <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 14 }} />
        </div>
        <div style={{ fontSize: 13, color: "#64748B" }}>
          対象者: <strong>{rows.length}名</strong>
        </div>
      </div>

      {/* 4月の基本給確認ロック */}
      {isApril && (
        <div style={{
          background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12,
          padding: "16px 20px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#D97706", marginBottom: 8 }}>
            ⚠️ 4月は補助対象限度額の年次見直し月です
          </div>
          <p style={{ fontSize: 13, color: "#92400E", marginBottom: 12 }}>
            全入居者の基本給を4月1日時点の値に更新してください。更新完了後にチェックを入れてください。
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={salaryChecked} onChange={e => setSalaryChecked(e.target.checked)} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>全入居者の基本給・限度額の確認・更新が完了しました</span>
          </label>
        </div>
      )}

      {/* 合計 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "#fff", borderRadius: 10, padding: "14px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 11, color: "#64748B" }}>会社負担合計（月）</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1E293B", marginTop: 4 }}>{yen(totalCompany)}</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, padding: "14px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 11, color: "#64748B" }}>本人控除合計（月）</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1E293B", marginTop: 4 }}>{yen(totalPersonal)}</div>
        </div>
      </div>

      {/* 一覧テーブル */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "auto", marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["氏名", "物件名", "実賃料", "本人負担額", "会社負担額", "日割り（日数）", "日割り後本人負担", "備考"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>読み込み中...</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.tenancy_id} style={{ borderBottom: "1px solid #F1F5F9", background: r.is_moving_out ? "#FFFBEB" : undefined }}>
                <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
                <td style={td}>{r.property_name}</td>
                <td style={td}>{yen(r.actual_rent)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{yen(r.personal_burden)}</td>
                <td style={td}>{yen(r.company_burden)}</td>
                <td style={td}>
                  {r.is_moving_out && (
                    <input
                      type="number" value={r.proration_days ?? ""}
                      onChange={e => updateRow(i, "proration_days", e.target.value)}
                      style={{ width: 70, padding: "5px 8px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13 }}
                      placeholder="日数"
                    />
                  )}
                </td>
                <td style={{ ...td, color: r.adjusted_personal != null ? "#3B82F6" : "#94A3B8", fontWeight: 600 }}>
                  {r.adjusted_personal != null ? yen(r.adjusted_personal) : "—"}
                </td>
                <td style={td}>
                  <input
                    value={r.note} onChange={e => updateRow(i, "note", e.target.value)}
                    style={{ width: 140, padding: "5px 8px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 12 }}
                    placeholder="備考"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* アクション */}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button
          onClick={exportCSV}
          disabled={isApril && !salaryChecked}
          style={{
            padding: "11px 28px", background: (isApril && !salaryChecked) ? "#E2E8F0" : "#3B82F6",
            color: (isApril && !salaryChecked) ? "#94A3B8" : "#fff",
            border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: (isApril && !salaryChecked) ? "not-allowed" : "pointer",
          }}
        >
          CSV 出力
        </button>
      </div>
    </div>
  );
}

const td = { padding: "12px 14px", fontSize: 13, color: "#475569", whiteSpace: "nowrap" };

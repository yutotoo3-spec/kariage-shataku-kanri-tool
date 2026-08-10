import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { yen } from "../utils/calc";

const STATUS_LABELS = {
  active: { label: "入居中", color: "#3B82F6", bg: "#EFF6FF" },
  move_out_pending: { label: "退去手続き中", color: "#F59E0B", bg: "#FFFBEB" },
  moved_out: { label: "退去済", color: "#94A3B8", bg: "#F8FAFC" },
};
const FAMILY_LABELS = { single: "単身", family: "家族帯同" };

export default function TenantLedger() {
  const [tenants, setTenants] = useState([]);
  const [filter, setFilter] = useState("active");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("tenancies")
        .select("*, rent_history(actual_rent, personal_burden, company_burden, subsidy_limit, effective_date)")
        .order("created_at", { ascending: false });
      setTenants(data || []);
      setLoading(false);
    }
    load();
  }, []);

  function currentRent(t) {
    const hist = (t.rent_history || []).sort((a, b) => b.effective_date.localeCompare(a.effective_date));
    return hist[0] || { actual_rent: 0, personal_burden: 0, company_burden: 0 };
  }

  const filtered = filter === "all" ? tenants : tenants.filter(t => t.status === filter);
  const counts = {};
  tenants.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });

  if (loading) return <div style={{ color: "#94A3B8", padding: 40 }}>読み込み中...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>入居者台帳</h1>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>全{tenants.length}件</p>
        </div>
      </div>

      {/* フィルター */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[["all", "すべて"], ["active", "入居中"], ["move_out_pending", "退去手続き中"], ["moved_out", "退去済"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: "6px 14px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 500,
            background: filter === k ? "#1E293B" : "#E2E8F0",
            color: filter === k ? "#fff" : "#64748B", cursor: "pointer",
          }}>
            {l}{k !== "all" && counts[k] ? ` (${counts[k]})` : ""}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8", fontSize: 14 }}>
          該当する入居者がいません
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["氏名", "家族区分", "物件名", "実賃料", "本人負担額", "会社負担額", "契約開始", "契約満了", "ステータス", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const rent = currentRent(t);
                const st = STATUS_LABELS[t.status];
                const isExpiringSoon = t.contract_end && (() => {
                  const days = Math.floor((new Date(t.contract_end) - new Date()) / 86400000);
                  return days >= 0 && days <= 60;
                })();
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid #F1F5F9", background: isExpiringSoon ? "#FFFBEB" : undefined }}>
                    <td style={{ ...td, fontWeight: 600, color: "#1E293B" }}>{t.name}</td>
                    <td style={td}>{FAMILY_LABELS[t.family_type]}</td>
                    <td style={td}>{t.property_name}</td>
                    <td style={td}>{yen(rent.actual_rent)}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{yen(rent.personal_burden)}</td>
                    <td style={td}>{yen(rent.company_burden)}</td>
                    <td style={td}>{t.contract_start}</td>
                    <td style={td}>
                      {t.contract_end || "—"}
                      {isExpiringSoon && <span style={{ marginLeft: 4, fontSize: 10, color: "#D97706", fontWeight: 700 }}>⚠ 更新</span>}
                    </td>
                    <td style={td}>
                      <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={td}>
                      <Link to={`/tenants/${t.id}`} style={{ fontSize: 12, color: "#3B82F6", fontWeight: 600 }}>
                        詳細
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const td = { padding: "12px 14px", fontSize: 13, color: "#475569", whiteSpace: "nowrap" };

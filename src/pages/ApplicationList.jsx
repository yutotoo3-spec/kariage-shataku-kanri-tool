import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { yen } from "../utils/calc";

const STATUS_LABELS = {
  pending: { label: "審査待ち", color: "#F59E0B", bg: "#FFFBEB" },
  reviewing: { label: "審査中", color: "#3B82F6", bg: "#EFF6FF" },
  approved: { label: "承認済", color: "#10B981", bg: "#F0FDF4" },
  rejected: { label: "差戻し", color: "#EF4444", bg: "#FEF2F2" },
  contract_pending: { label: "契約手続き中", color: "#8B5CF6", bg: "#F5F3FF" },
};

const SCENE_LABELS = { new_hire: "採用時", existing: "既存社員" };
const FAMILY_LABELS = { single: "単身", family: "家族帯同" };

export default function ApplicationList() {
  const [apps, setApps] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false });
      setApps(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === "all" ? apps : apps.filter(a => a.status === filter);

  const counts = {};
  apps.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });

  if (loading) return <div style={{ color: "#94A3B8", padding: 40 }}>読み込み中...</div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>申請一覧</h1>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>全{apps.length}件</p>
      </div>

      {/* フィルタータブ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[["all", "すべて"], ...Object.entries(STATUS_LABELS).map(([k, v]) => [k, v.label])].map(([k, l]) => (
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
          該当する申請がありません
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["申請日", "氏名", "シーン", "家族区分", "実賃料", "本人負担額", "入居希望日", "ステータス", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(app => {
                const st = STATUS_LABELS[app.status] || STATUS_LABELS.pending;
                return (
                  <tr key={app.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={td}>{app.created_at?.slice(0, 10)}</td>
                    <td style={{ ...td, fontWeight: 600, color: "#1E293B" }}>{app.name}</td>
                    <td style={td}>{SCENE_LABELS[app.scene]}</td>
                    <td style={td}>{FAMILY_LABELS[app.family_type]}</td>
                    <td style={td}>{yen(app.actual_rent)}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{yen(app.personal_burden)}</td>
                    <td style={td}>{app.desired_move_in}</td>
                    <td style={td}>
                      <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={td}>
                      <Link to={`/applications/${app.id}`} style={{ fontSize: 12, color: "#3B82F6", fontWeight: 600 }}>
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

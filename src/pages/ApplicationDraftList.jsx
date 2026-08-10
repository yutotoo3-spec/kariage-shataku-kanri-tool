import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { yen } from "../utils/calc";

const STATUS_LABELS = {
  submitted: { label: "未確認", color: "#F59E0B", bg: "#FFFBEB" },
  converted: { label: "登録済", color: "#3B82F6", bg: "#EFF6FF" },
  dismissed: { label: "却下", color: "#94A3B8", bg: "#F8FAFC" },
};
const SCENE_LABELS = { new_hire: "採用時", existing: "既存社員" };

export default function ApplicationDraftList() {
  const [drafts, setDrafts] = useState([]);
  const [filter, setFilter] = useState("submitted");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("application_drafts")
        .select("*")
        .order("created_at", { ascending: false });
      setDrafts(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === "all" ? drafts : drafts.filter(d => d.status === filter);
  const counts = {};
  drafts.forEach(d => { counts[d.status] = (counts[d.status] || 0) + 1; });

  async function copyPublicUrl() {
    const url = `${window.location.origin}/apply`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div style={{ color: "#94A3B8", padding: 40 }}>読み込み中...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>申請フォーム受付一覧</h1>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
            本人が公開フォームから送信した内容です。確認のうえ申請登録してください
          </p>
        </div>
        <button onClick={copyPublicUrl} style={{
          padding: "10px 20px", background: "#1E293B", color: "#fff",
          borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
        }}>
          {copied ? "コピーしました" : "公開フォームURLをコピー"}
        </button>
      </div>

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
          該当する受付がありません
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["送信日", "氏名", "シーン", "物件名", "実賃料", "ステータス", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const st = STATUS_LABELS[d.status] || STATUS_LABELS.submitted;
                return (
                  <tr key={d.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={td}>{d.created_at?.slice(0, 10)}</td>
                    <td style={{ ...td, fontWeight: 600, color: "#1E293B" }}>{d.name}</td>
                    <td style={td}>{SCENE_LABELS[d.scene]}</td>
                    <td style={td}>{d.property_name}</td>
                    <td style={td}>{yen(d.actual_rent)}</td>
                    <td style={td}>
                      <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={td}>
                      <Link to={`/application-drafts/${d.id}`} style={{ fontSize: 12, color: "#3B82F6", fontWeight: 600 }}>
                        確認
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

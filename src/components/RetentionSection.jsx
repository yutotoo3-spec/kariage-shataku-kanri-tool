import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const KIND_LABELS = {
  application: { label: "却下した申請", rule: "審査日から1年経過" },
  tenancy: { label: "退去済みの入居者", rule: "退去日から5年経過（家賃履歴・元の申請も削除）" },
  draft: { label: "旧方式の仮申請", rule: "送信から1年経過" },
};

// 設定画面（owner のみ）の「保存期間を過ぎた個人情報」欄。対象を確認してから削除する
export default function RetentionSection() {
  const [candidates, setCandidates] = useState(null);
  const [error, setError] = useState("");
  const [purging, setPurging] = useState(false);
  const [result, setResult] = useState(null);

  async function fetchCandidates() {
    const { data, error } = await supabase.rpc("list_retention_candidates");
    if (error) throw error;
    return data || [];
  }

  useEffect(() => {
    let cancelled = false;
    fetchCandidates()
      .then(list => { if (!cancelled) setCandidates(list); })
      .catch(e => { if (!cancelled) setError("削除対象を取得できませんでした: " + e.message); });
    return () => { cancelled = true; };
  }, []);

  async function handlePurge() {
    if (!window.confirm(`保存期間を過ぎた ${candidates.length} 件の個人情報を削除しますか？\n削除したデータは元に戻せません。`)) return;
    setError("");
    setPurging(true);
    const { data, error } = await supabase.rpc("purge_expired_personal_data");
    if (error) {
      setError("削除できませんでした: " + error.message);
    } else {
      setResult(data?.[0] ?? null);
    }
    try { setCandidates(await fetchCandidates()); } catch (e) { setError("削除対象を取得できませんでした: " + e.message); }
    setPurging(false);
  }

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>保存期間を過ぎた個人情報</h2>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4, lineHeight: 1.7 }}>
          却下した申請は1年、退去済みの入居者は退去から5年を保存期間としています。期間を過ぎたデータは確認のうえ削除してください（個人情報保護法第22条）
        </p>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {candidates === null && !error && <div style={{ padding: "16px 20px", fontSize: 13, color: "#94A3B8" }}>読み込み中...</div>}
        {candidates?.length === 0 && (
          <div style={{ padding: "16px 20px", fontSize: 13, color: "#64748B" }}>保存期間を過ぎた個人情報はありません</div>
        )}
        {candidates?.map((c, i) => (
          <div key={`${c.kind}-${c.id}`} style={{
            padding: "12px 20px", borderBottom: i < candidates.length - 1 ? "1px solid #F1F5F9" : "none",
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 13,
          }}>
            <span style={{ flex: "0 0 140px", color: "#475569" }}>{KIND_LABELS[c.kind]?.label ?? c.kind}</span>
            <span style={{ flex: "1 1 160px", fontWeight: 600, color: "#1E293B" }}>{c.name}</span>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>{c.base_date}（{KIND_LABELS[c.kind]?.rule}）</span>
          </div>
        ))}
        {candidates?.length > 0 && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handlePurge} disabled={purging} style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: "#fff", color: "#DC2626", border: "1px solid #FECACA",
            }}>
              {purging ? "削除中..." : `${candidates.length}件を削除する`}
            </button>
          </div>
        )}
      </div>
      {result && (
        <p style={{ fontSize: 12, color: "#15803D", marginTop: 10 }}>
          削除しました（申請 {result.applications}件・入居者 {result.tenancies}件・仮申請 {result.drafts}件）
        </p>
      )}
      {error && <p style={{ fontSize: 12, color: "#DC2626", marginTop: 10 }}>{error}</p>}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { calcNoticeDeadline } from "../utils/calc";

const STATUS_STYLE = {
  active: { bg: "#DCFCE7", text: "#15803D", label: "運用中" },
  cancelled: { bg: "#F1F5F9", text: "#64748B", label: "解約済" },
};

export default function PropertyList() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");

  useEffect(() => {
    async function load() {
      const [{ data: props }, { data: tenants }] = await Promise.all([
        supabase.from("properties").select("*").order("created_at", { ascending: false }),
        supabase.from("tenancies").select("id, name, status, property_id, property_address").eq("status", "active"),
      ]);

      const enriched = (props || []).map(p => ({
        ...p,
        activeTenant: (tenants || []).find(t => t.property_id === p.id || t.property_address === p.property_address),
      }));

      setProperties(enriched);
      setLoading(false);
    }
    load();
  }, []);

  function getNoticeInfo(p) {
    return calcNoticeDeadline(p.company_contract_end, p.notice_period_months);
  }

  const counts = {
    active: properties.filter(p => p.status === "active").length,
    cancelled: properties.filter(p => p.status === "cancelled").length,
  };
  const filtered = filter === "all" ? properties : properties.filter(p => p.status === filter);

  if (loading) return <div style={{ color: "#94A3B8", padding: 40 }}>読み込み中...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>物件台帳</h1>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>会社が契約している社宅物件・解約条件・書類を一元管理します</p>
        </div>
        <button onClick={() => navigate("/properties/new")} style={{
          padding: "9px 20px", background: "#3B82F6", color: "#fff",
          border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer",
        }}>
          + 物件を登録
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[["active", `運用中（${counts.active}）`], ["cancelled", `解約済（${counts.cancelled}）`], ["all", `すべて（${properties.length}）`]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: filter === v ? "#1E293B" : "#F1F5F9",
            color: filter === v ? "#fff" : "#64748B", border: "none",
          }}>{l}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "#94A3B8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 14 }}>物件が登録されていません</div>
          <button onClick={() => navigate("/properties/new")} style={{
            marginTop: 16, padding: "9px 20px", background: "#3B82F6", color: "#fff",
            border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>最初の物件を登録する</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(p => {
            const notice = p.status === "active" ? getNoticeInfo(p) : null;
            const isExpired = notice && notice.daysLeft < 0;
            const isWarning = notice && notice.daysLeft >= 0 && notice.daysLeft <= 90;
            const sc = STATUS_STYLE[p.status] || STATUS_STYLE.active;

            return (
              <Link key={p.id} to={`/properties/${p.id}`} style={{
                background: "#fff", borderRadius: 12, padding: "18px 24px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textDecoration: "none",
                border: `1px solid ${isExpired ? "#FECACA" : isWarning ? "#FDE68A" : "transparent"}`,
                display: "block",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#1E293B" }}>{p.property_name}</span>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.text, fontWeight: 600 }}>
                        {sc.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B", marginBottom: 10 }}>{p.property_address}</div>
                    <div style={{ display: "flex", gap: 20, fontSize: 12, color: "#94A3B8", flexWrap: "wrap" }}>
                      {p.company_contract_end && <span>会社契約満了：{p.company_contract_end}</span>}
                      {p.notice_period_months && <span>解約予告：{p.notice_period_months}ヶ月前</span>}
                      {p.monthly_rent && <span>賃料：¥{p.monthly_rent.toLocaleString()}</span>}
                    </div>
                    {(isExpired || isWarning) && (
                      <div style={{ marginTop: 8, fontSize: 12, color: isExpired ? "#DC2626" : "#D97706", fontWeight: 600 }}>
                        {isExpired
                          ? `⚠ 解約通知期限を${Math.abs(notice.daysLeft)}日超過しています`
                          : `⚠ 解約通知期限まであと${notice.daysLeft}日（${notice.deadlineStr}までに通知が必要）`}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", minWidth: 100, marginLeft: 16 }}>
                    {p.activeTenant ? (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{p.activeTenant.name}</div>
                        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>入居中</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>入居者なし</div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

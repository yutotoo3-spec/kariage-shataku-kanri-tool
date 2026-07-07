import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { calcNoticeDeadline } from "../utils/calc";

export default function Dashboard() {
  const [stats, setStats] = useState({ pending: 0, active: 0, moveOutSoon: 0, properties: 0 });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: apps }, { data: tenants }, { data: properties }] = await Promise.all([
        supabase.from("applications").select("id, status"),
        supabase.from("tenancies").select("id, name, contract_end, status, basic_salary, family_type"),
        supabase.from("properties").select("id, property_name, company_contract_end, notice_period_months, status").eq("status", "active"),
      ]);

      const pending = (apps || []).filter(a => ["pending", "reviewing"].includes(a.status)).length;
      const active = (tenants || []).filter(t => t.status === "active").length;

      const newAlerts = [];
      const today = new Date();
      const currentMonth = today.getMonth() + 1;

      // 4月の限度額見直しアラート（2〜3月に表示）
      if (currentMonth === 2 || currentMonth === 3) {
        const activeList = (tenants || []).filter(t => t.status === "active");
        if (activeList.length > 0) {
          newAlerts.push({
            type: "warning",
            title: `4月の補助対象限度額見直しが必要です`,
            desc: `入居者 ${activeList.length}名 の基本給を確認・更新してください`,
            link: "/tenants",
          });
        }
      }

      // 契約満了60日以内のアラート
      (tenants || []).forEach(t => {
        if (!t.contract_end || t.status !== "active") return;
        const end = new Date(t.contract_end);
        const diff = Math.floor((end - today) / (1000 * 60 * 60 * 24));
        if (diff <= 60 && diff >= 0) {
          newAlerts.push({
            type: "info",
            title: `${t.name}さんの契約が${diff}日後に満了します`,
            desc: `契約期間：〜${t.contract_end}　更新手続きを開始してください`,
            link: "/tenants",
          });
        }
      });

      // 物件の解約通知期限アラート
      (properties || []).forEach(p => {
        const notice = calcNoticeDeadline(p.company_contract_end, p.notice_period_months, today);
        if (!notice) return;
        if (notice.daysLeft < 0) {
          newAlerts.push({
            type: "danger",
            title: `${p.property_name}：解約通知期限を${Math.abs(notice.daysLeft)}日超過しています`,
            desc: `契約満了：${p.company_contract_end}　解約予告：${p.notice_period_months}ヶ月前`,
            link: `/properties/${p.id}`,
          });
        } else if (notice.daysLeft <= 90) {
          newAlerts.push({
            type: "warning",
            title: `${p.property_name}：解約通知期限まであと${notice.daysLeft}日`,
            desc: `契約満了：${p.company_contract_end}　${notice.deadlineStr}までに通知が必要`,
            link: `/properties/${p.id}`,
          });
        }
      });

      // 退去期限超過チェック
      (tenants || []).filter(t => t.status === "move_out_pending").forEach(t => {
        if (!t.move_out_date) return;
        const moveOut = new Date(t.move_out_date);
        if (today > moveOut) {
          newAlerts.push({
            type: "danger",
            title: `${t.name}さんの退去期限が過ぎています`,
            desc: `退去予定日：${t.move_out_date}　対応が必要です`,
            link: "/tenants",
          });
        }
      });

      setStats({
        pending,
        active,
        moveOutSoon: (tenants || []).filter(t => t.status === "move_out_pending").length,
        properties: (properties || []).length,
      });
      setAlerts(newAlerts);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <PageLoading />;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1E293B" }}>ダッシュボード</h1>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>借上社宅の管理状況をひと目で確認できます</p>
      </div>

      {/* サマリーカード */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="審査待ち申請" value={stats.pending} unit="件" color="#3B82F6" link="/applications" />
        <StatCard label="入居中" value={stats.active} unit="名" color="#10B981" link="/tenants" />
        <StatCard label="退去手続き中" value={stats.moveOutSoon} unit="名" color="#F59E0B" link="/tenants" />
        <StatCard label="契約物件数" value={stats.properties ?? 0} unit="件" color="#8B5CF6" link="/properties" />
      </div>

      {/* アラート */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", marginBottom: 12 }}>要対応アラート</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alerts.map((a, i) => (
              <Link key={i} to={a.link} style={{
                display: "block", padding: "14px 18px",
                background: a.type === "danger" ? "#FEF2F2" : a.type === "warning" ? "#FFFBEB" : "#EFF6FF",
                border: `1px solid ${a.type === "danger" ? "#FECACA" : a.type === "warning" ? "#FDE68A" : "#BFDBFE"}`,
                borderRadius: 10, textDecoration: "none",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: a.type === "danger" ? "#DC2626" : a.type === "warning" ? "#D97706" : "#1D4ED8" }}>
                  {a.title}
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>{a.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div style={{
          padding: "20px", background: "#F0FDF4", border: "1px solid #BBF7D0",
          borderRadius: 10, fontSize: 13, color: "#15803D",
        }}>
          現在、対応が必要なアラートはありません
        </div>
      )}

      {/* クイックアクション */}
      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", marginBottom: 12 }}>クイックアクション</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <QuickAction to="/applications/new" label="新規申請を登録する" desc="採用時・既存社員の社宅申請を登録" />
          <QuickAction to="/properties/new" label="物件を登録する" desc="社宅物件・解約条件・書類を管理" />
          <QuickAction to="/monthly" label="月次処理を行う" desc="控除額の確認・CSV出力" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, color, link }) {
  return (
    <Link to={link} style={{
      background: "#fff", borderRadius: 12, padding: "20px 24px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textDecoration: "none",
      borderTop: `3px solid ${color}`, display: "block",
    }}>
      <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: "#1E293B" }}>
        {value}<span style={{ fontSize: 14, color: "#94A3B8", marginLeft: 4 }}>{unit}</span>
      </div>
    </Link>
  );
}

function QuickAction({ to, label, desc }) {
  return (
    <Link to={to} style={{
      background: "#fff", borderRadius: 12, padding: "18px 20px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textDecoration: "none",
      border: "1px solid #E2E8F0", display: "block",
      transition: "border-color 0.15s",
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#3B82F6", marginBottom: 4 }}>{label} →</div>
      <div style={{ fontSize: 12, color: "#64748B" }}>{desc}</div>
    </Link>
  );
}

function PageLoading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#94A3B8" }}>
      読み込み中...
    </div>
  );
}

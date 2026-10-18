// 公開申請フォームの「個人情報の取扱いについて」。
// 個人情報保護法第21条により、個人情報を取得する際は利用目的を本人に通知・公表する必要がある
export default function PrivacyNotice({ companyName, contact, agreed, onChange }) {
  return (
    <div style={{ marginTop: 8, marginBottom: 16 }}>
      <div style={{
        border: "1px solid #E2E8F0", borderRadius: 8, padding: "14px 16px", background: "#F8FAFC",
        fontSize: 12, color: "#475569", lineHeight: 1.8, maxHeight: 220, overflowY: "auto",
      }}>
        <div style={{ fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>個人情報の取扱いについて</div>
        <p>
          {companyName}（以下「当社」）は、本申請でご入力いただいた個人情報（氏名、メールアドレス、基本給、入社日、物件の情報、備考等）を、次の目的で利用します。
        </p>
        <ul style={{ paddingLeft: 20, margin: "4px 0" }}>
          <li>借上社宅の申請の審査、賃貸借契約の手続き、入居中の管理</li>
          <li>社宅使用料（本人負担額）の計算および給与からの控除</li>
          <li>上記に関するご本人への連絡</li>
        </ul>
        <p>
          法令に基づく場合を除き、ご本人の同意なく第三者に提供することはありません。
          本システムの運営・保守のため、個人情報の取扱いを外部の事業者に委託する場合があります。その場合は、委託先を適切に監督します。
        </p>
        <p>お問い合わせ窓口：{contact || "社内の人事担当部署"}</p>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: "#1E293B", cursor: "pointer" }}>
        <input type="checkbox" checked={agreed} onChange={e => onChange(e.target.checked)} />
        個人情報の取扱いに同意します
      </label>
    </div>
  );
}

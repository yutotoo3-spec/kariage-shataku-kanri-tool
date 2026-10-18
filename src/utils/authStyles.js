// パスワード再設定まわりの画面（ログイン画面と同じ見た目）で共通のスタイル
export const pageStyle = {
  minHeight: "100vh", background: "#F1F5F9",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "24px 16px",
};
export const cardStyle = {
  background: "#fff", borderRadius: 16,
  padding: "40px 36px", width: 380, maxWidth: "100%",
  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
};
export const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 600,
  color: "#475569", marginBottom: 6,
};
export const inputStyle = {
  width: "100%", padding: "10px 12px",
  border: "1px solid #E2E8F0", borderRadius: 8,
  fontSize: 14, color: "#1E293B",
  outline: "none",
};
export const errorStyle = {
  marginBottom: 16, padding: "10px 14px", background: "#FEF2F2",
  border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626",
};
export const buttonStyle = loading => ({
  width: "100%", padding: "12px",
  background: loading ? "#93C5FD" : "#3B82F6",
  color: "#fff", border: "none", borderRadius: 10,
  fontSize: 14, fontWeight: 600,
});

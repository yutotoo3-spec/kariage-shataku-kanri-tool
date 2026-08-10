import { calcSubsidyLimit, calcBurden, checkRentCeiling, yen } from "../utils/calc";

export default function CalcPreview({ basicSalary, familyType, actualRent }) {
  if (!basicSalary || !actualRent) return null;

  const subsidyLimit = calcSubsidyLimit(basicSalary, familyType);
  const { companyBurden, personalBurden } = calcBurden(actualRent, subsidyLimit);
  const withinCeiling = checkRentCeiling(actualRent, subsidyLimit);

  return (
    <div style={{
      background: withinCeiling ? "#EFF6FF" : "#FEF2F2",
      border: `1px solid ${withinCeiling ? "#BFDBFE" : "#FECACA"}`,
      borderRadius: 10, padding: "16px 20px", marginTop: 8,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: withinCeiling ? "#1D4ED8" : "#DC2626", letterSpacing: "0.06em", marginBottom: 12 }}>
        {withinCeiling ? "自動計算結果" : "⚠️ 自動計算結果（上限超過）"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        <CalcItem label="補助対象限度額" value={yen(subsidyLimit)} />
        <CalcItem label="会社負担額（月）" value={yen(companyBurden)} highlight />
        <CalcItem label="本人負担額（月）" value={yen(personalBurden)} highlight />
      </div>
      {!withinCeiling && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#DC2626", fontWeight: 500 }}>
          実賃料が補助対象限度額の1.5倍（{yen(Math.floor(subsidyLimit * 1.5))}）を超えています。規程上、承認は推奨されません。
        </div>
      )}
    </div>
  );
}

function CalcItem({ label, value, highlight }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#64748B", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: highlight ? "#1E293B" : "#475569" }}>{value}</div>
    </div>
  );
}

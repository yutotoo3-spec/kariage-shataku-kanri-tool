// 規程に基づく各種料率・上限値のデフォルト値（settingsテーブル取得前・取得失敗時のフォールバック）
export const DEFAULT_SETTINGS = {
  company_burden_rate: 0.7,
  personal_burden_rate: 0.3,
  subsidy_ratio_single: 0.2,
  subsidy_ratio_family: 0.25,
  rent_ceiling_multiplier: 1.5,
  floor_area_limit: 99,
  building_tax_rate: 0.002,
  land_tax_rate: 0.0022,
  floor_area_unit_price: 12,
  prorate_first_month: false,
  deemed_rent_check_enabled: false,
};

// 補助対象限度額
export function calcSubsidyLimit(basicSalary, familyType, settings = DEFAULT_SETTINGS) {
  const ratio = familyType === "single" ? settings.subsidy_ratio_single : settings.subsidy_ratio_family;
  return Math.floor(basicSalary * ratio);
}

// 会社負担額・本人負担額
export function calcBurden(actualRent, subsidyLimit, settings = DEFAULT_SETTINGS) {
  const { company_burden_rate: companyRate, personal_burden_rate: personalRate } = settings;
  if (actualRent <= subsidyLimit) {
    return {
      companyBurden: Math.floor(actualRent * companyRate),
      personalBurden: Math.ceil(actualRent * personalRate),
    };
  }
  return {
    companyBurden: Math.floor(subsidyLimit * companyRate),
    personalBurden: Math.ceil(subsidyLimit * personalRate) + (actualRent - subsidyLimit),
  };
}

// 上限チェック（限度額×上限倍率超は承認不可推奨）
export function checkRentCeiling(actualRent, subsidyLimit, settings = DEFAULT_SETTINGS) {
  return actualRent <= subsidyLimit * settings.rent_ceiling_multiplier;
}

// 実賃料（家賃＋共益費＋管理費）の自動集計
export function calcActualRent(costs = {}) {
  return (parseInt(costs.rent) || 0) + (parseInt(costs.common_fee) || 0) + (parseInt(costs.management_fee) || 0);
}

// 毎月：給与控除合計（実賃料分の本人負担額 ＋ 本人負担の毎月費用）
const PERSONAL_MONTHLY_COST_KEYS = [
  "parking_fee", "bicycle_parking_fee", "neighborhood_fee",
  "internet_fee", "water_fee_flat", "support_service_fee_monthly", "other_monthly_personal",
];
export function calcTotalPersonalDeduction(personalBurden, costs = {}) {
  const extra = PERSONAL_MONTHLY_COST_KEYS.reduce((sum, key) => sum + (parseInt(costs[key]) || 0), 0);
  return personalBurden + extra;
}

// 毎月：会社負担合計（実賃料分の会社負担額 ＋ 会社負担の毎月費用）
const COMPANY_MONTHLY_COST_KEYS = [
  "other_fixed_lease_cost", "satellite_fee", "other_monthly_company", "guarantee_fee_monthly",
];
export function calcTotalCompanyCost(companyBurden, costs = {}) {
  const extra = COMPANY_MONTHLY_COST_KEYS.reduce((sum, key) => sum + (parseInt(costs[key]) || 0), 0);
  return companyBurden + extra;
}

// 日割り計算
export function calcProration(monthlyAmount, totalDays, occupiedDays) {
  return Math.ceil((monthlyAmount / totalDays) * occupiedDays);
}

// 金額フォーマット
export function yen(amount) {
  if (amount == null) return "—";
  return `¥${Math.round(amount).toLocaleString()}`;
}

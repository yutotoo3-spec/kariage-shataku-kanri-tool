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

// 日割り計算
export function calcProration(monthlyAmount, totalDays, occupiedDays) {
  return Math.ceil((monthlyAmount / totalDays) * occupiedDays);
}

// 金額フォーマット
export function yen(amount) {
  if (amount == null) return "—";
  return `¥${Math.round(amount).toLocaleString()}`;
}

// 補助対象限度額
export function calcSubsidyLimit(basicSalary, familyType) {
  return familyType === "single"
    ? Math.floor(basicSalary / 5)
    : Math.floor(basicSalary / 4);
}

// 会社負担額・本人負担額
export function calcBurden(actualRent, subsidyLimit) {
  if (actualRent <= subsidyLimit) {
    return {
      companyBurden: Math.floor(actualRent * 0.7),
      personalBurden: Math.ceil(actualRent * 0.3),
    };
  }
  return {
    companyBurden: Math.floor(subsidyLimit * 0.7),
    personalBurden: Math.ceil(subsidyLimit * 0.3) + (actualRent - subsidyLimit),
  };
}

// 上限チェック（限度額×1.5倍超は承認不可推奨）
export function checkRentCeiling(actualRent, subsidyLimit) {
  return actualRent <= subsidyLimit * 1.5;
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

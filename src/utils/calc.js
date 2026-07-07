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

// 解約通知期限（契約満了日の nヶ月前。月末はその月の末日にクランプする）
export function calcNoticeDeadline(contractEnd, noticePeriodMonths, baseDate = new Date()) {
  if (!contractEnd || !noticePeriodMonths) return null;
  const [y, m, d] = contractEnd.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1 - noticePeriodMonths, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  const pad = n => String(n).padStart(2, "0");
  const deadlineStr = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
  const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const daysLeft = Math.round((target - today) / 86400000);
  return { deadlineStr, daysLeft };
}

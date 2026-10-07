// 毎月発生する費用項目の定義（借上社宅管理規程「費用項目」準拠）
// group: "rent" = 実賃料の構成要素／"company" = 会社負担／"personal" = 本人負担／"guarantee" = 保証料
export const MONTHLY_COST_FIELDS = [
  { key: "rent", label: "家賃（月額・円）", group: "rent", required: true, placeholder: "150000" },
  { key: "common_fee", label: "共益費（月額・円）", group: "rent", required: true, placeholder: "ない場合は0" },
  { key: "management_fee", label: "管理費（月額・円）", group: "rent", required: true, placeholder: "ない場合は0" },
  { key: "parking_fee", label: "駐車場使用料（月額・円）", group: "personal", note: "本人負担。借りない場合は0" },
  { key: "bicycle_parking_fee", label: "駐輪場使用料（月額・円）", group: "personal", note: "本人負担。なければ0" },
  { key: "neighborhood_fee", label: "町内会費（月額・円）", group: "personal", note: "本人負担。ない場合は0" },
  { key: "internet_fee", label: "インターネット定額料金（月額・円）", group: "personal", note: "本人負担。ない場合は0" },
  { key: "water_fee_flat", label: "水道料金（定額の場合・月額・円）", group: "personal", note: "本人負担。実費契約なら0" },
  { key: "support_service_fee_monthly", label: "24時間サポート等の月額サービス料（円）", group: "personal", note: "本人負担。ない場合は0" },
  { key: "guarantee_fee_monthly", label: "家賃保証委託料（月額・円）", group: "guarantee", note: "毎月かかるタイプの場合のみ。初回一括のみなら0" },
  { key: "other_fixed_lease_cost", label: "その他の賃貸借固定費（月額・円）", group: "company", note: "会社負担。ない場合は0" },
  { key: "satellite_fee", label: "衛星費（月額・円）", group: "company", note: "会社負担。ない場合は0" },
  { key: "other_monthly_company", label: "その他の毎月の費用（会社負担・円）", group: "company", note: "上の項目にない会社負担の費用" },
  { key: "other_monthly_personal", label: "その他の毎月の費用（本人負担・円）", group: "personal", note: "上の項目にない本人負担の費用" },
];

export function emptyMonthlyCosts() {
  const costs = {};
  MONTHLY_COST_FIELDS.forEach(f => { costs[f.key] = ""; });
  return costs;
}

export function monthlyCostsFromRecord(record) {
  const costs = {};
  MONTHLY_COST_FIELDS.forEach(f => { costs[f.key] = record?.[f.key] ?? (f.required ? "" : 0); });
  return costs;
}

export function parseMonthlyCosts(costs) {
  const parsed = {};
  MONTHLY_COST_FIELDS.forEach(f => { parsed[f.key] = parseInt(costs[f.key]) || 0; });
  return parsed;
}

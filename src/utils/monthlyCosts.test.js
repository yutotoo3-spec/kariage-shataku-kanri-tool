import { describe, it, expect } from "vitest";
import { MONTHLY_COST_FIELDS, emptyMonthlyCosts, monthlyCostsFromRecord, parseMonthlyCosts } from "./monthlyCosts";

describe("monthlyCosts", () => {
  it("すべての費用項目を空欄で初期化する", () => {
    const costs = emptyMonthlyCosts();
    expect(Object.keys(costs)).toEqual(MONTHLY_COST_FIELDS.map(f => f.key));
    expect(Object.values(costs).every(v => v === "")).toBe(true);
  });

  it("入力値を整数に変換し、空欄・不正値は0円にする", () => {
    const parsed = parseMonthlyCosts({ rent: "130000", common_fee: "", management_fee: "abc", parking_fee: 5000 });
    expect(parsed.rent).toBe(130000);
    expect(parsed.common_fee).toBe(0);
    expect(parsed.management_fee).toBe(0);
    expect(parsed.parking_fee).toBe(5000);
    expect(Object.keys(parsed)).toHaveLength(MONTHLY_COST_FIELDS.length);
  });

  it("保存済みレコードから読み込み、未設定の任意項目は0円・必須項目は空欄にする", () => {
    const costs = monthlyCostsFromRecord({ rent: 80000, parking_fee: null });
    expect(costs.rent).toBe(80000);
    expect(costs.parking_fee).toBe(0);
    expect(costs.common_fee).toBe("");
  });
});

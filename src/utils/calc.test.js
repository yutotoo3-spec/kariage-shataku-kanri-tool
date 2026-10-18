import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETTINGS, calcSubsidyLimit, calcBurden, checkRentCeiling, calcActualRent,
  calcTotalPersonalDeduction, calcTotalCompanyCost, calcProration, yen,
} from "./calc";
import burdenCases from "../../tests/fixtures/burden-cases.json";

// フィクスチャの settings は差分だけを持つので、既定値に重ねて使う
const withDefaults = settings => ({ ...DEFAULT_SETTINGS, ...settings });

describe("負担額の計算（DBの calc_rent_burden と共通のケース）", () => {
  // 同じフィクスチャを supabase/tests でもDB側に流しており、画面とDBの計算が一致することを保証する
  it.each(burdenCases)("$description", c => {
    const settings = withDefaults(c.settings);
    const actualRent = calcActualRent(c);
    const subsidyLimit = calcSubsidyLimit(c.basic_salary, c.family_type, settings);
    const { companyBurden, personalBurden } = calcBurden(actualRent, subsidyLimit, settings);
    expect({ actual_rent: actualRent, subsidy_limit: subsidyLimit, company_burden: companyBurden, personal_burden: personalBurden })
      .toEqual(c.expected);
  });
});

describe("calcSubsidyLimit", () => {
  it("単身は基本給の20%、家族帯同は25%（既定値）", () => {
    expect(calcSubsidyLimit(300000, "single")).toBe(60000);
    expect(calcSubsidyLimit(300000, "family")).toBe(75000);
  });

  it("1円未満は切り捨て", () => {
    expect(calcSubsidyLimit(333333, "single")).toBe(66666);
  });

  it("小数の誤差で1円ずれない（205,000円×20%）", () => {
    expect(calcSubsidyLimit(205000, "single")).toBe(41000);
  });
});

describe("calcBurden", () => {
  it("限度額以内は実賃料を会社70%・本人30%で按分（会社は切り捨て、本人は切り上げ）", () => {
    expect(calcBurden(55555, 60000)).toEqual({ companyBurden: 38888, personalBurden: 16667 });
  });

  it("限度額超過分は全額本人負担", () => {
    expect(calcBurden(140000, 100000)).toEqual({ companyBurden: 70000, personalBurden: 70000 });
  });

  it("会社負担＋本人負担は実賃料以上になる（1円未満の端数は本人側に寄る）", () => {
    for (const rent of [1, 999, 55555, 60000, 60001, 123457]) {
      const { companyBurden, personalBurden } = calcBurden(rent, 60000);
      expect(companyBurden + personalBurden).toBeGreaterThanOrEqual(rent);
      expect(companyBurden + personalBurden - rent).toBeLessThanOrEqual(1);
    }
  });

  it("小数の誤差で1円ずれない（1,000円刻みで60万円まで、70%/30%）", () => {
    for (let rent = 0; rent <= 600000; rent += 1000) {
      const { companyBurden, personalBurden } = calcBurden(rent, Infinity);
      expect(companyBurden).toBe(Math.floor((rent * 70) / 100));
      expect(personalBurden).toBe(Math.ceil((rent * 30) / 100));
    }
  });
});

describe("checkRentCeiling", () => {
  it("実賃料が限度額の1.5倍以内ならOK、超えたらNG", () => {
    expect(checkRentCeiling(150000, 100000)).toBe(true);
    expect(checkRentCeiling(150001, 100000)).toBe(false);
  });
});

describe("calcActualRent", () => {
  it("家賃＋共益費＋管理費の合計（文字列の入力値も数値として扱う）", () => {
    expect(calcActualRent({ rent: "130000", common_fee: "5000", management_fee: 2000 })).toBe(137000);
  });

  it("未入力の項目は0円として扱う", () => {
    expect(calcActualRent({ rent: 50000 })).toBe(50000);
    expect(calcActualRent()).toBe(0);
  });

  it("駐車場代などは実賃料に含めない", () => {
    expect(calcActualRent({ rent: 50000, parking_fee: 10000 })).toBe(50000);
  });
});

describe("calcTotalPersonalDeduction / calcTotalCompanyCost", () => {
  const costs = {
    parking_fee: 10000, bicycle_parking_fee: 500, neighborhood_fee: 300, internet_fee: 4000,
    water_fee_flat: 2000, support_service_fee_monthly: 1000, other_monthly_personal: 200,
    other_fixed_lease_cost: 3000, satellite_fee: 400, other_monthly_company: 600, guarantee_fee_monthly: 1500,
  };

  it("本人負担の毎月費用を足した給与控除合計", () => {
    expect(calcTotalPersonalDeduction(30000, costs)).toBe(30000 + 18000);
  });

  it("会社負担の毎月費用（保証料を含む）を足した会社負担合計", () => {
    expect(calcTotalCompanyCost(70000, costs)).toBe(70000 + 5500);
  });

  it("費用がなければ負担額そのまま", () => {
    expect(calcTotalPersonalDeduction(30000)).toBe(30000);
    expect(calcTotalCompanyCost(70000)).toBe(70000);
  });
});

describe("calcProration（日割り）", () => {
  it("月額を日数で按分し、1円未満は切り上げ", () => {
    expect(calcProration(30000, 30, 10)).toBe(10000);
    expect(calcProration(10000, 31, 15)).toBe(4839);
  });

  it("満月入居なら月額と一致する（小数の誤差で1円増えない）", () => {
    for (const amount of [31000, 70000, 33333, 123457]) {
      for (const days of [28, 29, 30, 31]) {
        expect(calcProration(amount, days, days)).toBe(amount);
      }
    }
  });
});

describe("yen", () => {
  it("円記号と桁区切りを付ける", () => {
    expect(yen(1234567)).toBe("¥1,234,567");
  });

  it("未設定は —", () => {
    expect(yen(null)).toBe("—");
    expect(yen(undefined)).toBe("—");
  });
});

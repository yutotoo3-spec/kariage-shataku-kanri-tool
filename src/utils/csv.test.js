import { describe, it, expect } from "vitest";
import { csvCell, csvRow } from "./csv";

describe("csvCell", () => {
  it("通常の文字列・数値はそのまま", () => {
    expect(csvCell("山田太郎")).toBe("山田太郎");
    expect(csvCell(85000)).toBe("85000");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("カンマ・ダブルクォート・改行を含む値はダブルクォートで囲む", () => {
    expect(csvCell("A,B")).toBe('"A,B"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("1行目\n2行目")).toBe('"1行目\n2行目"');
  });

  it("式として解釈される先頭文字の前に ' を付ける", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+81-90")).toBe("'+81-90");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\t=1")).toBe("'\t=1");
    expect(csvCell('=HYPERLINK("http://example.com","x")')).toBe('"\'=HYPERLINK(""http://example.com"",""x"")"');
  });

  it("数値のマイナスはそのまま（金額の調整などで使う）", () => {
    expect(csvCell(-500)).toBe("-500");
  });
});

describe("csvRow", () => {
  it("セルをカンマでつなぐ", () => {
    expect(csvRow(["=cmd", "物件,A", 1000])).toBe("'=cmd,\"物件,A\",1000");
  });
});

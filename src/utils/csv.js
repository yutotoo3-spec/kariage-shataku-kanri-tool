// CSV の1セル分の値を作る。
// 表計算ソフトは先頭が = + - @（とタブ・CR）のセルを式として扱うため、申請者が入力した文字列に
// 式を仕込まれると、担当者が Excel で開いたときに実行されてしまう（CSVインジェクション）。
// 文字列はそのような先頭文字の前に ' を付けて、ただの文字として扱わせる。金額などの数値はそのまま出力する。
export function csvCell(value) {
  let s = String(value ?? "");
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(values) {
  return values.map(csvCell).join(",");
}

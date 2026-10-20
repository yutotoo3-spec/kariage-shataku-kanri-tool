// 人事担当者の一連の業務（ログイン → 申請の審査 → 入居者台帳 → 月次処理 → 監査ログ）と、
// 権限による画面の出し分けを、実際のブラウザ操作で確認する。データは e2e/seed.sh のダミーデータ。
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const PASSWORD = "e2e-Password-2026";

async function login(page, email) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page.getByText("E2Eテスト株式会社")).toBeVisible();
}

test("申請を審査して入居者台帳に登録し、月次処理と監査ログに反映される", async ({ page }) => {
  await login(page, "owner@e2e.example");

  // 申請一覧 → 詳細
  await page.getByRole("link", { name: "申請一覧" }).click();
  const row = page.getByRole("row", { name: /E2E 太郎/ });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "詳細" }).click();

  // 実賃料（家賃50,000円＋共益費5,000円）はサーバー側で計算されている
  await expect(page.getByText("55,000").first()).toBeVisible();

  // 審査：契約手続き中にする
  await page.locator("select").first().selectOption("contract_pending");
  await page.getByRole("button", { name: "ステータスを更新" }).click();

  // 入居者台帳へ登録
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  await page.locator('input[type="date"]').first().fill(today);
  await page.getByRole("button", { name: "入居者台帳に登録する" }).click();
  await expect(page.getByText("承認済").first()).toBeVisible();

  // 入居者台帳に載る
  await page.getByRole("link", { name: "入居者台帳" }).click();
  await expect(page.getByText("E2E 太郎")).toBeVisible();

  // 月次処理に載り、CSV を出力できる
  await page.getByRole("link", { name: "月次処理" }).click();
  await expect(page.getByText("E2E 太郎")).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "CSV 出力" }).click(),
  ]);
  // ヘッドレスの Chromium は日本語のファイル名を "download" にしてしまうため、ファイル名ではなく中身を確認する
  const csv = readFileSync(await download.path(), "utf8");
  expect(csv).toContain("氏名,物件名,実賃料,本人負担額,会社負担額,備考");
  expect(csv).toContain("E2E 太郎");

  // 監査ログに操作が残る（owner のみ閲覧可）。絞り込み用プルダウンの選択肢にも同じ文字があるため、表示中の要素だけを見る
  await page.getByRole("link", { name: "監査ログ" }).click();
  await expect(page.getByText("入居者台帳へ登録").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("申請のステータス変更").filter({ visible: true }).first()).toBeVisible();
});

test("owner は設定画面で所属メンバーを確認できる", async ({ page }) => {
  await login(page, "owner@e2e.example");
  await page.getByRole("link", { name: "設定" }).click();
  await expect(page.getByText("所属メンバー")).toBeVisible();
  await expect(page.getByText("member@e2e.example")).toBeVisible();
  await expect(page.getByText("二要素認証")).toBeVisible();
});

test("member には監査ログのメニューが出ず、設定は閲覧のみ", async ({ page }) => {
  await login(page, "member@e2e.example");
  await expect(page.getByRole("link", { name: "監査ログ" })).toHaveCount(0);
  await page.getByRole("link", { name: "設定" }).click();
  await expect(page.getByText("設定の変更は管理者（owner）のみ可能です")).toBeVisible();
  await expect(page.getByText("所属メンバー")).toHaveCount(0);
});

test("ログインしていないと管理画面は見られない", async ({ page }) => {
  await page.goto("/applications");
  await expect(page).toHaveURL(/\/login$/);
});

test("公開申請フォームに会社名と個人情報の取扱いが表示される", async ({ page }) => {
  await page.goto("/apply/e2e-co");
  await expect(page.getByText("E2Eテスト株式会社").first()).toBeVisible();
  await expect(page.getByText("個人情報の取扱いについて")).toBeVisible();
  // 同意しないと送信できない
  await expect(page.getByRole("button", { name: "送信する" })).toBeDisabled();
});

// E2E テスト（ブラウザを自動操作して、画面の一連の流れを確認する）
// ローカルの Supabase（supabase start）にダミーデータを入れた状態で実行する。手順は e2e/README.md を参照。
import { defineConfig } from "@playwright/test";

const port = 4173;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    // 本番と同じくビルドした画面を配信する。接続先はローカルの Supabase（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    port,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

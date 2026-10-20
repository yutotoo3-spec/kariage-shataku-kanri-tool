# E2E テスト

ブラウザ（Chromium）を自動で操作して、画面の一連の流れが動くかを確認するテストです。PR ごとに GitHub Actions の `e2e tests` で自動実行されます。

## 何を確認しているか（`app.spec.js`）

1. owner でログイン → 申請を審査 → 入居者台帳に登録 → 月次処理に載り CSV を出力できる → 監査ログに記録される
2. owner は設定画面で所属メンバー・二要素認証の欄が見える
3. member には監査ログのメニューが出ず、設定は閲覧のみ
4. ログインしていないと管理画面は見られない
5. 公開申請フォームに会社名と個人情報の取扱いが表示される

## 接続先（使い捨てのステージング）

本番の Supabase には一切接続しません。テストのたびに Supabase CLI で Supabase 一式（DB・ログイン・API）を手元（CI ではその実行の中）に立ち上げ、`supabase/migrations/` を全部流し、`seed.sh` でダミーの会社・ユーザー・申請を入れます。終わったら捨てます。

| ダミーユーザー | パスワード | 権限 |
|---|---|---|
| owner@e2e.example | e2e-Password-2026 | owner |
| member@e2e.example | e2e-Password-2026 | member |

## ローカルで実行する

必要なもの：Node.js 22 以上、Docker、psql

```bash
npm install
npx playwright install chromium
npx supabase start -x studio,imgproxy,logflare,vector,supavisor,realtime,storage-api,mailpit,postgres-meta

# 毎回きれいな状態から始める（DB を作り直してダミーデータを入れる）
eval "$(npx supabase status -o env | sed 's/^/export /')"
npx supabase db reset
bash e2e/seed.sh

VITE_SUPABASE_URL=$API_URL VITE_SUPABASE_ANON_KEY=$ANON_KEY npm run test:e2e

npx supabase stop   # 片付け
```

失敗したときは `npx playwright show-report` で、失敗した画面のスクリーンショットと操作の記録を見られます。CI で失敗したときは、実行結果の Artifacts から `playwright-report` をダウンロードできます。

## 画面を変えたとき

ボタンやメニューの文言を変えると、テストが要素を見つけられず失敗します。`app.spec.js` の該当する文言も合わせて直してください。

# 申請フォームの CAPTCHA（Cloudflare Turnstile）

公開申請フォーム（`/apply/:slug`）の大量送信対策として、Cloudflare Turnstile で「人間による送信か」を確認しています（Issue #32）。

## しくみ

```
申請フォーム ──(Turnstileのトークン＋申請内容)──▶ Edge Function「submit-application」
                                                    │ ① Cloudflare にトークンを確認（Secret Key を使用）
                                                    │ ② 有効な会社か確認
                                                    ▼ ③ 申請を登録（service_role）
                                                 applications テーブル
```

- 申請フォームから `applications` テーブルへ直接登録することは、マイグレーション 019 で禁止しています。CAPTCHA を通らない送信は登録されません
- 1社あたり 1時間20件・24時間100件の上限（018）と、ボット用の見えない入力欄（ハニーポット）も併用しています
- Site Key（公開してよい鍵）は `src/components/TurnstileWidget.jsx` に、Secret Key は Supabase の Edge Function の Secret にだけ置きます

## 初回設定（本番反映の順番）

**この順番を守ってください。** 逆にすると、その間は申請フォームから送信できなくなります。

### 1. Secret Key を Supabase に登録する
1. Supabase ダッシュボード → 左メニュー **Edge Functions** → **Secrets**（または Project Settings → Edge Functions）
2. **Add new secret** で次を登録する
   - Name：`TURNSTILE_SECRET_KEY`
   - Value：Cloudflare の Turnstile 画面に表示された **Secret Key**

### 2. Edge Function をデプロイする
1. Supabase ダッシュボード → **Edge Functions** → **Deploy a new function** → **Via Editor**
2. Function name に `submit-application` と入力する（**この名前で作ること**。画面側がこの名前で呼び出す）
3. エディタの中身をすべて消し、`supabase/functions/submit-application/index.ts` の内容を貼り付ける
4. **Deploy function** を押す
5. 関数の詳細画面 → **Details**（設定）で「**Verify JWT with legacy secret**」（または Enforce JWT verification）を **OFF** にして保存する
   - この関数は未ログインの申請者が呼ぶ公開用の窓口で、守りは Turnstile のトークン検証で行っている
   - ON のままだと、プロジェクトの鍵の種類によっては申請フォームからの呼び出しが拒否される

### 3. 申請フォームを本番にデプロイする
このPRをマージすると、Vercel が自動でデプロイします。デプロイ後、申請フォームに確認欄が表示され、送信できることを確認します。

### 4. 直接登録を禁止する
SQL Editor で `supabase/migrations/019_require_captcha_for_public_apply.sql` を実行します。

実行後、もう一度申請フォームから送信できることを確認します。

## Edge Function を更新したとき
`supabase/functions/submit-application/index.ts` を変更したら、上の「2. Edge Function をデプロイする」と同じ画面で、既存の `submit-application` を開いて内容を貼り替え、デプロイし直します（コードをマージしただけでは Supabase に反映されません）。

## 注意

- Turnstile のウィジェットに登録したホスト名（`kariage-shataku-kanri-tool.vercel.app`）以外では確認が通りません。Vercel のプレビュー環境（`...-git-....vercel.app`）では申請フォームの送信は失敗します。プレビューでも試したい場合は、Cloudflare の Turnstile 設定でそのホスト名を追加します
- ローカル開発では、`.env.local` に Cloudflare 公式のテスト用キー `VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA`（常に成功）を設定できます
- 独自ドメインに移行した場合は、Turnstile のホスト名にも追加してください

## 動作確認の目安
| 症状 | 確認すること |
|---|---|
| 確認欄が表示されない | ブラウザの拡張機能（広告ブロック等）で challenges.cloudflare.com が遮断されていないか |
| 「確認に失敗しました」と出る | Secret Key が正しく登録されているか、Turnstile のホスト名が正しいか |
| 「送信に失敗しました」と出る | Edge Function の名前が `submit-application` になっているか、Edge Functions → Logs にエラーが出ていないか |

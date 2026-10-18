# 借上社宅管理ツール

借上社宅（会社が物件を借り、社員に貸す社宅）の申請から入居者台帳・月次処理までを管理する Web アプリです。複数の企業が1つのアプリを共同で使う形（マルチテナント）で、各社のデータは互いに見えません。

## 主な機能

| 機能 | 画面 | 内容 |
|---|---|---|
| 公開申請フォーム | `/apply/:企業スラッグ` | 社員がログインせずに入居申請を送る。CAPTCHA（Cloudflare Turnstile）付き |
| 申請管理 | `/applications` | 申請の審査（承認・却下など）と、入居者台帳への登録 |
| 入居者台帳 | `/tenants` | 入居中の社員・物件・家賃の管理。家賃変更や退去の記録 |
| 月次処理 | `/monthly` | 月ごとの会社負担額・本人負担額の一覧 |
| 設定（owner のみ） | `/settings` | 規程の料率など。担当者の招待 |
| 監査ログ（owner のみ） | `/audit-logs` | 誰が・いつ・何を操作したかの記録を閲覧 |
| パスワード再設定 | `/forgot-password` → メールのリンク → `/reset-password` | ログイン画面の「パスワードを忘れた場合」から。Supabase の Redirect URLs に `/reset-password` の URL を登録しておく |
| 運営者メニュー | `/admin` | 企業登録の招待発行、企業の一覧・利用停止（運営者のみ） |

### 権限

- **運営者**：アプリ全体の管理者。企業登録の招待を発行できる
- **owner**：企業の管理者。設定変更・担当者の招待・監査ログの閲覧ができる
- **member**：企業の担当者。申請審査・入居者登録・月次処理などの日常業務ができる

## 構成

```
ブラウザ（React）──▶ Vercel（画面の配信）
      │
      ├──▶ Supabase（データベース・ログイン・権限チェック）
      └──▶ Supabase Edge Function「submit-application」──▶ Cloudflare Turnstile（人間か確認）
```

| 役割 | 使っているもの |
|---|---|
| 画面 | React 19 + Vite + React Router |
| データベース・認証 | Supabase（PostgreSQL）。データの見える範囲は RLS（行単位のアクセス制御）で制御 |
| 申請受付 | Supabase Edge Function（`supabase/functions/submit-application`） |
| 公開（ホスティング） | Vercel。`main` にマージすると自動で本番に反映される |
| 自動テスト | GitHub Actions（`.github/workflows/ci.yml`） |
| バックアップ | GitHub Actions で毎日暗号化バックアップ（`docs/backup-restore.md`） |

金額計算は画面（`src/utils/calc.js`）とデータベース（`calc_rent_burden` 関数）の両方にあります。**最終的な金額はデータベース側で計算し直す**ため、画面の値を書き換えられても改ざんにはなりません。計算式を変えるときは両方を直し、`tests/fixtures/burden-cases.json` のテストケースで一致を確認してください。

## ローカル開発

必要なもの：Node.js 22 以上

```bash
npm install
cp .env.example .env   # 中身を自分の Supabase の値に書き換える
npm run dev            # http://localhost:5173 で起動
```

`.env` に書く値（Supabase ダッシュボード → Project Settings → API）：

| 名前 | 内容 |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon public キー（公開してよい鍵） |

> `.env` は Git に含めません。`service_role` キー・DB パスワード・Turnstile の Secret Key などの秘密の値は、`.env` やチャット・Issue に書かず、Supabase / GitHub の Secrets にだけ登録してください。

### よく使うコマンド

| コマンド | 内容 |
|---|---|
| `npm run lint` | 書き方のチェック |
| `npm test` | 画面側のテスト（Vitest） |
| `npm run build` | 本番用ファイルの作成 |
| `npm run test:db` | データベースのテスト（PostgreSQL が必要。CI では自動実行） |

## マイグレーション（データベースの変更）

`supabase/migrations/` の SQL ファイルを、**番号順に** Supabase の SQL Editor で実行します。各ファイルは何度実行しても同じ結果になるように書いています。

### 注意点

- **019 は実行の順番に注意**：先に Edge Function のデプロイと `TURNSTILE_SECRET_KEY` の登録、新しい申請フォームの本番反映を済ませてから実行します（逆にすると申請フォームから送信できなくなる）。詳細は `docs/turnstile.md`
- **申請フォームに入力項目を追加したとき**：`supabase/functions/submit-application/index.ts` の `ALLOWED_FIELDS` にも列名を追加し、Edge Function を再デプロイします。ここにない項目は保存されません（申請者に審査結果や負担額を書き込ませないため）
- **金額計算・設定項目を変えたとき**：`src/utils/calc.js` と `calc_rent_burden`（017）の両方を直します
- **新しいテーブルを作ったとき**：必ず RLS を有効にし、`company_id = public.current_company_id()` で自社分だけ見えるポリシーを付けます。`supabase/tests/02_security.sql` に他社のデータが見えないことのテストを追加してください
- **申請の件数上限**（1社あたり 1時間20件・24時間100件）を変えるときは、018 を直接直さず新しいマイグレーションを作ります

## 運営者の登録と企業登録の流れ

企業の登録は招待制です。運営者が招待を送った人だけが企業を登録できます。

### 1. 運営者を登録する（最初の1回）

運営者になる人のアカウントを `/signup` などで作成したあと、Supabase の SQL Editor で実行します。

```sql
insert into platform_admins (user_id)
select id from auth.users where email = '運営者のメールアドレス';
```

### 2. 企業を招待する

1. 運営者でログイン → メニューの **運営者メニュー**
2. 招待先のメールアドレスを入力して招待を発行し、表示されたリンクを相手に送る（有効期限 14日・1回のみ）
3. 相手がリンクから企業名・スラッグ（申請フォームの URL に使う英数字）を入力して登録すると、その人が企業の owner になる

### 3. 担当者を追加する

owner でログイン → **設定** から担当者を招待します。

### 企業の利用停止

運営者メニューの企業一覧から、企業を利用停止・再開できます。停止中の企業は画面の操作と申請受付ができなくなります。

## リリース手順

1. **PR を作る**：変更はブランチで行い、PR（プルリクエスト）を作成する
2. **自動テストを確認**：PR の CI（lint / test / build・database tests・edge function tests）がすべて緑になるのを待つ
3. **プレビューで確認**：PR に Vercel が付けるプレビュー URL で画面を確認する（申請フォームの送信は本番のドメインでしか通らない）
4. **マージ**：`main` にマージすると Vercel が自動で本番に反映する
5. **SQL を実行**：PR に新しいマイグレーションが含まれる場合、Supabase の SQL Editor で実行する（実行の順番に注意があるものは PR に記載）
6. **Edge Function を更新**：`supabase/functions/` を変更した場合は Supabase で再デプロイする
7. **本番確認**：本番の画面で変更した機能を実際に操作して確認する

## 関連ドキュメント

- `docs/turnstile.md`：申請フォームの CAPTCHA の設定
- `docs/backup-restore.md`：バックアップと復元の手順

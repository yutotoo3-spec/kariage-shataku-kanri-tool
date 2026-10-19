# データベースのバックアップと復元

人事データ（個人情報・給与・家賃）を扱うため、Supabase のデータベースを毎日バックアップしています（Issue #30）。

## しくみ

| 項目 | 内容 |
|---|---|
| 実行 | GitHub Actions（`.github/workflows/db-backup.yml`）が毎日 03:17（日本時間）に自動実行。Actions 画面から手動実行も可能 |
| 対象 | `public` スキーマ全体（テーブル定義・データ・関数・RLSポリシー・権限）と `auth.users`（ログインユーザー） |
| 保管 | パスワード（`BACKUP_PASSPHRASE`）で AES256 暗号化し、GitHub Actions の成果物（Artifacts）として **30日間** 保管 |
| 処理本体 | `scripts/backup-db.sh` |

主要なテーブルのデータが含まれていない場合、バックアップは失敗扱いになります（空のバックアップを成功と誤認しないため）。

## 初回設定

1. Supabase ダッシュボードで **Connect** を開き、**Session pooler** の接続文字列をコピーする
   - `[YOUR-PASSWORD]` の部分を、DBのパスワードに置き換える
   - GitHub Actions は IPv4 で接続するため、Direct connection ではなく Session pooler を使う
2. 暗号化パスワードを決める（長くて推測されにくいもの。パスワードマネージャーでの生成を推奨）
3. GitHub のリポジトリで **Settings → Secrets and variables → Actions → New repository secret** から次の2つを登録する
   - `SUPABASE_DB_URL`：1の接続文字列
   - `BACKUP_PASSPHRASE`：2の暗号化パスワード
4. **暗号化パスワードは GitHub 以外の安全な場所（パスワードマネージャーなど）にも必ず控える**
   - GitHub の Secret は登録後に中身を見られないため、紛失するとバックアップを復元できなくなる
5. **Actions → DB backup → Run workflow** で手動実行し、成功することを確認する

## バックアップの取り出し

1. GitHub の **Actions → DB backup** から、復元したい日の実行を開く
2. 画面下部の **Artifacts** から `db-backup-...` をダウンロードして展開する（`db-backup-YYYYMMDDTHHMMSSZ.tar.gz.gpg` が入っている）
3. 復号して展開する（暗号化パスワードの入力を求められる）

```bash
gpg --decrypt db-backup-YYYYMMDDTHHMMSSZ.tar.gz.gpg | tar -xz
# → public.dump と auth_users.dump が展開される
```

## 復元テスト（毎月自動）

バックアップが「取れている」だけでなく「戻せる」ことを確かめるため、毎月1日に **Actions → DB restore drill** が自動で実行されます（手動実行も可能）。

最新のバックアップを、本番とは別の **復元確認用の Supabase プロジェクト** に戻し、次を確認します（`scripts/restore-db.sh`）。結果は実行画面の **Summary** に表として表示されます（件数のみで、個人情報は表示しません）。

- 主要なテーブルの件数（本番の現在の件数と並べて表示）
- 全テーブルで RLS（行単位のアクセス制御）が有効か
- マイグレーションで外した権限が戻っていないか（未ログインでの申請の直接登録・監査ログの更新削除・内部用関数の呼び出し）
- アプリが使う権限・トリガーが戻っているか

### 初回設定

1. Supabase で **新しいプロジェクト** を作る（例：`kariage-restore-test`。無料プランで可。リージョンは本番と同じ東京を推奨）
2. 新しいプロジェクトの **Connect → Session pooler** の接続文字列をコピーし、`[YOUR-PASSWORD]` を **そのプロジェクトの** DBパスワードに置き換える
3. GitHub の **Settings → Secrets and variables → Actions → New repository secret** で登録する
   - `RESTORE_DB_URL`：2の接続文字列
4. **Actions → DB backup → Run workflow** でバックアップを取り直す（この変更より前のバックアップは権限を含まないため、復元テストが失敗する）
5. **Actions → DB restore drill → Run workflow** で実行し、成功することを確認する

> **復元確認用プロジェクトの中身は、実行のたびにすべて消えて最新のバックアップに置き換わります。** `RESTORE_DB_URL` に本番の接続文字列を登録しないでください（同じ接続先の場合は実行を中止するようにしていますが、念のため）。

## 復元（手動）

本番を直接上書きする前に、まず復元確認用プロジェクトで中身を確認してください。手元のパソコンで行う場合は、PostgreSQL 17 のクライアントと gpg が必要です。

```bash
export RESTORE_DB_URL='postgresql://postgres.xxxx:パスワード@aws-0-xxxx.pooler.supabase.com:5432/postgres'
export BACKUP_PASSPHRASE='暗号化パスワード'
export SUPABASE_DB_URL='本番の接続文字列'   # 本番との取り違え防止のため（任意）
scripts/restore-db.sh db-backup-YYYYMMDDTHHMMSSZ.tar.gz.gpg
```

`restore-db.sh` は、復元先の `public` スキーマとログインユーザーを **すべて削除してから** バックアップの内容で作り直し、上記の確認を行います。

### 注意

- **データだけを既存のテーブルに戻す（`--data-only`）のは避けてください。** 申請・監査ログのトリガーが動き、ステータスや日時・操作者が上書きされます。`restore-db.sh` はテーブルごと作り直すため、データを戻した後にトリガーが作られ、上書きは起きません
- バックアップに含まれないもの：二要素認証の登録（`auth.mfa_factors`）、ログイン方法の紐付け（`auth.identities`）、Edge Function と Secret、Supabase の Authentication の設定。本番を作り直す場合はこれらを別途設定し、利用者には二要素認証の再登録をお願いする
- 本番を戻す必要がある場合は、作業前に必ずその時点のバックアップを手動実行で取ってから行ってください

## 定期的な確認

- 月に1回程度、Actions の実行履歴が成功しているかを確認する（失敗すると GitHub から通知メールが届きます）
- 毎月の DB restore drill が成功しているかを確認する（失敗すると GitHub から通知メールが届きます）

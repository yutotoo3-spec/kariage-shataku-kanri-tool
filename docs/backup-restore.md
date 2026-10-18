# データベースのバックアップと復元

人事データ（個人情報・給与・家賃）を扱うため、Supabase のデータベースを毎日バックアップしています（Issue #30）。

## しくみ

| 項目 | 内容 |
|---|---|
| 実行 | GitHub Actions（`.github/workflows/db-backup.yml`）が毎日 03:17（日本時間）に自動実行。Actions 画面から手動実行も可能 |
| 対象 | `public` スキーマ全体（テーブル定義・データ・関数・RLSポリシー）と `auth.users`（ログインユーザー） |
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

## 復元

本番を直接上書きする前に、**新しい Supabase プロジェクト（復元確認用）に復元して中身を確認する**のが安全です。
コマンドには、復元先プロジェクトの Session pooler の接続文字列を使います（PostgreSQL 17 のクライアントが必要）。

```bash
RESTORE_DB_URL='postgresql://postgres.xxxx:パスワード@aws-0-xxxx.pooler.supabase.com:5432/postgres'

# 1. ログインユーザー（auth.users）を先に戻す（profiles などが参照しているため）
pg_restore --dbname="$RESTORE_DB_URL" --data-only auth_users.dump

# 2. アプリのデータ（テーブル・関数・RLSポリシー・データ）を戻す
pg_restore --dbname="$RESTORE_DB_URL" --no-owner --no-privileges public.dump
```

- 2 で `schema "public" already exists` というエラーが1件出ますが、問題ありません
- 復元後、主要なテーブルの件数を元と比べて確認する

```sql
select 'companies' as t, count(*) from companies union all
select 'profiles', count(*) from profiles union all
select 'applications', count(*) from applications union all
select 'tenancies', count(*) from tenancies union all
select 'rent_history', count(*) from rent_history;
```

### 注意

- **データだけを既存のテーブルに戻す（`--data-only`）のは避けてください。** 申請・監査ログのトリガーが動き、ステータスや日時・操作者が上書きされます。上記のようにテーブルごと復元すると、トリガーはデータを戻した後に作られるため上書きは起きません
- 本番を戻す必要がある場合は、作業前に必ずその時点のバックアップを手動実行で取ってから行ってください

## 定期的な確認

- 月に1回程度、Actions の実行履歴が成功しているかを確認する（失敗すると GitHub から通知メールが届きます）
- 半年に1回程度、復元確認用プロジェクトへの復元を試し、手順が古くなっていないかを確認する

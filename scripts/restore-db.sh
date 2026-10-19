#!/usr/bin/env bash
# 暗号化バックアップを復元確認用のDBに戻し、中身と権限が正しく戻ったかを検証する（復元テスト）
#
# 必要な環境変数:
#   RESTORE_DB_URL     … 復元先DBの接続文字列（本番とは別の Supabase プロジェクト。中身はすべて消える）
#   BACKUP_PASSPHRASE  … バックアップの暗号化パスワード
# 任意の環境変数:
#   SUPABASE_DB_URL    … 本番DBの接続文字列。誤って本番に復元しないための照合と、件数の比較に使う
#   PG_BIN             … pg_restore / psql のあるディレクトリ
#
# 使い方: scripts/restore-db.sh db-backup-YYYYMMDDTHHMMSSZ.tar.gz.gpg
set -euo pipefail

: "${RESTORE_DB_URL:?RESTORE_DB_URL が設定されていません}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE が設定されていません}"
backup_file="${1:?バックアップファイルを指定してください}"

pg_restore="${PG_BIN:+$PG_BIN/}pg_restore"
psql="${PG_BIN:+$PG_BIN/}psql"

# 接続先を「ユーザー@ホスト:ポート/DB名」と Supabase のプロジェクトID に正規化する（パスワードは除く）
endpoint() { sed -E 's#^[a-z]+://##; s#^([^:@/]+)(:[^@]*)?@#\1@#; s#\?.*$##' <<<"$1"; }
project_ref() { grep -oE '(postgres\.[a-z0-9]{20}|db\.[a-z0-9]{20}\.supabase\.co)' <<<"$1" | head -1 | sed -E 's#^postgres\.##; s#^db\.##; s#\.supabase\.co$##' || true; }

# 本番を消してしまわないよう、復元先が本番と同じなら中止する
if [ -n "${SUPABASE_DB_URL:-}" ]; then
  restore_ref="$(project_ref "$RESTORE_DB_URL")"
  if [ "$(endpoint "$RESTORE_DB_URL")" = "$(endpoint "$SUPABASE_DB_URL")" ] \
    || { [ -n "$restore_ref" ] && [ "$restore_ref" = "$(project_ref "$SUPABASE_DB_URL")" ]; }; then
    echo "復元先が本番DBと同じです。本番のデータを消してしまうため中止しました" >&2
    exit 1
  fi
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
  --decrypt --output "$work/backup.tar.gz" "$backup_file" 3<<<"$BACKUP_PASSPHRASE"
tar -C "$work" -xzf "$work/backup.tar.gz"

run_sql() { "$psql" "$RESTORE_DB_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

# 復元先を空にする（public スキーマごと削除し、バックアップのスキーマ・権限で作り直す）
run_sql -c "drop schema if exists public cascade" -c "delete from auth.users"

# 1. ログインユーザー（profiles などが参照しているため先に戻す）
"$pg_restore" --dbname="$RESTORE_DB_URL" --data-only --exit-on-error "$work/auth_users.dump"
# 2. アプリのデータ（テーブル・関数・RLSポリシー・権限・データ）。データを戻した後にトリガーが作られるため上書きは起きない
"$pg_restore" --dbname="$RESTORE_DB_URL" --no-owner --exit-on-error "$work/public.dump"

tables="companies profiles settings applications tenancies rent_history audit_logs invites company_invites platform_admins"
count_sql() {
  local sql="" t
  for t in $tables; do sql+="${sql:+ union all }select '$t', count(*) from public.$t"; done
  echo "$sql"
}

summary="${GITHUB_STEP_SUMMARY:-/dev/null}"
{
  echo "## 復元テストの結果"
  echo
  echo "バックアップ: \`$(basename "$backup_file")\`"
  echo
  echo "| テーブル | 復元した件数 | 本番の現在の件数 |"
  echo "|---|---:|---:|"
} >>"$summary"

declare -A prod_counts=()
if [ -n "${SUPABASE_DB_URL:-}" ]; then
  while IFS='|' read -r t c; do prod_counts[$t]=$c; done < <("$psql" "$SUPABASE_DB_URL" -X -qAt -c "$(count_sql)")
fi
echo "テーブルごとの件数（復元 / 本番の現在）:"
while IFS='|' read -r t c; do
  echo "  $t: $c / ${prod_counts[$t]:--}"
  echo "| $t | $c | ${prod_counts[$t]:--} |" >>"$summary"
done < <(run_sql -At -c "$(count_sql)")

# 検証。1つでも失敗したら復元テストは失敗扱いにする（個人情報は表示せず、件数と設定だけを確認する）
failures="$(run_sql -At <<'SQL'
select msg from (
  select 'companies / profiles / settings のいずれかが空です' as msg
    where (select count(*) from public.companies) = 0 or (select count(*) from public.profiles) = 0
       or (select count(*) from public.settings) = 0
  union all
  select 'ログインユーザーが見つからない profiles が ' || count(*) || ' 件あります'
    from public.profiles p where not exists (select 1 from auth.users u where u.id = p.user_id) having count(*) > 0
  union all
  select 'RLS が無効なテーブルがあります: ' || string_agg(c.relname, ', ')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity having count(*) > 0
  union all
  select 'アプリが使う権限が戻っていません（ログイン中ユーザーの申請の参照、申請フォームの企業情報の取得）'
    where not has_table_privilege('authenticated', 'public.applications', 'SELECT')
       or not has_function_privilege('anon', 'public.get_public_company(text)', 'EXECUTE')
  union all
  select '未ログインで申請を直接登録できる権限が戻っています'
    where has_table_privilege('anon', 'public.applications', 'INSERT')
  union all
  select '監査ログを更新・削除できる権限が戻っています'
    where has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE')
       or has_table_privilege('authenticated', 'public.audit_logs', 'DELETE')
  union all
  select '内部用の関数 calc_rent_burden を直接呼べる権限が戻っています'
    where has_function_privilege('authenticated', 'public.calc_rent_burden(uuid,integer,text,integer)', 'EXECUTE')
  union all
  select 'トリガーが見つかりません: ' || name
    from unnest(array['applications_before_insert', 'applications_a_rate_limit', 'audit_logs_before_insert']) as name
    where not exists (select 1 from pg_trigger where tgname = name)
) checks
SQL
)"

echo >>"$summary"
if [ -n "$failures" ]; then
  echo "復元テストで問題が見つかりました:" >&2
  echo "$failures" | sed 's/^/  - /' >&2
  { echo "### ❌ 問題あり"; echo "$failures" | sed 's/^/- /'; } >>"$summary"
  exit 1
fi
echo "復元テストに成功しました（データ・RLS・権限・トリガーが戻っていることを確認）"
echo "### ✅ 成功（データ・RLS・権限・トリガーが戻っていることを確認）" >>"$summary"

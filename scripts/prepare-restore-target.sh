#!/usr/bin/env bash
# 復元テスト用の空の PostgreSQL を、Supabase のDBに近い状態に整える
# （復元先に Supabase のプロジェクトを使わず、GitHub Actions 内の使い捨てDBに復元するため）
#   1. 本番と同じ名前のロール（anon / authenticated / service_role など）を作る（権限の復元に必要）
#   2. 本番の auth.users と同じ構造のテーブルを作る（ログインユーザーの復元に必要）
#   3. Supabase が用意している auth.uid() などの関数と auth.mfa_factors を最小限まねる（RLSポリシーの復元に必要）
# 本番に対しては、ロール名の一覧と auth.users の定義を読み取るだけで、何も変更しない。
#
# 必要な環境変数:
#   SUPABASE_DB_URL … 本番DBの接続文字列（読み取りのみ）
#   RESTORE_DB_URL  … 復元先の空のDBの接続文字列（スーパーユーザーで接続すること）
# 任意: PG_BIN … pg_dump / psql のあるディレクトリ
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL が設定されていません}"
: "${RESTORE_DB_URL:?RESTORE_DB_URL が設定されていません}"

pg_dump="${PG_BIN:+$PG_BIN/}pg_dump"
psql="${PG_BIN:+$PG_BIN/}psql"

roles="$("$psql" "$SUPABASE_DB_URL" -X -qAt -c "select rolname from pg_roles where rolname !~ '^pg_' order by 1")"
while read -r role; do
  [ -n "$role" ] || continue
  "$psql" "$RESTORE_DB_URL" -X -q -v ON_ERROR_STOP=1 -v role="$role" <<'SQL'
select format('create role %I nologin', :'role') as stmt
where not exists (select 1 from pg_roles where rolname = :'role') \gexec
SQL
done <<<"$roles"

"$psql" "$RESTORE_DB_URL" -X -q -v ON_ERROR_STOP=1 -c "create schema if not exists auth"
"$pg_dump" "$SUPABASE_DB_URL" --schema-only --no-owner --no-privileges --table=auth.users \
  | "$psql" "$RESTORE_DB_URL" -X -q -v ON_ERROR_STOP=1 >/dev/null

"$psql" "$RESTORE_DB_URL" -X -q -v ON_ERROR_STOP=1 <<'SQL'
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create or replace function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create table if not exists auth.mfa_factors (id uuid primary key, user_id uuid not null, status text not null);
grant usage on schema auth to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
SQL

echo "復元先の準備ができました（ロール $(wc -l <<<"$roles") 件・auth.users の定義を本番から反映）"

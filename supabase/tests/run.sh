#!/usr/bin/env bash
# DBのテストを実行する (#37)
# 空のテスト用DBを作り、Supabase相当の準備 → 全マイグレーション → テストの順に流す。
# 接続先は psql の標準の環境変数（PGHOST / PGPORT / PGUSER / PGPASSWORD）で指定する。
# 例: PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run test:db
set -euo pipefail
cd "$(dirname "$0")/../.."

db="${TEST_DB_NAME:-kariage_test}"
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
psql_db=(psql -X -q -v ON_ERROR_STOP=1 -d "$db")

psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $db" -c "create database $db"

"${psql_db[@]}" -f supabase/tests/supabase_stub.sql
for migration in supabase/migrations/*.sql; do
  echo "migrate: $migration"
  "${psql_db[@]}" -f "$migration" >/dev/null
done
"${psql_db[@]}" -f supabase/tests/helpers.sql

cases="$(cat tests/fixtures/burden-cases.json)"
for test_file in supabase/tests/[0-9]*.sql; do
  echo "test: $test_file"
  "${psql_db[@]}" -v cases="$cases" -f "$test_file" >/dev/null
done

echo "DBのテストはすべて成功しました"

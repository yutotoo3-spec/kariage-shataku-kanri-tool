#!/usr/bin/env bash
# バックアップ → 復元の一連の流れを、テスト用DBで確認する
# 「本番役」のDBにマイグレーションとサンプルデータを入れ、scripts/backup-db.sh で暗号化バックアップを作り、
# scripts/prepare-restore-target.sh で空の「復元先役」のDBを準備し、scripts/restore-db.sh で戻して、データ・RLS・権限・トリガーが戻ることを確かめる。
# 接続先は psql の標準の環境変数（PGHOST / PGPORT / PGUSER / PGPASSWORD）で指定する。
set -euo pipefail
cd "$(dirname "$0")/../.."

export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
prod_db="${TEST_DB_NAME:-kariage_test}_backup_src"
restore_db="${TEST_DB_NAME:-kariage_test}_backup_dst"

db_url() {
  if [[ "${PGHOST:-}" == /* ]]; then
    echo "postgresql:///$1?host=${PGHOST}&port=${PGPORT:-5432}&user=${PGUSER:-postgres}"
  else
    echo "postgresql://${PGUSER:-postgres}:${PGPASSWORD:-}@${PGHOST:-localhost}:${PGPORT:-5432}/$1"
  fi
}

for db in "$prod_db" "$restore_db"; do
  psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $db" -c "create database $db"
done
psql -X -q -v ON_ERROR_STOP=1 -d "$prod_db" -f supabase/tests/supabase_stub.sql
for migration in supabase/migrations/*.sql; do
  psql -X -q -v ON_ERROR_STOP=1 -d "$prod_db" -f "$migration" >/dev/null
done
psql -X -q -v ON_ERROR_STOP=1 -d "$prod_db" <<'SQL'
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'owner@backup.example');
insert into companies (id, name, slug) values ('90000000-0000-0000-0000-0000000000a1', 'B社', 'b-co');
insert into profiles (user_id, company_id, role) values ('00000000-0000-0000-0000-0000000000b1', '90000000-0000-0000-0000-0000000000a1', 'owner');
insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in)
values ('90000000-0000-0000-0000-0000000000a1', 'new_hire', 'バックアップ確認', 300000, 'single', 'p', 'a', 50000, '2026-11-01');
SQL

export SUPABASE_DB_URL; SUPABASE_DB_URL="$(db_url "$prod_db")"
export RESTORE_DB_URL; RESTORE_DB_URL="$(db_url "$restore_db")"
export BACKUP_PASSPHRASE="roundtrip-test-passphrase"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT

scripts/backup-db.sh "$out" >/dev/null
# 復元先は空のDB。復元テストの workflow と同じく、本番役のDBからロールと auth.users の定義を写して準備する
scripts/prepare-restore-target.sh >/dev/null
backup_file="$(ls "$out"/db-backup-*.tar.gz.gpg)"

# 復元先に本番を指定すると中止されること
if RESTORE_DB_URL="$SUPABASE_DB_URL" scripts/restore-db.sh "$backup_file" 2>/dev/null; then
  echo "復元先に本番DBを指定しても中止されませんでした" >&2
  exit 1
fi

scripts/restore-db.sh "$backup_file"

# 復元先の2回目の実行（前回の復元内容が残っている状態）でも成功すること
scripts/restore-db.sh "$backup_file" >/dev/null

restored="$(psql -X -qAt -d "$restore_db" -c "select name from applications")"
[ "$restored" = "バックアップ確認" ] || { echo "申請データが復元されていません: $restored" >&2; exit 1; }
echo "バックアップと復元のテストに成功しました"

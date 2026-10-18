#!/usr/bin/env bash
# Supabase のデータベースを書き出し、パスワードで暗号化したバックアップファイルを作る (#30)
#
# 必要な環境変数:
#   SUPABASE_DB_URL    … DBの接続文字列（Supabase の Connect → Session pooler の URI）
#   BACKUP_PASSPHRASE  … バックアップを暗号化するパスワード（復元時に必要。紛失すると復元できない）
# 任意の環境変数:
#   PG_BIN             … pg_dump / pg_restore のあるディレクトリ（サーバーと同じかそれ以上のバージョンを使う）
#
# 使い方: scripts/backup-db.sh [出力先ディレクトリ]
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL が設定されていません}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE が設定されていません}"

pg_dump="${PG_BIN:+$PG_BIN/}pg_dump"
pg_restore="${PG_BIN:+$PG_BIN/}pg_restore"
out_dir="${1:-backup-out}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# アプリのデータ（public スキーマのテーブル定義・データ・関数・RLSポリシー）
"$pg_dump" "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges \
  --schema=public --file="$work/public.dump"

# ログインユーザー（profiles と紐付けるため。パスワードはハッシュ化された状態で含まれる）
"$pg_dump" "$SUPABASE_DB_URL" --format=custom --data-only \
  --table=auth.users --file="$work/auth_users.dump"

# 書き出しに主要なテーブルのデータが含まれているかを確認する（空のバックアップを「成功」にしない）
for table in companies profiles applications tenancies rent_history settings audit_logs; do
  if ! "$pg_restore" --list "$work/public.dump" | grep -q "TABLE DATA public $table "; then
    echo "バックアップに public.$table のデータが含まれていません" >&2
    exit 1
  fi
done

tar -C "$work" -czf "$work/backup.tar.gz" public.dump auth_users.dump

mkdir -p "$out_dir"
out_file="$out_dir/db-backup-$stamp.tar.gz.gpg"
# パスワードはコマンドライン引数に載せず（他のプロセスから見えるため）、ファイル記述子で渡す
gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
  --symmetric --cipher-algo AES256 --output "$out_file" "$work/backup.tar.gz" \
  3<<<"$BACKUP_PASSPHRASE"

echo "バックアップを作成しました: $out_file ($(du -h "$out_file" | cut -f1))"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "file=$out_file" >> "$GITHUB_OUTPUT"
fi

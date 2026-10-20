#!/usr/bin/env bash
# E2E テスト用のダミーデータを、ローカルの Supabase（supabase start）に入れる
# 本番のデータは使わない。ログインユーザーは Supabase の管理APIで作り、会社・申請はSQLで入れる。
#
# 必要な環境変数（supabase status -o env の値）: API_URL / SERVICE_ROLE_KEY / DB_URL
set -euo pipefail
: "${API_URL:?}" "${SERVICE_ROLE_KEY:?}" "${DB_URL:?}"

create_user() {
  curl -sS -f -X POST "$API_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"e2e-Password-2026\",\"email_confirm\":true}" >/dev/null
}
create_user owner@e2e.example
create_user member@e2e.example

psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 <<'SQL'
insert into companies (id, name, slug, status) values ('e2e00000-0000-0000-0000-000000000001', 'E2Eテスト株式会社', 'e2e-co', 'active');
insert into profiles (user_id, company_id, role)
select u.id, 'e2e00000-0000-0000-0000-000000000001', case u.email when 'owner@e2e.example' then 'owner' else 'member' end
from auth.users u where u.email in ('owner@e2e.example', 'member@e2e.example');
insert into settings (company_id, key, value, description) values
  ('e2e00000-0000-0000-0000-000000000001', 'company_burden_rate', '0.7', ''),
  ('e2e00000-0000-0000-0000-000000000001', 'personal_burden_rate', '0.3', ''),
  ('e2e00000-0000-0000-0000-000000000001', 'subsidy_ratio_single', '0.2', ''),
  ('e2e00000-0000-0000-0000-000000000001', 'subsidy_ratio_family', '0.25', ''),
  ('e2e00000-0000-0000-0000-000000000001', 'rent_ceiling_multiplier', '1.5', ''),
  ('e2e00000-0000-0000-0000-000000000001', 'floor_area_limit', '99', ''),
  ('e2e00000-0000-0000-0000-000000000001', 'building_tax_rate', '0.002', ''),
  ('e2e00000-0000-0000-0000-000000000001', 'land_tax_rate', '0.0022', ''),
  ('e2e00000-0000-0000-0000-000000000001', 'floor_area_unit_price', '12', ''),
  ('e2e00000-0000-0000-0000-000000000001', 'prorate_first_month', 'false', ''),
  ('e2e00000-0000-0000-0000-000000000001', 'deemed_rent_check_enabled', 'false', '')
on conflict (company_id, key) do nothing;
-- 実賃料・限度額・負担額はトリガーがサーバー側で計算する
insert into applications (company_id, scene, name, email, basic_salary, family_type, property_name, property_address, rent, common_fee, management_fee, desired_move_in)
values ('e2e00000-0000-0000-0000-000000000001', 'new_hire', 'E2E 太郎', 'taro@e2e.example', 300000, 'single', 'E2Eマンション101', '東京都千代田区1-1', 50000, 5000, 0, current_date);
SQL
echo "E2E 用のダミーデータを投入しました"

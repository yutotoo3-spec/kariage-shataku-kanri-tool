-- セキュリティ強化（徳丸本ベースの見直し）
--   #19 未ログインで読めるデータの最小化（companies / settings）
--   #16 公開申請フォームの改ざん対策（送れる列の制限・負担額のサーバー側再計算）
--   #17 監査ログを追記専用にし、操作者をサーバー側で記録する

-- ============================================================
-- #19 未ログインで読めるデータの最小化
-- ============================================================
-- これまで companies / settings は「有効な会社なら誰でも全件SELECT可」だったため、
-- 未ログインでも利用企業の一覧や全社の設定値を取得できた。
-- テーブルへの公開SELECTはやめ、必要な情報だけを返す security definer 関数に置き換える。

create or replace function public.is_active_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from companies c where c.id = p_company_id and c.status = 'active')
$$;

-- 公開申請フォーム（/apply/:slug）用。slug から1社分の id・name・slug のみ返す
create or replace function public.get_public_company(p_slug text)
returns table (id uuid, name text, slug text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.slug from companies c
  where c.slug = p_slug and c.status = 'active'
$$;

-- サインアップ画面用。slug が使用済みかどうかだけを返す
create or replace function public.is_company_slug_taken(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from companies c where c.slug = p_slug)
$$;

-- 公開申請フォームの概算プレビュー用。指定した有効な1社分の設定値のみ返す
create or replace function public.get_public_settings(p_company_id uuid)
returns table (key text, value jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select s.key, s.value from settings s
  where s.company_id = p_company_id and public.is_active_company(p_company_id)
$$;

grant execute on function public.is_active_company(uuid) to anon, authenticated;
grant execute on function public.get_public_company(text) to anon, authenticated;
grant execute on function public.is_company_slug_taken(text) to anon, authenticated;
grant execute on function public.get_public_settings(uuid) to anon, authenticated;

drop policy if exists "anyone can look up an active company by slug" on companies;

drop policy if exists "anyone can read settings of an active company" on settings;
drop policy if exists "company members can read settings" on settings;
create policy "company members can read settings"
  on settings for select to authenticated
  using (company_id = public.current_company_id());

-- companies の公開SELECTを廃止したため、ポリシー内の companies 参照は security definer 関数経由にする
drop policy if exists "anyone can submit an application to an active company" on applications;
create policy "anyone can submit an application to an active company"
  on applications for insert to anon
  with check (public.is_active_company(company_id));

-- ============================================================
-- #16 公開申請フォームの改ざん対策
-- ============================================================
-- 未ログインユーザーが INSERT できる列を、申請者が入力する項目だけに限定する
-- （status・審査結果・限度額/負担額などはブラウザから指定させない）。
-- ※ 申請フォームに入力項目を追加したときは、ここにも列を追加すること
revoke insert on applications from anon;
grant insert (
  company_id, scene, name, email, basic_salary, family_type, join_date,
  property_name, property_address, floor_area,
  rent, common_fee, management_fee, parking_fee, bicycle_parking_fee, neighborhood_fee,
  internet_fee, water_fee_flat, support_service_fee_monthly, guarantee_fee_monthly,
  other_fixed_lease_cost, satellite_fee, other_monthly_company, other_monthly_personal,
  desired_move_in, note
) on applications to anon;

-- 登録時に、審査関連の項目を初期値に固定し、実賃料・限度額・負担額を自社の設定からサーバー側で再計算する。
-- 計算式は src/utils/calc.js（calcActualRent / calcSubsidyLimit / calcBurden）と同じ。
create or replace function public.applications_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
  v_ratio numeric;
  v_company_rate numeric;
  v_personal_rate numeric;
begin
  new.status := 'pending';
  new.reviewed_at := null;
  new.review_comment := null;
  new.created_at := now();

  new.actual_rent := coalesce(new.rent, 0) + coalesce(new.common_fee, 0) + coalesce(new.management_fee, 0);

  select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb) into v_settings
  from settings s where s.company_id = new.company_id;

  -- 設定が未登録のときは calc.js の DEFAULT_SETTINGS と同じ値を使う
  v_ratio := case when new.family_type = 'single'
    then coalesce((v_settings ->> 'subsidy_ratio_single')::numeric, 0.2)
    else coalesce((v_settings ->> 'subsidy_ratio_family')::numeric, 0.25)
  end;
  v_company_rate := coalesce((v_settings ->> 'company_burden_rate')::numeric, 0.7);
  v_personal_rate := coalesce((v_settings ->> 'personal_burden_rate')::numeric, 0.3);

  new.subsidy_limit := floor(new.basic_salary * v_ratio);

  if new.actual_rent <= new.subsidy_limit then
    new.company_burden := floor(new.actual_rent * v_company_rate);
    new.personal_burden := ceil(new.actual_rent * v_personal_rate);
  else
    new.company_burden := floor(new.subsidy_limit * v_company_rate);
    new.personal_burden := ceil(new.subsidy_limit * v_personal_rate) + (new.actual_rent - new.subsidy_limit);
  end if;

  return new;
end;
$$;

drop trigger if exists applications_before_insert on applications;
create trigger applications_before_insert
  before insert on applications
  for each row execute function public.applications_before_insert();

-- 入力値の範囲チェック（巨大な文字列・負の金額などの登録を防ぐ）。
-- not valid により既存データは検証せず、今後の INSERT / UPDATE にのみ適用する。
alter table applications drop constraint if exists applications_text_length_check;
alter table applications add constraint applications_text_length_check check (
  char_length(name) <= 100
  and char_length(coalesce(email, '')) <= 254
  and char_length(property_name) <= 200
  and char_length(property_address) <= 300
  and char_length(coalesce(note, '')) <= 2000
) not valid;

alter table applications drop constraint if exists applications_amount_range_check;
alter table applications add constraint applications_amount_range_check check (
  basic_salary between 1 and 99999999
  and rent between 0 and 9999999
  and (floor_area is null or (floor_area > 0 and floor_area <= 10000))
  and least(
    common_fee, management_fee, parking_fee, bicycle_parking_fee, neighborhood_fee,
    internet_fee, water_fee_flat, support_service_fee_monthly, guarantee_fee_monthly,
    other_fixed_lease_cost, satellite_fee, other_monthly_company, other_monthly_personal
  ) >= 0
  and greatest(
    common_fee, management_fee, parking_fee, bicycle_parking_fee, neighborhood_fee,
    internet_fee, water_fee_flat, support_service_fee_monthly, guarantee_fee_monthly,
    other_fixed_lease_cost, satellite_fee, other_monthly_company, other_monthly_personal
  ) <= 9999999
) not valid;

-- ============================================================
-- #17 監査ログを追記専用にする
-- ============================================================
-- 監査ログは削除されたユーザーの分も残す必要があるため、auth.users への外部キーは張らない
alter table audit_logs add column if not exists user_id uuid;

drop policy if exists "company members can read/write audit_logs" on audit_logs;
drop policy if exists "company members can read audit_logs" on audit_logs;
drop policy if exists "company members can append audit_logs" on audit_logs;
create policy "company members can read audit_logs"
  on audit_logs for select to authenticated
  using (company_id = public.current_company_id());
create policy "company members can append audit_logs"
  on audit_logs for insert to authenticated
  with check (company_id = public.current_company_id());

-- RLSに加えて権限レベルでも更新・削除を禁止する（多層防御）
revoke update, delete, truncate on audit_logs from anon, authenticated;

-- 操作者・日時はブラウザから送られた値を信用せず、ログイン情報からサーバー側で設定する
create or replace function public.audit_logs_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  new.user_email := (select u.email from auth.users u where u.id = auth.uid());
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists audit_logs_before_insert on audit_logs;
create trigger audit_logs_before_insert
  before insert on audit_logs
  for each row execute function public.audit_logs_before_insert();

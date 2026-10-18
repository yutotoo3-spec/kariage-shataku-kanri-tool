-- 入居者台帳への登録をトランザクション化する (#31)
-- これまでは画面から「入居者登録 → 家賃履歴登録 → 申請を承認済に更新 → 監査ログ」を順に実行していたため、
-- 途中で失敗すると家賃履歴のない入居者などの中途半端なデータが残っていた。
-- 1つのRPCにまとめ、関数全体を1トランザクションとして「全部成功するか、全部取り消すか」にする。

-- 1. 限度額・負担額の計算を共通関数にする（013 の申請登録トリガーと台帳登録RPCで同じ計算を使う）
-- 計算式は src/utils/calc.js（calcSubsidyLimit / calcBurden）と同じ。設定が未登録のときは DEFAULT_SETTINGS と同じ値を使う
create or replace function public.calc_rent_burden(
  p_company_id uuid, p_basic_salary integer, p_family_type text, p_actual_rent integer
)
returns table (subsidy_limit integer, company_burden integer, personal_burden integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
  v_ratio numeric;
  v_company_rate numeric;
  v_personal_rate numeric;
  v_limit integer;
begin
  select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb) into v_settings
  from settings s where s.company_id = p_company_id;

  v_ratio := case when p_family_type = 'single'
    then coalesce((v_settings ->> 'subsidy_ratio_single')::numeric, 0.2)
    else coalesce((v_settings ->> 'subsidy_ratio_family')::numeric, 0.25)
  end;
  v_company_rate := coalesce((v_settings ->> 'company_burden_rate')::numeric, 0.7);
  v_personal_rate := coalesce((v_settings ->> 'personal_burden_rate')::numeric, 0.3);

  v_limit := floor(p_basic_salary * v_ratio);

  if p_actual_rent <= v_limit then
    return query select v_limit, floor(p_actual_rent * v_company_rate)::integer, ceil(p_actual_rent * v_personal_rate)::integer;
  else
    return query select v_limit, floor(v_limit * v_company_rate)::integer,
      (ceil(v_limit * v_personal_rate) + (p_actual_rent - v_limit))::integer;
  end if;
end;
$$;

-- 他社の設定値を推測されないよう、直接の呼び出しは許可しない（トリガー・RPCの中からのみ使う）
revoke execute on function public.calc_rent_burden(uuid, integer, text, integer) from public, anon, authenticated;

-- 013 の申請登録トリガーを共通関数を使う形に置き換える（計算結果は変わらない）
create or replace function public.applications_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_calc record;
begin
  new.status := 'pending';
  new.reviewed_at := null;
  new.review_comment := null;
  new.created_at := now();

  new.actual_rent := coalesce(new.rent, 0) + coalesce(new.common_fee, 0) + coalesce(new.management_fee, 0);

  select * into v_calc from public.calc_rent_burden(new.company_id, new.basic_salary, new.family_type, new.actual_rent);
  new.subsidy_limit := v_calc.subsidy_limit;
  new.company_burden := v_calc.company_burden;
  new.personal_burden := v_calc.personal_burden;

  return new;
end;
$$;

-- 2. 申請から入居者台帳への登録RPC
create or replace function public.convert_application_to_tenancy(
  p_application_id uuid, p_contract_start date, p_contract_end date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_company_id();
  v_app applications%rowtype;
  v_actual_rent integer;
  v_calc record;
  v_tenancy_id uuid;
begin
  if auth.uid() is null or v_company_id is null then
    raise exception 'authentication required';
  end if;
  if p_contract_start is null then
    raise exception 'contract start date required';
  end if;
  if p_contract_end is not null and p_contract_end < p_contract_start then
    raise exception 'contract end date must be on or after start date';
  end if;

  -- 申請の行をロックし、同じ申請の同時登録（二重登録）を防ぐ
  select * into v_app from applications a
  where a.id = p_application_id and a.company_id = v_company_id
  for update;

  if v_app.id is null then
    raise exception 'application not found';
  end if;
  if v_app.status not in ('contract_pending', 'approved') then
    raise exception 'application is not ready for tenancy registration';
  end if;
  if exists (select 1 from tenancies t where t.application_id = v_app.id) then
    raise exception 'tenancy already registered for this application';
  end if;

  -- 実賃料・限度額・負担額は申請に保存された値ではなく、現在の設定でサーバー側で計算し直す
  v_actual_rent := coalesce(v_app.rent, 0) + coalesce(v_app.common_fee, 0) + coalesce(v_app.management_fee, 0);
  select * into v_calc from public.calc_rent_burden(v_company_id, v_app.basic_salary, v_app.family_type, v_actual_rent);

  insert into tenancies (
    company_id, application_id, name, email, basic_salary, family_type,
    property_name, property_address, floor_area, contract_start, contract_end, status,
    rent, common_fee, management_fee, parking_fee, bicycle_parking_fee, neighborhood_fee,
    internet_fee, water_fee_flat, support_service_fee_monthly, guarantee_fee_monthly,
    other_fixed_lease_cost, satellite_fee, other_monthly_company, other_monthly_personal
  ) values (
    v_company_id, v_app.id, v_app.name, v_app.email, v_app.basic_salary, v_app.family_type,
    v_app.property_name, v_app.property_address, v_app.floor_area, p_contract_start, p_contract_end, 'active',
    v_app.rent, v_app.common_fee, v_app.management_fee, v_app.parking_fee, v_app.bicycle_parking_fee, v_app.neighborhood_fee,
    v_app.internet_fee, v_app.water_fee_flat, v_app.support_service_fee_monthly, v_app.guarantee_fee_monthly,
    v_app.other_fixed_lease_cost, v_app.satellite_fee, v_app.other_monthly_company, v_app.other_monthly_personal
  )
  returning id into v_tenancy_id;

  insert into rent_history (
    company_id, tenancy_id, effective_date, actual_rent, subsidy_limit, company_burden, personal_burden, changed_by
  ) values (
    v_company_id, v_tenancy_id, p_contract_start, v_actual_rent,
    v_calc.subsidy_limit, v_calc.company_burden, v_calc.personal_burden,
    (select u.email from auth.users u where u.id = auth.uid())
  );

  update applications
  set status = 'approved', reviewed_at = coalesce(reviewed_at, now())
  where id = v_app.id;

  -- 操作者・日時は 013 の audit_logs トリガーが設定する
  insert into audit_logs (company_id, action, target_type, target_id, details)
  values (v_company_id, 'convert_to_tenancy', 'application', v_app.id,
    jsonb_build_object('name', v_app.name, 'contract_start', p_contract_start, 'tenancy_id', v_tenancy_id));

  return v_tenancy_id;
end;
$$;

revoke execute on function public.convert_application_to_tenancy(uuid, date, date) from public, anon;
grant execute on function public.convert_application_to_tenancy(uuid, date, date) to authenticated;

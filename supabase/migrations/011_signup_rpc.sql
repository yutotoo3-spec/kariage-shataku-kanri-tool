-- マルチテナント化 フェーズ3（企業登録・管理者登録のサインアップ）
--
-- サインアップ時は supabase.auth.signUp() の options.data に company_name / company_slug を
-- 乗せておき、ログイン後（確認メール不要な設定なら即時、必要な設定ならメール確認後の初回ログイン時）に
-- このRPCを呼び出して companies / profiles / settings(初期値) をまとめて作成する。
-- security definer のため、companies/profiles/settings への直接のINSERT用RLSポリシーは不要。

create or replace function public.create_company_and_owner()
returns table (company_id uuid, slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_name text;
  v_slug text;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  -- 既に自社を持っている場合（2回目以降のログイン等）はそれを返すだけ（冪等）
  if exists (select 1 from profiles p where p.user_id = v_user_id) then
    select p.company_id into v_company_id from profiles p where p.user_id = v_user_id;
    return query select v_company_id, c.slug from companies c where c.id = v_company_id;
    return;
  end if;

  select u.raw_user_meta_data ->> 'company_name', u.raw_user_meta_data ->> 'company_slug'
    into v_name, v_slug
  from auth.users u
  where u.id = v_user_id;

  if v_name is null or v_slug is null then
    raise exception 'signup metadata missing';
  end if;

  insert into companies (name, slug, status)
  values (v_name, v_slug, 'active')
  returning id into v_company_id;

  insert into profiles (user_id, company_id, role)
  values (v_user_id, v_company_id, 'owner');

  insert into settings (company_id, key, value, description) values
    (v_company_id, 'company_burden_rate', '0.7', '第11条2項(1) 実賃料が限度額以内のときの会社負担割合'),
    (v_company_id, 'personal_burden_rate', '0.3', '第11条2項(1) 同・本人負担割合'),
    (v_company_id, 'subsidy_ratio_single', '0.2', '第9条1項(1) 単身者＝基本報酬月額の1/5（=20%）'),
    (v_company_id, 'subsidy_ratio_family', '0.25', '第9条1項(2) 家族帯同者＝基本報酬月額の1/4（=25%）'),
    (v_company_id, 'rent_ceiling_multiplier', '1.5', '第11条2項※ 実賃料は補助対象限度額の1.5倍以内が原則。超過は会社が借上げを拒否できる'),
    (v_company_id, 'floor_area_limit', '99', '第8条1項 99㎡以下'),
    (v_company_id, 'building_tax_rate', '0.002', '第4条3項(1) 賃貸料相当額の計算に使う建物課税標準額の率（0.2%）'),
    (v_company_id, 'land_tax_rate', '0.0022', '第4条3項(3) 賃貸料相当額の計算に使う土地課税標準額の率（0.22%）'),
    (v_company_id, 'floor_area_unit_price', '12', '第4条3項(2) 12円 ×（総床面積㎡ ÷ 3.3）'),
    (v_company_id, 'prorate_first_month', 'false', '規程に定めのない運用ルール。初月の入居日から月末までの日数で本人負担額を日割りするか'),
    (v_company_id, 'deemed_rent_check_enabled', 'false', '第11条1項ただし書き（本人負担額の下限＝賃貸料相当額）のチェックを使うか。有効にすると物件ごとに建物・敷地の固定資産税課税標準額の入力が必要');

  return query select v_company_id, v_slug;
end;
$$;

grant execute on function public.create_company_and_owner() to authenticated;

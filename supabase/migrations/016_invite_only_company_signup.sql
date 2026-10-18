-- 企業登録の招待制化
-- これまでは /signup から誰でも企業を登録できたが、運営者（platform_admins）が発行した
-- 企業登録招待のリンク経由でのみ企業を作成できるようにする。
-- 招待は宛先メールアドレスに紐付き、1回のみ・期限付きで使用できる。

-- 1. 運営者
-- 運営者の追加・削除はSQL Editorで行う（アプリからは変更できない）。例：
--   insert into platform_admins (user_id) select id from auth.users where email = '運営者のメールアドレス';
create table if not exists platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- RLSを有効にしてポリシーは作らない（直接の読み書きは不可。判定は下の関数経由のみ）
alter table platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from platform_admins where user_id = auth.uid())
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- 2. 企業登録招待
create table if not exists company_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'used', 'revoked')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz default now(),
  created_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  company_id uuid references companies(id) on delete set null
);

create unique index if not exists company_invites_token_idx on company_invites(token);

-- 発行・取り消し・使用はすべて security definer RPC 経由。一覧表示用のSELECTのみ運営者に許可する
alter table company_invites enable row level security;

drop policy if exists "platform admins can read company invites" on company_invites;
create policy "platform admins can read company invites"
  on company_invites for select to authenticated
  using (public.is_platform_admin());

-- 招待の発行（運営者のみ）
create or replace function public.create_company_invite(p_email text)
returns table (id uuid, token uuid, email text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if not public.is_platform_admin() then
    raise exception 'only platform admins can invite companies';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email';
  end if;

  return query
  insert into company_invites (email, created_by)
  values (v_email, auth.uid())
  returning company_invites.id, company_invites.token, company_invites.email, company_invites.expires_at;
end;
$$;

grant execute on function public.create_company_invite(text) to authenticated;

-- 招待の取り消し（運営者のみ）
create or replace function public.revoke_company_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'only platform admins can revoke company invites';
  end if;

  update company_invites set status = 'revoked'
  where id = p_invite_id and status = 'pending';
end;
$$;

grant execute on function public.revoke_company_invite(uuid) to authenticated;

-- 未ログインの企業登録画面用（宛先メールアドレスと有効性のみ返す）
create or replace function public.get_company_invite_by_token(p_token uuid)
returns table (email text, valid boolean)
language sql
stable
security definer
set search_path = public
as $$
  select ci.email, (ci.status = 'pending' and ci.expires_at > now())
  from company_invites ci
  where ci.token = p_token
$$;

grant execute on function public.get_company_invite_by_token(uuid) to anon, authenticated;

-- 3. 企業作成RPCに招待チェックを追加
-- signUp 時の user_metadata に company_invite_token を乗せておき、有効な招待（未使用・期限内・宛先メール一致）
-- がある場合のみ企業を作成する。作成と同時に招待を使用済みにする。
create or replace function public.create_company_and_owner()
returns table (company_id uuid, slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_company_id uuid;
  v_name text;
  v_slug text;
  v_token uuid;
  v_invite company_invites%rowtype;
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

  select u.email,
         u.raw_user_meta_data ->> 'company_name',
         u.raw_user_meta_data ->> 'company_slug',
         nullif(u.raw_user_meta_data ->> 'company_invite_token', '')::uuid
    into v_user_email, v_name, v_slug, v_token
  from auth.users u
  where u.id = v_user_id;

  if v_name is null or v_slug is null then
    raise exception 'signup metadata missing';
  end if;
  if v_token is null then
    raise exception 'company invite required';
  end if;

  -- 同じ招待で同時に2社作られないよう行ロックを取る
  select * into v_invite from company_invites ci where ci.token = v_token for update;

  if v_invite.id is null then
    raise exception 'company invite not found';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'company invite already used or revoked';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'company invite expired';
  end if;
  if lower(v_invite.email) <> lower(v_user_email) then
    raise exception 'company invite email mismatch';
  end if;

  v_name := trim(v_name);
  if char_length(v_name) not between 1 and 100 then
    raise exception 'invalid company name';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_slug) > 50 then
    raise exception 'invalid company slug';
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

  update company_invites
  set status = 'used', used_at = now(), company_id = v_company_id
  where id = v_invite.id;

  return query select v_company_id, v_slug;
end;
$$;

-- 二要素認証（MFA）の導入 (#49)
-- 認証アプリ（TOTP）を登録したユーザーは、ログイン時にワンタイムコードを入力するまで（aal2 になるまで）
-- 自社のデータを読み書きできないようにする。画面でコード入力を求めるだけだと、パスワードだけで取得した
-- トークンで API を直接呼ばれると素通りになるため、DB 側でも判定する。
-- 認証アプリを登録していないユーザーは従来どおりパスワードだけで使える。

-- MFA の条件を満たしているか：認証アプリを登録していない、または今回のログインでコードを入力済み（aal2）
create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$$;

grant execute on function public.mfa_satisfied() to authenticated;

-- 各テーブルのRLSが使う「自社」「役割」「運営者か」の判定に MFA の条件を加える。
-- 条件を満たさないと自社なし（null）・運営者でない扱いになり、データは1件も見えない。
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.company_id from profiles p
  join companies c on c.id = p.company_id
  where p.user_id = auth.uid() and c.status = 'active' and public.mfa_satisfied()
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where user_id = auth.uid() and public.mfa_satisfied()
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from platform_admins where user_id = auth.uid()) and public.mfa_satisfied()
$$;

-- 担当者の招待の発行・取り消しは profiles を直接読んでいたため、上の判定関数を使う形に置き換える
-- （あわせて、利用停止中の会社からは招待できなくなる）
create or replace function public.create_invite(p_email text, p_role text default 'member')
returns table (id uuid, token uuid, email text, role text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_company_id();
  v_caller_role text := public.current_user_role();
  v_invite_id uuid;
  v_token uuid;
  v_expires timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;
  if v_company_id is null then
    raise exception 'no company';
  end if;
  if v_caller_role is distinct from 'owner' then
    raise exception 'only owners can invite members';
  end if;
  if p_role not in ('owner', 'member') then
    raise exception 'invalid role';
  end if;

  insert into invites (company_id, email, role, created_by)
  values (v_company_id, lower(p_email), p_role, v_user_id)
  returning invites.id, invites.token, invites.expires_at into v_invite_id, v_token, v_expires;

  return query select v_invite_id, v_token, lower(p_email), p_role, v_expires;
end;
$$;

create or replace function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_company_id();
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if v_company_id is null or public.current_user_role() is distinct from 'owner' then
    raise exception 'only owners can revoke invites';
  end if;

  update invites set status = 'revoked'
  where id = p_invite_id and company_id = v_company_id and status = 'pending';
end;
$$;

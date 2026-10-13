-- マルチテナント化 フェーズ5（チームメンバー招待機能）
-- 1企業に複数のHR担当者（owner/member）を招待できるようにする。
-- 招待の発行・承認はすべてsecurity definer RPC経由で行うため、invitesテーブル自体への
-- INSERT/UPDATE用RLSポリシーは不要（SELECTのみ、自社分の一覧表示用に許可する）。

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  email text not null,
  token uuid not null default gen_random_uuid(),
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create unique index if not exists invites_token_idx on invites(token);
create index if not exists invites_company_id_idx on invites(company_id);

alter table invites enable row level security;

create policy "company members can read their invites"
  on invites for select to authenticated
  using (company_id = public.current_company_id());

-- 招待の発行（owner権限のみ）
create or replace function public.create_invite(p_email text, p_role text default 'member')
returns table (id uuid, token uuid, email text, role text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_caller_role text;
  v_invite_id uuid;
  v_token uuid;
  v_expires timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  select p.company_id, p.role into v_company_id, v_caller_role
  from profiles p where p.user_id = v_user_id;

  if v_company_id is null then
    raise exception 'no company';
  end if;
  if v_caller_role <> 'owner' then
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

grant execute on function public.create_invite(text, text) to authenticated;

-- 招待の取り消し
create or replace function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
begin
  select p.company_id into v_company_id from profiles p where p.user_id = v_user_id;
  update invites set status = 'revoked'
  where id = p_invite_id and company_id = v_company_id and status = 'pending';
end;
$$;

grant execute on function public.revoke_invite(uuid) to authenticated;

-- 未ログインの招待リンク閲覧用（会社名・メール・役割・有効性のプレビューのみ返す）
create or replace function public.get_invite_by_token(p_token uuid)
returns table (company_name text, company_slug text, email text, role text, valid boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.name, c.slug, i.email, i.role,
    (i.status = 'pending' and i.expires_at > now())
  from invites i
  join companies c on c.id = i.company_id
  where i.token = p_token
$$;

grant execute on function public.get_invite_by_token(uuid) to anon, authenticated;

-- 招待の承認（signUp時にuser_metadataへinvite_tokenを乗せておき、ログイン後に呼び出す）
create or replace function public.accept_invite()
returns table (company_id uuid, slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_token uuid;
  v_invite invites%rowtype;
  v_company_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if exists (select 1 from profiles p where p.user_id = v_user_id) then
    select p.company_id into v_company_id from profiles p where p.user_id = v_user_id;
    return query select v_company_id, c.slug from companies c where c.id = v_company_id;
    return;
  end if;

  select u.email, (u.raw_user_meta_data ->> 'invite_token')::uuid
    into v_user_email, v_token
  from auth.users u
  where u.id = v_user_id;

  if v_token is null then
    raise exception 'invite metadata missing';
  end if;

  select * into v_invite from invites i where i.token = v_token;

  if v_invite.id is null then
    raise exception 'invite not found';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'invite already used or revoked';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'invite expired';
  end if;
  if lower(v_invite.email) <> lower(v_user_email) then
    raise exception 'invite email mismatch';
  end if;

  insert into profiles (user_id, company_id, role)
  values (v_user_id, v_invite.company_id, v_invite.role);

  update invites set status = 'accepted' where id = v_invite.id;

  return query select v_invite.company_id, c.slug from companies c where c.id = v_invite.company_id;
end;
$$;

grant execute on function public.accept_invite() to authenticated;

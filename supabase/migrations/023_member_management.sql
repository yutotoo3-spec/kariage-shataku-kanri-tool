-- メンバーの一覧・削除・権限変更 (#53)
-- これまでは担当者の招待しかできず、退職・異動した担当者のアクセスを止める手段がなかった。
-- owner が自社のメンバーを一覧し、会社から外す・権限を変更できるようにする。
-- 会社から外すと profiles の行が消え、current_company_id() が null になるため、次の操作から自社データに一切アクセスできなくなる。
-- （使用済みの招待は再利用できないため、外されたユーザーが自分で戻ることはできない）

-- 自社のメンバー一覧（owner のみ）。profiles は本人の行しか読めないため security definer で返す
create or replace function public.list_company_members()
returns table (user_id uuid, email text, role text, joined_at timestamptz, is_me boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_company_id();
begin
  if v_company_id is null or public.current_user_role() is distinct from 'owner' then
    raise exception 'only owners can list members';
  end if;

  return query
  select p.user_id, u.email::text, p.role, p.created_at, p.user_id = auth.uid()
  from profiles p
  left join auth.users u on u.id = p.user_id
  where p.company_id = v_company_id
  order by p.created_at;
end;
$$;

-- メンバーを会社から外す（owner のみ・自分自身は不可）
create or replace function public.remove_company_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_company_id();
  v_target profiles%rowtype;
begin
  if v_company_id is null or public.current_user_role() is distinct from 'owner' then
    raise exception 'only owners can remove members';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot remove yourself';
  end if;

  select * into v_target from profiles p
  where p.user_id = p_user_id and p.company_id = v_company_id
  for update;
  if v_target.user_id is null then
    raise exception 'member not found';
  end if;

  delete from profiles where user_id = p_user_id and company_id = v_company_id;

  insert into audit_logs (company_id, action, target_type, target_id, details)
  values (v_company_id, 'remove_member', 'user', p_user_id,
    jsonb_build_object('email', (select u.email from auth.users u where u.id = p_user_id), 'role', v_target.role));
end;
$$;

-- メンバーの権限を変更する（owner のみ・自分自身は不可）
-- 自分の権限を変えられないようにすることで、owner が1人もいなくなる状態を防ぐ
create or replace function public.set_member_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_company_id();
  v_target profiles%rowtype;
begin
  if v_company_id is null or public.current_user_role() is distinct from 'owner' then
    raise exception 'only owners can change roles';
  end if;
  if p_role not in ('owner', 'member') then
    raise exception 'invalid role';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot change your own role';
  end if;

  select * into v_target from profiles p
  where p.user_id = p_user_id and p.company_id = v_company_id
  for update;
  if v_target.user_id is null then
    raise exception 'member not found';
  end if;
  if v_target.role = p_role then
    return;
  end if;

  update profiles set role = p_role where user_id = p_user_id and company_id = v_company_id;

  insert into audit_logs (company_id, action, target_type, target_id, details)
  values (v_company_id, 'change_member_role', 'user', p_user_id,
    jsonb_build_object('email', (select u.email from auth.users u where u.id = p_user_id), 'old', v_target.role, 'new', p_role));
end;
$$;

revoke execute on function public.list_company_members() from public, anon;
revoke execute on function public.remove_company_member(uuid) from public, anon;
revoke execute on function public.set_member_role(uuid, text) from public, anon;
grant execute on function public.list_company_members() to authenticated;
grant execute on function public.remove_company_member(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;

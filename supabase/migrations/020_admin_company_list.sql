-- 運営者メニューに利用企業の一覧と利用停止の切り替えを追加する (#33)

-- 1. 利用企業の一覧（運営者のみ）
-- 他社のデータをまとめて集計するため、security definer の関数で運営者だけに返す
create or replace function public.admin_list_companies()
returns table (
  id uuid, name text, slug text, status text, created_at timestamptz,
  owner_emails text, member_count bigint, application_count bigint, tenancy_count bigint,
  last_application_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'only platform admins can list companies';
  end if;

  return query
  select c.id, c.name, c.slug, c.status, c.created_at,
    (select string_agg(u.email, ', ' order by u.email)
       from profiles p join auth.users u on u.id = p.user_id
       where p.company_id = c.id and p.role = 'owner'),
    (select count(*) from profiles p where p.company_id = c.id),
    (select count(*) from applications a where a.company_id = c.id),
    (select count(*) from tenancies t where t.company_id = c.id and t.status <> 'moved_out'),
    (select max(a.created_at) from applications a where a.company_id = c.id)
  from companies c
  order by c.created_at;
end;
$$;

revoke execute on function public.admin_list_companies() from public, anon;
grant execute on function public.admin_list_companies() to authenticated;

-- 2. 利用停止・再開（運営者のみ）
create or replace function public.admin_set_company_status(p_company_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'only platform admins can change company status';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid status';
  end if;
  -- 運営者が自分の所属する会社を停止すると、自分も使えなくなるため禁止する
  if p_status = 'suspended' and exists (
    select 1 from profiles p where p.user_id = auth.uid() and p.company_id = p_company_id
  ) then
    raise exception 'cannot suspend your own company';
  end if;

  update companies set status = p_status where id = p_company_id;
  if not found then
    raise exception 'company not found';
  end if;

  -- 操作者・日時は 013 の audit_logs トリガーが設定する
  insert into audit_logs (company_id, action, target_type, target_id, details)
  values (p_company_id, 'admin_set_company_status', 'company', p_company_id, jsonb_build_object('status', p_status));
end;
$$;

revoke execute on function public.admin_set_company_status(uuid, text) from public, anon;
grant execute on function public.admin_set_company_status(uuid, text) to authenticated;

-- 3. 利用停止中の会社の社員はデータにアクセスできないようにする
-- 各テーブルのRLSは current_company_id() で自社を判定しているため、停止中の会社なら null を返すようにする。
-- （申請フォーム・企業情報の公開取得は 013/019 で既に active の会社に限定している）
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.company_id from profiles p
  join companies c on c.id = p.company_id
  where p.user_id = auth.uid() and c.status = 'active'
$$;

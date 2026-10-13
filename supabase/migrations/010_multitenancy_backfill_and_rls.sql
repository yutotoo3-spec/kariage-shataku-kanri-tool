-- マルチテナント化 フェーズ1（既存データ移行 + RLS全面書き換え）
-- 009 のスキーマ追加が適用済みであることが前提。
-- このマイグレーション適用後は、ログイン中のユーザーは自社（company_id が一致する行）のデータしか
-- 読み書きできなくなる。適用前に 009 が完了していることを必ず確認すること。

-- 1. 既存データを単一企業（Athena Technologies）に紐付ける
do $$
declare
  v_company_id uuid;
begin
  select id into v_company_id from companies where slug = 'athena-tech';

  if v_company_id is null then
    insert into companies (name, slug, status)
    values ('Athena Technologies', 'athena-tech', 'active')
    returning id into v_company_id;
  end if;

  update applications set company_id = v_company_id where company_id is null;
  update application_drafts set company_id = v_company_id where company_id is null;
  update tenancies set company_id = v_company_id where company_id is null;
  update rent_history set company_id = v_company_id where company_id is null;
  update audit_logs set company_id = v_company_id where company_id is null;
  update settings set company_id = v_company_id where company_id is null;

  -- 既存のSupabase Authユーザー全員を、このテナントの owner として紐付ける
  insert into profiles (user_id, company_id, role)
  select u.id, v_company_id, 'owner'
  from auth.users u
  where not exists (select 1 from profiles p where p.user_id = u.id);
end $$;

-- 2. company_id を必須化
alter table applications alter column company_id set not null;
alter table application_drafts alter column company_id set not null;
alter table tenancies alter column company_id set not null;
alter table rent_history alter column company_id set not null;
alter table audit_logs alter column company_id set not null;
alter table settings alter column company_id set not null;

-- settings は (company_id, key) の複合キーに変更（企業ごとに同じ key を持てるようにする）
alter table settings drop constraint if exists settings_pkey;
alter table settings add primary key (company_id, key);

-- 3. ログイン中ユーザーの所属企業IDを返すヘルパー関数
-- security definer により、RLSを経由せず profiles を直接参照する（profiles 自体のRLSとの無限再帰を避けるため）
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from profiles where user_id = auth.uid()
$$;

-- 4. RLSポリシーの全面書き換え（company_id によるテナント分離）

-- companies
drop policy if exists "anyone can look up an active company by slug" on companies;
drop policy if exists "members can read their own company" on companies;
create policy "anyone can look up an active company by slug"
  on companies for select to public using (status = 'active');
create policy "members can read their own company"
  on companies for select to authenticated using (id = public.current_company_id());

-- profiles
drop policy if exists "users can read their own profile" on profiles;
create policy "users can read their own profile"
  on profiles for select to authenticated using (user_id = auth.uid());

-- applications
drop policy if exists "authenticated users can read/write applications" on applications;
drop policy if exists "anyone can submit an application" on applications;
create policy "company members can read/write applications"
  on applications for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy "anyone can submit an application to an active company"
  on applications for insert to anon
  with check (exists (select 1 from companies c where c.id = applications.company_id and c.status = 'active'));

-- application_drafts（現在アプリからは使用していないが、スキーマ整合のため同様に分離）
drop policy if exists "anyone can submit an application draft" on application_drafts;
drop policy if exists "authenticated users can read application drafts" on application_drafts;
drop policy if exists "authenticated users can update application drafts" on application_drafts;
drop policy if exists "authenticated users can delete application drafts" on application_drafts;
create policy "company members can read/write application drafts"
  on application_drafts for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- tenancies
drop policy if exists "authenticated users can read/write tenancies" on tenancies;
create policy "company members can read/write tenancies"
  on tenancies for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- rent_history
drop policy if exists "authenticated users can read/write rent_history" on rent_history;
create policy "company members can read/write rent_history"
  on rent_history for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- audit_logs
drop policy if exists "authenticated users can read/write audit_logs" on audit_logs;
create policy "company members can read/write audit_logs"
  on audit_logs for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- settings
drop policy if exists "anyone can read settings" on settings;
drop policy if exists "authenticated users can update settings" on settings;
create policy "anyone can read settings of an active company"
  on settings for select to public
  using (exists (select 1 from companies c where c.id = settings.company_id and c.status = 'active'));
create policy "company members can update settings"
  on settings for update to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- owner / member の権限分離 (#21)
-- 規程の料率などの設定変更と、招待の取り消しを owner のみに限定する。
-- 申請審査・入居者登録・家賃変更・月次処理などの日常業務は member も引き続き可能。
-- （招待の発行は 012 の create_invite で既に owner のみ）

-- ログイン中ユーザーの役割を返すヘルパー関数（current_company_id と同じく profiles のRLS再帰を避けるため security definer）
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where user_id = auth.uid()
$$;

-- 設定の変更は owner のみ
drop policy if exists "company members can update settings" on settings;
drop policy if exists "company owners can update settings" on settings;
create policy "company owners can update settings"
  on settings for update to authenticated
  using (company_id = public.current_company_id() and public.current_user_role() = 'owner')
  with check (company_id = public.current_company_id() and public.current_user_role() = 'owner');

-- 招待の取り消しは owner のみ
create or replace function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_caller_role text;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  select p.company_id, p.role into v_company_id, v_caller_role
  from profiles p where p.user_id = v_user_id;

  if v_caller_role is distinct from 'owner' then
    raise exception 'only owners can revoke invites';
  end if;

  update invites set status = 'revoked'
  where id = p_invite_id and company_id = v_company_id and status = 'pending';
end;
$$;

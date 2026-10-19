-- 保存期間を過ぎた個人情報の削除 (#55)
-- 個人情報は利用目的を達成したら遅滞なく消去するよう努める必要がある（個人情報保護法第22条）。
-- 保存期間：
--   ・却下した申請 … 審査日（なければ申請日）から1年
--   ・退去済みの入居者 … 退去日から5年（賃金台帳等の保存期間（労基法第109条）を目安）。家賃履歴と元の申請も一緒に削除する
--   ・旧方式の仮申請（application_drafts。008 以降は使っていない）… 申請に変換されていないものは送信から1年
-- 自動では削除せず、owner が設定画面で対象を確認してから削除する。
-- 削除対象はサーバー側で判定し直すため、画面から任意のデータを消させることはできない。

-- 削除対象の一覧（owner のみ）
create or replace function public.list_retention_candidates()
returns table (kind text, id uuid, name text, base_date date)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_company_id();
begin
  if v_company_id is null or public.current_user_role() is distinct from 'owner' then
    raise exception 'only owners can manage data retention';
  end if;

  return query
  select 'application'::text, a.id, a.name, coalesce(a.reviewed_at, a.created_at)::date
  from applications a
  where a.company_id = v_company_id and a.status = 'rejected'
    and coalesce(a.reviewed_at, a.created_at) < now() - interval '1 year'
    and not exists (select 1 from tenancies t where t.application_id = a.id)
  union all
  select 'tenancy'::text, t.id, t.name, t.move_out_date
  from tenancies t
  where t.company_id = v_company_id and t.status = 'moved_out'
    and t.move_out_date is not null and t.move_out_date < current_date - interval '5 years'
  union all
  select 'draft'::text, d.id, d.name, d.created_at::date
  from application_drafts d
  where d.company_id = v_company_id and d.converted_application_id is null
    and d.created_at < now() - interval '1 year'
  order by 4;
end;
$$;

-- 削除対象をまとめて削除する（owner のみ）。削除した件数を返す
create or replace function public.purge_expired_personal_data()
returns table (applications integer, tenancies integer, drafts integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_company_id();
  v_tenancy_ids uuid[];
  v_application_ids uuid[];
  v_draft_ids uuid[];
  v_linked_application_ids uuid[];
begin
  if v_company_id is null or public.current_user_role() is distinct from 'owner' then
    raise exception 'only owners can manage data retention';
  end if;

  select coalesce(array_agg(c.id) filter (where c.kind = 'tenancy'), '{}'),
         coalesce(array_agg(c.id) filter (where c.kind = 'application'), '{}'),
         coalesce(array_agg(c.id) filter (where c.kind = 'draft'), '{}')
    into v_tenancy_ids, v_application_ids, v_draft_ids
  from public.list_retention_candidates() c;

  -- 退去者の元の申請（承認済み）も一緒に消す
  select coalesce(array_agg(t.application_id), '{}') into v_linked_application_ids
  from tenancies t where t.id = any(v_tenancy_ids) and t.application_id is not null;

  delete from tenancies where id = any(v_tenancy_ids) and company_id = v_company_id;  -- rent_history は cascade で削除
  delete from application_drafts
  where company_id = v_company_id
    and (id = any(v_draft_ids) or converted_application_id = any(v_application_ids || v_linked_application_ids));
  delete from applications where id = any(v_application_ids || v_linked_application_ids) and company_id = v_company_id;

  -- 監査ログには件数だけ残す（氏名などの個人情報は残さない）
  insert into audit_logs (company_id, action, target_type, target_id, details)
  values (v_company_id, 'purge_personal_data', 'company', v_company_id,
    jsonb_build_object('applications', cardinality(v_application_ids), 'tenancies', cardinality(v_tenancy_ids), 'drafts', cardinality(v_draft_ids)));

  return query select cardinality(v_application_ids), cardinality(v_tenancy_ids), cardinality(v_draft_ids);
end;
$$;

revoke execute on function public.list_retention_candidates() from public, anon;
revoke execute on function public.purge_expired_personal_data() from public, anon;
grant execute on function public.list_retention_candidates() to authenticated;
grant execute on function public.purge_expired_personal_data() to authenticated;

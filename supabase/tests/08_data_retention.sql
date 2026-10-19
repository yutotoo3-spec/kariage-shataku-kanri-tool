-- 保存期間を過ぎた個人情報の削除（025）の確認
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'owner@r.example'),
  ('00000000-0000-0000-0000-0000000000c2', 'member@r.example');
insert into companies (id, name, slug) values
  ('80000000-0000-0000-0000-0000000000a1', 'R社', 'r-co'),
  ('80000000-0000-0000-0000-0000000000a2', 'S社', 's-co');
insert into profiles (user_id, company_id, role) values
  ('00000000-0000-0000-0000-0000000000c1', '80000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-0000000000c2', '80000000-0000-0000-0000-0000000000a1', 'member');

-- トリガーで日時が上書きされるため、登録後に日付を書き換える
alter table applications disable trigger applications_a_rate_limit;
insert into applications (id, company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in) values
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-0000000000a1', 'new_hire', '古い却下', 300000, 'single', 'p', 'a', 50000, '2020-01-01'),
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-0000000000a1', 'new_hire', '最近の却下', 300000, 'single', 'p', 'a', 50000, '2026-01-01'),
  ('81000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-0000000000a1', 'new_hire', '古い退去者', 300000, 'single', 'p', 'a', 50000, '2015-01-01'),
  ('81000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-0000000000a2', 'new_hire', '他社の古い却下', 300000, 'single', 'p', 'a', 50000, '2020-01-01');
alter table applications enable trigger applications_a_rate_limit;
update applications set status = 'rejected', reviewed_at = now() - interval '2 years'
  where id in ('81000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000004');
update applications set status = 'rejected', reviewed_at = now() - interval '1 month' where id = '81000000-0000-0000-0000-000000000002';
update applications set status = 'approved' where id = '81000000-0000-0000-0000-000000000003';

insert into tenancies (id, company_id, application_id, name, basic_salary, family_type, property_name, property_address, contract_start, status, move_out_date, rent) values
  ('82000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-0000000000a1', '81000000-0000-0000-0000-000000000003', '古い退去者', 300000, 'single', 'p', 'a', '2015-01-01', 'moved_out', current_date - interval '6 years', 50000),
  ('82000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-0000000000a1', null, '最近の退去者', 300000, 'single', 'p', 'a', '2020-01-01', 'moved_out', current_date - interval '1 year', 50000),
  ('82000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-0000000000a1', null, '入居中', 300000, 'single', 'p', 'a', '2010-01-01', 'active', null, 50000);
insert into rent_history (company_id, tenancy_id, effective_date, actual_rent, subsidy_limit, company_burden, personal_burden)
values ('80000000-0000-0000-0000-0000000000a1', '82000000-0000-0000-0000-000000000001', '2015-01-01', 50000, 60000, 35000, 15000);

set role authenticated;

-- member は使えない
select test.login('00000000-0000-0000-0000-0000000000c2');
select test.expect_error($$select * from list_retention_candidates()$$, 'only owners', 'member は一覧を見られない');
select test.expect_error($$select * from purge_expired_personal_data()$$, 'only owners', 'member は削除できない');

-- owner は自社の期限切れだけが対象
select test.login('00000000-0000-0000-0000-0000000000c1');
select test.assert_eq((select count(*) from list_retention_candidates()), 2::bigint, '期限切れは古い却下と古い退去者の2件');
select test.assert_eq((select string_agg(name, ',' order by name) from list_retention_candidates()), '古い却下,古い退去者', '対象の内訳');

select test.assert_eq((select tenancies from purge_expired_personal_data()), 1, '退去者1件を削除');
select test.assert_eq((select count(*) from list_retention_candidates()), 0::bigint, '削除後は対象なし');
select test.assert((select count(*) from applications where name in ('古い却下', '古い退去者')) = 0, '期限切れの申請と退去者の元の申請が消える');
select test.assert((select count(*) from applications where name = '最近の却下') = 1, '期限内の申請は残る');
select test.assert((select count(*) from tenancies) = 2, '期限内の退去者と入居中は残る');
select test.assert((select count(*) from rent_history) = 0, '家賃履歴も消える');
select test.assert((select details->>'tenancies' from audit_logs where action = 'purge_personal_data') = '1', '件数が監査ログに残る');
reset role;

select test.assert((select count(*) from applications where name = '他社の古い却下') = 1, '他社のデータは消えない');

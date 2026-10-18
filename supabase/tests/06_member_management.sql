-- メンバーの一覧・削除・権限変更（023）の確認
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'owner@n.example'),
  ('00000000-0000-0000-0000-0000000000d2', 'member@n.example'),
  ('00000000-0000-0000-0000-0000000000d3', 'leaver@n.example'),
  ('00000000-0000-0000-0000-0000000000d4', 'other-owner@o.example');
insert into companies (id, name, slug) values
  ('60000000-0000-0000-0000-0000000000a1', 'N社', 'n-co'),
  ('60000000-0000-0000-0000-0000000000a2', 'O社', 'o-co');
insert into profiles (user_id, company_id, role) values
  ('00000000-0000-0000-0000-0000000000d1', '60000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-0000000000d2', '60000000-0000-0000-0000-0000000000a1', 'member'),
  ('00000000-0000-0000-0000-0000000000d3', '60000000-0000-0000-0000-0000000000a1', 'member'),
  ('00000000-0000-0000-0000-0000000000d4', '60000000-0000-0000-0000-0000000000a2', 'owner');
insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in)
values ('60000000-0000-0000-0000-0000000000a1', 'new_hire', 'N社の申請', 300000, 'single', 'p', 'a', 50000, '2026-11-01');

set role authenticated;

-- member は一覧・削除・権限変更ができない
select test.login('00000000-0000-0000-0000-0000000000d2');
select test.expect_error($$select * from list_company_members()$$, 'only owners', 'member は一覧を取得できない');
select test.expect_error($$select remove_company_member('00000000-0000-0000-0000-0000000000d3')$$, 'only owners', 'member は削除できない');
select test.expect_error($$select set_member_role('00000000-0000-0000-0000-0000000000d3', 'owner')$$, 'only owners', 'member は権限を変更できない');

-- owner は自社のメンバーだけ一覧できる
select test.login('00000000-0000-0000-0000-0000000000d1');
select test.assert_eq((select count(*) from list_company_members()), 3::bigint, '自社のメンバー3人');
select test.assert_eq((select email from list_company_members() where is_me), 'owner@n.example', '自分の行がわかる');

-- 自分自身は削除・権限変更できない
select test.expect_error($$select remove_company_member('00000000-0000-0000-0000-0000000000d1')$$, 'cannot remove yourself', '自分は削除できない');
select test.expect_error($$select set_member_role('00000000-0000-0000-0000-0000000000d1', 'member')$$, 'cannot change your own role', '自分の権限は変更できない');

-- 他社のメンバーは操作できない
select test.expect_error($$select remove_company_member('00000000-0000-0000-0000-0000000000d4')$$, 'member not found', '他社のメンバーは削除できない');
select test.expect_error($$select set_member_role('00000000-0000-0000-0000-0000000000d4', 'member')$$, 'member not found', '他社のメンバーの権限は変更できない');
select test.expect_error($$select set_member_role('00000000-0000-0000-0000-0000000000d2', 'admin')$$, 'invalid role', '不正な権限は拒否');

-- 権限変更と削除
select set_member_role('00000000-0000-0000-0000-0000000000d2', 'owner');
select test.assert_eq((select role from list_company_members() where user_id = '00000000-0000-0000-0000-0000000000d2'), 'owner', 'member を owner に変更できる');
select remove_company_member('00000000-0000-0000-0000-0000000000d3');
select test.assert_eq((select count(*) from list_company_members()), 2::bigint, '退職者を外せる');
select test.assert_eq((select count(*) from audit_logs where action in ('remove_member', 'change_member_role')), 2::bigint, '操作が監査ログに残る');

-- 外されたユーザーは自社データにアクセスできない
select test.login('00000000-0000-0000-0000-0000000000d3');
select test.assert(public.current_company_id() is null, '外されたユーザーは所属なし');
select test.assert_eq((select count(*) from applications), 0::bigint, '外されたユーザーは申請が見えない');

reset role;

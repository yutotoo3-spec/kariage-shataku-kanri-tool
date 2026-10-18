-- 二要素認証（022）の確認：認証アプリを登録したユーザーはコード入力（aal2）まで自社データを扱えない
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'mfa-owner@m.example'),
  ('00000000-0000-0000-0000-0000000000e2', 'plain-member@m.example'),
  ('00000000-0000-0000-0000-0000000000e3', 'mfa-admin@op.example');
insert into companies (id, name, slug) values ('50000000-0000-0000-0000-0000000000a1', 'M社', 'm-co');
insert into profiles (user_id, company_id, role) values
  ('00000000-0000-0000-0000-0000000000e1', '50000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-0000000000e2', '50000000-0000-0000-0000-0000000000a1', 'member');
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000e3');
insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in)
values ('50000000-0000-0000-0000-0000000000a1', 'new_hire', 'M社の申請', 300000, 'single', 'p', 'a', 50000, '2026-11-01');
insert into auth.mfa_factors (user_id, status) values
  ('00000000-0000-0000-0000-0000000000e1', 'verified'),
  ('00000000-0000-0000-0000-0000000000e3', 'verified'),
  -- 登録途中（未確認）の認証アプリは条件に含めない
  ('00000000-0000-0000-0000-0000000000e2', 'unverified');

set role authenticated;

-- 認証アプリ登録済み・パスワードのみ（aal1）では何も見えない・操作できない
select test.login('00000000-0000-0000-0000-0000000000e1');
select test.set_aal('aal1');
select test.assert_eq(public.mfa_satisfied(), false, 'MFA登録済みで aal1 なら条件を満たさない');
select test.assert(public.current_company_id() is null, 'aal1 では自社なし扱い');
select test.assert_eq((select count(*) from applications), 0::bigint, 'aal1 では申請が見えない');
select test.expect_error($$select * from create_invite('new@m.example', 'member')$$, 'no company', 'aal1 では招待できない');

-- コード入力後（aal2）は使える
select test.set_aal('aal2');
select test.assert_eq(public.current_company_id(), '50000000-0000-0000-0000-0000000000a1'::uuid, 'aal2 なら自社を判定できる');
select test.assert_eq((select count(*) from applications), 1::bigint, 'aal2 なら申請が見える');
select test.assert((select count(*) from create_invite('new@m.example', 'member')) = 1, 'aal2 なら owner は招待できる');

-- 認証アプリ未登録（未確認のみ）のユーザーは aal1 のままで使える
select test.login('00000000-0000-0000-0000-0000000000e2');
select test.set_aal('aal1');
select test.assert_eq((select count(*) from applications), 1::bigint, 'MFA未登録なら従来どおり使える');
select test.expect_error($$select * from create_invite('x@m.example', 'member')$$, 'only owners', 'member は招待できない（従来どおり）');

-- 運営者も、認証アプリ登録済みなら aal2 が必要
select test.login('00000000-0000-0000-0000-0000000000e3');
select test.set_aal('aal1');
select test.expect_error($$select * from admin_list_companies()$$, 'only platform admins', 'aal1 の運営者は企業一覧を取得できない');
select test.set_aal('aal2');
select test.assert((select count(*) from admin_list_companies()) >= 1, 'aal2 の運営者は企業一覧を取得できる');

select test.set_aal('aal1');
reset role;

-- 運営者メニューの利用企業一覧・利用停止（020）の確認
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'admin@op.example'),
  ('00000000-0000-0000-0000-0000000000f2', 'owner@x.example'),
  ('00000000-0000-0000-0000-0000000000f3', 'member@x.example');
insert into companies (id, name, slug) values
  ('40000000-0000-0000-0000-0000000000a1', '運営社', 'op-co'),
  ('40000000-0000-0000-0000-0000000000a2', 'X社', 'x-co');
insert into profiles (user_id, company_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', '40000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-0000000000f2', '40000000-0000-0000-0000-0000000000a2', 'owner'),
  ('00000000-0000-0000-0000-0000000000f3', '40000000-0000-0000-0000-0000000000a2', 'member');
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000f1');
insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in)
values ('40000000-0000-0000-0000-0000000000a2', 'new_hire', 'X社の申請', 300000, 'single', 'p', 'a', 50000, '2026-11-01');

-- 運営者以外は一覧・停止ができない
set role authenticated;
select test.login('00000000-0000-0000-0000-0000000000f2');
select test.expect_error($$select * from admin_list_companies()$$, 'only platform admins', '運営者以外は企業一覧を取得できない');
select test.expect_error($$select admin_set_company_status('40000000-0000-0000-0000-0000000000a2', 'suspended')$$,
  'only platform admins', '運営者以外は利用停止できない');
reset role;

set role anon;
select test.login(null);
select test.expect_error($$select * from admin_list_companies()$$, 'permission denied', '未ログインでは企業一覧を取得できない');
reset role;

-- 運営者は全社の一覧と集計を取得できる
set role authenticated;
select test.login('00000000-0000-0000-0000-0000000000f1');
select test.assert((select count(*) from admin_list_companies()) >= 2, '運営者は全社の一覧を取得できる');
select test.assert_eq((select owner_emails from admin_list_companies() where slug = 'x-co'), 'owner@x.example', '管理者のメールアドレス');
select test.assert_eq((select member_count from admin_list_companies() where slug = 'x-co'), 2::bigint, '所属ユーザー数');
select test.assert_eq((select application_count from admin_list_companies() where slug = 'x-co'), 1::bigint, '申請数');

-- 自分の会社は停止できない・不正な状態は拒否
select test.expect_error($$select admin_set_company_status('40000000-0000-0000-0000-0000000000a1', 'suspended')$$,
  'cannot suspend your own company', '自分の会社は停止できない');
select test.expect_error($$select admin_set_company_status('40000000-0000-0000-0000-0000000000a2', 'deleted')$$,
  'invalid status', '不正な状態は拒否');

-- X社を停止する
select admin_set_company_status('40000000-0000-0000-0000-0000000000a2', 'suspended');
reset role;
select test.assert_eq((select status from companies where slug = 'x-co'), 'suspended', '停止できる');
select test.assert_eq((select count(*) from audit_logs where action = 'admin_set_company_status' and company_id = '40000000-0000-0000-0000-0000000000a2'),
  1::bigint, '停止操作が監査ログに残る');

-- 停止中の会社の社員はデータを見られない・申請フォームも使えない
set role authenticated;
select test.login('00000000-0000-0000-0000-0000000000f3');
select test.assert_eq(current_company_id(), null::uuid, '停止中は所属企業なし扱い');
select test.assert_eq((select count(*) from applications), 0::bigint, '停止中は申請が見えない');
select test.assert_eq((select count(*) from companies), 0::bigint, '停止中は企業情報が見えない');
reset role;
set role anon;
select test.login(null);
select test.assert_eq((select count(*) from get_public_company('x-co')), 0::bigint, '停止中は申請フォームを開けない');
reset role;

-- 再開すると元どおり
set role authenticated;
select test.login('00000000-0000-0000-0000-0000000000f1');
select admin_set_company_status('40000000-0000-0000-0000-0000000000a2', 'active');
select test.login('00000000-0000-0000-0000-0000000000f3');
select test.assert_eq((select count(*) from applications), 1::bigint, '再開後は申請が見える');
reset role;

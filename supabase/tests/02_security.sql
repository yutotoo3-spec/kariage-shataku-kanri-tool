-- 権限まわりの回帰テスト（RLS・申請の改ざん対策・監査ログ・owner/member・台帳登録・企業登録の招待）
-- ここまで手作業で確認してきた内容を、マイグレーションを変更するたびに自動で確かめる

-- ===== 準備（管理者として） =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@a.example'),
  ('00000000-0000-0000-0000-0000000000a2', 'member@a.example'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner@b.example');
insert into companies (id, name, slug, status) values
  ('10000000-0000-0000-0000-0000000000aa', 'A社', 'a-co', 'active'),
  ('10000000-0000-0000-0000-0000000000bb', 'B社', 'b-co', 'active'),
  ('10000000-0000-0000-0000-0000000000cc', '停止社', 'stopped-co', 'suspended');
insert into profiles (user_id, company_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000aa', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-0000000000aa', 'member'),
  ('00000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000bb', 'owner');
insert into settings (company_id, key, value) values
  ('10000000-0000-0000-0000-0000000000aa', 'company_burden_rate', '0.7'),
  ('10000000-0000-0000-0000-0000000000bb', 'company_burden_rate', '0.7');
insert into invites (id, company_id, email) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000aa', 'new@a.example');

-- ===== 未ログイン（申請者） =====
set role anon;
select test.login(null);

select test.assert_eq((select count(*) from companies), 0::bigint, 'anon: companies を直接読めない');
select test.assert_eq((select count(*) from settings), 0::bigint, 'anon: settings を直接読めない');
select test.assert_eq((select name from get_public_company('a-co')), 'A社', 'anon: slug から公開情報を取得できる');
select test.assert_eq((select count(*) from get_public_company('stopped-co')), 0::bigint, 'anon: 停止中の会社は取得できない');
select test.assert((select count(*) from get_public_settings('10000000-0000-0000-0000-0000000000aa')) > 0, 'anon: 1社分の設定を取得できる');

-- 019 以降、申請は Edge Function（service_role）経由のみ。未ログインの直接 INSERT はすべて拒否される
select test.expect_error($$
  insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in)
  values ('10000000-0000-0000-0000-0000000000aa', 'new_hire', 'x', 300000, 'single', 'p', 'a', 50000, '2026-11-01')
$$, 'permission denied', 'anon: 申請テーブルへの直接の登録は拒否（CAPTCHA を経由しない送信を防ぐ）');
select test.assert_eq((select count(*) from applications), 0::bigint, 'anon: 申請を読めない');
select test.expect_error($$select convert_application_to_tenancy(gen_random_uuid(), '2026-11-01')$$,
  'permission denied', 'anon: 台帳登録RPCを呼べない');
select test.expect_error($$select * from create_company_invite('x@example.com')$$,
  'only platform admins|permission denied', 'anon: 企業登録の招待を発行できない');
reset role;

-- ===== Edge Function（service_role）相当の登録：値の検証・再計算はDB側で必ず行われる =====
select test.expect_error($$
  insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in)
  values ('10000000-0000-0000-0000-0000000000aa', 'new_hire', repeat('あ', 101), 300000, 'single', 'p', 'a', 50000, '2026-11-01')
$$, 'applications_text_length_check', '101文字の氏名は拒否');
select test.expect_error($$
  insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, parking_fee, desired_move_in)
  values ('10000000-0000-0000-0000-0000000000aa', 'new_hire', 'x', 300000, 'single', 'p', 'a', 50000, -1, '2026-11-01')
$$, 'applications_amount_range_check', '負の金額は拒否');
insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in, status, personal_burden)
values ('10000000-0000-0000-0000-0000000000aa', 'new_hire', '申請者1', 300000, 'single', 'p', 'a', 50000, '2026-11-01', 'approved', 0);
select test.assert_eq((select status from applications where name = '申請者1'), 'pending', 'status を指定しても審査待ちで登録される');
select test.assert_eq((select personal_burden from applications where name = '申請者1'), 15000, '負担額はサーバー側で再計算される');

-- ログイン中でも、所属していない会社への直接登録は拒否（CAPTCHA を経由しない送信を防ぐ）
set role authenticated;
select test.login('00000000-0000-0000-0000-0000000000b1');
select test.expect_error($$
  insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in)
  values ('10000000-0000-0000-0000-0000000000aa', 'new_hire', 'x', 300000, 'single', 'p', 'a', 50000, '2026-11-01')
$$, 'row-level security', '他社の社員は申請テーブルに直接登録できない');
reset role;

-- ===== A社 member =====
set role authenticated;
select test.login('00000000-0000-0000-0000-0000000000a2');

select test.assert_eq((select count(*) from companies), 1::bigint, 'member: 自社の companies だけ読める');
select test.assert_eq((select count(*) from settings where company_id = '10000000-0000-0000-0000-0000000000bb'), 0::bigint, 'member: 他社の設定は読めない');
update settings set value = '0.9' where key = 'company_burden_rate';
select test.expect_error($$select revoke_invite('20000000-0000-0000-0000-000000000001')$$,
  'only owners', 'member: 招待を取り消せない');

insert into audit_logs (company_id, action, user_email) values ('10000000-0000-0000-0000-0000000000aa', 'test', 'fake@example.com');
select test.assert_eq((select count(*) from audit_logs), 0::bigint, 'member: 監査ログは閲覧できない（owner のみ）');
select test.expect_error($$update audit_logs set action = 'x'$$, 'permission denied', 'member: 監査ログを更新できない');
select test.expect_error($$delete from audit_logs$$, 'permission denied', 'member: 監査ログを削除できない');
select test.expect_error($$insert into audit_logs (company_id, action) values ('10000000-0000-0000-0000-0000000000bb', 'x')$$,
  'row-level security', 'member: 他社宛ての監査ログは書けない');
reset role;

select test.assert_eq((select value::text from settings where company_id = '10000000-0000-0000-0000-0000000000aa' and key = 'company_burden_rate'),
  '0.7', 'member の設定変更は反映されない');
select test.assert_eq((select status from invites where id = '20000000-0000-0000-0000-000000000001'), 'pending', 'member の招待取り消しは反映されない');
select test.assert_eq((select user_email from audit_logs where action = 'test'), 'member@a.example', 'member: 監査ログの操作者は偽装できない');

-- ===== A社 owner =====
set role authenticated;
select test.login('00000000-0000-0000-0000-0000000000a1');
update settings set value = '0.75' where key = 'company_burden_rate';
select revoke_invite('20000000-0000-0000-0000-000000000001');
select test.assert((select count(*) from audit_logs) > 0, 'owner: 自社の監査ログを閲覧できる');
select test.assert_eq((select count(*) from audit_logs where company_id <> current_company_id()), 0::bigint, 'owner: 他社の監査ログは見えない');
reset role;
select test.assert_eq((select value::text from settings where company_id = '10000000-0000-0000-0000-0000000000aa' and key = 'company_burden_rate'),
  '0.75', 'owner は設定を変更できる');
select test.assert_eq((select status from invites where id = '20000000-0000-0000-0000-000000000001'), 'revoked', 'owner は招待を取り消せる');
update settings set value = '0.7' where key = 'company_burden_rate';

-- ===== 台帳登録（トランザクション） =====
set role authenticated;
select test.login('00000000-0000-0000-0000-0000000000a2');
select test.expect_error($$select convert_application_to_tenancy((select id from applications where name = '申請者1'), '2026-11-01')$$,
  'not ready', '審査待ちの申請は台帳登録できない');
update applications set status = 'contract_pending' where name = '申請者1';
select test.expect_error($$select convert_application_to_tenancy((select id from applications where name = '申請者1'), '2026-11-01', '2026-10-01')$$,
  'end date', '契約満了日が開始日より前は拒否');
select convert_application_to_tenancy((select id from applications where name = '申請者1'), '2026-11-01');
select test.expect_error($$select convert_application_to_tenancy((select id from applications where name = '申請者1'), '2026-11-01')$$,
  'already registered', '同じ申請の二重登録は拒否');

select test.login('00000000-0000-0000-0000-0000000000b1');
select test.assert_eq((select count(*) from applications), 0::bigint, '他社の申請は見えない');
select test.assert_eq((select count(*) from tenancies), 0::bigint, '他社の入居者は見えない');
reset role;

select test.assert_eq((select status from applications where name = '申請者1'), 'approved', '台帳登録で申請は承認済になる');
select test.assert_eq((select count(*) from rent_history rh join tenancies t on t.id = rh.tenancy_id where t.name = '申請者1'),
  1::bigint, '台帳登録で家賃履歴が1件作られる');
select test.assert_eq((select count(*) from audit_logs where action = 'convert_to_tenancy'), 1::bigint, '台帳登録が監査ログに残る');

-- 途中で失敗したら全部取り消される
insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in)
values ('10000000-0000-0000-0000-0000000000aa', 'new_hire', '申請者2', 300000, 'family', 'p', 'a', 50000, '2026-11-01');
update applications set status = 'contract_pending' where name = '申請者2';
create function pg_temp.force_failure() returns trigger language plpgsql as $$ begin raise exception 'forced failure'; end $$;
create trigger force_failure before insert on rent_history for each row execute function pg_temp.force_failure();
set role authenticated;
select test.login('00000000-0000-0000-0000-0000000000a1');
select test.expect_error($$select convert_application_to_tenancy((select id from applications where name = '申請者2'), '2026-11-01')$$,
  'forced failure', '家賃履歴の登録に失敗させる');
reset role;
drop trigger force_failure on rent_history;
select test.assert_eq((select count(*) from tenancies where name = '申請者2'), 0::bigint, '失敗時は入居者も残らない');
select test.assert_eq((select status from applications where name = '申請者2'), 'contract_pending', '失敗時は申請のステータスも変わらない');

-- ===== 企業登録の招待 =====
set role authenticated;
select test.login('00000000-0000-0000-0000-0000000000a1');
select test.expect_error($$select * from create_company_invite('x@example.com')$$, 'only platform admins', '運営者以外は企業登録の招待を発行できない');
select test.assert_eq((select count(*) from platform_admins), 0::bigint, 'platform_admins は直接読めない');
reset role;

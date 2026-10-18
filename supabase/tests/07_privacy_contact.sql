-- 申請フォームの問い合わせ窓口の設定（024）の確認
insert into companies (id, name, slug) values ('70000000-0000-0000-0000-0000000000a1', 'P社', 'p-co');

-- 新しく登録された会社にも設定項目が用意される
select test.assert_eq(
  (select value #>> '{}' from settings where company_id = '70000000-0000-0000-0000-0000000000a1' and key = 'privacy_contact'),
  '', '新しい会社に privacy_contact が用意される');

-- 未ログインでも申請フォーム用に取得できる
set role anon;
select test.login(null);
select test.assert((select count(*) from get_public_settings('70000000-0000-0000-0000-0000000000a1') where key = 'privacy_contact') = 1,
  '未ログインでも問い合わせ窓口を取得できる');
reset role;

-- 極端に長い文字列は保存できない
select test.expect_error(
  $$update settings set value = to_jsonb(repeat('あ', 501)) where company_id = '70000000-0000-0000-0000-0000000000a1' and key = 'privacy_contact'$$,
  'settings_text_value_length_check', '501文字以上は保存できない');
update settings set value = to_jsonb('人事部 hr@p.example'::text) where company_id = '70000000-0000-0000-0000-0000000000a1' and key = 'privacy_contact';

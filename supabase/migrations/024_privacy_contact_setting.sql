-- 申請フォームに個人情報の取扱いを表示する (#54)
-- 表示文の「お問い合わせ窓口」を会社ごとに設定できるよう、設定項目 privacy_contact を追加する。
-- 値は申請フォームに表示するため、get_public_settings（013）で未ログインでも取得できる（公開して問題ない内容のみ入れること）。

insert into settings (company_id, key, value, description)
select c.id, 'privacy_contact', to_jsonb(''::text), '申請フォームの個人情報の取扱いに表示する問い合わせ窓口（例：人事部 hr@example.com）'
from companies c
on conflict (company_id, key) do nothing;

-- 今後登録される会社にも同じ設定項目を用意する
create or replace function public.companies_add_default_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into settings (company_id, key, value, description)
  values (new.id, 'privacy_contact', to_jsonb(''::text), '申請フォームの個人情報の取扱いに表示する問い合わせ窓口（例：人事部 hr@example.com）')
  on conflict (company_id, key) do nothing;
  return new;
end;
$$;

drop trigger if exists companies_add_default_settings on companies;
create trigger companies_add_default_settings
  after insert on companies
  for each row execute function public.companies_add_default_settings();

-- 表示文が極端に長くならないよう、文字列の設定値の長さを制限する
alter table settings drop constraint if exists settings_text_value_length_check;
alter table settings add constraint settings_text_value_length_check
  check (jsonb_typeof(value) <> 'string' or char_length(value #>> '{}') <= 500) not valid;

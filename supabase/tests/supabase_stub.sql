-- テスト用に、Supabase が本番で用意しているロール・auth スキーマを最小限まねる
-- （マイグレーションはこれらが存在する前提で書かれているため）
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;

create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);

-- Supabase では JWT（ログイン情報）から取り出す。テストでは set_config で設定した値を返す
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create function auth.jwt() returns jsonb language sql stable as
  $$ select jsonb_build_object('aal', coalesce(nullif(current_setting('request.jwt.claim.aal', true), ''), 'aal1')) $$;
grant execute on all functions in schema auth to anon, authenticated;

-- 二要素認証の登録情報（本物は status が auth.factor_status 型）
create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null);

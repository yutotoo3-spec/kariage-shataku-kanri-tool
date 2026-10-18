-- テスト用のアサーション関数（マイグレーション適用後に作成する）
create schema test;
grant usage on schema test to anon, authenticated;

create function test.assert(p_condition boolean, p_message text) returns void language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'ASSERTION FAILED: %', p_message;
  end if;
end $$;

create function test.assert_eq(p_actual anyelement, p_expected anyelement, p_message text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'ASSERTION FAILED: % (expected %, got %)', p_message, p_expected, p_actual;
  end if;
end $$;

-- p_sql を実行し、p_pattern に一致するエラーになることを確認する（成功してしまったら失敗）
create function test.expect_error(p_sql text, p_pattern text, p_message text) returns void language plpgsql as $$
declare
  v_succeeded boolean := false;
begin
  begin
    execute p_sql;
    v_succeeded := true;
  exception when others then
    if sqlerrm !~ p_pattern then
      raise exception 'ASSERTION FAILED: % (expected error matching "%", got "%")', p_message, p_pattern, sqlerrm;
    end if;
  end;
  if v_succeeded then
    raise exception 'ASSERTION FAILED: % (expected error matching "%", but it succeeded)', p_message, p_pattern;
  end if;
end $$;

-- ログイン状態を切り替える（p_user_id が null なら未ログイン）
create function test.login(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p_user_id::text, ''), false),
         set_config('request.jwt.claim.role', case when p_user_id is null then 'anon' else 'authenticated' end, false);
$$;

grant execute on all functions in schema test to anon, authenticated;

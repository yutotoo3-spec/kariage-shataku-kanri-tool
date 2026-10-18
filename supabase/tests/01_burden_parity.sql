-- 申請登録時にDBトリガーが計算する実賃料・限度額・負担額が、画面側（src/utils/calc.js）と一致することを確認する。
-- ケースは tests/fixtures/burden-cases.json（src/utils/calc.test.js と共通）から読み込む。
create temp table cases as
  select ordinality as n, value as c from jsonb_array_elements(:'cases'::jsonb) with ordinality;

do $$
declare
  r record;
  v_company_id uuid;
  v_key text;
  v_app applications%rowtype;
  v_actual jsonb;
begin
  for r in select * from cases loop
    insert into companies (name, slug) values ('parity ' || r.n, 'parity-' || r.n) returning id into v_company_id;
    for v_key in select jsonb_object_keys(r.c -> 'settings') loop
      insert into settings (company_id, key, value) values (v_company_id, v_key, r.c -> 'settings' -> v_key);
    end loop;

    insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address,
      rent, common_fee, management_fee, desired_move_in)
    values (v_company_id, 'new_hire', 'parity', (r.c ->> 'basic_salary')::int, r.c ->> 'family_type', 'p', 'a',
      (r.c ->> 'rent')::int, (r.c ->> 'common_fee')::int, (r.c ->> 'management_fee')::int, date '2026-11-01')
    returning * into v_app;

    v_actual := jsonb_build_object('actual_rent', v_app.actual_rent, 'subsidy_limit', v_app.subsidy_limit,
      'company_burden', v_app.company_burden, 'personal_burden', v_app.personal_burden);
    perform test.assert_eq(v_actual, r.c -> 'expected', r.c ->> 'description');
  end loop;
end $$;

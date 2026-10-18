-- 公開申請フォームの件数上限（018）の確認
insert into companies (id, name, slug) values
  ('30000000-0000-0000-0000-0000000000aa', '上限テスト社', 'limit-co'),
  ('30000000-0000-0000-0000-0000000000bb', '別の会社', 'other-co');

set role anon;
select test.login(null);

-- 1時間に20件までは受け付ける
do $$
begin
  for i in 1..20 loop
    insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in)
    values ('30000000-0000-0000-0000-0000000000aa', 'new_hire', '申請' || i, 300000, 'single', 'p', 'a', 50000, '2026-11-01');
  end loop;
end $$;

select test.expect_error($$
  insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in)
  values ('30000000-0000-0000-0000-0000000000aa', 'new_hire', '21件目', 300000, 'single', 'p', 'a', 50000, '2026-11-01')
$$, 'too many applications: hourly', '1時間に21件目は拒否');

-- 上限は会社ごと（他の会社には影響しない）
insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in)
values ('30000000-0000-0000-0000-0000000000bb', 'new_hire', '別会社', 300000, 'single', 'p', 'a', 50000, '2026-11-01');
reset role;

-- 1時間より前の申請は1時間の上限に数えない（24時間の上限には数える）
update applications set created_at = now() - interval '2 hours' where company_id = '30000000-0000-0000-0000-0000000000aa';
-- 過去分の申請をまとめて用意する間だけ、上限チェックを止める
alter table applications disable trigger applications_a_rate_limit;
insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in)
select '30000000-0000-0000-0000-0000000000aa', 'new_hire', '過去分' || g, 300000, 'single', 'p', 'a', 50000, '2026-11-01'
from generate_series(1, 79) g;
alter table applications enable trigger applications_a_rate_limit;
update applications set created_at = now() - interval '3 hours' where company_id = '30000000-0000-0000-0000-0000000000aa';
select test.assert_eq((select count(*) from applications where company_id = '30000000-0000-0000-0000-0000000000aa'), 99::bigint, '24時間で99件の状態を作る');

set role anon;
insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in)
values ('30000000-0000-0000-0000-0000000000aa', 'new_hire', '100件目', 300000, 'single', 'p', 'a', 50000, '2026-11-01');
select test.expect_error($$
  insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in)
  values ('30000000-0000-0000-0000-0000000000aa', 'new_hire', '101件目', 300000, 'single', 'p', 'a', 50000, '2026-11-01')
$$, 'too many applications: daily', '24時間に101件目は拒否');
reset role;

-- 24時間より前の申請は数えない
update applications set created_at = now() - interval '25 hours' where company_id = '30000000-0000-0000-0000-0000000000aa';
set role anon;
insert into applications (company_id, scene, name, basic_salary, family_type, property_name, property_address, rent, desired_move_in)
values ('30000000-0000-0000-0000-0000000000aa', 'new_hire', '翌日', 300000, 'single', 'p', 'a', 50000, '2026-11-01');
reset role;

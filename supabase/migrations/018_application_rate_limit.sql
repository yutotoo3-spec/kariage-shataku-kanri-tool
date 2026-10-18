-- 公開申請フォームの大量送信対策（第1段階） (#32)
-- 1社あたりの申請件数に上限を設け、機械的な大量送信の被害を一定件数で止める。
-- （人間かどうかの判定は、第2段階で Cloudflare Turnstile を導入して行う）
--
-- 上限：1社あたり 1時間に20件・24時間に100件
-- ※ 上限を変える場合は、この関数の定数を変更する新しいマイグレーションを作ること

create index if not exists applications_company_created_idx on applications (company_id, created_at);

create or replace function public.applications_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_hourly_limit constant integer := 20;
  c_daily_limit constant integer := 100;
begin
  -- 同じ会社への同時送信で上限を超えないよう、会社単位で順番に処理する（トランザクション終了で自動解除）
  perform pg_advisory_xact_lock(hashtext('applications_rate_limit:' || new.company_id::text));

  if (select count(*) from applications a
      where a.company_id = new.company_id and a.created_at > now() - interval '1 hour') >= c_hourly_limit then
    raise exception 'too many applications: hourly limit reached' using errcode = 'P0001';
  end if;

  if (select count(*) from applications a
      where a.company_id = new.company_id and a.created_at > now() - interval '24 hours') >= c_daily_limit then
    raise exception 'too many applications: daily limit reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.applications_rate_limit() from public, anon, authenticated;

-- 013 の applications_before_insert（値の再計算）より前に判定する（トリガーは名前順に実行される）
drop trigger if exists applications_a_rate_limit on applications;
create trigger applications_a_rate_limit
  before insert on applications
  for each row execute function public.applications_rate_limit();

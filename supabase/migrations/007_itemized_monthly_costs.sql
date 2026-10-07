-- 実賃料（家賃＋共益費＋管理費）の単一値だったものを、
-- 毎月発生する費用項目ごとに分解する（借上社宅管理規程「費用項目」準拠）
-- actual_rent は rent + common_fee + management_fee としてアプリ側で算出し、
-- 引き続き一覧表示・月次処理の互換のために保持する

do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'applications' and column_name = 'rent') then
    alter table applications
      add column rent integer,
      add column common_fee integer not null default 0,
      add column management_fee integer not null default 0,
      add column parking_fee integer not null default 0,
      add column bicycle_parking_fee integer not null default 0,
      add column neighborhood_fee integer not null default 0,
      add column internet_fee integer not null default 0,
      add column water_fee_flat integer not null default 0,
      add column support_service_fee_monthly integer not null default 0,
      add column guarantee_fee_monthly integer not null default 0,
      add column other_fixed_lease_cost integer not null default 0,
      add column satellite_fee integer not null default 0,
      add column other_monthly_company integer not null default 0,
      add column other_monthly_personal integer not null default 0;

    update applications set rent = actual_rent, common_fee = 0, management_fee = 0 where rent is null;
    alter table applications alter column rent set not null;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'application_drafts' and column_name = 'rent') then
    alter table application_drafts
      add column rent integer,
      add column common_fee integer not null default 0,
      add column management_fee integer not null default 0,
      add column parking_fee integer not null default 0,
      add column bicycle_parking_fee integer not null default 0,
      add column neighborhood_fee integer not null default 0,
      add column internet_fee integer not null default 0,
      add column water_fee_flat integer not null default 0,
      add column support_service_fee_monthly integer not null default 0,
      add column guarantee_fee_monthly integer not null default 0,
      add column other_fixed_lease_cost integer not null default 0,
      add column satellite_fee integer not null default 0,
      add column other_monthly_company integer not null default 0,
      add column other_monthly_personal integer not null default 0;

    update application_drafts set rent = actual_rent, common_fee = 0, management_fee = 0 where rent is null;
    alter table application_drafts alter column rent set not null;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'tenancies' and column_name = 'rent') then
    alter table tenancies
      add column rent integer,
      add column common_fee integer not null default 0,
      add column management_fee integer not null default 0,
      add column parking_fee integer not null default 0,
      add column bicycle_parking_fee integer not null default 0,
      add column neighborhood_fee integer not null default 0,
      add column internet_fee integer not null default 0,
      add column water_fee_flat integer not null default 0,
      add column support_service_fee_monthly integer not null default 0,
      add column guarantee_fee_monthly integer not null default 0,
      add column other_fixed_lease_cost integer not null default 0,
      add column satellite_fee integer not null default 0,
      add column other_monthly_company integer not null default 0,
      add column other_monthly_personal integer not null default 0;
  end if;
end $$;

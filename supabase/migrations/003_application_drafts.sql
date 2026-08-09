-- 本人が公開フォームから送信する仮申請テーブル
create table if not exists application_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  scene text not null check (scene in ('new_hire', 'existing')),
  name text not null,
  email text,
  basic_salary integer not null,
  family_type text not null check (family_type in ('single', 'family')),
  join_date date,
  property_name text not null,
  property_address text not null,
  floor_area decimal,
  actual_rent integer not null,
  desired_move_in date not null,
  note text,
  subsidy_limit integer,
  company_burden integer,
  personal_burden integer,
  status text not null default 'submitted'
    check (status in ('submitted', 'converted', 'dismissed')),
  converted_application_id uuid references applications(id),
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text
);

alter table application_drafts enable row level security;

-- 未ログインの本人は送信（insert）のみ可能。他人の送信内容は読めない
create policy "anyone can submit an application draft"
  on application_drafts for insert
  to anon
  with check (true);

-- HR（ログイン済み）は閲覧・更新・削除が可能
create policy "authenticated users can read application drafts"
  on application_drafts for select
  to authenticated
  using (true);

create policy "authenticated users can update application drafts"
  on application_drafts for update
  to authenticated
  using (true);

create policy "authenticated users can delete application drafts"
  on application_drafts for delete
  to authenticated
  using (true);

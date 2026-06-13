-- 申請テーブル
create table if not exists applications (
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
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'approved', 'rejected', 'contract_pending')),
  reviewed_at timestamptz,
  review_comment text
);

-- 入居者台帳テーブル
create table if not exists tenancies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  application_id uuid references applications(id),
  name text not null,
  email text,
  basic_salary integer not null,
  family_type text not null check (family_type in ('single', 'family')),
  property_name text not null,
  property_address text not null,
  floor_area decimal,
  contract_start date not null,
  contract_end date,
  status text not null default 'active'
    check (status in ('active', 'move_out_pending', 'moved_out')),
  move_out_date date,
  move_out_reason text,
  restoration_cost integer default 0
);

-- 家賃履歴テーブル（実賃料変更・4月見直し記録）
create table if not exists rent_history (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid references tenancies(id) on delete cascade,
  effective_date date not null,
  actual_rent integer not null,
  subsidy_limit integer not null,
  company_burden integer not null,
  personal_burden integer not null,
  note text,
  changed_at timestamptz default now(),
  changed_by text
);

-- 監査ログテーブル
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_email text,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb
);

-- Row Level Security（認証済みユーザーのみ操作可）
alter table applications enable row level security;
alter table tenancies enable row level security;
alter table rent_history enable row level security;
alter table audit_logs enable row level security;

create policy "authenticated users can read/write applications"
  on applications for all using (auth.role() = 'authenticated');

create policy "authenticated users can read/write tenancies"
  on tenancies for all using (auth.role() = 'authenticated');

create policy "authenticated users can read/write rent_history"
  on rent_history for all using (auth.role() = 'authenticated');

create policy "authenticated users can read/write audit_logs"
  on audit_logs for all using (auth.role() = 'authenticated');

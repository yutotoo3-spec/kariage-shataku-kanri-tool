-- 物件マスターテーブル
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  property_name text not null,
  property_address text not null,
  building_type text default 'mansion' check (building_type in ('mansion', 'house', 'other')),
  floor_area numeric,
  owner_name text,
  management_company text,
  management_phone text,
  company_contract_start date,
  company_contract_end date,
  monthly_rent integer,
  notice_period_months integer default 1,
  cancellation_penalty text,
  cancellation_notes text,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  notes text
);

alter table properties enable row level security;
create policy "authenticated users full access on properties"
  on properties for all to authenticated using (true) with check (true);

-- 書類管理テーブル
create table if not exists property_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  property_id uuid not null references properties(id) on delete cascade,
  document_type text not null check (document_type in ('lease_contract', 'important_matters', 'resident_contract', 'video_link', 'other')),
  document_name text not null,
  external_url text,
  notes text,
  uploaded_at timestamptz default now()
);

alter table property_documents enable row level security;
create policy "authenticated users full access on property_documents"
  on property_documents for all to authenticated using (true) with check (true);

-- 入居者台帳に物件IDを追加
alter table tenancies add column if not exists property_id uuid references properties(id);

-- マルチテナント化 フェーズ1（スキーマ追加）
-- 複数企業がそれぞれ独立してこのツールを利用できるようにするためのテナント分離基盤。
-- このマイグレーションは追加のみで、既存の動作を変更しない（安全に先行適用できる）。
-- company_id の NOT NULL化・RLSの全面書き換えは 010 で行う。

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended')),
  plan text
);

-- auth.users（Supabase Authが管理）に対応する、企業・権限の情報
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id),
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz default now()
);

alter table applications add column if not exists company_id uuid references companies(id);
alter table application_drafts add column if not exists company_id uuid references companies(id);
alter table tenancies add column if not exists company_id uuid references companies(id);
alter table rent_history add column if not exists company_id uuid references companies(id);
alter table audit_logs add column if not exists company_id uuid references companies(id);
alter table settings add column if not exists company_id uuid references companies(id);

create index if not exists applications_company_id_idx on applications(company_id);
create index if not exists application_drafts_company_id_idx on application_drafts(company_id);
create index if not exists tenancies_company_id_idx on tenancies(company_id);
create index if not exists rent_history_company_id_idx on rent_history(company_id);
create index if not exists audit_logs_company_id_idx on audit_logs(company_id);
create index if not exists profiles_company_id_idx on profiles(company_id);

alter table companies enable row level security;
alter table profiles enable row level security;

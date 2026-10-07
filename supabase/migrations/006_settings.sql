-- 規程に基づく各種料率・上限値を設定として外部化する
-- (calc.js にハードコードされていた値をDB管理に移行)
create table if not exists settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz default now(),
  updated_by text
);

alter table settings enable row level security;

-- 公開フォーム（/apply、未ログイン）でも概算プレビューの計算に使うため、閲覧は誰でも可能
create policy "anyone can read settings"
  on settings for select
  to public
  using (true);

-- 変更はログイン済みユーザーのみ
create policy "authenticated users can update settings"
  on settings for update
  to authenticated
  using (true);

insert into settings (key, value, description) values
  ('company_burden_rate', '0.7', '第11条2項(1) 実賃料が限度額以内のときの会社負担割合'),
  ('personal_burden_rate', '0.3', '第11条2項(1) 同・本人負担割合'),
  ('subsidy_ratio_single', '0.2', '第9条1項(1) 単身者＝基本報酬月額の1/5（=20%）'),
  ('subsidy_ratio_family', '0.25', '第9条1項(2) 家族帯同者＝基本報酬月額の1/4（=25%）'),
  ('rent_ceiling_multiplier', '1.5', '第11条2項※ 実賃料は補助対象限度額の1.5倍以内が原則。超過は会社が借上げを拒否できる'),
  ('floor_area_limit', '99', '第8条1項 99㎡以下'),
  ('building_tax_rate', '0.002', '第4条3項(1) 賃貸料相当額の計算に使う建物課税標準額の率（0.2%）'),
  ('land_tax_rate', '0.0022', '第4条3項(3) 賃貸料相当額の計算に使う土地課税標準額の率（0.22%）'),
  ('floor_area_unit_price', '12', '第4条3項(2) 12円 ×（総床面積㎡ ÷ 3.3）'),
  ('prorate_first_month', 'false', '規程に定めのない運用ルール。初月の入居日から月末までの日数で本人負担額を日割りするか'),
  ('deemed_rent_check_enabled', 'false', '第11条1項ただし書き（本人負担額の下限＝賃貸料相当額）のチェックを使うか。有効にすると物件ごとに建物・敷地の固定資産税課税標準額の入力が必要')
on conflict (key) do nothing;

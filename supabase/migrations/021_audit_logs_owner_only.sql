-- 監査ログの閲覧を owner のみに限定する (#34)
-- 監査ログには社員の操作履歴（誰がいつ何を変更したか）が含まれるため、閲覧は管理者（owner）だけにする。
-- 記録（INSERT）は従来どおり社員全員が行える（017 の台帳登録RPCなどからも記録される）。

drop policy if exists "company members can read audit_logs" on audit_logs;
drop policy if exists "company owners can read audit_logs" on audit_logs;
create policy "company owners can read audit_logs"
  on audit_logs for select to authenticated
  using (company_id = public.current_company_id() and public.current_user_role() = 'owner');

-- 閲覧画面で新しい順・期間で絞り込むための索引
create index if not exists audit_logs_company_created_idx on audit_logs (company_id, created_at desc);

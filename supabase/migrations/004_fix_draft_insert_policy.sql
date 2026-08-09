-- application_drafts への insert は anon ロールにしか許可していなかったため、
-- ログイン済み（authenticated）のブラウザから /apply を開いた場合に
-- RLSで弾かれていた。ログイン状態に関わらず送信できるよう public に拡張する。
drop policy if exists "anyone can submit an application draft" on application_drafts;

create policy "anyone can submit an application draft"
  on application_drafts for insert
  to public
  with check (true);

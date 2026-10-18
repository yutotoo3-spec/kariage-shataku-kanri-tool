-- 公開申請フォームを、ログイン中のブラウザからも送信できるようにする
-- これまで公開申請用のINSERTポリシーは anon（未ログイン）のみが対象だったため、
-- 担当者がログインしたまま申請フォームを開くと、担当者向けポリシー（自社の company_id のみ）で判定され、
-- 別の会社のフォームや、所属企業がまだないアカウントからの送信が RLS 違反になっていた。
-- ログイン中でも申請者としての登録を許可する。status・審査結果・負担額は 013 のトリガーで
-- サーバー側が上書きするため、ログイン中のユーザーが値を指定しても改ざんにはならない。

drop policy if exists "anyone can submit an application to an active company" on applications;
create policy "anyone can submit an application to an active company"
  on applications for insert to anon, authenticated
  with check (public.is_active_company(company_id));

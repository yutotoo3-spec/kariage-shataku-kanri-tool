-- 申請フォーム受付（application_drafts によるHR確認ワークフロー）を廃止し、
-- 公開フォーム（/apply）からの送信を直接 applications に登録する一本化フローに変更する。
-- 既存の「審査」機能（ステータス変更・差戻しコメント）で代わりに内容確認・突き返しを行う。

create policy "anyone can submit an application"
  on applications for insert
  to public
  with check (true);

-- application_drafts は使われなくなるが、過去の送信履歴として参照できるよう残す
-- （不要になった場合は別途 drop table で削除する）

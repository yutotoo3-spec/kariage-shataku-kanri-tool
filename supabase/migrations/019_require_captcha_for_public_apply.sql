-- 公開申請フォームの大量送信対策（第2段階） (#32)
-- 申請は Edge Function「submit-application」（Cloudflare Turnstile で人間か確認してから登録）経由に一本化し、
-- 画面やAPIから applications へ直接 INSERT する経路を閉じる。
--
-- ⚠️ 適用の順番：
--   1. Edge Function をデプロイし、TURNSTILE_SECRET_KEY を登録する
--   2. 新しい申請フォーム（Edge Function を呼ぶ版）を本番にデプロイする
--   3. このマイグレーションを実行する
--   順番を逆にすると、その間は申請フォームから送信できなくなる。

-- 未ログイン（013）・ログイン中（015）の公開申請用 INSERT ポリシーを廃止する
drop policy if exists "anyone can submit an application to an active company" on applications;

-- 列単位の INSERT 権限（013）も取り消す（ポリシーがなくなったため不要。多層防御として権限レベルでも禁止する）
revoke insert on applications from anon;

-- 社員（authenticated）は「company members can read/write applications」ポリシーで自社分のみ操作できる（従来どおり）。
-- Edge Function は service_role で登録するため、RLS の対象外。件数上限（018）と値の再計算（013/017）のトリガーは引き続き適用される。

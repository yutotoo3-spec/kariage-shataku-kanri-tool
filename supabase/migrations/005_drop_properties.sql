-- 物件台帳機能を廃止（入居予定者からの申請受付→承認のみのフローに一本化したため）
alter table tenancies drop column if exists property_id;

drop table if exists property_documents;
drop table if exists properties;

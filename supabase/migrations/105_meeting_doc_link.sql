-- ============================================
-- 105: Meeting → Google Docs link columns
-- ============================================
-- Allows storing a link to an archived Google Doc meeting note so the
-- meeting detail page can show "📄 Google Docs에서 열기" after conclusion.

alter table meetings add column if not exists google_doc_url text;
alter table meetings add column if not exists google_doc_id text;

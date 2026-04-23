-- 114_notes_backlinks.sql
-- Adds backlinks jsonb column to personal_notes for [[Note Title]] wikilink support.

alter table personal_notes add column if not exists backlinks jsonb default '[]'::jsonb;
create index if not exists idx_personal_notes_backlinks_gin on personal_notes using gin(backlinks);

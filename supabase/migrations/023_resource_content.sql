-- 023: Add editable content field to resource tables
-- Allows template resources to store markdown content directly in the DB
-- so users can edit them inline instead of viewing static pages.

-- project_resources: add content column
ALTER TABLE project_resources ADD COLUMN IF NOT EXISTS content text;

-- file_attachments: add content column
ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS content text;

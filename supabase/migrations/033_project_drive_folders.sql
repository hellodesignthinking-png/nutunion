-- Project (Bolt) Google Drive folder columns
-- Mirrors group pattern: main folder + stage-based subfolders

ALTER TABLE projects ADD COLUMN IF NOT EXISTS google_drive_folder_id text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS google_drive_planning_folder_id text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS google_drive_interim_folder_id text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS google_drive_evidence_folder_id text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS google_drive_final_folder_id text;

-- Index for quick folder lookup
CREATE INDEX IF NOT EXISTS idx_projects_drive_folder ON projects(google_drive_folder_id) WHERE google_drive_folder_id IS NOT NULL;

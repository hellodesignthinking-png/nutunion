-- Migration 110: meetings.notes column for live note-taking during active meetings.
-- Additive only. Safe to run multiple times.

alter table meetings add column if not exists notes text;

comment on column meetings.notes is
  'Live notes taken during the meeting (auto-saved). Cross-validated with audio by meeting-summary AI.';

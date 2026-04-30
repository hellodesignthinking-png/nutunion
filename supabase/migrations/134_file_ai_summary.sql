-- ============================================
-- Migration 134: 파일 자동 AI 요약
-- ============================================
-- 자료실 파일 업로드 시 AI 가 3줄 요약 + 예상 Q&A 를 생성해 카드 옆에 표시.

alter table public.file_attachments
  add column if not exists ai_summary jsonb;
alter table public.file_attachments
  add column if not exists ai_summary_generated_at timestamptz;

alter table public.project_resources
  add column if not exists ai_summary jsonb;
alter table public.project_resources
  add column if not exists ai_summary_generated_at timestamptz;

-- jsonb 형식: { "summary": ["...", "...", "..."], "qa": [{"q":"...","a":"..."}], "model_used": "..." }

notify pgrst, 'reload schema';

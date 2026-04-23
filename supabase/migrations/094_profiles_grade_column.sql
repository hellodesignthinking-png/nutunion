-- 094_profiles_grade_column.sql
-- profiles.grade / can_create_project 컬럼 추가.
--
-- 증상: Admin 에서 유저 등급을 변경해도 새로고침하면 "실버" 로 돌아감.
-- 원인: DB 에 grade 컬럼이 없어서 update-user API 가 fallback 으로 빠져 저장 실패.
--       UI 는 u.grade=null → can_create_crew=true 기반 "silver" fallback 표시.
--
-- 해결: 두 컬럼 추가 → update 성공 → 저장된 값 그대로 표시.
-- 안전: IF NOT EXISTS 로 멱등 (재실행 안전).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS grade              text,
  ADD COLUMN IF NOT EXISTS can_create_project boolean NOT NULL DEFAULT false;

-- 기존 유저 중 can_create_crew=true 인 사람을 기본 silver 로 백필 (이미 grade 있으면 유지)
UPDATE public.profiles
   SET grade = 'silver'
 WHERE grade IS NULL
   AND can_create_crew = true
   AND role <> 'admin';

-- admin 은 vip
UPDATE public.profiles
   SET grade = 'vip'
 WHERE role = 'admin' AND grade IS NULL;

-- 나머지는 bronze
UPDATE public.profiles
   SET grade = 'bronze'
 WHERE grade IS NULL;

-- grade 필터링 인덱스 (admin users page 용)
CREATE INDEX IF NOT EXISTS idx_profiles_grade ON public.profiles(grade);

-- PostgREST 스키마 캐시 리로드
NOTIFY pgrst, 'reload schema';

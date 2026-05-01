-- 마인드맵 노드 위치 영속 — 다기기 동기화. 기존 localStorage 는 캐시로 사용.
-- 향후 다른 대시보드 선호도(보기 모드, 필터 프리셋 등)도 같은 컬럼에.

alter table profiles
  add column if not exists dashboard_settings jsonb not null default '{}'::jsonb;

comment on column profiles.dashboard_settings is
  'Dashboard preferences. Shape: { mindmap_layout: { [nodeId]: {x,y} }, mindmap_view_mode: "radial"|"timeline" }';

-- RLS — 자기 행만 읽고 쓰기. profiles 의 기존 정책이 이미 적용되어 별도 정책 불필요.
-- 확인용 주석: profiles 의 RLS 가 user.id = auth.uid() 로 self-only 인지 검증할 것.

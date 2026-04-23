-- 102_profile_personal.sql
-- 바이오리듬/사주/날씨 개인화용 개인정보 필드 추가.
-- 본인만 읽을 수 있도록 기존 profiles RLS 에 의존 (id = auth.uid() 셀프 업데이트 허용).

alter table profiles add column if not exists birth_date date;
alter table profiles add column if not exists birth_time time;           -- 사주용 출생 시각 (선택)
alter table profiles add column if not exists birth_calendar text default 'solar'
  check (birth_calendar in ('solar','lunar'));
alter table profiles add column if not exists gender text
  check (gender in ('male','female','other') or gender is null);
alter table profiles add column if not exists address_region text;       -- "서울 강남구" 등 (날씨 개인화용)

comment on column profiles.birth_date       is '생년월일 (바이오리듬/사주/나이 개인화)';
comment on column profiles.birth_time       is '출생 시각 (사주 정확도 향상용, 선택 필드)';
comment on column profiles.birth_calendar   is 'solar(양력) | lunar(음력)';
comment on column profiles.gender           is 'male | female | other | null';
comment on column profiles.address_region   is '거주 지역 (날씨/이벤트 추천 개인화)';

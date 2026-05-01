-- L5 확장 — 블록 타입 추가: table / audio / embed
-- 기존 CHECK constraint 교체.

-- check 제약 재정의 — 기존 제약 이름은 자동생성이므로 dynamic drop
do $$
declare con_name text;
begin
  select conname into con_name
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  where t.relname = 'space_page_blocks'
    and pg_get_constraintdef(c.oid) like '%type = ANY%'
  limit 1;
  if con_name is not null then
    execute format('alter table public.space_page_blocks drop constraint %I', con_name);
  end if;
end $$;

alter table public.space_page_blocks
  add constraint space_page_blocks_type_check
  check (type in (
    -- 기존 11종
    'text','h1','h2','h3','bullet','numbered','todo','code','divider','quote','callout',
    -- 신규 3종
    'table','audio','embed'
  ));

-- type / data 사용 패턴:
--   table:  data = { columns: [{name,width?},...], rows: [[cell, cell, ...], ...] }
--           content 은 비어있음.
--   audio:  data = { url: string, duration_sec?: number, mime?: string }
--           content 은 caption 텍스트 (선택).
--   embed:  data = { url, kind: "youtube"|"drive"|"figma"|"link", title? }
--           content 은 캡션.
--
-- 스타일 커스텀 — 모든 type 에서:
--   data.color : "default"|"red"|"amber"|"emerald"|"sky"|"violet"|"pink"
--   data.align : "left"|"center"|"right"  (h1-3, text, quote, callout 만)

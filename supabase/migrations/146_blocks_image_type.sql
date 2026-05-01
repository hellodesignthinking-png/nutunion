-- 이미지 블록 추가 — type='image', data: { url, alt?, width? }
-- (paste/drop/file input 으로 base64 또는 URL 저장)

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
    'text','h1','h2','h3','bullet','numbered','todo','code','divider','quote','callout',
    'table','audio','embed',
    -- 신규
    'image'
  ));

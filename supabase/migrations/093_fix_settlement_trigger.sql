-- 093_fix_settlement_trigger.sql
-- 091/092 의 trigger 에서 "ERROR: 42P01: relation \"v_room_id\" does not exist" 발생.
--
-- 원인: Supabase SQL parser 가 PL/pgSQL 변수의 `SELECT ... INTO v_room_id` 를
--       `SELECT ... INTO TABLE v_room_id` (SELECT INTO TABLE 문) 로 오해석.
-- 해결: assignment 문법 `v_room_id := (SELECT ...)` 사용.
--
-- 이 파일은 091/092 가 이미 실행된 환경에서도 **안전하게 재실행 가능** (CREATE OR REPLACE).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'settlements'
  ) THEN

    CREATE OR REPLACE FUNCTION public.trg_settlement_chat_notice() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER AS $fn$
    DECLARE
      v_room_id      uuid;
      v_nick         text;
      v_payload      text;
      v_text         text;
      v_receipt_url  text := NULL;
      v_memo         text := NULL;
    BEGIN
      IF NEW.status IS DISTINCT FROM 'pending' THEN
        RETURN NEW;
      END IF;

      -- 방 찾기 — assignment 패턴 (SELECT INTO 오해석 회피)
      IF NEW.group_id IS NOT NULL THEN
        v_room_id := (
          SELECT id FROM public.chat_rooms
           WHERE type = 'nut' AND group_id = NEW.group_id
           LIMIT 1
        );
      ELSIF NEW.project_id IS NOT NULL THEN
        v_room_id := (
          SELECT id FROM public.chat_rooms
           WHERE type = 'bolt' AND project_id = NEW.project_id
           LIMIT 1
        );
      END IF;

      IF v_room_id IS NULL THEN
        RETURN NEW;
      END IF;

      v_nick := (
        SELECT COALESCE(nickname, '멤버')
          FROM public.profiles
         WHERE id = NEW.requester_id
      );

      -- settlements.receipt_url / memo 는 환경마다 컬럼 유무 다름 → exception 으로 방어
      BEGIN
        v_receipt_url := NEW.receipt_url;
      EXCEPTION WHEN undefined_column THEN
        v_receipt_url := NULL;
      END;
      BEGIN
        v_memo := NEW.memo;
      EXCEPTION WHEN undefined_column THEN
        v_memo := NULL;
      END;

      v_payload := '__NU_ACTION__' || json_build_object(
        'type',           'payment_pending',
        'settlement_id',  NEW.id,
        'group_id',       NEW.group_id,
        'project_id',     NEW.project_id,
        'amount',         NEW.amount,
        'currency',       COALESCE(NEW.currency, 'KRW'),
        'requester_nick', v_nick,
        'receipt_url',    v_receipt_url,
        'memo',           v_memo
      )::text;

      v_text := v_nick || '님이 정산을 요청했어요 — 승인 대기 중';

      INSERT INTO public.chat_messages (room_id, sender_id, content, is_system)
      VALUES (v_room_id, NEW.requester_id, v_payload || E'\n' || v_text, true);

      RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS settlements_chat_notice ON public.settlements;
    CREATE TRIGGER settlements_chat_notice
      AFTER INSERT ON public.settlements
      FOR EACH ROW EXECUTE FUNCTION public.trg_settlement_chat_notice();

  END IF;
END $$;

-- PostgREST 스키마 캐시 리로드 (trigger 변경이 즉시 반영되도록)
NOTIFY pgrst, 'reload schema';

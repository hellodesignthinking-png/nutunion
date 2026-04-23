-- 092_poll_close_announcement.sql
-- 1) polls.closed_at — 자동 종료 감지용
-- 2) polls.result_posted — 결과 공지 중복 방지
-- 3) announcement severity 는 content payload 에만 있으므로 DB 변경 불필요.

ALTER TABLE IF EXISTS public.polls
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS result_posted boolean NOT NULL DEFAULT false;

-- 만료된 poll 을 찾기 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_polls_expiring
  ON public.polls (closes_at)
  WHERE closed_at IS NULL AND closes_at IS NOT NULL;

-- ── settlement 트리거 재정의 — receipt_url 포함 ─────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='settlements') THEN

    CREATE OR REPLACE FUNCTION public.trg_settlement_chat_notice() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER AS $TRIG$
    DECLARE
      v_room_id      uuid;
      v_nick         text;
      v_payload      text;
      v_text         text;
      v_receipt_url  text := NULL;
      v_receipt_mime text := NULL;
      v_memo         text := NULL;
    BEGIN
      IF NEW.status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;

      IF NEW.group_id IS NOT NULL THEN
        SELECT id INTO v_room_id FROM public.chat_rooms
         WHERE type='nut' AND group_id = NEW.group_id LIMIT 1;
      ELSIF NEW.project_id IS NOT NULL THEN
        SELECT id INTO v_room_id FROM public.chat_rooms
         WHERE type='bolt' AND project_id = NEW.project_id LIMIT 1;
      END IF;
      IF v_room_id IS NULL THEN RETURN NEW; END IF;

      SELECT COALESCE(nickname, '멤버') INTO v_nick
        FROM public.profiles WHERE id = NEW.requester_id;

      -- settlements 테이블의 스키마에 따라 receipt_url / memo 컬럼이 있을 수 있음 (동적 추출)
      BEGIN
        v_receipt_url := NEW.receipt_url;
      EXCEPTION WHEN undefined_column THEN v_receipt_url := NULL; END;
      BEGIN
        v_memo := NEW.memo;
      EXCEPTION WHEN undefined_column THEN v_memo := NULL; END;

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
    $TRIG$;

    DROP TRIGGER IF EXISTS settlements_chat_notice ON public.settlements;
    CREATE TRIGGER settlements_chat_notice
      AFTER INSERT ON public.settlements
      FOR EACH ROW EXECUTE FUNCTION public.trg_settlement_chat_notice();

  END IF;
END $$;

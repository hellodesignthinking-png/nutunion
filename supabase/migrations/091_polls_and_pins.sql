-- 091_polls_and_pins.sql
-- Poll 영구 저장 + 채팅 고정(pin) 기능.
-- 모두 IF NOT EXISTS 패턴으로 안전 재실행 가능.

-- ── 1) polls 테이블 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.polls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  message_id    uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  created_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  question      text NOT NULL,
  options       jsonb NOT NULL,  -- 예: ["A","B","C"]
  allow_multi   boolean NOT NULL DEFAULT false,
  closes_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_polls_room ON public.polls(room_id);
CREATE INDEX IF NOT EXISTS idx_polls_message ON public.polls(message_id);

-- ── 2) poll_votes 테이블 ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id     uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_idx  int  NOT NULL,
  voted_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id, option_idx)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON public.poll_votes(poll_id);

-- ── 3) chat_pins — 채팅방 고정 메시지 ─────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_pins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  message_id  uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  pinned_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pinned_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_pins_room ON public.chat_pins(room_id);

-- ── 4) RLS — 방 멤버만 read/write ───────────────────────────
ALTER TABLE public.polls        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_pins    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS polls_read_members   ON public.polls;
DROP POLICY IF EXISTS polls_insert_members ON public.polls;
DROP POLICY IF EXISTS poll_votes_read      ON public.poll_votes;
DROP POLICY IF EXISTS poll_votes_insert    ON public.poll_votes;
DROP POLICY IF EXISTS poll_votes_delete    ON public.poll_votes;
DROP POLICY IF EXISTS pins_read_members    ON public.chat_pins;
DROP POLICY IF EXISTS pins_insert_members  ON public.chat_pins;
DROP POLICY IF EXISTS pins_delete_members  ON public.chat_pins;

CREATE POLICY polls_read_members ON public.polls
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.chat_members m WHERE m.room_id = polls.room_id AND m.user_id = auth.uid())
  );

CREATE POLICY polls_insert_members ON public.polls
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.chat_members m WHERE m.room_id = polls.room_id AND m.user_id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY poll_votes_read ON public.poll_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.chat_members m ON m.room_id = p.room_id
      WHERE p.id = poll_votes.poll_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY poll_votes_insert ON public.poll_votes
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.chat_members m ON m.room_id = p.room_id
      WHERE p.id = poll_votes.poll_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY poll_votes_delete ON public.poll_votes
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY pins_read_members ON public.chat_pins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.chat_members m WHERE m.room_id = chat_pins.room_id AND m.user_id = auth.uid())
  );

CREATE POLICY pins_insert_members ON public.chat_pins
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.chat_members m WHERE m.room_id = chat_pins.room_id AND m.user_id = auth.uid())
    AND pinned_by = auth.uid()
  );

CREATE POLICY pins_delete_members ON public.chat_pins
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.chat_members m WHERE m.room_id = chat_pins.room_id AND m.user_id = auth.uid())
  );

-- ── 5) Realtime publication ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='poll_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chat_pins'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_pins;
  END IF;
END $$;

-- ── 6) Settlement insert 자동 트리거 → payment_pending 시스템 메시지 ──
-- 기존 settlements 테이블이 존재할 때만 트리거 등록 (미존재 환경 대응)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='settlements') THEN

    CREATE OR REPLACE FUNCTION public.trg_settlement_chat_notice() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER AS $TRIG$
    DECLARE
      v_room_id    uuid;
      v_nick       text;
      v_payload    text;
      v_text       text;
    BEGIN
      IF NEW.status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;

      -- 방 찾기 (group_id 또는 project_id)
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

      -- payment_pending action payload 인코딩
      v_payload := '__NU_ACTION__' || json_build_object(
        'type',           'payment_pending',
        'settlement_id',  NEW.id,
        'group_id',       NEW.group_id,
        'project_id',     NEW.project_id,
        'amount',         NEW.amount,
        'currency',       COALESCE(NEW.currency, 'KRW'),
        'requester_nick', v_nick
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

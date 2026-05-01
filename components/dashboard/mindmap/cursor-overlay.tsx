"use client";

import { useEffect, useRef, useState } from "react";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

/**
 * 마인드맵 위에 떠 있는 다른 탭/기기의 커서.
 *
 * 채널 키: mindmap-cursor:${userId} — Genesis 대시보드는 개인 공간이므로 룸은 사용자별.
 * 다인 협업 마인드맵(향후 너트/볼트 단위)으로 확장될 때는 키를 그룹·프로젝트 id 로 변경.
 *
 * 좌표 시스템: react-flow 가 적용한 transform 으로 canvas → screen 매핑이 결정되므로
 * 컨테이너의 BBox + react-flow viewport transform 을 같이 broadcast 해 다른 클라이언트가
 * 같은 노드 위에 자기 커서를 정확히 띄울 수 있게 한다.
 *
 * 단순화: 좌표는 컨테이너 좌상단 기준 (clientX - rect.left). 양 탭이 같은 transform 을 쓸
 * 때만 정확하지만, react-flow 는 fitView 로 양쪽이 비슷한 zoom 으로 시작하므로
 * 평균적인 케이스에서 충분히 직관적. 정밀이 필요해지면 viewport state 도 broadcast.
 */

const THROTTLE_MS = 50;
const STALE_AFTER_MS = 5_000;

type Pos = { x: number; y: number };
type RemoteCursor = { id: string; label: string; x: number; y: number; updatedAt: number };

interface Props {
  /** Supabase auth user id — 룸 키. 없으면 비활성. */
  userId?: string;
  /** 자기 닉네임 — broadcast 라벨. */
  nickname: string;
  /** react-flow 컨테이너 ref. mousemove 좌표를 BBox 기준으로 변환. */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

// 탭마다 고유 id — 같은 사용자라도 다른 탭은 다른 커서로 보이게
const TAB_ID = typeof window !== "undefined"
  ? `${Math.random().toString(36).slice(2, 8)}`
  : "ssr";

export function CursorOverlay({ userId, nickname, containerRef }: Props) {
  const [remotes, setRemotes] = useState<Record<string, RemoteCursor>>({});
  const lastSendRef = useRef(0);

  // mousemove → throttled broadcast
  useEffect(() => {
    if (!userId || !containerRef.current) return;
    const supa = createBrowserClient();
    const channel = supa.channel(`mindmap-cursor:${userId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const p = payload as RemoteCursor;
        if (!p?.id || p.id === TAB_ID) return;
        setRemotes((prev) => ({ ...prev, [p.id]: { ...p, updatedAt: Date.now() } }));
      })
      .on("broadcast", { event: "leave" }, ({ payload }) => {
        const p = payload as { id: string };
        setRemotes((prev) => {
          const next = { ...prev };
          delete next[p.id];
          return next;
        });
      })
      .subscribe();

    const el = containerRef.current;
    function onMove(e: MouseEvent) {
      const now = Date.now();
      if (now - lastSendRef.current < THROTTLE_MS) return;
      lastSendRef.current = now;
      const rect = el.getBoundingClientRect();
      const pos: Pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      void channel.send({
        type: "broadcast",
        event: "cursor",
        payload: { id: TAB_ID, label: nickname, x: pos.x, y: pos.y, updatedAt: now },
      });
    }
    function onLeave() {
      void channel.send({
        type: "broadcast",
        event: "leave",
        payload: { id: TAB_ID },
      });
    }

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    window.addEventListener("beforeunload", onLeave);

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("beforeunload", onLeave);
      void channel.send({ type: "broadcast", event: "leave", payload: { id: TAB_ID } }).catch(() => undefined);
      void supa.removeChannel(channel);
    };
  }, [userId, nickname, containerRef]);

  // stale GC — 5초간 갱신 없으면 사라지게
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setRemotes((prev) => {
        let changed = false;
        const next: typeof prev = {};
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.updatedAt < STALE_AFTER_MS) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1500);
    return () => clearInterval(t);
  }, []);

  if (!userId) return null;
  const list = Object.values(remotes);
  if (list.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
      {list.map((c) => (
        <div
          key={c.id}
          style={{ transform: `translate(${c.x}px, ${c.y}px)` }}
          className="absolute top-0 left-0 transition-transform duration-75 ease-out"
        >
          {/* SVG 화살표 — react-flow 위에 떠야 하므로 inline */}
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              d="M0 0 L0 14 L4 11 L7 17 L9 16 L6 10 L11 10 Z"
              fill="#FF3D88"
              stroke="#0D0F14"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          <div className="ml-3 -mt-1 inline-block bg-nu-pink text-white border-[2px] border-nu-ink px-1.5 py-0.5 font-mono-nu text-[9px] uppercase tracking-widest shadow-[2px_2px_0_0_#0D0F14]">
            {c.label || "익명"}
          </div>
        </div>
      ))}
    </div>
  );
}

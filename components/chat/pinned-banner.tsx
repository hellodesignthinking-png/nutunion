"use client";

/**
 * PinnedBanner — 채팅방 상단 고정 영역.
 * 가장 최근 pinned 메시지 표시 + 여러 건이면 "외 N개" 인디케이터.
 * 탭하면 드롭다운으로 전체 목록 + 각 항목의 원 메시지로 스크롤.
 */

import { useCallback, useEffect, useState } from "react";
import { Pin, PinOff, ChevronDown, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { decodeAction } from "@/lib/chat/chat-actions";
import { toast } from "sonner";

interface PinItem {
  id: string;
  message_id: string;
  pinned_at: string;
  message?: {
    id: string;
    content: string | null;
    is_system: boolean;
    created_at: string;
    sender?: { id: string; nickname: string } | null;
  };
}

export function PinnedBanner({ roomId }: { roomId: string }) {
  const [pins, setPins] = useState<PinItem[]>([]);
  const [open, setOpen] = useState(false);
  const [migration, setMigration] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/pins`, { cache: "no-store" });
      const j = await res.json();
      if (j.migration_pending) setMigration(true);
      setPins(j.pins || []);
    } catch {}
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime 구독 — pin 추가/삭제 시 자동 갱신
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`pins-${roomId}-${Math.random().toString(36).slice(2, 6)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_pins", filter: `room_id=eq.${roomId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomId, load]);

  if (migration || pins.length === 0) return null;

  const top = pins[0];

  function displayFor(p: PinItem): { title: string; subtitle: string; severity: "info" | "warning" | "urgent" } {
    const m = p.message;
    if (!m) return { title: "고정 메시지", subtitle: "", severity: "info" };
    const content = m.content || "";
    const decoded = decodeAction(content);
    const body = decoded ? decoded.displayText : content;
    const author = m.sender?.nickname || "";
    const severity =
      decoded?.action.type === "announcement" && (decoded.action as any).severity
        ? ((decoded.action as any).severity as "info" | "warning" | "urgent")
        : "info";
    return {
      title: body.slice(0, 80).replace(/\n/g, " "),
      subtitle: author ? `${author}` : "",
      severity,
    };
  }

  async function unpin(messageId: string) {
    try {
      const res = await fetch(
        `/api/chat/rooms/${roomId}/pins?message_id=${encodeURIComponent(messageId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error((await res.json()).error || "실패");
      toast.success("고정 해제됨");
    } catch (e: any) {
      toast.error(e.message || "실패");
    }
  }

  const topDisplay = displayFor(top);
  const bannerTheme = {
    info: { bg: "bg-nu-pink/5", border: "border-nu-pink/20", text: "text-nu-pink", label: "고정" },
    warning: { bg: "bg-amber-100", border: "border-amber-500/40", text: "text-amber-700", label: "⚠ 중요" },
    urgent: { bg: "bg-red-100 animate-pulse", border: "border-red-500/40", text: "text-red-700", label: "🚨 긴급" },
  }[topDisplay.severity];

  return (
    <div className={`${bannerTheme.bg} border-b ${bannerTheme.border} px-3 py-2 shrink-0 chat-system-font`}>
      <div className="flex items-center gap-2">
        <Pin size={14} className={`${bannerTheme.text} shrink-0`} />
        <button
          onClick={() => {
            document.getElementById(`msg-${top.message_id}`)?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }}
          className="flex-1 min-w-0 text-left"
        >
          <div className={`flex items-center gap-1.5 text-[10px] font-mono-nu uppercase tracking-widest ${bannerTheme.text} font-bold`}>
            <Megaphone size={10} /> {bannerTheme.label} {pins.length > 1 && <span className="text-nu-muted">· 외 {pins.length - 1}개</span>}
          </div>
          <div className="text-[12px] text-nu-ink truncate">
            {topDisplay.subtitle && <span className="font-semibold mr-1">{topDisplay.subtitle}:</span>}
            {topDisplay.title}
          </div>
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 p-1 hover:bg-nu-pink/10 rounded"
          aria-label="고정 목록"
        >
          <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-1 max-h-[280px] overflow-auto">
          {pins.map((p) => {
            const d = displayFor(p);
            return (
              <div
                key={p.id}
                className="flex items-start gap-2 px-2 py-1.5 bg-white border border-nu-ink/10 rounded-md"
              >
                <button
                  onClick={() => {
                    document.getElementById(`msg-${p.message_id}`)?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }}
                  className="flex-1 text-left min-w-0"
                >
                  {d.subtitle && (
                    <div className="text-[10px] font-mono-nu text-nu-muted">{d.subtitle}</div>
                  )}
                  <div className="text-[12px] text-nu-ink truncate">{d.title}</div>
                </button>
                <button
                  onClick={() => unpin(p.message_id)}
                  className="shrink-0 p-1 hover:bg-red-50 rounded text-red-600"
                  title="고정 해제"
                  aria-label="고정 해제"
                >
                  <PinOff size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

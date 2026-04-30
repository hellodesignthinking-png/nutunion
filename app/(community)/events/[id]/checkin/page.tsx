"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Calendar, CheckCircle2, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * QR 리덤션 페이지 — URL: /events/:id/checkin?t=TOKEN
 * QR 스캐너가 이 URL 로 열어서, 로그인 후 자동 체크인.
 */
export default function EventCheckinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-nu-paper" />}>
      <EventCheckinInner />
    </Suspense>
  );
}

function EventCheckinInner() {
  const params = useParams();
  const eventId = params.id as string;
  const sp = useSearchParams();
  const token = sp.get("t") || "";

  const [status, setStatus] = useState<"loading" | "info" | "need_login" | "success" | "already" | "error">("loading");
  const [error, setError] = useState<string>("");
  const [meta, setMeta] = useState<{ title: string; start_at: string; end_at: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) {
        setError("잘못된 체크인 링크입니다");
        setStatus("error");
        return;
      }
      // Auth 확인
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      // 이벤트 정보 조회
      try {
        const res = await fetch(`/api/events/${eventId}/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "info", token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "체크인 정보 조회 실패");
        setMeta(data);

        if (!user) {
          setStatus("need_login");
          return;
        }

        // 바로 redeem
        const redeemRes = await fetch(`/api/events/${eventId}/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "redeem", token }),
        });
        const redeemData = await redeemRes.json();
        if (!redeemRes.ok) {
          setError(redeemData.error || "체크인 실패");
          setStatus("error");
          return;
        }
        setStatus(redeemData.already ? "already" : "success");
      } catch (e: any) {
        setError(e.message || "오류 발생");
        setStatus("error");
      }
    })();
  }, [eventId, token]);

  return (
    <div className="min-h-screen bg-nu-paper flex items-center justify-center p-4">
      <div className="w-full max-w-md border-[2.5px] border-nu-ink bg-nu-paper shadow-[6px_6px_0_0_rgba(13,13,13,0.3)]">
        <header className="px-5 py-4 border-b-[2px] border-nu-ink bg-gradient-to-r from-nu-pink/10 to-nu-blue/10">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink font-bold">QR Check-in</div>
          <h1 className="font-head text-xl font-extrabold text-nu-ink">nutunion · 이벤트 출석</h1>
        </header>

        <div className="p-6">
          {status === "loading" && (
            <div className="text-center py-6">
              <Loader2 size={32} className="animate-spin mx-auto text-nu-pink mb-3" />
              <p className="text-sm text-nu-graphite">확인 중...</p>
            </div>
          )}

          {meta && (status === "info" || status === "need_login" || status === "success" || status === "already") && (
            <div className="mb-4 border-l-[3px] border-nu-pink bg-nu-pink/5 p-3">
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink font-bold mb-1">Event</div>
              <div className="font-bold text-[14px] text-nu-ink">{meta.title}</div>
              <div className="font-mono-nu text-[11px] text-nu-graphite mt-1 flex items-center gap-1">
                <Calendar size={10} />
                {new Date(meta.start_at).toLocaleString("ko", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          )}

          {status === "need_login" && (
            <div className="text-center py-4">
              <AlertTriangle size={24} className="mx-auto text-nu-amber mb-2" />
              <p className="text-sm text-nu-ink mb-3">체크인하려면 로그인이 필요합니다</p>
              <Link
                href={`/login?redirectTo=${encodeURIComponent(`/events/${eventId}/checkin?t=${token}`)}`}
                className="inline-flex items-center gap-1 font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 no-underline"
              >
                로그인 <ArrowRight size={11} />
              </Link>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 border-[3px] border-green-500 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <h2 className="font-head text-lg font-extrabold text-nu-ink">체크인 완료!</h2>
              <p className="text-[12px] text-nu-graphite mt-1">
                강성 <span className="text-nu-pink font-bold">+5</span> 획득 🎉
              </p>
              <Link
                href="/dashboard"
                className="mt-4 inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline"
              >
                대시보드로 이동 <ArrowRight size={10} />
              </Link>
            </div>
          )}

          {status === "already" && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-nu-blue/10 border-[2px] border-nu-blue flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={24} className="text-nu-blue" />
              </div>
              <h2 className="font-head text-base font-extrabold text-nu-ink">이미 체크인됨</h2>
              <p className="text-[12px] text-nu-graphite mt-1">이 이벤트에 이미 참석으로 기록됐습니다</p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-red-100 border-[2px] border-red-500 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <h2 className="font-head text-base font-extrabold text-nu-ink">체크인 실패</h2>
              <p className="text-[12px] text-red-700 mt-1">{error || "알 수 없는 오류"}</p>
              <Link href="/dashboard" className="mt-3 inline-block font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
                ← 대시보드
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

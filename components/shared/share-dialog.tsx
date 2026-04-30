"use client";

import { useEffect, useState } from "react";
import { Share2, Copy, Check, X, MessageCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * 공유 다이얼로그 — 너트/볼트 등 컨텐츠를 소셜로 공유.
 *
 * 채널: 카카오톡 / X(트위터) / Facebook / LinkedIn / Threads / 복사 / 시스템 공유 시트.
 * 카카오톡: 공식 SDK 가 등록 안 됐으면 https://sharer.kakao.com fallback.
 * 시스템 공유: 모바일 navigator.share 우선 (기본 카카오/메시지 등 네이티브 시트).
 */

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;        // "제로싸이트 너트"
  description: string;  // 한 줄 소개
  url: string;          // https://nutunion.co.kr/groups/...
  kind?: "너트" | "볼트";
}

export function ShareDialog({ open, onClose, title, description, url, kind = "너트" }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const inviteMsg = `[nutunion ${kind}] ${title}\n${description}\n\n참여하기 → ${url}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("링크 복사됨");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("복사 실패 — 수동으로 복사해주세요");
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteMsg);
      toast.success("초대 메시지 복사됨 — 카톡/메시지에 붙여넣기");
    } catch {
      toast.error("복사 실패");
    }
  }

  function nativeShare() {
    const sharer = (navigator as any).share;
    if (typeof sharer === "function") {
      sharer.call(navigator, { title, text: description, url }).catch(() => {});
    } else {
      copyLink();
      toast.info("이 기기는 공유 시트 미지원 — 링크가 복사됐어요");
    }
  }

  function shareKakao() {
    // 1) Kakao JS SDK — KakaoSdkLoader 가 layout.tsx 에서 init() 완료 (NEXT_PUBLIC_KAKAO_JS_KEY 있을 때)
    const kakao = (window as any).Kakao;
    if (kakao?.Share?.sendDefault) {
      try {
        kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title,
            description,
            imageUrl: `${window.location.origin}/api/og${getOgPath()}`,
            link: { mobileWebUrl: url, webUrl: url },
          },
          buttons: [
            { title: `${kind} 보기`, link: { mobileWebUrl: url, webUrl: url } },
          ],
        });
        return;
      } catch (e) {
        // SDK init 실패 등 → 폴백
        console.warn("[Kakao Share] sendDefault failed:", e);
      }
    }
    // 2) Fallback — 초대 메시지 복사 + 안내
    copyInvite();
    toast.info("카톡 SDK 미준비 — 메시지 복사됨, 카톡에 붙여넣어주세요");
  }

  function shareX() {
    const text = `[nutunion ${kind}] ${title} — ${description}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer,width=600,height=500",
    );
  }

  function shareFacebook() {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer,width=600,height=500",
    );
  }

  function shareLinkedIn() {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer,width=600,height=500",
    );
  }

  function shareThreads() {
    const text = `${title}\n${description}\n${url}`;
    window.open(
      `https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function getOgPath(): string {
    // url 에서 /groups/{id} 또는 /projects/{id} 추출 → /api/og/{kind}/{id}
    try {
      const u = new URL(url);
      const m = u.pathname.match(/\/(groups|projects)\/([^/]+)/);
      if (m) return `/${m[1] === "groups" ? "group" : "project"}/${m[2]}`;
    } catch {}
    return "";
  }

  const buttons: Array<{ key: string; label: string; emoji: string; action: () => void; bg: string }> = [
    { key: "kakao", label: "카카오톡", emoji: "💬", action: shareKakao, bg: "bg-yellow-300 hover:bg-yellow-400 text-nu-ink" },
    { key: "x", label: "X(트위터)", emoji: "𝕏", action: shareX, bg: "bg-nu-ink text-white hover:bg-black" },
    { key: "facebook", label: "Facebook", emoji: "f", action: shareFacebook, bg: "bg-blue-600 text-white hover:bg-blue-700" },
    { key: "linkedin", label: "LinkedIn", emoji: "in", action: shareLinkedIn, bg: "bg-sky-700 text-white hover:bg-sky-800" },
    { key: "threads", label: "Threads", emoji: "@", action: shareThreads, bg: "bg-nu-ink text-white hover:bg-zinc-800" },
    { key: "native", label: "기기 공유", emoji: "📱", action: nativeShare, bg: "bg-nu-cream text-nu-ink hover:bg-nu-cream/80 border-[2px] border-nu-ink" },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-dialog-title"
      className="fixed inset-0 z-[200] bg-nu-ink/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b-[3px] border-nu-ink px-5 py-4 flex items-center justify-between bg-nu-cream/40">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-nu-pink" />
            <h2 id="share-dialog-title" className="font-head text-base font-extrabold text-nu-ink">
              {kind} 공유하기
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 hover:bg-nu-ink/10 rounded-sm focus:outline-none focus:ring-2 focus:ring-nu-pink"
          >
            <X size={16} />
          </button>
        </div>

        {/* Preview */}
        <div className="px-5 py-4 bg-white border-b-[3px] border-nu-ink/10">
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1.5">미리보기</p>
          <p className="font-bold text-sm text-nu-ink line-clamp-1">{title}</p>
          <p className="text-xs text-nu-muted line-clamp-2 mt-0.5">{description}</p>
          <p className="font-mono-nu text-[10px] text-nu-pink/80 mt-2 break-all">{url}</p>
        </div>

        {/* Quick actions row */}
        <div className="px-5 py-4 grid grid-cols-2 gap-2 border-b-[3px] border-nu-ink/10">
          <button
            onClick={copyLink}
            className="flex items-center justify-center gap-2 px-3 py-2.5 border-[2px] border-nu-ink bg-nu-paper hover:bg-nu-ink hover:text-nu-paper transition-colors text-sm font-bold focus:outline-none focus:ring-2 focus:ring-nu-pink"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "복사됨" : "링크 복사"}
          </button>
          <button
            onClick={copyInvite}
            className="flex items-center justify-center gap-2 px-3 py-2.5 border-[2px] border-nu-ink bg-nu-pink text-white hover:bg-nu-pink/90 transition-colors text-sm font-bold focus:outline-none focus:ring-2 focus:ring-nu-pink"
          >
            <MessageCircle size={14} />
            초대 메시지 복사
          </button>
        </div>

        {/* Social buttons */}
        <div className="px-5 py-4">
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">소셜로 공유</p>
          <div className="grid grid-cols-3 gap-2">
            {buttons.map((b) => (
              <button
                key={b.key}
                onClick={b.action}
                className={`flex flex-col items-center justify-center gap-1 py-3 transition-colors text-xs font-bold focus:outline-none focus:ring-2 focus:ring-nu-pink ${b.bg}`}
              >
                <span className="text-base font-black">{b.emoji}</span>
                <span>{b.label}</span>
              </button>
            ))}
          </div>
          <p className="font-mono-nu text-[10px] text-nu-muted/70 mt-3">
            카카오톡: 모바일에서 공식 시트 자동 호출 · 데스크톱은 초대 메시지 복사
          </p>
        </div>
      </div>
    </div>
  );
}

/** 트리거 버튼 — 헤더에 배치하기 좋은 컴팩트 버전. */
export function ShareButton({ title, description, url, kind = "너트", className = "" }: { title: string; description: string; url: string; kind?: "너트" | "볼트"; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-2 border-[2px] border-nu-ink bg-nu-paper hover:bg-nu-ink hover:text-nu-paper transition-colors font-mono-nu text-[12px] font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-nu-pink ${className}`}
        aria-label={`${kind} 공유하기`}
      >
        <Share2 size={13} />
        공유
      </button>
      <ShareDialog open={open} onClose={() => setOpen(false)} title={title} description={description} url={url} kind={kind} />
    </>
  );
}

"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";

interface KakaoShareButtonProps {
  title: string;
  description: string;
  url: string;
  className?: string;
}

export function KakaoShareButton({ title, description, url, className = "" }: KakaoShareButtonProps) {
  function handleShare() {
    // Use Web Share API if available
    if (navigator.share) {
      navigator.share({ title, text: description, url }).catch(() => {});
      return;
    }

    // Fallback: copy link
    navigator.clipboard.writeText(url);
    toast.success("링크가 복사되었습니다. 카카오톡에 붙여넣기 하세요!");
  }

  return (
    <button
      onClick={handleShare}
      className={`inline-flex items-center gap-2 font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2.5 bg-[#FEE500] text-[#191919] hover:bg-[#FDD835] transition-colors ${className}`}
    >
      <Share2 size={13} />
      카카오톡 공유
    </button>
  );
}

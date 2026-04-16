"use client";

import { useEffect } from "react";
import { Brain } from "lucide-react";

export default function WikiErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Wiki page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-nu-paper flex items-center justify-center px-8">
      <div className="max-w-md w-full bg-white border-[2px] border-nu-ink p-8 text-center">
        <div className="w-16 h-16 bg-nu-pink/10 flex items-center justify-center mx-auto mb-4 -rotate-3">
          <Brain size={28} className="text-nu-pink" />
        </div>
        <h2 className="font-head text-xl font-extrabold text-nu-ink mb-2">탭 로드 오류</h2>
        <p className="text-sm text-nu-muted mb-4">
          탭 페이지를 불러오는 중 문제가 발생했습니다.
        </p>
        {error.digest && (
          <p className="font-mono-nu text-[11px] text-nu-muted bg-nu-cream/50 px-3 py-1 mb-4 break-all">
            digest: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="font-mono-nu text-[13px] font-bold uppercase tracking-widest px-6 py-3 bg-nu-ink text-white hover:bg-nu-pink transition-all"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";

export default function GroupErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Group page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-nu-paper flex items-center justify-center px-8">
      <div className="max-w-md w-full bg-nu-white border-[2px] border-nu-ink/[0.08] p-8 text-center">
        <div className="w-16 h-16 bg-nu-pink/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="font-head text-xl font-extrabold text-nu-ink mb-2">페이지 로드 오류</h2>
        <p className="text-sm text-nu-muted mb-4">
          너트 페이지를 불러오는 중 문제가 발생했습니다.
        </p>
        {error.digest && (
          <p className="font-mono-nu text-[9px] text-nu-muted bg-nu-cream/50 px-3 py-1 mb-4 break-all">
            digest: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-6 py-3 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-all"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}

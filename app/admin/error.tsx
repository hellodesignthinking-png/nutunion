"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin page error:", error.message, error.digest);
  }, [error]);

  return (
    <div className="min-h-screen bg-nu-paper flex items-center justify-center px-8">
      <div className="max-w-lg w-full bg-nu-white border-[2px] border-nu-ink/[0.08] p-10 text-center">
        <div className="w-20 h-20 bg-nu-pink/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">⚠️</span>
        </div>
        <h2 className="font-head text-2xl font-extrabold text-nu-ink mb-3">관리자 페이지 오류</h2>
        <p className="text-sm text-nu-muted mb-4 leading-relaxed">
          관리자 페이지를 불러오는 중 문제가 발생했습니다.<br />
          잠시 후 다시 시도해 주세요.
        </p>
        {error.digest && (
          <p className="font-mono-nu text-[9px] text-nu-muted bg-nu-cream/50 px-4 py-2 mb-6 break-all border border-nu-ink/5 inline-block">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-8 py-3 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-all"
          >
            다시 시도
          </button>
          <a
            href="/admin"
            className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-8 py-3 border-[2px] border-nu-ink text-nu-ink no-underline hover:bg-nu-ink hover:text-nu-paper transition-all"
          >
            관리자 홈
          </a>
        </div>
      </div>
    </div>
  );
}

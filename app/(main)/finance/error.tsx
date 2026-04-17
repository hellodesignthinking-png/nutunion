"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function FinanceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[Finance error]", error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
      <div className="text-[48px] mb-4">⚠️</div>
      <div className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-red-600 mb-2">
        ERROR
      </div>
      <h1 className="text-[24px] font-bold text-nu-ink mb-3">
        재무 데이터를 불러오는 중 오류가 발생했습니다
      </h1>
      <p className="text-[13px] text-nu-graphite mb-6">
        {error.message || "알 수 없는 오류"}
      </p>
      {error.digest && (
        <div className="font-mono-nu text-[10px] text-nu-graphite mb-6">
          Error ID: {error.digest}
        </div>
      )}
      <div className="flex justify-center gap-3 flex-wrap">
        <button
          onClick={() => reset()}
          className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-6 py-3 font-mono-nu text-[12px] uppercase tracking-widest hover:bg-nu-ink"
        >
          다시 시도
        </button>
        <Link
          href="/finance"
          className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-6 py-3 font-mono-nu text-[12px] uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper"
        >
          재무 홈으로
        </Link>
      </div>
    </div>
  );
}

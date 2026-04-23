"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Venture 페이지 전용 error boundary.
 * 하위 서버/클라이언트 컴포넌트에서 throw 된 에러를 잡아 graceful UI 표시.
 */
export default function VentureError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[venture page error]", error);
  }, [error]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="border-[2.5px] border-orange-500 bg-orange-50 p-6 shadow-[4px_4px_0_0_rgba(234,88,12,0.3)]">
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-orange-700 mb-2">
          ⚠ Venture Page Error
        </div>
        <h1 className="text-[20px] font-bold text-nu-ink mb-2">
          페이지를 불러오지 못했습니다
        </h1>
        <p className="text-[13px] text-nu-graphite leading-relaxed mb-4">
          일시적 오류가 발생했거나, 필요한 DB 마이그레이션(058/059)이 아직 적용되지 않았을 수 있습니다.
        </p>

        {error.digest && (
          <div className="font-mono-nu text-[10px] text-nu-graphite mb-4 break-all">
            digest: {error.digest}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="h-10 px-4 border-[2px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper"
          >
            다시 시도
          </button>
          <Link
            href="/projects"
            className="h-10 px-4 border-[2px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper inline-flex items-center no-underline"
          >
            볼트 목록
          </Link>
        </div>
      </div>
    </div>
  );
}

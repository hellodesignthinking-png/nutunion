"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function StaffError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Staff error:", error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <AlertTriangle size={48} className="mx-auto mb-4 text-red-400" />
      <h2 className="font-head text-xl font-extrabold text-nu-ink mb-2">
        오류가 발생했습니다
      </h2>
      <p className="text-sm text-nu-muted mb-8">
        페이지를 불러오는 중 문제가 발생했습니다. 다시 시도하거나 대시보드로 돌아가주세요.
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 font-mono-nu text-[13px] uppercase tracking-widest px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors border-none cursor-pointer"
        >
          <RefreshCw size={14} /> 다시 시도
        </button>
        <Link
          href="/staff"
          className="inline-flex items-center gap-2 font-mono-nu text-[13px] uppercase tracking-widest px-5 py-2.5 border border-nu-ink/15 text-nu-graphite no-underline hover:border-nu-ink/30 transition-colors"
        >
          <ArrowLeft size={14} /> 대시보드로
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-8">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-nu-pink/10 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={28} className="text-nu-pink" />
        </div>
        <h2 className="font-head text-2xl font-extrabold text-nu-ink mb-3">
          문제가 발생했습니다
        </h2>
        <p className="text-sm text-nu-muted mb-8">
          페이지를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="font-mono-nu text-[11px] uppercase tracking-widest px-6 py-3 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center gap-2"
          >
            <RotateCcw size={14} /> 다시 시도
          </button>
          <Link
            href="/projects"
            className="font-mono-nu text-[11px] uppercase tracking-widest px-6 py-3 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-all no-underline flex items-center gap-2"
          >
            <Home size={14} /> 볼트 목록
          </Link>
        </div>
      </div>
    </div>
  );
}

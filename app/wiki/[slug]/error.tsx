"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Brain, ArrowLeft } from "lucide-react";

export default function PublicWikiErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Public wiki error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-nu-paper flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-nu-ink flex items-center justify-center mx-auto mb-6 -rotate-3">
          <Brain size={40} className="text-white" />
        </div>
        <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-3">오류 발생</h1>
        <p className="text-sm text-nu-graphite mb-2">위키를 불러오는 중 문제가 발생했습니다.</p>
        {error.digest && (
          <p className="font-mono-nu text-[9px] text-nu-muted mb-4 break-all">digest: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={reset}
            className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-6 py-3 bg-nu-ink text-white hover:bg-nu-pink transition-colors"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-mono-nu text-[10px] font-bold uppercase tracking-widest px-6 py-3 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-white transition-colors no-underline"
          >
            <ArrowLeft size={12} /> 홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}

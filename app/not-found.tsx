import Link from "next/link";
import { Home, ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-nu-paper flex items-center justify-center px-8">
      <div className="max-w-lg w-full text-center">
        <div className="relative mb-8">
          <span className="font-head text-[120px] font-extrabold text-nu-ink/[0.04] leading-none select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-head text-[120px] font-extrabold text-nu-pink/20 leading-none translate-x-1 -translate-y-0.5 select-none">
              404
            </span>
          </div>
        </div>
        <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-3">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-sm text-nu-muted mb-10 max-w-sm mx-auto">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="font-mono-nu text-[11px] uppercase tracking-widest px-6 py-3 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all no-underline flex items-center gap-2"
          >
            <Home size={14} /> 홈으로
          </Link>
          <Link
            href="/dashboard"
            className="font-mono-nu text-[11px] uppercase tracking-widest px-6 py-3 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-all no-underline flex items-center gap-2"
          >
            <ArrowLeft size={14} /> 대시보드
          </Link>
        </div>
      </div>
    </div>
  );
}

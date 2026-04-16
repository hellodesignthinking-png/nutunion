import Link from "next/link";
import { Brain, ArrowLeft } from "lucide-react";

export default function WikiNotFound() {
  return (
    <div className="min-h-screen bg-nu-paper flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-nu-ink flex items-center justify-center mx-auto mb-6 -rotate-3">
          <Brain size={40} className="text-white" />
        </div>
        <h1 className="font-head text-4xl font-extrabold text-nu-ink mb-3">404</h1>
        <p className="text-sm text-nu-graphite mb-2 font-medium">
          요청하신 탭을 찾을 수 없습니다
        </p>
        <p className="text-xs text-nu-muted mb-8">
          비공개이거나 삭제된 탭일 수 있습니다
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono-nu text-[12px] font-bold uppercase tracking-widest px-6 py-3 bg-nu-ink text-white hover:bg-nu-pink transition-colors no-underline"
        >
          <ArrowLeft size={12} /> 홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}

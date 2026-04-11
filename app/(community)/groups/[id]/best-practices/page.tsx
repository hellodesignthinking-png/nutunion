"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { BestPracticeLibrary } from "@/components/shared/best-practice-library";

export default function BestPracticesPage() {
  const params = useParams();
  const groupId = params.id as string;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pt-8 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href={`/groups/${groupId}`}
          className="p-2 bg-nu-paper border-2 border-nu-ink/10 text-nu-graphite hover:bg-nu-ink hover:text-nu-paper transition-all no-underline"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-nu-pink" />
            <span className="font-mono-nu text-[9px] font-black uppercase tracking-[0.2em] text-nu-pink">
              Best_Practices
            </span>
          </div>
          <h1 className="font-head text-2xl font-extrabold text-nu-ink">
            베스트 프랙티스
          </h1>
          <p className="text-sm text-nu-muted mt-0.5">
            소모임에서 검증된 세션과 자료를 커리큘럼·가이드라인으로 승격한 컬렉션
          </p>
        </div>
      </div>

      {/* Library */}
      <BestPracticeLibrary groupId={groupId} />
    </div>
  );
}

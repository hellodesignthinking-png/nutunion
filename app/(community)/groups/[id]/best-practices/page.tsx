"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BestPracticeLibrary } from "@/components/shared/best-practice-library";

export default function BestPracticesPage() {
  const params = useParams();
  const groupId = params.id as string;
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGroup() {
      const supabase = createClient();
      const { data: group } = await supabase
        .from("groups")
        .select("name")
        .eq("id", groupId)
        .single();
      setGroupName(group?.name || "너트");
      setLoading(false);
    }
    loadGroup();
  }, [groupId]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-8 pb-24">
        <div className="flex items-center gap-1.5 mb-6">
          <div className="h-4 w-16 bg-nu-ink/5 animate-pulse" />
          <div className="h-4 w-4 bg-nu-ink/5 animate-pulse" />
          <div className="h-4 w-24 bg-nu-ink/5 animate-pulse" />
        </div>
        <div className="h-8 w-56 bg-nu-ink/5 animate-pulse mb-2" />
        <div className="h-4 w-80 bg-nu-ink/5 animate-pulse mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white border-[2px] border-nu-ink/[0.08] p-6 space-y-3">
              <div className="h-5 w-3/4 bg-nu-ink/5 animate-pulse" />
              <div className="h-3 w-full bg-nu-ink/5 animate-pulse" />
              <div className="h-3 w-1/2 bg-nu-ink/5 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pt-8 pb-24">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 mb-6 font-mono-nu text-[11px] uppercase tracking-widest">
        <Link href={`/groups/${groupId}`}
          className="text-nu-muted hover:text-nu-ink no-underline flex items-center gap-1 transition-colors">
          <ArrowLeft size={12} /> {groupName}
        </Link>
        <ChevronRight size={12} className="text-nu-muted/40" />
        <span className="text-nu-ink">베스트 프랙티스</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-nu-pink" />
          <span className="font-mono-nu text-[9px] font-black uppercase tracking-[0.2em] text-nu-pink">
            Best_Practices
          </span>
        </div>
        <h1 className="font-head text-3xl font-extrabold text-nu-ink">
          베스트 프랙티스
        </h1>
        <p className="text-sm text-nu-muted mt-1">
          너트에서 검증된 세션과 자료를 커리큘럼·가이드라인으로 승격한 컬렉션
        </p>
      </div>

      {/* Library */}
      <BestPracticeLibrary groupId={groupId} />
    </div>
  );
}

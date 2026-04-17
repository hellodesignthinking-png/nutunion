"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Sparkles, Trash2, Zap } from "lucide-react";

export function QuickRetro({ meetingId, userId, canEdit }: { meetingId: string; userId: string | null; canEdit: boolean }) {
  const [retros, setRetros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadRetros() {
    const supabase = createClient();
    const { data } = await supabase
      .from("meeting_notes")
      .select("*, author:profiles!meeting_notes_created_by_fkey(nickname)")
      .eq("meeting_id", meetingId)
      .eq("type", "retro")
      .order("created_at", { ascending: false });
    if (data) setRetros(data);
    setLoading(false);
  }

  useEffect(() => { loadRetros(); }, [meetingId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) { toast.error("로그인이 필요합니다"); return; }
    
    const fd = new FormData(e.currentTarget);
    const q1 = fd.get("q1") as string;
    const q2 = fd.get("q2") as string;
    const q3 = fd.get("q3") as string;

    const content = `[Action Retro]
- 🏃 컨디션 / 직관적 느낌: ${q1}
- 💡 발견한 점 / 좋았던 점: ${q2}
- ⚠️ 다음 실행을 위한 주의사항: ${q3}`;

    const supabase = createClient();
    const { error } = await supabase.from("meeting_notes").insert({
      meeting_id: meetingId,
      content,
      type: "retro",
      created_by: userId
    });

    if (error) {
      toast.error("저장 실패: " + error.message);
    } else {
      toast.success("빠른 회고가 위키의 아카이브로 저장되었습니다!");
      (e.target as HTMLFormElement).reset();
      loadRetros();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 회고를 삭제하시겠습니까?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("meeting_notes").delete().eq("id", id);
    if (!error) loadRetros();
  }

  return (
    <div className="bg-[#FFFDF7] border-[2px] border-nu-amber p-6 shadow-[6px_6px_0px_0px_rgba(245,158,11,0.15)] mb-8">
      <div className="flex items-center gap-2 mb-3 text-nu-amber">
        <Zap size={20} className="fill-nu-amber" />
        <h3 className="font-head text-2xl font-extrabold text-nu-ink tracking-tight uppercase">Action Retro</h3>
      </div>
      <p className="text-sm font-medium text-nu-graphite mb-6 bg-nu-amber/10 inline-block px-3 py-1">오늘 실행하면서 얻은 '몸의 감각'과 '경험적 인사이트'를 1분 만에 남겨주세요.</p>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 mb-10">
        <div>
          <label className="font-mono-nu text-[11px] font-bold uppercase tracking-[0.1em] text-nu-muted block mb-2">Q1. 오늘의 컨디션이나 직관적인 느낌은 어땠나요?</label>
          <input name="q1" required placeholder="예: 비가 와서 습했지만 페이스 조절이 좋았습니다." 
            className="w-full border-[2px] border-nu-ink/10 px-4 py-3 text-sm focus:border-nu-amber focus:ring-0 outline-none transition-colors rounded-none placeholder:text-nu-muted/40" />
        </div>
        <div>
          <label className="font-mono-nu text-[11px] font-bold uppercase tracking-[0.1em] text-nu-muted block mb-2">Q2. 오늘 모임에서 가장 좋았던 점이나 새로운 발견은?</label>
          <input name="q2" required placeholder="예: 신림역 4번 출구 쪽 코스가 평탄해서 달리기 좋다는 걸 발견함." 
            className="w-full border-[2px] border-nu-ink/10 px-4 py-3 text-sm focus:border-nu-amber focus:ring-0 outline-none transition-colors rounded-none placeholder:text-nu-muted/40" />
        </div>
        <div>
          <label className="font-mono-nu text-[11px] font-bold uppercase tracking-[0.1em] text-nu-amber block mb-2">Q3. [핵심] 다른 멤버들(또는 다음 모임)을 위한 팁이나 주의사항이 있다면?</label>
          <input name="q3" required placeholder="예: 저녁 7시 이후 공원 입구가 어두우니 밝은 옷 추천." 
            className="w-full border-[2px] border-nu-ink/10 px-4 py-3 text-sm focus:border-nu-amber focus:ring-0 outline-none transition-colors rounded-none placeholder:text-nu-muted/40" />
        </div>
        <button type="submit" 
          className="mt-2 font-mono-nu text-[13px] font-extrabold uppercase tracking-widest px-6 py-4 bg-nu-ink text-nu-paper hover:bg-nu-amber hover:text-white transition-all self-start flex items-center gap-2">
          <Sparkles size={14} /> 스냅샷 아카이빙
        </button>
      </form>

      <div className="border-t-[2px] border-nu-ink/[0.05] pt-8">
        <h4 className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-muted mb-4 flex items-center gap-2">
          <Sparkles size={12} className="text-nu-pink" /> 누적 회고 인사이트 ({retros.length})
        </h4>
        {loading ? (
          <p className="text-xs text-nu-muted">로딩 중...</p>
        ) : retros.length === 0 ? (
          <p className="text-sm text-nu-muted italic px-4 py-6 bg-white border border-nu-ink/5">첫 번째 회고록을 작성하여 팀의 자산을 만들어주세요.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {retros.map(retro => (
              <div key={retro.id} className="bg-white p-5 border-[2px] border-nu-ink/[0.08] hover:border-nu-amber/40 transition-colors group relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-none bg-nu-amber flex items-center justify-center font-head text-[10px] font-bold text-white shrink-0">
                    {(retro.author?.nickname || "U").charAt(0).toUpperCase()}
                  </div>
                  <span className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-graphite">{retro.author?.nickname}</span>
                  <span className="font-mono-nu text-[9px] text-nu-muted ml-auto">{new Date(retro.created_at).toLocaleDateString()}</span>
                  {(userId === retro.created_by || canEdit) && (
                    <button onClick={() => handleDelete(retro.id)} className="opacity-0 group-hover:opacity-100 absolute top-4 right-4 text-nu-muted hover:text-red-500 transition-all p-1">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <div className="text-xs text-nu-graphite whitespace-pre-wrap leading-relaxed font-mono-nu mt-1">{retro.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

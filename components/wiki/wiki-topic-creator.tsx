"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, X, Brain, FileText } from "lucide-react";

export function WikiTopicCreator({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("주제 이름을 입력해주세요"); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("wiki_topics").insert({
        group_id: groupId,
        name: name.trim(),
        description: description.trim() || null,
      });
      if (error) throw error;
      toast.success("새 주제가 생성되었습니다!");
      setName("");
      setDescription("");
      setOpen(false);
      // Refresh to show new topic
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "생성에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-nu-ink text-white px-6 py-3 font-mono-nu text-[11px] font-bold uppercase tracking-widest hover:bg-nu-pink transition-all flex items-center gap-2 shrink-0"
      >
        <Plus size={14} /> 새 주제
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white border-[3px] border-nu-ink w-full max-w-lg animate-in zoom-in-95 fade-in">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b-[2px] border-nu-ink/10">
              <h3 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2">
                <Brain size={20} className="text-nu-pink" /> 새 위키 주제 만들기
              </h3>
              <button onClick={() => setOpen(false)} className="p-1 text-nu-muted hover:text-nu-ink transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-2">
                  주제 이름 *
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="예: Protocol Design, Scene Architecture..."
                  className="w-full border-[2px] border-nu-ink px-4 py-3 font-head text-base font-bold focus:outline-none focus:border-nu-pink transition-colors placeholder:text-nu-ink/20"
                />
              </div>
              <div>
                <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-2">
                  설명 (선택)
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="이 주제에서 다루는 범위와 목표를 설명해주세요..."
                  rows={3}
                  className="w-full border-[2px] border-nu-ink/20 px-4 py-3 text-sm focus:outline-none focus:border-nu-pink transition-colors resize-none placeholder:text-nu-ink/15"
                />
              </div>

              <div className="bg-nu-cream/50 border border-nu-ink/10 p-4">
                <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest mb-2 flex items-center gap-1">
                  <FileText size={10} /> 좋은 주제 예시
                </p>
                <ul className="space-y-1 text-xs text-nu-muted">
                  <li>• <strong>Protocol Collective</strong> — 운영 원칙과 거버넌스</li>
                  <li>• <strong>공간 해석 방법론</strong> — 공간 기획의 이론적 기반</li>
                  <li>• <strong>기술 스택</strong> — 우리가 사용하는 도구와 기술</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t-[2px] border-nu-ink/10 bg-nu-cream/20">
              <button
                onClick={() => setOpen(false)}
                className="px-5 py-2.5 border-[2px] border-nu-ink font-mono-nu text-[10px] font-bold uppercase tracking-widest hover:bg-nu-cream transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="px-6 py-2.5 bg-nu-pink text-white font-mono-nu text-[10px] font-bold uppercase tracking-widest hover:bg-nu-pink/80 transition-all flex items-center gap-2 disabled:opacity-50 shadow-[3px_3px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                생성하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function ForkButton({ pageId }: { pageId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState<{ id: string; title: string; group_id: string | null; group_name?: string }[]>([]);
  const [topicId, setTopicId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    (async () => {
      const supabase = createClient();
      const { data: topicsData } = await supabase
        .from("wiki_topics")
        .select("id, title, group_id")
        .order("title");
      const list = (topicsData as { id: string; title: string; group_id: string | null }[]) ?? [];
      // 그룹 이름 조인
      const gids = [...new Set(list.map((t) => t.group_id).filter(Boolean))] as string[];
      let gMap = new Map<string, string>();
      if (gids.length > 0) {
        const { data: groups } = await supabase.from("groups").select("id, name").in("id", gids);
        gMap = new Map((groups as { id: string; name: string }[] | null ?? []).map((g) => [g.id, g.name]));
      }
      setTopics(list.map((t) => ({ ...t, group_name: t.group_id ? gMap.get(t.group_id) : "(개인)" })));
    })();
  }, [open]);

  const fork = async () => {
    if (!topicId) return toast.error("대상 토픽을 선택하세요");
    setLoading(true);
    try {
      const res = await fetch(`/api/wiki/${pageId}/fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_topic_id: topicId,
          new_title: newTitle.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "실패");
      toast.success("파생 탭이 생성되었습니다");
      setOpen(false);
      router.push(`/wiki/${data.page.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-[2px] border-nu-ink bg-nu-pink text-nu-paper px-2 py-1 font-mono-nu text-[10px] uppercase tracking-wider hover:bg-nu-ink"
      >
        🍴 Fork
      </button>

      {open && (
        <div
          role="dialog"
          className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
          onClick={() => !loading && setOpen(false)}
        >
          <div className="bg-nu-paper border-[2.5px] border-nu-ink w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b-[2px] border-nu-ink flex justify-between items-center">
              <span className="font-mono-nu text-[11px] uppercase tracking-widest">탭 고도화 (Fork)</span>
              <button onClick={() => setOpen(false)} className="text-[18px]">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[12px] text-nu-graphite">
                이 탭을 복제해 다른 토픽에서 고도화합니다. 원작자 정보는 계보에 보존됩니다.
              </p>

              <div>
                <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1 block">
                  대상 토픽
                </label>
                <select
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="w-full border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]"
                >
                  <option value="">— 선택 —</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.group_name ? `[${t.group_name}] ` : ""}{t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1 block">
                  새 제목 (선택)
                </label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="빈칸이면 '원제목 (고도화)' 로 자동 설정"
                  className="w-full border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setOpen(false)} disabled={loading} className="flex-1 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink py-2 font-mono-nu text-[11px] uppercase tracking-widest">
                  취소
                </button>
                <button onClick={fork} disabled={loading} className="flex-1 border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50">
                  {loading ? "생성 중..." : "파생 생성"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

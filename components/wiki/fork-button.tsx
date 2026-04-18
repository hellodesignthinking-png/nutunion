"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Mode = "existing" | "new-group";

export function ForkButton({ pageId }: { pageId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("existing");
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState<{ id: string; title: string; group_id: string | null; group_name?: string }[]>([]);
  const [topicId, setTopicId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [topicTitle, setTopicTitle] = useState("시작");
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
      const gids = [...new Set(list.map((t) => t.group_id).filter(Boolean))] as string[];
      let gMap = new Map<string, string>();
      if (gids.length > 0) {
        const { data: groups } = await supabase.from("groups").select("id, name").in("id", gids);
        gMap = new Map((groups as { id: string; name: string }[] | null ?? []).map((g) => [g.id, g.name]));
      }
      setTopics(list.map((t) => ({ ...t, group_name: t.group_id ? gMap.get(t.group_id) : "(개인)" })));
    })();
  }, [open]);

  const forkExisting = async () => {
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

  const forkIntoNewGroup = async () => {
    if (groupName.trim().length < 2) return toast.error("그룹명 2자 이상");
    setLoading(true);
    try {
      const res = await fetch(`/api/wiki/${pageId}/fork-into-new-group`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_name: groupName.trim(),
          group_description: groupDesc.trim() || undefined,
          new_title: newTitle.trim() || undefined,
          topic_title: topicTitle.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "실패");
      toast.success("새 너트가 생성되었습니다");
      setOpen(false);
      router.push(`/groups/${data.group_id}`);
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
          <div className="bg-nu-paper border-[2.5px] border-nu-ink w-full max-w-lg max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b-[2px] border-nu-ink flex justify-between items-center sticky top-0 bg-nu-paper">
              <span className="font-mono-nu text-[11px] uppercase tracking-widest">탭 고도화 (Fork)</span>
              <button onClick={() => setOpen(false)} className="text-[18px]">✕</button>
            </div>

            {/* 모드 탭 */}
            <div className="grid grid-cols-2 border-b-[2px] border-nu-ink">
              <button
                onClick={() => setMode("existing")}
                className={`py-2.5 font-mono-nu text-[11px] uppercase tracking-widest ${
                  mode === "existing" ? "bg-nu-ink text-nu-paper" : "bg-nu-paper text-nu-graphite hover:bg-nu-ink/5"
                }`}
              >
                기존 너트로
              </button>
              <button
                onClick={() => setMode("new-group")}
                className={`py-2.5 font-mono-nu text-[11px] uppercase tracking-widest border-l-[2px] border-nu-ink ${
                  mode === "new-group" ? "bg-nu-pink text-nu-paper" : "bg-nu-paper text-nu-graphite hover:bg-nu-ink/5"
                }`}
              >
                ✨ 새 너트 만들기
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-[12px] text-nu-graphite">
                {mode === "existing"
                  ? "이 탭을 복제해 다른 토픽에서 고도화합니다."
                  : "이 탭을 시작점으로 완전히 새로운 너트(그룹)를 만듭니다. 당신이 호스트가 되고, 원본 원작자는 계보에 보존됩니다."}
              </p>

              {mode === "existing" && (
                <>
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
                </>
              )}

              {mode === "new-group" && (
                <>
                  <div>
                    <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1 block">
                      새 너트 이름 *
                    </label>
                    <input
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="예: 신림동 공유주방 운영단"
                      className="w-full border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1 block">
                      너트 설명
                    </label>
                    <textarea
                      value={groupDesc}
                      onChange={(e) => setGroupDesc(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder="어떤 목적의 너트인지 한두 문장"
                      className="w-full border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1 block">
                        첫 토픽
                      </label>
                      <input
                        value={topicTitle}
                        onChange={(e) => setTopicTitle(e.target.value)}
                        placeholder="시작"
                        className="w-full border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]"
                      />
                    </div>
                    <div>
                      <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1 block">
                        새 탭 제목
                      </label>
                      <input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="빈칸: 원제목+너트명"
                        className="w-full border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]"
                      />
                    </div>
                  </div>
                  <div className="bg-nu-pink/5 border-l-[3px] border-nu-pink p-2 text-[11px] text-nu-ink">
                    ✨ 생성 후 당신이 자동으로 호스트가 됩니다. 원본 탭의 원작자 정보는 계보로 영구 보존.
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={() => setOpen(false)} disabled={loading} className="flex-1 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink py-2 font-mono-nu text-[11px] uppercase tracking-widest">
                  취소
                </button>
                <button
                  onClick={mode === "existing" ? forkExisting : forkIntoNewGroup}
                  disabled={loading}
                  className="flex-1 border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50"
                >
                  {loading ? "생성 중..." : mode === "existing" ? "파생 생성" : "새 너트 만들기"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

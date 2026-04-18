"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  entityType: "project" | "member" | "group";
  entityId: string;
  entityName?: string;
  triggerLabel?: string;
}

export function ChatDigestCreateModal({
  entityType,
  entityId,
  entityName,
  triggerLabel = "📝 카톡 회의록 정리",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [chat, setChat] = useState("");
  const [chatDate, setChatDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState<"kakao" | "slack" | "manual" | "other">("kakao");
  const [saveRaw, setSaveRaw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setChat("");
    setChatDate(new Date().toISOString().slice(0, 10));
    setSource("kakao");
    setSaveRaw(false);
    setError(null);
  };

  const charCount = chat.length;
  const lineCount = chat ? chat.split("\n").length : 0;

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) return setError("제목을 입력하세요");
    if (chat.trim().length < 20) return setError("대화가 너무 짧습니다 (20자 이상)");
    if (chat.length > 60_000) return setError("대화가 너무 깁니다 (최대 60,000자)");

    setLoading(true);
    try {
      const res = await fetch("/api/chat-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          title: title.trim(),
          chat,
          chat_date: chatDate || undefined,
          source,
          save_raw: saveRaw,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "생성 실패");
      }
      toast.success("회의록이 생성되었습니다");
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-3 py-1.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper"
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="chat-digest-title"
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="bg-nu-paper border-[2.5px] border-nu-ink w-full max-w-3xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-nu-paper border-b-[2px] border-nu-ink px-5 py-3 flex justify-between items-center">
              <h2 id="chat-digest-title" className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-ink">
                카톡 대화 → 회의록 정리
              </h2>
              <button
                type="button"
                onClick={() => !loading && setOpen(false)}
                aria-label="닫기"
                className="text-nu-graphite hover:text-nu-ink text-[18px] leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {entityName && (
                <div className="font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite">
                  {entityType === "project" ? "볼트" : entityType === "member" ? "너트" : "그룹"}: {entityName}
                </div>
              )}

              <Field label="제목 *">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 2026-04-18 주간 회의"
                  maxLength={200}
                  className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[14px] outline-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="대화 일자">
                  <input
                    type="date"
                    value={chatDate}
                    onChange={(e) => setChatDate(e.target.value)}
                    className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[13px] outline-none"
                  />
                </Field>
                <Field label="출처">
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as typeof source)}
                    className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[13px] outline-none"
                  >
                    <option value="kakao">카카오톡</option>
                    <option value="slack">Slack</option>
                    <option value="manual">직접 작성</option>
                    <option value="other">기타</option>
                  </select>
                </Field>
              </div>

              <Field label={`대화 내용 * (${charCount.toLocaleString()}자 · ${lineCount}줄)`}>
                <textarea
                  value={chat}
                  onChange={(e) => setChat(e.target.value)}
                  placeholder={`카카오톡 대화 그대로 붙여넣기:\n[홍길동] 2026-04-18 13:22:15\n회의 시작합니다.\n\n[김철수] 2026-04-18 13:23:02\n안건은 두 가지입니다...`}
                  rows={12}
                  className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[12px] font-mono outline-none resize-y"
                />
                <p className="text-[10px] text-nu-graphite mt-1">
                  카톡 → 대화방 설정 → 대화 내보내기 (텍스트) 결과를 붙여넣으세요. 20자 이상, 최대 60,000자.
                </p>
              </Field>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveRaw}
                  onChange={(e) => setSaveRaw(e.target.checked)}
                  className="w-4 h-4 accent-nu-pink"
                />
                <span className="text-[12px] text-nu-ink">원본 대화도 함께 저장 (개인정보 포함 주의)</span>
              </label>

              {error && (
                <div className="border-[2px] border-red-500 bg-red-50 text-red-600 px-3 py-2 text-[12px]">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => !loading && setOpen(false)}
                  className="flex-1 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink/5"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50"
                >
                  {loading ? "AI 정리 중... (5~15초)" : "AI 로 정리"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">
        {label}
      </div>
      {children}
    </label>
  );
}

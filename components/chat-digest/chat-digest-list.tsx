"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export interface ChatDigest {
  id: string;
  title: string;
  summary: string;
  chat_date: string | null;
  source: string;
  topics: { title: string; summary: string }[];
  decisions: string[];
  action_items: { assignee: string | null; task: string; due: string | null }[];
  participants: string[];
  tone: string | null;
  created_at: string;
  created_by: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  kakao: "카톡",
  slack: "Slack",
  manual: "직접",
  other: "기타",
};

export function ChatDigestList({
  digests,
  canDelete = false,
}: {
  digests: ChatDigest[];
  canDelete?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async (id: string) => {
    if (!confirm("이 회의록을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/chat-digest/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "삭제 실패");
      toast.success("삭제되었습니다");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  if (digests.length === 0) {
    return (
      <div className="border-[2px] border-dashed border-nu-ink/30 bg-nu-paper p-8 text-center">
        <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite">
          NO DIGESTS
        </div>
        <p className="text-[12px] text-nu-graphite mt-2">
          아직 정리된 회의록이 없습니다. &ldquo;📝 카톡 회의록 정리&rdquo; 버튼으로 시작하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {digests.map((d) => {
        const isOpen = expandedId === d.id;
        return (
          <article key={d.id} className="border-[2.5px] border-nu-ink bg-nu-paper">
            <button
              type="button"
              onClick={() => setExpandedId(isOpen ? null : d.id)}
              aria-expanded={isOpen}
              className="w-full text-left px-4 py-3 flex justify-between items-start gap-3 hover:bg-nu-ink/5"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono-nu text-[9px] uppercase tracking-wider border border-nu-ink/30 px-1.5 py-0.5 text-nu-graphite">
                    {SOURCE_LABELS[d.source] ?? d.source}
                  </span>
                  {d.chat_date && (
                    <span className="font-mono-nu text-[10px] text-nu-graphite">
                      {d.chat_date}
                    </span>
                  )}
                  {d.participants.length > 0 && (
                    <span className="font-mono-nu text-[10px] text-nu-graphite">
                      · {d.participants.length}명 참여
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-[14px] text-nu-ink leading-tight">{d.title}</h3>
                <p className="text-[12px] text-nu-graphite mt-1 line-clamp-2">{d.summary}</p>
              </div>
              <span className="font-mono-nu text-[11px] text-nu-graphite flex-shrink-0 pt-1">
                {isOpen ? "▲" : "▼"}
              </span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 border-t border-nu-ink/10 pt-3 space-y-4">
                {/* 참여자 */}
                {d.participants.length > 0 && (
                  <Section title="참여자">
                    <div className="flex flex-wrap gap-1.5">
                      {d.participants.map((p, i) => (
                        <span
                          key={i}
                          className="font-mono-nu text-[10px] uppercase tracking-wider border border-nu-ink/30 px-2 py-0.5 text-nu-ink"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </Section>
                )}

                {/* 주요 논의 */}
                {d.topics.length > 0 && (
                  <Section title="주요 논의">
                    <ol className="list-decimal pl-5 space-y-2">
                      {d.topics.map((t, i) => (
                        <li key={i} className="text-[13px] text-nu-ink">
                          <div className="font-bold">{t.title}</div>
                          <div className="text-[12px] text-nu-graphite mt-0.5">{t.summary}</div>
                        </li>
                      ))}
                    </ol>
                  </Section>
                )}

                {/* 결정 사항 */}
                {d.decisions.length > 0 && (
                  <Section title="결정 사항">
                    <ul className="list-disc pl-5 space-y-1">
                      {d.decisions.map((dec, i) => (
                        <li key={i} className="text-[13px] text-nu-ink">
                          {dec}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* 실행 항목 */}
                {d.action_items.length > 0 && (
                  <Section title="실행 항목">
                    <ul className="space-y-1.5">
                      {d.action_items.map((a, i) => (
                        <li key={i} className="text-[13px] text-nu-ink flex gap-2">
                          <input type="checkbox" disabled className="mt-1 accent-nu-pink" />
                          <span>
                            {a.assignee && <strong>{a.assignee}: </strong>}
                            {a.task}
                            {a.due && (
                              <span className="ml-2 font-mono-nu text-[10px] text-orange-600">
                                ~{a.due}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* 분위기 */}
                {d.tone && (
                  <Section title="전반적 분위기">
                    <p className="text-[12px] text-nu-graphite italic">&ldquo;{d.tone}&rdquo;</p>
                  </Section>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-nu-ink/10">
                  <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">
                    생성: {new Date(d.created_at).toLocaleString("ko-KR")}
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(d.id)}
                      className="border-[2px] border-red-500 text-red-600 px-2 py-1 font-mono-nu text-[9px] uppercase tracking-wider hover:bg-red-500 hover:text-white"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">
        {title}
      </div>
      {children}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Submission {
  id: string;
  project_id: string;
  plan_id: string;
  status: string;
  amount_req: number | null;
  contact_email: string | null;
  pitch: string | null;
  review_note: string | null;
  submitted_at: string;
  decided_at: string | null;
  project?: { title: string };
  plan?: { version: number; content: Record<string, unknown> };
}

export function FundingRow({ submission }: { submission: Submission }) {
  const [expanded, setExpanded] = useState(false);
  const [reviewNote, setReviewNote] = useState(submission.review_note ?? "");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const update = async (status: string) => {
    if (status === "rejected" && !reviewNote.trim()) {
      return toast.error("반려 사유를 입력하세요");
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/funding/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, review_note: reviewNote.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "실패");
      toast.success("업데이트됨");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "실패");
    } finally {
      setLoading(false);
    }
  };

  const content = submission.plan?.content as { summary?: string; problem?: string; solution?: string } | undefined;

  return (
    <article className="border-[2.5px] border-nu-ink bg-nu-paper">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex justify-between items-start gap-3 hover:bg-nu-ink/5"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono-nu text-[9px] uppercase tracking-wider bg-nu-ink text-nu-paper px-1.5 py-0.5">
              v{submission.plan?.version ?? "?"}
            </span>
            <span className="font-mono-nu text-[10px] text-nu-graphite">
              {new Date(submission.submitted_at).toLocaleDateString("ko-KR")}
            </span>
            {submission.amount_req != null && (
              <span className="font-mono-nu text-[11px] text-nu-ink font-bold">
                ₩{submission.amount_req.toLocaleString("ko-KR")}
              </span>
            )}
          </div>
          <h3 className="font-bold text-[15px] text-nu-ink truncate">{submission.project?.title ?? "(프로젝트)"}</h3>
          {content?.summary && (
            <p className="text-[12px] text-nu-graphite mt-1 line-clamp-2">{content.summary}</p>
          )}
        </div>
        <span className="text-nu-graphite flex-shrink-0">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-nu-ink/10 pt-3 space-y-3">
          <div className="flex gap-2 text-[11px] flex-wrap">
            <Link href={`/projects/${submission.project_id}/venture`} className="border-[2px] border-nu-ink px-2 py-0.5 font-mono-nu uppercase tracking-wider hover:bg-nu-ink hover:text-nu-paper">
              → Venture
            </Link>
            {submission.contact_email && (
              <span className="text-nu-graphite">📧 {submission.contact_email}</span>
            )}
          </div>

          {content?.problem && <Field label="문제" value={content.problem} />}
          {content?.solution && <Field label="솔루션" value={content.solution} />}
          {submission.pitch && <Field label="추가 피치" value={submission.pitch} />}

          <div>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">
              심사 메모
            </div>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={3}
              placeholder="반려 시 사유 필수"
              className="w-full border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <button onClick={() => update("reviewing")} disabled={loading} className="border-[2px] border-nu-ink bg-nu-paper text-nu-ink px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-wider hover:bg-nu-ink hover:text-nu-paper disabled:opacity-50">
              🔍 심사 중
            </button>
            <button onClick={() => update("funded")} disabled={loading} className="border-[2px] border-green-700 bg-green-50 text-green-700 px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-wider hover:bg-green-700 hover:text-white disabled:opacity-50">
              ✅ 펀딩 결정
            </button>
            <button onClick={() => update("rejected")} disabled={loading} className="border-[2px] border-red-500 text-red-600 px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-wider hover:bg-red-500 hover:text-white disabled:opacity-50">
              ❌ 반려
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1">{label}</div>
      <p className="text-[12px] text-nu-ink whitespace-pre-wrap">{value}</p>
    </div>
  );
}

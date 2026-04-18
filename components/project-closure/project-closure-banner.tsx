"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Contributor {
  name: string;
  role: string | null;
  contribution: string;
}

interface Highlights {
  headline?: string;
  achievements?: string[];
  challenges?: string[];
  lessons?: string[];
  final_outputs?: string[];
  key_contributors?: Contributor[];
  stats?: {
    total_milestones?: number;
    completed_milestones?: number;
    total_members?: number;
    total_digests?: number;
  };
}

export function ProjectClosureBanner({
  project,
  canCancel,
}: {
  project: {
    id: string;
    title: string;
    closed_at: string | null;
    closure_summary: string | null;
    closure_highlights: Highlights | null;
    closure_model: string | null;
  };
  canCancel?: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const h = project.closure_highlights ?? {};
  const closedDate = project.closed_at ? new Date(project.closed_at).toLocaleDateString("ko-KR") : null;

  const handleCancel = async () => {
    if (!confirm("마감을 취소하면 상태가 '진행중' 으로 복원되고 요약이 삭제됩니다. 계속할까요?")) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/close`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "취소 실패");
      toast.success("마감이 취소되었습니다");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "취소 실패");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <section
      className="border-[2.5px] border-nu-ink bg-gradient-to-br from-nu-pink/5 to-nu-paper print:border-nu-ink"
      aria-labelledby="closure-headline"
    >
      <div className="border-b-[2px] border-nu-ink px-5 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] bg-nu-ink text-nu-paper px-2 py-0.5">
            🏁 CLOSED
          </span>
          {closedDate && (
            <span className="font-mono-nu text-[11px] text-nu-graphite">{closedDate} 마감</span>
          )}
        </div>
        {canCancel && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="border-[2px] border-nu-ink/30 text-nu-graphite px-2 py-1 font-mono-nu text-[9px] uppercase tracking-wider hover:border-red-500 hover:text-red-600 disabled:opacity-50"
          >
            {cancelling ? "취소 중..." : "마감 취소"}
          </button>
        )}
      </div>

      <div className="p-5">
        {h.headline && (
          <h2 id="closure-headline" className="text-[18px] sm:text-[22px] font-bold text-nu-ink mb-3 leading-tight">
            {h.headline}
          </h2>
        )}

        {project.closure_summary && (
          <p className="text-[13px] sm:text-[14px] text-nu-ink leading-relaxed whitespace-pre-wrap">
            {project.closure_summary}
          </p>
        )}

        {/* 통계 */}
        {h.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-nu-ink/10">
            <Stat label="멤버" value={h.stats.total_members ?? 0} />
            <Stat
              label="마일스톤"
              value={`${h.stats.completed_milestones ?? 0}/${h.stats.total_milestones ?? 0}`}
            />
            <Stat label="회의록" value={h.stats.total_digests ?? 0} />
            <Stat
              label="달성률"
              value={
                h.stats.total_milestones && h.stats.total_milestones > 0
                  ? `${Math.round(((h.stats.completed_milestones ?? 0) / h.stats.total_milestones) * 100)}%`
                  : "—"
              }
            />
          </div>
        )}

        {/* 하이라이트 (toggle) */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-4 font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink hover:text-nu-pink"
        >
          {expanded ? "▲ 상세 접기" : "▼ 상세 하이라이트"}
        </button>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-nu-ink/10 space-y-4">
            <Group title="성과" items={h.achievements} />
            <Group title="과제" items={h.challenges} />
            <Group title="배운 점" items={h.lessons} />
            <Group title="최종 산출물" items={h.final_outputs} />
            {h.key_contributors && h.key_contributors.length > 0 && (
              <div>
                <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">
                  핵심 기여자
                </div>
                <ul className="space-y-1.5">
                  {h.key_contributors.map((c, i) => (
                    <li key={i} className="text-[13px] text-nu-ink">
                      <strong>{c.name}</strong>
                      {c.role && <span className="text-nu-graphite"> · {c.role}</span>}
                      <div className="text-[12px] text-nu-graphite mt-0.5">{c.contribution}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {project.closure_model && (
          <div className="mt-4 pt-3 border-t border-nu-ink/10 font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">
            Generated by {project.closure_model}
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center">
      <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-0.5">
        {label}
      </div>
      <div className="text-[16px] font-bold text-nu-ink tabular-nums">{value}</div>
    </div>
  );
}

function Group({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">
        {title}
      </div>
      <ul className="list-disc pl-5 space-y-1">
        {items.map((s, i) => (
          <li key={i} className="text-[13px] text-nu-ink">
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

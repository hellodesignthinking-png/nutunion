"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, ExternalLink, Loader2 } from "lucide-react";

function ArchiveToTapButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const [archived, setArchived] = useState<{ url: string } | null>(null);

  async function handleArchive() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/archive-to-wiki`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "승격 실패");
      setArchived({ url: data.url });
      toast.success(data.already_archived ? "이미 승격됨" : "탭(Tap) 아카이브에 승격됐습니다");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (archived) {
    return (
      <Link href={archived.url}
        className="border-[2px] border-green-600 text-green-700 bg-green-50 px-2 py-1 font-mono-nu text-[9px] uppercase tracking-wider no-underline inline-flex items-center gap-1">
        <BookOpen size={10} /> 탭 보기 <ExternalLink size={9} />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handleArchive}
      disabled={loading}
      title="이 볼트의 회고를 탭(Tap) 아카이브에 영구 보관"
      className="border-[2px] border-nu-pink text-nu-pink px-2 py-1 font-mono-nu text-[9px] uppercase tracking-wider hover:bg-nu-pink hover:text-nu-paper disabled:opacity-50 inline-flex items-center gap-1"
    >
      {loading ? <Loader2 size={10} className="animate-spin" /> : <BookOpen size={10} />}
      탭 아카이브
    </button>
  );
}

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
        <div className="flex items-center gap-1.5">
          <ArchiveToTapButton projectId={project.id} />
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

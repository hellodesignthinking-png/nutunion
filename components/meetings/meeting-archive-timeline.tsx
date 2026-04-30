import Link from "next/link";
import { BookOpen, ExternalLink, CheckSquare, Sparkles, ArrowRight } from "lucide-react";

export type ArchiveMeeting = {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
  summary: string | null;
  next_topic: string | null;
  next_topics?: any;
  ai_result?: any;
  google_doc_url: string | null;
};

type Props = {
  meetings: ArchiveMeeting[];
  variant: "group" | "project";
  baseHref: string;
};

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

function fmtDatePill(iso: string): string {
  const d = new Date(iso);
  const kst = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    weekday: "narrow",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => kst.find((p) => p.type === t)?.value || "";
  const mm = get("month");
  const dd = get("day");
  const wd = get("weekday");
  const hh = get("hour");
  const mi = get("minute");
  return `${mm}.${dd} (${wd}) ${hh}:${mi}`;
}

/** Pull `### Topic` headers (and the first bullet under each) from the markdown summary. */
function parseTopicsFromMd(md: string | null): { title: string; first: string }[] {
  if (!md) return [];
  const lines = md.split(/\r?\n/);
  const out: { title: string; first: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^###\s+(.+)$/.exec(lines[i]);
    if (m) {
      let first = "";
      for (let j = i + 1; j < lines.length && j < i + 8; j++) {
        const b = /^\s*[-*]\s+(.+)$/.exec(lines[j]);
        if (b) {
          first = b[1].trim();
          break;
        }
        if (/^#{1,6}\s/.test(lines[j])) break;
      }
      out.push({ title: m[1].trim(), first });
      if (out.length >= 3) break;
    }
  }
  return out;
}

/** Pull lines under `## 결정 사항` from md (lines starting with `>`, `-`, or `*`). */
function parseDecisionsFromMd(md: string | null): string[] {
  if (!md) return [];
  const lines = md.split(/\r?\n/);
  const idx = lines.findIndex((l) => /^##\s+결정\s*사항/.test(l));
  if (idx < 0) return [];
  const out: string[] = [];
  for (let j = idx + 1; j < lines.length; j++) {
    if (/^##\s/.test(lines[j])) break;
    const m = /^\s*(?:>|[-*])\s*(?:✅\s*)?(.+)$/.exec(lines[j]);
    if (m && m[1].trim()) out.push(m[1].trim());
  }
  return out;
}

function normalizeNextTopics(m: ArchiveMeeting): string[] {
  const arr = Array.isArray(m.next_topics) ? m.next_topics : [];
  if (arr.length) return arr.map((x) => String(x)).filter(Boolean);
  const ai = Array.isArray(m.ai_result?.nextTopics)
    ? m.ai_result.nextTopics
    : Array.isArray(m.ai_result?.next_topics)
      ? m.ai_result.next_topics
      : [];
  if (ai.length) return ai.map((x: any) => String(x)).filter(Boolean);
  if (m.next_topic && m.next_topic.trim()) return [m.next_topic.trim()];
  return [];
}

function MeetingCard({ m, baseHref }: { m: ArchiveMeeting; baseHref: string }) {
  const ai = m.ai_result || null;
  const isCompleted = m.status === "completed";

  // 1. Topics
  let topics: { title: string; first: string }[] = [];
  if (Array.isArray(ai?.topics) && ai.topics.length) {
    topics = ai.topics.slice(0, 3).map((t: any) => ({
      title: String(t?.title || "주제"),
      first: Array.isArray(t?.points) && t.points.length ? String(t.points[0]) : "",
    }));
  } else {
    topics = parseTopicsFromMd(m.summary);
  }

  // 2. Decisions
  let decisions: string[] = [];
  if (Array.isArray(ai?.decisions) && ai.decisions.length) {
    decisions = ai.decisions.map((d: any) => String(d)).filter(Boolean);
  } else {
    decisions = parseDecisionsFromMd(m.summary);
  }
  const decisionVisible = decisions.slice(0, 3);
  const decisionMore = decisions.length - decisionVisible.length;

  // 3. Next topics
  const nextTopics = normalizeNextTopics(m);

  // 4. Action items
  const actionItems: any[] = Array.isArray(ai?.actionItems) ? ai.actionItems : [];
  const actionVisible = actionItems.slice(0, 2);

  const detailHref = `${baseHref}/${m.id}`;

  return (
    <article className="bg-nu-white border-[3px] border-nu-ink p-5 transition-all hover:-translate-y-[1px] hover:shadow-[4px_4px_0_0_rgba(13,13,13,0.18)]">
      {/* Header */}
      <header className="flex items-start gap-3 flex-wrap mb-4 pb-3 border-b-[2px] border-nu-ink/10">
        <h3 className="font-head text-lg font-extrabold text-nu-ink m-0 flex-1 min-w-0 truncate">
          {m.title}
        </h3>
        <span className="font-mono-nu text-[11px] text-nu-graphite px-2 py-0.5 border-[2px] border-nu-ink/15 bg-nu-cream/50">
          {fmtDatePill(m.scheduled_at)}
        </span>
        <span
          className={`font-mono-nu text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border-[2px] ${
            isCompleted
              ? "border-nu-ink bg-nu-ink text-nu-paper"
              : "border-nu-ink/30 bg-nu-paper text-nu-graphite"
          }`}
        >
          {isCompleted ? "완료" : "예정"}
        </span>
      </header>

      {/* 논의된 내용 */}
      <section className="mb-4">
        <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
          논의된 내용
        </p>
        {topics.length === 0 ? (
          <p className="font-mono-nu text-[12px] text-nu-muted">요약 없음</p>
        ) : (
          <ul className="m-0 p-0 list-none space-y-1.5">
            {topics.map((t, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="inline-flex shrink-0 mt-0.5 px-1.5 py-0.5 bg-nu-ink text-nu-paper font-mono-nu text-[10px] font-bold uppercase tracking-wider">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm text-nu-ink min-w-0">
                  <span className="font-bold">{t.title}</span>
                  {t.first ? (
                    <span className="text-nu-graphite"> — {t.first}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 결정 사항 */}
      {decisions.length > 0 && (
        <section className="mb-4">
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
            결정 사항
          </p>
          <div className="flex flex-wrap gap-1.5">
            {decisionVisible.map((d, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 border-[2px] border-nu-ink bg-nu-paper font-mono-nu text-[11px] text-nu-ink"
              >
                <CheckSquare size={11} className="shrink-0" />
                <span className="line-clamp-1">{d}</span>
              </span>
            ))}
            {decisionMore > 0 && (
              <span className="inline-flex items-center px-2 py-1 border-[2px] border-nu-ink/30 bg-nu-cream/40 font-mono-nu text-[11px] text-nu-graphite">
                +{decisionMore}개
              </span>
            )}
          </div>
        </section>
      )}

      {/* 다음 회의 안건 — callout */}
      {nextTopics.length > 0 && (
        <section className="mb-4 border-l-4 border-nu-pink bg-nu-cream/30 px-3 py-2">
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">
            다음 회의 기준
          </p>
          <ul className="m-0 p-0 list-none space-y-0.5">
            {nextTopics.slice(0, 4).map((t, i) => (
              <li key={i} className="text-sm text-nu-ink flex items-start gap-1.5">
                <span className="text-nu-pink font-bold">→</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 그래서 우리는 — 액션 아이템 */}
      {actionItems.length > 0 && (
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
              그래서 우리는 — 액션 아이템
            </p>
            <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 bg-nu-pink text-nu-paper font-mono-nu text-[10px] font-bold">
              {actionItems.length}
            </span>
          </div>
          <ul className="m-0 p-0 list-none space-y-1.5">
            {actionVisible.map((a: any, i: number) => (
              <li
                key={i}
                className="flex items-center gap-2 px-2 py-1.5 border-[2px] border-nu-ink/15 bg-nu-paper"
              >
                <span className="inline-block w-3.5 h-3.5 border-[2px] border-nu-ink shrink-0" />
                <span className="font-mono-nu text-[12px] text-nu-ink flex-1 min-w-0 truncate">
                  {String(a?.task || a?.content || "")}
                </span>
                {a?.assignee && (
                  <span className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-wider shrink-0">
                    @{a.assignee}
                  </span>
                )}
                {a?.dueDate && (
                  <span className="font-mono-nu text-[10px] text-nu-graphite shrink-0">
                    {a.dueDate}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {actionItems.length > actionVisible.length && (
            <Link
              href={detailHref}
              className="inline-flex items-center gap-1 mt-2 font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-pink no-underline"
            >
              전체 {actionItems.length}개 보기 <ArrowRight size={11} />
            </Link>
          )}
        </section>
      )}

      {/* Footer */}
      <footer className="flex items-center justify-between gap-3 pt-3 border-t-[2px] border-nu-ink/10 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href={detailHref}
            className="inline-flex items-center gap-1 font-mono-nu text-[11px] font-bold uppercase tracking-widest text-nu-ink hover:text-nu-pink no-underline"
          >
            <BookOpen size={12} /> 회의록 자세히
          </Link>
          {m.google_doc_url && (
            <a
              href={m.google_doc_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-blue no-underline"
            >
              📄 Docs <ExternalLink size={10} />
            </a>
          )}
        </div>
        {!ai && (
          <span className="font-mono-nu text-[10px] text-nu-muted/70 uppercase tracking-wider inline-flex items-center gap-1">
            <Sparkles size={10} /> AI 요약 미생성
          </span>
        )}
      </footer>
    </article>
  );
}

export function MeetingArchiveTimeline({ meetings, variant, baseHref }: Props) {
  const sorted = [...(meetings || [])].sort(
    (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
  );
  const visible = sorted.slice(0, 10);
  const hasMore = sorted.length > 10;

  if (!visible.length) {
    return (
      <div className="bg-nu-paper border-[3px] border-dashed border-nu-ink/30 p-10 text-center">
        <p className="font-head text-base font-extrabold text-nu-ink mb-1">
          아직 마감된 {variant === "group" ? "회의" : "회의"}가 없어요
        </p>
        <p className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">
          첫 회의를 진행하면 여기에 자동으로 아카이브됩니다
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical rail */}
      <div
        className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-nu-ink/15 hidden sm:block"
        aria-hidden
      />
      <ul className="m-0 p-0 list-none space-y-5">
        {visible.map((m) => (
          <li key={m.id} className="relative sm:pl-8">
            {/* Dot */}
            <span
              className="hidden sm:block absolute left-0 top-5 w-4 h-4 bg-nu-paper border-[3px] border-nu-ink rounded-full"
              aria-hidden
            />
            <MeetingCard m={m} baseHref={baseHref} />
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="mt-5 sm:pl-8">
          <Link
            href={baseHref}
            className="inline-flex items-center gap-1.5 font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-ink hover:text-nu-pink no-underline border-b-[2px] border-nu-ink/30 hover:border-nu-pink pb-0.5"
          >
            이전 회의 더 보기 <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}

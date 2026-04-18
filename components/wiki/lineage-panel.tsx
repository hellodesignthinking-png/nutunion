import Link from "next/link";
import type { LineagePage, Connection } from "@/lib/wiki/lineage";
import { ForkButton } from "./fork-button";

const RELATION_LABEL: Record<string, string> = {
  related:  "관련",
  extends:  "고도화",
  combines: "결합",
  cites:    "인용",
  replaces: "대체",
  sequel:   "후속",
};

export function LineagePanel({
  pageId,
  ancestry,
  descendants,
  connections,
  groupBasePath,
}: {
  pageId: string;
  ancestry: LineagePage[];
  descendants: LineagePage[];
  connections: { outgoing: Connection[]; incoming: Connection[] };
  /** 예: "/groups/{id}/wiki/pages" — 페이지 링크 조합용 */
  groupBasePath?: string;
}) {
  const hasLineage = ancestry.length > 1 || descendants.length > 0;
  const hasConnections = connections.outgoing.length + connections.incoming.length > 0;

  const hrefFor = (id: string) => groupBasePath ? `${groupBasePath}/${id}` : `/wiki/${id}`;

  return (
    <aside className="border-[2.5px] border-nu-ink bg-nu-paper">
      <div className="px-4 py-3 border-b-[2px] border-nu-ink flex items-center justify-between">
        <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
          🧬 계보 · 연결
        </span>
        <ForkButton pageId={pageId} />
      </div>

      {/* 조상 체인 */}
      {ancestry.length > 1 && (
        <div className="p-4 border-b border-nu-ink/10">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">
            원본 → 현재
          </div>
          <ol className="space-y-1.5">
            {ancestry.map((p, i) => {
              const isCurrent = p.id === pageId;
              return (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="font-mono-nu text-[9px] text-nu-graphite w-5">
                    {i === 0 ? "🌱" : `↓`}
                  </span>
                  {isCurrent ? (
                    <span className="text-[13px] font-bold text-nu-pink flex-1">{p.title}</span>
                  ) : (
                    <Link href={hrefFor(p.id)} className="text-[13px] text-nu-ink hover:text-nu-pink no-underline flex-1">
                      {p.title}
                    </Link>
                  )}
                  {p.created_by_name && (
                    <span className="font-mono-nu text-[9px] text-nu-graphite">by {p.created_by_name}</span>
                  )}
                </li>
              );
            })}
          </ol>
          {ancestry[0]?.created_by_name && ancestry.length > 1 && (
            <div className="mt-2 font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite">
              최초 원작자: <strong>{ancestry[0].created_by_name}</strong>
            </div>
          )}
        </div>
      )}

      {/* 자손 */}
      {descendants.length > 0 && (
        <div className="p-4 border-b border-nu-ink/10">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">
            이 탭을 고도화한 파생 ({descendants.length})
          </div>
          <ul className="space-y-1.5">
            {descendants.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <span className="font-mono-nu text-[9px] text-nu-graphite w-5">↳</span>
                <Link href={hrefFor(d.id)} className="text-[13px] text-nu-ink hover:text-nu-pink no-underline flex-1">
                  {d.title}
                </Link>
                <span className="font-mono-nu text-[9px] text-nu-graphite">
                  depth {d.fork_depth}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 외부 연결 */}
      {hasConnections && (
        <div className="p-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">
            연결된 탭
          </div>
          <ul className="space-y-1.5">
            {connections.outgoing.map((c, i) => (
              <li key={`o-${i}`} className="flex items-center gap-2">
                <span className="font-mono-nu text-[9px] bg-nu-ink text-nu-paper px-1 tracking-wider">
                  {RELATION_LABEL[c.relation] ?? c.relation}
                </span>
                <span className="font-mono-nu text-[9px] text-nu-graphite">→</span>
                <Link href={hrefFor(c.target_id)} className="text-[12px] text-nu-ink hover:text-nu-pink no-underline flex-1 truncate">
                  {c.target_title ?? c.target_id}
                </Link>
              </li>
            ))}
            {connections.incoming.map((c, i) => (
              <li key={`i-${i}`} className="flex items-center gap-2">
                <span className="font-mono-nu text-[9px] border-[1.5px] border-nu-ink px-1 tracking-wider">
                  {RELATION_LABEL[c.relation] ?? c.relation}
                </span>
                <span className="font-mono-nu text-[9px] text-nu-graphite">←</span>
                <Link href={hrefFor(c.source_id)} className="text-[12px] text-nu-ink hover:text-nu-pink no-underline flex-1 truncate">
                  {c.source_title ?? c.source_id}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasLineage && !hasConnections && (
        <div className="p-6 text-center">
          <p className="text-[12px] text-nu-graphite mb-3">
            아직 파생/연결이 없습니다.<br />
            다른 너트가 이 탭을 고도화하거나 연결할 수 있습니다.
          </p>
        </div>
      )}
    </aside>
  );
}

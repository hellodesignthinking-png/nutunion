import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Users, Rocket, ArrowRight } from "lucide-react";

/**
 * My 너트 · My 볼트 — 내가 속한 커뮤니티/프로젝트 리스트.
 * Dashboard Reader Mode 안에서 가로 스크롤 캐러셀 (모바일).
 */
export async function DashboardMyLists({ userId }: { userId: string }) {
  const supabase = await createClient();

  const [{ data: nuts }, { data: bolts }] = await Promise.all([
    supabase
      .from("group_members")
      .select("role, joined_at, group:groups!group_members_group_id_fkey(id, name, category, description, image_url, is_active)")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("joined_at", { ascending: false })
      .limit(6),
    supabase
      .from("project_members")
      .select("role, joined_at, project:projects!project_members_project_id_fkey(id, title, category, status, end_date)")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(6),
  ]);

  const myNuts = (nuts || []).map((m: any) => ({ ...m, group: Array.isArray(m.group) ? m.group[0] : m.group })).filter((m: any) => m.group?.is_active !== false);
  const myBolts = (bolts || []).map((m: any) => ({ ...m, project: Array.isArray(m.project) ? m.project[0] : m.project })).filter((m: any) => m.project);

  if (myNuts.length === 0 && myBolts.length === 0) return null;

  return (
    <section className="reader-shell mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* My 너트 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="reader-h2 inline-flex items-center gap-1.5">
              <Users size={14} className="text-[color:var(--reader-text-muted)]" />
              내 너트
              <span className="reader-meta font-normal">{myNuts.length}</span>
            </h2>
            <Link href="/groups" className="reader-meta hover:text-[color:var(--reader-text)] no-underline">전체 →</Link>
          </div>
          {myNuts.length === 0 ? (
            <div className="reader-card text-center py-6">
              <p className="reader-meta mb-2">아직 너트에 참여하지 않았어요</p>
              <Link href="/groups" className="reader-link text-[13px]">너트 탐색 →</Link>
            </div>
          ) : (
            <ul className="list-none m-0 p-0 space-y-2">
              {myNuts.slice(0, 4).map((m: any) => (
                <li key={m.group.id}>
                  <Link href={`/groups/${m.group.id}`} className="reader-card block no-underline flex items-center gap-3 hover:border-[color:var(--reader-accent)] transition-colors">
                    {m.group.image_url ? (
                      <img src={m.group.image_url} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-[color:var(--reader-border-soft)] flex items-center justify-center text-[12px] font-semibold text-[color:var(--reader-text-muted)] shrink-0">
                        {m.group.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-semibold text-[color:var(--reader-text)] truncate">{m.group.name}</span>
                        {m.role === "host" && <span className="text-[10px] font-mono-nu uppercase text-[color:var(--reader-accent)]">호스트</span>}
                      </div>
                      {m.group.description && <p className="reader-meta line-clamp-1 !text-[12px]">{m.group.description}</p>}
                    </div>
                    <ArrowRight size={11} className="shrink-0 text-[color:var(--reader-text-muted)]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* My 볼트 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="reader-h2 inline-flex items-center gap-1.5">
              <Rocket size={14} className="text-[color:var(--reader-text-muted)]" />
              내 볼트
              <span className="reader-meta font-normal">{myBolts.length}</span>
            </h2>
            <Link href="/projects" className="reader-meta hover:text-[color:var(--reader-text)] no-underline">전체 →</Link>
          </div>
          {myBolts.length === 0 ? (
            <div className="reader-card text-center py-6">
              <p className="reader-meta mb-2">아직 볼트에 참여하지 않았어요</p>
              <Link href="/projects" className="reader-link text-[13px]">볼트 탐색 →</Link>
            </div>
          ) : (
            <ul className="list-none m-0 p-0 space-y-2">
              {myBolts.slice(0, 4).map((m: any) => {
                const daysLeft = m.project.end_date
                  ? Math.ceil((new Date(m.project.end_date).getTime() - Date.now()) / 86400000)
                  : null;
                return (
                  <li key={m.project.id}>
                    <Link href={`/projects/${m.project.id}`} className="reader-card block no-underline hover:border-[color:var(--reader-accent)] transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[14px] font-semibold text-[color:var(--reader-text)] truncate">{m.project.title}</span>
                          {m.role === "lead" && <span className="text-[10px] font-mono-nu uppercase text-[color:var(--reader-accent)] shrink-0">Lead</span>}
                        </div>
                        <span className={`text-[10px] font-mono-nu uppercase shrink-0 ${
                          m.project.status === "completed" ? "text-green-700" :
                          m.project.status === "active" ? "text-[color:var(--reader-accent)]" : "text-[color:var(--reader-text-muted)]"
                        }`}>
                          {m.project.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 reader-meta !text-[11px]">
                        <span>{m.project.category}</span>
                        {daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && (
                          <span className="text-[color:var(--reader-accent)]">· D-{daysLeft}</span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

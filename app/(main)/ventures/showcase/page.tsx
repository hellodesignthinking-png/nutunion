import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Venture 성공 사례" };

interface Row {
  project_id: string;
  status: string;
  amount_req: number | null;
  decided_at: string | null;
  submitted_at: string;
  plan_id: string;
  project?: { title: string; description: string | null; closed_at: string | null; venture_stage: string | null };
  plan?: { version: number; content: Record<string, unknown> };
}

export default async function VentureShowcasePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/ventures/showcase");

  // 펀딩 결정된 사례
  const { data: funded } = await supabase
    .from("funding_submissions")
    .select("project_id, status, amount_req, decided_at, submitted_at, plan_id, project:projects(title, description, closed_at, venture_stage), plan:venture_plans(version, content)")
    .eq("status", "funded")
    .order("decided_at", { ascending: false })
    .limit(30);

  // 마감된 Venture 볼트 (closure_summary 있는)
  const { data: closed } = await supabase
    .from("projects")
    .select("id, title, closure_summary, closure_highlights, closed_at, venture_mode")
    .eq("venture_mode", true)
    .not("closed_at", "is", null)
    .order("closed_at", { ascending: false })
    .limit(30);

  const fundedRows: Row[] = (funded as Row[] | null) ?? [];
  type ClosedRow = {
    id: string;
    title: string;
    closure_summary: string | null;
    closure_highlights: Record<string, unknown> | null;
    closed_at: string | null;
  };
  const closedRows: ClosedRow[] = (closed as ClosedRow[] | null) ?? [];

  // 펀딩 + 마감 중복 제거 — funded 우선
  const fundedIds = new Set(fundedRows.map((r) => r.project_id));
  const onlyClosed = closedRows.filter((c) => !fundedIds.has(c.id));

  const totalFunded = fundedRows.reduce((s, r) => s + (r.amount_req ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <header className="mb-8">
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink mb-1">
          Venture · Showcase
        </div>
        <h1 className="text-[24px] sm:text-[30px] font-bold text-nu-ink">
          성공 사례 — 아이디어에서 사업까지
        </h1>
        <p className="text-[13px] text-nu-graphite mt-2 leading-relaxed">
          Venture Builder 를 통해 디자인 씽킹 5단계를 완주하고 실제 펀딩/마감까지 이어진 볼트들.
        </p>
      </header>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Kpi label="펀딩 결정" value={fundedRows.length.toString()} accent />
        <Kpi label="총 펀딩액" value={`₩${totalFunded.toLocaleString("ko-KR")}`} />
        <Kpi label="Venture 마감" value={closedRows.length.toString()} />
        <Kpi label="진행 중" value={"활성"} sublabel="/projects 에서 확인" />
      </div>

      {/* Funded 사례 */}
      <section className="mb-10">
        <h2 className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite border-b-[2px] border-nu-ink pb-2 mb-4">
          ✅ 펀딩 결정 ({fundedRows.length})
        </h2>
        {fundedRows.length === 0 ? (
          <p className="text-[12px] text-nu-graphite">아직 펀딩 결정 사례가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fundedRows.map((r) => {
              const content = r.plan?.content as { summary?: string; solution?: string } | undefined;
              return (
                <article key={`${r.project_id}-${r.plan_id}`} className="border-[2.5px] border-nu-ink bg-nu-paper shadow-[4px_4px_0_0_rgba(255,61,136,1)] p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-mono-nu text-[9px] uppercase tracking-wider bg-nu-pink text-nu-paper px-1.5 py-0.5">
                      FUNDED
                    </span>
                    {r.decided_at && (
                      <span className="font-mono-nu text-[10px] text-nu-graphite">
                        {new Date(r.decided_at).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                    {r.amount_req && (
                      <span className="font-mono-nu text-[12px] font-bold text-nu-ink ml-auto">
                        ₩{r.amount_req.toLocaleString("ko-KR")}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[16px] font-bold text-nu-ink mb-1">{r.project?.title ?? "-"}</h3>
                  {content?.summary && (
                    <p className="text-[12px] text-nu-graphite leading-relaxed mb-2 line-clamp-3">
                      {content.summary}
                    </p>
                  )}
                  <Link
                    href={`/projects/${r.project_id}/venture`}
                    className="inline-block font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink hover:underline no-underline"
                  >
                    → Venture 보기
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Closed 사례 */}
      {onlyClosed.length > 0 && (
        <section>
          <h2 className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite border-b-[2px] border-nu-ink pb-2 mb-4">
            🏁 완료된 Venture ({onlyClosed.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {onlyClosed.map((c) => {
              const h = c.closure_highlights as { headline?: string } | null;
              return (
                <article key={c.id} className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-mono-nu text-[9px] uppercase tracking-wider bg-nu-ink text-nu-paper px-1.5 py-0.5">
                      CLOSED
                    </span>
                    {c.closed_at && (
                      <span className="font-mono-nu text-[10px] text-nu-graphite">
                        {new Date(c.closed_at).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[16px] font-bold text-nu-ink mb-1">{c.title}</h3>
                  {h?.headline && (
                    <p className="text-[13px] text-nu-ink italic mb-2">&ldquo;{h.headline}&rdquo;</p>
                  )}
                  {c.closure_summary && (
                    <p className="text-[12px] text-nu-graphite leading-relaxed mb-2 line-clamp-3">
                      {c.closure_summary}
                    </p>
                  )}
                  <Link
                    href={`/projects/${c.id}`}
                    className="inline-block font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink hover:text-nu-pink no-underline"
                  >
                    → 상세
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <p className="mt-10 text-[11px] text-nu-graphite">
        이 페이지는 자동 집계입니다. 새 사례는 펀딩 결정 또는 볼트 마감 시 자동 추가됩니다.
      </p>
    </div>
  );
}

function Kpi({ label, value, sublabel, accent }: { label: string; value: string; sublabel?: string; accent?: boolean }) {
  return (
    <div className={`border-[2.5px] p-4 ${accent ? "border-nu-pink bg-nu-pink/5" : "border-nu-ink bg-nu-paper"}`}>
      <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">{label}</div>
      <div className={`text-[22px] font-bold ${accent ? "text-nu-pink" : "text-nu-ink"} tabular-nums`}>{value}</div>
      {sublabel && <div className="font-mono-nu text-[9px] text-nu-graphite mt-0.5">{sublabel}</div>}
    </div>
  );
}

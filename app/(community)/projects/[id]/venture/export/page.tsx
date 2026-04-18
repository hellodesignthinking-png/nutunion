import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getVentureOverview } from "@/lib/venture/queries";
import { STAGES } from "@/lib/venture/types";
import { PrintBar } from "@/components/venture/print-bar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Venture Report (인쇄용)" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VentureExportPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/projects/${id}/venture/export`);

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, description, venture_mode, venture_stage, closure_summary, closure_highlights, closed_at, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const overview = await getVentureOverview(id);
  const plan = overview.currentPlan;
  const today = new Date().toLocaleDateString("ko-KR");

  return (
    <>
      <style>{`
        @media print {
          body { background: white; }
          .print-hide { display: none !important; }
          .print-page { page-break-after: always; }
          .print-page:last-child { page-break-after: auto; }
          @page { margin: 15mm; size: A4; }
        }
        body { background: #f5f5f5; }
        .print-page { background: white; padding: 2rem; margin: 1rem auto; max-width: 210mm; min-height: 297mm; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      `}</style>

      <PrintBar backHref={`/projects/${id}/venture`} />

      {/* Page 1 — 표지 */}
      <section className="print-page">
        <div className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite mb-4">
          Venture Builder · Final Report
        </div>
        <h1 className="text-[36px] font-bold text-nu-ink leading-tight mb-2">{project.title}</h1>
        {project.description && (
          <p className="text-[15px] text-nu-graphite leading-relaxed mb-8">{project.description}</p>
        )}

        <div className="grid grid-cols-2 gap-4 my-8">
          <Meta label="시작일" value={new Date(project.created_at).toLocaleDateString("ko-KR")} />
          <Meta label="보고일" value={today} />
          <Meta label="현재 단계" value={STAGES.find((s) => s.id === project.venture_stage)?.label ?? "-"} />
          <Meta label="상태" value={project.closed_at ? "🏁 마감" : "🏃 진행 중"} />
        </div>

        {project.closure_summary && (
          <div className="mt-8 border-t-[3px] border-nu-ink pt-6">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink mb-2">
              Closure Summary
            </div>
            <p className="text-[14px] text-nu-ink leading-relaxed whitespace-pre-wrap">
              {project.closure_summary}
            </p>
          </div>
        )}
      </section>

      {/* Page 2 — 데이터 요약 */}
      <section className="print-page">
        <h2 className="text-[24px] font-bold text-nu-ink mb-6">디자인 씽킹 5단계 요약</h2>

        <div className="space-y-4">
          <StageSummary title="① 공감 (Empathize)" count={overview.insights.length} unit="건의 인사이트" items={overview.insights.slice(0, 5).map(i => i.quote.slice(0, 120))} />
          <StageSummary
            title="② 정의 (Define)"
            count={overview.problems.length}
            unit="개의 HMW 후보"
            items={overview.problems.filter(p => p.is_selected).map(p => `★ ${p.hmw_statement}`)}
          />
          <StageSummary
            title="③ 아이디어 (Ideate)"
            count={overview.ideas.length}
            unit="개의 아이디어"
            items={overview.ideas.filter(i => i.is_main).map(i => `★ ${i.title}${i.description ? ` — ${i.description.slice(0, 100)}` : ""}`)}
          />
          <StageSummary
            title="④ 프로토타입 (Prototype)"
            count={overview.tasks.length}
            unit={`태스크 · 완료 ${overview.tasks.filter(t => t.status === "done").length}개 · 피드백 ${overview.feedback.length}건`}
            items={[]}
          />
        </div>
      </section>

      {/* Page 3 — 사업계획서 */}
      {plan && (
        <section className="print-page">
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="text-[24px] font-bold text-nu-ink">⑤ 사업계획서</h2>
            <span className="font-mono-nu text-[10px] uppercase tracking-wider bg-nu-ink text-nu-paper px-1.5 py-0.5">
              v{plan.version}
            </span>
          </div>

          {plan.content.summary && <PlanSection label="경영진 요약" value={plan.content.summary} />}
          {plan.content.problem && <PlanSection label="문제" value={plan.content.problem} />}
          {plan.content.solution && <PlanSection label="솔루션" value={plan.content.solution} />}
          {plan.content.target && <PlanSection label="타겟 고객" value={plan.content.target} />}
          {plan.content.market && <PlanSection label="시장" value={plan.content.market} />}
          {plan.content.business_model && <PlanSection label="비즈니스 모델" value={plan.content.business_model} />}

          {plan.content.milestones && plan.content.milestones.length > 0 && (
            <div className="mb-4">
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">
                마일스톤
              </div>
              <ol className="list-decimal pl-5 space-y-1">
                {plan.content.milestones.map((m, i) => (
                  <li key={i} className="text-[13px] text-nu-ink">{m}</li>
                ))}
              </ol>
            </div>
          )}

          {plan.content.team && <PlanSection label="팀" value={plan.content.team} />}
        </section>
      )}

      {/* Page 4 — 최종 보고서 하이라이트 */}
      {project.closure_highlights && (
        <section className="print-page">
          <h2 className="text-[24px] font-bold text-nu-ink mb-6">🏁 최종 결실</h2>
          {(() => {
            const h = project.closure_highlights as {
              headline?: string;
              achievements?: string[];
              challenges?: string[];
              lessons?: string[];
              key_contributors?: { name: string; role: string | null; contribution: string }[];
              final_outputs?: string[];
            };
            return (
              <>
                {h.headline && (
                  <div className="mb-6 border-l-[4px] border-nu-pink pl-3">
                    <p className="text-[18px] font-bold text-nu-ink italic">&ldquo;{h.headline}&rdquo;</p>
                  </div>
                )}
                {h.achievements && <Group title="성과" items={h.achievements} />}
                {h.challenges && <Group title="과제" items={h.challenges} />}
                {h.lessons && <Group title="배운 점" items={h.lessons} />}
                {h.final_outputs && <Group title="최종 산출물" items={h.final_outputs} />}
                {h.key_contributors && h.key_contributors.length > 0 && (
                  <div className="mb-4">
                    <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">
                      핵심 기여자
                    </div>
                    <ul className="space-y-1.5">
                      {h.key_contributors.map((c, i) => (
                        <li key={i} className="text-[13px] text-nu-ink">
                          <strong>{c.name}</strong>
                          {c.role && <span className="text-nu-graphite"> · {c.role}</span>}
                          <div className="text-[12px] text-nu-graphite">{c.contribution}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            );
          })()}
        </section>
      )}

      {/* 푸터 */}
      <section className="print-page" style={{ minHeight: "auto", padding: "1rem 2rem", textAlign: "center" }}>
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite">
          nutunion · Venture Builder Report · {today}
        </div>
      </section>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-0.5">{label}</div>
      <div className="text-[14px] text-nu-ink font-bold">{value}</div>
    </div>
  );
}

function StageSummary({ title, count, unit, items }: { title: string; count: number; unit: string; items: string[] }) {
  return (
    <div className="border-l-[4px] border-nu-ink pl-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[16px] font-bold text-nu-ink">{title}</h3>
        <span className="font-mono-nu text-[11px] text-nu-graphite">
          {count} {unit}
        </span>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 space-y-1">
          {items.map((it, i) => (
            <li key={i} className="text-[12px] text-nu-graphite">· {it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlanSection({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4">
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">
        {label}
      </div>
      <p className="text-[13px] text-nu-ink leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function Group({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">
        {title}
      </div>
      <ul className="list-disc pl-5 space-y-0.5">
        {items.map((it, i) => (
          <li key={i} className="text-[13px] text-nu-ink">{it}</li>
        ))}
      </ul>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { b2bPortalEnabled } from "@/lib/flags";
import { Building2, Plus, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { PageHero } from "@/components/shared/page-hero";

export const dynamic = "force-dynamic";
export const metadata = { title: "B2B 발주 — nutunion" };

function fmt(n: number | null | undefined) {
  return n ? new Intl.NumberFormat("ko-KR").format(n) : "—";
}

const TIER_META: Record<string, { label: string; color: string }> = {
  startup:   { label: "스타트업", color: "bg-nu-pink/10 text-nu-pink" },
  sme:       { label: "중소기업", color: "bg-nu-blue/10 text-nu-blue" },
  enterprise:{ label: "대기업",   color: "bg-nu-ink/10 text-nu-ink" },
  public:    { label: "공공기관", color: "bg-green-100 text-green-700" },
  nonprofit: { label: "비영리",   color: "bg-nu-amber/10 text-nu-amber" },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  open:        { label: "모집 중",   color: "text-nu-pink" },
  matching:    { label: "매칭 중",   color: "text-nu-blue" },
  matched:     { label: "매칭 완료", color: "text-nu-amber" },
  in_progress: { label: "진행 중",   color: "text-green-700" },
  completed:   { label: "완료",      color: "text-nu-graphite" },
  cancelled:   { label: "취소",      color: "text-nu-muted" },
};

export default async function B2BPortalPage() {
  const enabled = await b2bPortalEnabled();
  if (!enabled) {
    // 비활성화 상태 — landing만 표시 (베타 신청 안내)
    return (
      <div className="bg-nu-paper min-h-screen">
        <PageHero
          compact
          category="B2B"
          title="B2B 발주 포털"
          description="기업·기관이 nutunion 팀에 프로젝트를 발주하는 전용 채널. 현재 베타 준비 중."
        />
        <div className="max-w-2xl mx-auto px-6 py-12 text-center">
          <Building2 size={32} className="mx-auto text-nu-muted mb-3" />
          <h2 className="font-head text-xl font-extrabold text-nu-ink mb-2">B2B 포털 베타 오픈 예정</h2>
          <p className="text-[13px] text-nu-graphite leading-relaxed mb-6">
            지자체 · 공공기관 · 대기업의 <strong>문화기획 / 도시재생 / 리서치</strong> 발주를
            nutunion 큐레이티드 팀과 연결합니다. 얼리 액세스를 원하시면 운영팀에 문의해주세요.
          </p>
          <Link href="/challenges" className="inline-flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-4 py-2 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper no-underline">
            기존 의뢰 경로 보기 <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/b2b");

  const [{ data: requests }, { data: myOrgs }] = await Promise.all([
    supabase
      .from("b2b_bolt_requests")
      .select("id, title, description, category, budget_min, budget_max, deadline, status, created_at, organization:b2b_organizations(id, name, tier, verified)")
      .in("status", ["open", "matching", "matched", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("b2b_organizations")
      .select("id, name, verified, tier")
      .eq("created_by", user.id),
  ]);

  const rows = (requests as any[]) || [];
  const hasOrg = (myOrgs as any[])?.length > 0;

  return (
    <div className="bg-nu-paper min-h-screen pb-20">
      <PageHero
        compact
        category="B2B"
        title="기관 발주 포털"
        description="검증된 기업·기관이 nutunion 팀에 프로젝트를 발주합니다. 관심 있는 발주에 제안을 보내보세요."
        stats={[
          { label: "진행 중 발주", value: `${rows.length}건`, icon: <Clock size={12} /> },
          { label: "내 조직", value: `${myOrgs?.length || 0}개`, icon: <Building2 size={12} /> },
        ]}
      />

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* 내 조직 / 발주 등록 CTA */}
        <section className="flex items-center justify-between border-[2px] border-nu-ink/10 bg-nu-cream/30 p-3">
          <div>
            <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">기관 담당자이신가요?</p>
            <p className="text-[12px] text-nu-ink mt-0.5">조직을 등록하고 발주를 올려보세요</p>
          </div>
          <Link href={hasOrg ? "/b2b/new" : "/b2b/organizations/new"}
            className="inline-flex items-center gap-1 font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2 bg-nu-ink text-nu-paper hover:bg-nu-pink no-underline">
            <Plus size={11} /> {hasOrg ? "발주 올리기" : "조직 등록"}
          </Link>
        </section>

        {/* 발주 리스트 */}
        {rows.length === 0 ? (
          <div className="border-[2px] border-dashed border-nu-ink/15 p-12 text-center">
            <Building2 size={28} className="mx-auto text-nu-muted mb-3" />
            <p className="text-[13px] text-nu-graphite">아직 등록된 발주가 없습니다</p>
          </div>
        ) : (
          <ul className="list-none m-0 p-0 space-y-2">
            {rows.map((r) => {
              const tier = r.organization?.tier || "startup";
              const tierMeta = TIER_META[tier] || TIER_META.startup;
              const statusMeta = STATUS_META[r.status] || STATUS_META.open;
              return (
                <li key={r.id}>
                  <Link href={`/b2b/${r.id}`}
                    className="block border-[2px] border-nu-ink/10 hover:border-nu-pink bg-nu-paper p-3 no-underline transition-all">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-mono-nu text-[9px] uppercase px-1.5 py-0.5 ${tierMeta.color}`}>
                        {tierMeta.label}
                      </span>
                      {r.organization?.verified && <CheckCircle2 size={10} className="text-green-600" />}
                      <span className="font-mono-nu text-[10px] text-nu-graphite">{r.organization?.name || "—"}</span>
                      <span className={`font-mono-nu text-[9px] uppercase tracking-widest ml-auto ${statusMeta.color}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <div className="font-bold text-[14px] text-nu-ink mb-1">{r.title}</div>
                    {r.description && <p className="text-[11px] text-nu-graphite line-clamp-2 leading-relaxed">{r.description}</p>}
                    <div className="flex items-center gap-3 mt-2 font-mono-nu text-[10px] text-nu-graphite">
                      <span>💰 ₩{fmt(r.budget_min)} ~ ₩{fmt(r.budget_max)}</span>
                      {r.deadline && <span>📅 ~{new Date(r.deadline).toLocaleDateString("ko", { month: "short", day: "numeric" })}</span>}
                      {r.category && <span className="uppercase">· {r.category}</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

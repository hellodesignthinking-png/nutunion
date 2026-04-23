import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Rocket } from "lucide-react";
import type { DevPlan } from "@/lib/genesis/dev-plan-schema";
import { DevPlanView } from "@/components/genesis/dev-plan-view";

export const dynamic = "force-dynamic";

export default async function DevPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // migration 109 graceful fallback
  let plan: DevPlan | null = null;
  let project: { id: string; title: string; created_by: string | null } | null = null;
  let generatedAt: string | null = null;
  let intent: string | null = null;

  try {
    const { data, error } = await supabase
      .from("projects")
      .select("id, title, dev_plan, dev_plan_generated_at, created_by, description")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      notFound();
    }
    project = {
      id: data.id,
      title: data.title,
      created_by: (data as any).created_by ?? null,
    };
    plan = (data as any).dev_plan as DevPlan | null;
    generatedAt = (data as any).dev_plan_generated_at || null;
    intent = (plan?.mvp_target ? plan.mvp_target : null) || (data as any).description || null;
  } catch {
    notFound();
  }

  if (!project) notFound();

  if (!plan) {
    return (
      <div className="min-h-screen bg-nu-paper">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <Link
            href={`/projects/${id}`}
            className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-nu-ink no-underline"
          >
            <ArrowLeft size={12} /> 볼트로
          </Link>
          <div className="mt-8 bg-nu-cream border-[4px] border-nu-ink p-10 text-center shadow-[6px_6px_0_0_#0D0F14]">
            <Rocket size={40} className="mx-auto mb-3 text-nu-pink" />
            <h1 className="font-head text-2xl font-black text-nu-ink">
              개발 로드맵이 아직 생성되지 않았습니다
            </h1>
            <p className="mt-3 text-sm text-nu-muted">
              Genesis AI 에서 <span className="font-bold text-nu-pink">🛠️ 개발 로드맵 모드</span>로
              이 볼트를 프로비저닝하면 SecondWind 수준의 상세 스케줄이 이 페이지에 표시됩니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isHost = !!user && !!project.created_by && user.id === project.created_by;

  return (
    <DevPlanView
      projectId={project.id}
      projectTitle={project.title}
      plan={plan}
      generatedAt={generatedAt}
      isHost={isHost}
      intent={intent}
    />
  );
}

/**
 * PATCH /api/genesis/dev-plan/:projectId
 * 호스트가 dev_plan 의 일부 필드(narrative markdown 등)를 인라인 편집할 때 사용.
 * Body: { patch: Partial<DevPlan> }  — 얕은 merge.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/observability/logger";

export const maxDuration = 30;

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await ctx.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const body = await request.json();
    const patch = body?.patch;
    if (!patch || typeof patch !== "object") {
      return NextResponse.json({ error: "patch 객체가 필요합니다" }, { status: 400 });
    }

    // 호스트(생성자) 만 편집 허용
    const { data: proj, error: pErr } = await supabase
      .from("projects")
      .select("id, created_by, dev_plan")
      .eq("id", projectId)
      .maybeSingle();
    if (pErr || !proj) {
      return NextResponse.json({ error: "볼트를 찾을 수 없음" }, { status: 404 });
    }
    if (proj.created_by !== user.id) {
      return NextResponse.json({ error: "호스트만 편집 가능" }, { status: 403 });
    }

    const current = (proj as any).dev_plan || {};
    // patch 가 { replace: true, plan } 형태면 전체 교체, 아니면 shallow merge
    const merged =
      patch && typeof patch === "object" && (patch as any).__replace && (patch as any).plan
        ? (patch as any).plan
        : { ...current, ...patch };

    const { error: upErr } = await supabase
      .from("projects")
      .update({
        dev_plan: merged,
        dev_plan_generated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
    if (upErr) {
      log.warn("genesis.devplan.patch_failed", { error: upErr.message, projectId });
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, plan: merged });
  } catch (err: any) {
    log.error(err, "genesis.devplan.patch.exception");
    return NextResponse.json({ error: err?.message || "편집 실패" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const BodySchema = z.object({
  to_stage: z.enum(["empathize", "define", "ideate", "prototype", "plan"]),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/venture/[projectId]/revert
 *
 * 현재 단계에서 이전 단계로 되돌림. venture_stage_history 에 is_revert=true 로 기록.
 * 호스트 / admin / staff 만 가능.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`venture-revert:${user.id}`, 10, 60_000);
  if (!rl.success) return NextResponse.json({ error: "요청이 너무 많습니다" }, { status: 429 });

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "잘못된 입력" }, { status: 400 });

  const [{ data: project }, { data: profile }, { data: pm }] = await Promise.all([
    supabase.from("projects").select("created_by, venture_stage").eq("id", projectId).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!project) return NextResponse.json({ error: "프로젝트 없음" }, { status: 404 });

  const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
  const isHost = (project as { created_by?: string }).created_by === user.id
    || pm?.role === "host" || pm?.role === "manager" || pm?.role === "owner";
  if (!isAdminStaff && !isHost) {
    return NextResponse.json({ error: "호스트/admin 만 단계 되돌리기 가능" }, { status: 403 });
  }

  const currentStage = (project as { venture_stage?: string | null }).venture_stage ?? null;
  if (currentStage === parsed.data.to_stage) {
    return NextResponse.json({ error: "이미 그 단계입니다" }, { status: 400 });
  }

  // 순서 검증 — 되돌림은 앞 단계로만
  const order = ["empathize", "define", "ideate", "prototype", "plan"];
  const curIdx = order.indexOf(currentStage ?? "");
  const nextIdx = order.indexOf(parsed.data.to_stage);
  if (curIdx !== -1 && nextIdx >= curIdx) {
    return NextResponse.json({ error: "되돌리기는 이전 단계로만 가능합니다. 앞으로 가려면 일반 stage 변경 사용" }, { status: 400 });
  }

  // stage 변경 + history 기록
  const { error: updErr } = await supabase
    .from("projects")
    .update({ venture_stage: parsed.data.to_stage })
    .eq("id", projectId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  try {
    await supabase.from("venture_stage_history").insert({
      project_id: projectId,
      from_stage: currentStage,
      to_stage: parsed.data.to_stage,
      changed_by: user.id,
      is_revert: true,
      note: parsed.data.reason
        ? `🔄 단계 되돌림: ${parsed.data.reason}`
        : `🔄 ${currentStage} → ${parsed.data.to_stage} 단계 되돌림`,
    });
  } catch (err) {
    log.error(err, "venture.projectId.revert.failed");
    console.warn("[stage revert] history insert failed", err);
  }

  return NextResponse.json({ success: true, from: currentStage, to: parsed.data.to_stage });
}

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { seedVentureTemplate } from "@/lib/venture/seed-template";

export const runtime = "nodejs";

const BodySchema = z.object({
  category: z.enum(["saas", "community", "local", "content", "generic"]).optional(),
});

/** POST /api/venture/[projectId]/enable — host/admin 만 */
export const POST = withRouteLog("venture.projectId.enable", async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  const category = parsed.success ? (parsed.data.category ?? "generic") : "generic";

  const [{ data: profile }, { data: project }, { data: pm }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("projects").select("created_by, venture_mode, venture_stage").eq("id", projectId).maybeSingle(),
    supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!project) return NextResponse.json({ error: "프로젝트 없음" }, { status: 404 });

  const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
  const isHost =
    (project as { created_by?: string }).created_by === user.id ||
    pm?.role === "host" ||
    pm?.role === "manager" ||
    pm?.role === "owner";
  if (!isAdminStaff && !isHost) {
    return NextResponse.json({ error: "권한 없음 (호스트/admin)" }, { status: 403 });
  }

  // 재활성화 시 기존 stage 보존 — 이미 venture_mode=true 면 stage 덮어쓰지 않음
  const alreadyEnabled = (project as { venture_mode?: boolean }).venture_mode === true;
  const currentStage = (project as { venture_stage?: string | null }).venture_stage ?? null;

  // 템플릿 시드를 먼저 시도 (실패해도 진행) — 이후 venture_mode 플래그 활성화
  let seeded = false;
  let seedError: string | null = null;
  try {
    const result = await seedVentureTemplate(supabase, projectId, user.id, category);
    seeded = result.seeded;
  } catch (err) {
    log.error(err, "venture.projectId.enable.failed");
    seedError = err instanceof Error ? err.message : "seed failed";
    console.warn("[venture seed]", err);
  }

  const updates: Record<string, unknown> = { venture_mode: true };
  if (!alreadyEnabled || !currentStage) {
    updates.venture_stage = "empathize";
  }

  const { error } = await supabase.from("projects").update(updates).eq("id", projectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, seeded, seedError });
});

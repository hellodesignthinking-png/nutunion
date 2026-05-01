import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { aiError } from "@/lib/ai/error";
import { rateLimit } from "@/lib/rate-limit";
import { dispatchPushToUsers } from "@/lib/push/dispatch";

export const runtime = "nodejs";

const BodySchema = z.object({
  problems: z.array(
    z.object({
      hmw_statement: z.string().min(5),
      target_user: z.string().nullable().optional(),
      context: z.string().nullable().optional(),
      success_metric: z.string().nullable().optional(),
      rationale: z.string().nullable().optional(),
      citations: z.array(z.object({
        source_id: z.string().uuid(),
        title: z.string(),
        kind: z.string(),
        quote: z.string(),
      })).optional(),
    })
  ).min(1).max(10),
});

/** POST — AI 가 제안한 HMW 중 선택된 것들을 venture_problems 에 저장 */
export const POST = withRouteLog("venture.projectId.synthesize-problems.save", async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return aiError("auth", "venture/synthesize-problems/save");

  // 멤버십/관리자 확인 — app-level defense-in-depth
  const [{ data: profile }, { data: pm }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("project_members").select("user_id").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
  ]);
  const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
  if (!pm && !isAdminStaff) return aiError("forbidden", "venture/synthesize-problems/save");

  const { success } = rateLimit(`ai:${user.id}`, 30, 60_000);
  if (!success) return aiError("rate_limit", "venture/synthesize-problems/save");

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return aiError("bad_input", "venture/synthesize-problems/save", { internal: parsed.error.issues });

  const rows = parsed.data.problems.map((p) => ({
    project_id: projectId,
    author_id: user.id,
    hmw_statement: p.hmw_statement,
    target_user: p.target_user ?? null,
    context: p.context ?? null,
    success_metric: p.success_metric ?? null,
    is_selected: false,
    generated_by_ai: true,
    ai_rationale: p.rationale ?? null,
    source_citations: p.citations ?? [],
  }));

  const { data, error } = await supabase.from("venture_problems").insert(rows).select("id");
  if (error) return aiError("server_error", "venture/synthesize-problems/save", { internal: error.message });

  // Push 알림 — 호스트 + 다른 멤버에게 (저자 자신 제외)
  try {
    const [{ data: project }, { data: members }] = await Promise.all([
      supabase.from("projects").select("title, created_by").eq("id", projectId).maybeSingle(),
      supabase.from("project_members").select("user_id").eq("project_id", projectId),
    ]);
    const userIds = new Set<string>();
    const hostId = (project as { created_by?: string } | null)?.created_by;
    if (hostId && hostId !== user.id) userIds.add(hostId);
    for (const m of ((members as { user_id: string }[] | null) ?? [])) {
      if (m.user_id !== user.id) userIds.add(m.user_id);
    }
    if (userIds.size > 0) {
      dispatchPushToUsers([...userIds], {
        title: `🎯 새 HMW ${rows.length}개 추가`,
        body: `${(project as { title?: string } | null)?.title ?? "볼트"} — AI 분석 결과 HMW 가 저장됐습니다`,
        url: `/projects/${projectId}/venture`,
        tag: `venture-hmw-${projectId}`,
      }).catch((err) => console.warn("[hmw push]", err));
    }
  } catch (err) {
    log.error(err, "venture.projectId.synthesize-problems.save.failed");
    console.warn("[hmw notify]", err);
  }

  return NextResponse.json({ success: true, inserted: data?.length ?? 0, ids: data?.map((r) => r.id) ?? [] });
});

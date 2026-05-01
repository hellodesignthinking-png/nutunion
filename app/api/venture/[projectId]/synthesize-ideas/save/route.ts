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
  ideas: z.array(
    z.object({
      title: z.string().min(2).max(200),
      description: z.string().nullable().optional(),
      linked_problem_id: z.string().uuid().nullable().optional(),
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

export const POST = withRouteLog("venture.projectId.synthesize-ideas.save", async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return aiError("auth", "venture/synthesize-ideas/save");

  const [{ data: profile }, { data: pm }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("project_members").select("user_id").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
  ]);
  const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
  if (!pm && !isAdminStaff) return aiError("forbidden", "venture/synthesize-ideas/save");

  const { success } = rateLimit(`ai:${user.id}`, 30, 60_000);
  if (!success) return aiError("rate_limit", "venture/synthesize-ideas/save");

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return aiError("bad_input", "venture/synthesize-ideas/save");

  const rows = parsed.data.ideas.map((i) => ({
    project_id: projectId,
    author_id: user.id,
    title: i.title,
    description: i.description ?? null,
    is_main: false,
    generated_by_ai: true,
    ai_rationale: i.rationale ?? null,
    source_citations: i.citations ?? [],
    linked_problem_id: i.linked_problem_id ?? null,
  }));

  const { data, error } = await supabase.from("venture_ideas").insert(rows).select("id");
  if (error) return aiError("server_error", "venture/synthesize-ideas/save", { internal: error.message });

  // Push 알림 — 호스트 + 다른 멤버
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
        title: `💡 새 아이디어 ${rows.length}개 추가`,
        body: `${(project as { title?: string } | null)?.title ?? "볼트"} — AI 발산 결과 아이디어가 저장됐습니다`,
        url: `/projects/${projectId}/venture`,
        tag: `venture-idea-${projectId}`,
      }).catch((err) => console.warn("[idea push]", err));
    }
  } catch (err) {
    log.error(err, "venture.projectId.synthesize-ideas.save.failed");
    console.warn("[idea notify]", err);
  }

  return NextResponse.json({ success: true, inserted: data?.length ?? 0, ids: data?.map((r) => r.id) ?? [] });
});

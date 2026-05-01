import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/venture/[projectId]/cleanup-placeholders
 *
 * 쿼리 파라미터 `?dry=1` 이면 실제 삭제하지 않고 대상 IDs 만 반환 (미리보기).
 * 기본은 실제 삭제.
 *
 * 이전 seed 로직이 삽입한 플레이스홀더 포함 예시 행을 삭제:
 *   - problems 중 hmw_statement 에 `[...]` 패턴 포함
 *   - ideas 중 title 이 템플릿 sample 정확 일치 또는 `[...]` 포함
 *   - prototype_tasks 중 title 이 템플릿 sample 정확 일치
 *
 * 호스트 / admin / staff 만 가능. rate limit 10/분.
 */
export const POST = withRouteLog("venture.projectId.cleanup-placeholders", async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`cleanup:${user.id}`, 10, 60_000);
  if (!rl.success) return NextResponse.json({ error: "요청이 너무 많습니다" }, { status: 429 });

  const dryRun = new URL(req.url).searchParams.get("dry") === "1";

  // 권한 확인 — 호스트 / admin / staff
  const [{ data: project }, { data: profile }, { data: pm }] = await Promise.all([
    supabase.from("projects").select("created_by").eq("id", projectId).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!project) return NextResponse.json({ error: "프로젝트 없음" }, { status: 404 });
  const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
  const isHost = (project as { created_by?: string }).created_by === user.id
    || pm?.role === "host" || pm?.role === "manager" || pm?.role === "owner";
  if (!isAdminStaff && !isHost) {
    return NextResponse.json({ error: "호스트/admin 만 가능" }, { status: 403 });
  }

  const deleted = { problems: 0, ideas: 0, tasks: 0 };
  const errors: string[] = [];

  // 1. problems — hmw_statement 에 대괄호 패턴 포함
  try {
    const { data: probs } = await supabase
      .from("venture_problems")
      .select("id, hmw_statement")
      .eq("project_id", projectId);
    const bracketIds = ((probs as { id: string; hmw_statement: string }[] | null) ?? [])
      .filter((p) => /\[[^\]]+\]/.test(p.hmw_statement))
      .map((p) => p.id);
    if (bracketIds.length > 0) {
      if (dryRun) {
        deleted.problems = bracketIds.length;
      } else {
        const { error } = await supabase.from("venture_problems").delete().in("id", bracketIds);
        if (error) errors.push(`problems: ${error.message}`);
        else deleted.problems = bracketIds.length;
      }
    }
  } catch (err) {
    log.error(err, "venture.projectId.cleanup-placeholders.failed");
    errors.push(`problems exception: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. ideas — title 또는 description 이 템플릿 sample 과 정확 일치
  try {
    const { TEMPLATES } = await import("@/lib/venture/templates");
    const allSampleTitles = new Set<string>();
    const allSampleDescs = new Set<string>();
    for (const t of Object.values(TEMPLATES)) {
      for (const i of t.idea_samples) {
        allSampleTitles.add(i.title);
        allSampleDescs.add(i.description);
      }
    }
    const { data: ideas } = await supabase
      .from("venture_ideas")
      .select("id, title, description")
      .eq("project_id", projectId);
    const ideaIds = ((ideas as { id: string; title: string; description: string | null }[] | null) ?? [])
      .filter((i) => allSampleTitles.has(i.title) || (i.description && allSampleDescs.has(i.description)) || /\[[^\]]+\]/.test(i.title) || (i.description && /\[[^\]]+\]/.test(i.description)))
      .map((i) => i.id);
    if (ideaIds.length > 0) {
      if (dryRun) {
        deleted.ideas = ideaIds.length;
      } else {
        const { error } = await supabase.from("venture_ideas").delete().in("id", ideaIds);
        if (error) errors.push(`ideas: ${error.message}`);
        else deleted.ideas = ideaIds.length;
      }
    }
  } catch (err) {
    log.error(err, "venture.projectId.cleanup-placeholders.failed");
    errors.push(`ideas exception: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. prototype_tasks — title 이 템플릿 sample 과 정확 일치
  try {
    const { TEMPLATES } = await import("@/lib/venture/templates");
    const allSampleTasks = new Set<string>();
    for (const t of Object.values(TEMPLATES)) {
      for (const task of t.prototype_tasks) allSampleTasks.add(task);
    }
    const { data: tasks } = await supabase
      .from("venture_prototype_tasks")
      .select("id, title")
      .eq("project_id", projectId);
    const taskIds = ((tasks as { id: string; title: string }[] | null) ?? [])
      .filter((t) => allSampleTasks.has(t.title))
      .map((t) => t.id);
    if (taskIds.length > 0) {
      if (dryRun) {
        deleted.tasks = taskIds.length;
      } else {
        const { error } = await supabase.from("venture_prototype_tasks").delete().in("id", taskIds);
        if (error) errors.push(`tasks: ${error.message}`);
        else deleted.tasks = taskIds.length;
      }
    }
  } catch (err) {
    log.error(err, "venture.projectId.cleanup-placeholders.failed");
    errors.push(`tasks exception: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 기록 (dry-run 시 skip)
  if (!dryRun) {
    try {
      const totalDeleted = deleted.problems + deleted.ideas + deleted.tasks;
      if (totalDeleted > 0) {
        await supabase.from("venture_stage_history").insert({
          project_id: projectId,
          from_stage: null,
          to_stage: "empathize",
          changed_by: user.id,
          note: `🧹 플레이스holder 정리: problems ${deleted.problems} / ideas ${deleted.ideas} / tasks ${deleted.tasks}`,
        });
      }
    } catch { /* noop */ }
  }

  return NextResponse.json({
    success: errors.length === 0,
    dryRun,
    deleted,
    total: deleted.problems + deleted.ideas + deleted.tasks,
    errors: errors.length > 0 ? errors : undefined,
  });
});

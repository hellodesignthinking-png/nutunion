/**
 * POST /api/dashboard/mindmap/save-ai-task
 *
 * Genesis AI 가 마인드맵에 띄운 임시 ai-task 노드를 실제 볼트의 todo 로 변환.
 *
 * Body: { project_id: string; title: string; }
 * 권한: 호출자가 해당 볼트 멤버여야 함 (project_members 체크)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { log } from "@/lib/observability/logger";

export const POST = withRouteLog("dashboard.mindmap.save_ai_task", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const projectId: string | undefined = body?.project_id;
  const title: string | undefined = body?.title;
  if (!projectId || !title?.trim()) {
    return NextResponse.json({ error: "project_id + title required" }, { status: 400 });
  }
  if (title.length > 200) {
    return NextResponse.json({ error: "title 200자 이내" }, { status: 400 });
  }

  // 볼트 멤버 검증
  const { data: pm } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!pm) {
    log.warn("dashboard.mindmap.save_ai_task.forbidden", { user_id: user.id, project_id: projectId });
    return NextResponse.json({ error: "이 볼트의 멤버가 아닙니다" }, { status: 403 });
  }

  // sort_order 끝에 추가
  const { data: last } = await supabase
    .from("project_tasks")
    .select("sort_order")
    .eq("project_id", projectId)
    .eq("status", "todo")
    .order("sort_order", { ascending: false })
    .limit(1);
  const sortOrder = ((last?.[0] as any)?.sort_order ?? -1) + 1;

  const { data: task, error } = await supabase
    .from("project_tasks")
    .insert({
      project_id: projectId,
      title: title.trim(),
      status: "todo",
      sort_order: sortOrder,
      assigned_to: user.id,
      description: `🧠 Genesis 마인드맵 제안에서 추가됨`,
    })
    .select("id")
    .single();

  if (error) {
    // description 컬럼 미존재 환경 fallback
    if (/description/.test(error.message || "")) {
      const { data: t2, error: e2 } = await supabase
        .from("project_tasks")
        .insert({ project_id: projectId, title: title.trim(), status: "todo", sort_order: sortOrder, assigned_to: user.id })
        .select("id")
        .single();
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
      return NextResponse.json({ task_id: t2?.id });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task_id: task?.id });
});

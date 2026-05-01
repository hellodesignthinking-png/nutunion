/**
 * POST /api/chat-digest/[id]/to-tasks
 *
 * 디지스트의 action_items 를 볼트(project_tasks) 또는 너트의 어느 볼트에
 * 칸반 태스크로 자동 등록.
 *
 * Body: { project_id: string, milestone_id?: string, status?: 'todo'|'doing'|'done' }
 *
 * 동작:
 *  1) chat_digests 행에서 action_items 읽기
 *  2) 디지스트 entity (group/project) 멤버 닉네임 → user_id 매핑 시도
 *  3) project_tasks 일괄 insert (assignee 매칭 시 assigned_to 채움)
 *  4) 결과: { inserted: N, with_assignee: M }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

export const dynamic = "force-dynamic";

interface ActionItem {
  assignee: string | null;
  task: string;
  due: string | null;
}

export const POST = withRouteLog("chat_digest.to_tasks", async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id: digestId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const projectId: string | undefined = body?.project_id;
  const milestoneId: string | null = body?.milestone_id ?? null;
  const status: string = body?.status || "todo";
  if (!projectId) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  // 1) 디지스트 조회
  const { data: digest, error: digestErr } = await supabase
    .from("chat_digests")
    .select("id, action_items, entity_type, entity_id")
    .eq("id", digestId)
    .maybeSingle();
  if (digestErr || !digest) {
    return NextResponse.json({ error: "디지스트를 찾을 수 없습니다" }, { status: 404 });
  }
  const items: ActionItem[] = Array.isArray((digest as any).action_items)
    ? (digest as any).action_items
    : [];
  if (items.length === 0) {
    return NextResponse.json({ inserted: 0, with_assignee: 0, message: "action_items 가 없어요" });
  }

  // 2) 프로젝트 멤버 권한 확인 + 닉네임→id 매핑
  const { data: pjMember } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!pjMember) {
    return NextResponse.json({ error: "이 볼트의 멤버가 아닙니다" }, { status: 403 });
  }

  // 멱등성 가드 — 같은 digest 가 이미 변환됐으면 그대로 반환. description 에 박아둔
  // `digest:<id>` 마커로 식별. description 컬럼이 없는 환경(스키마 가벼운 호스팅)에선
  // 쿼리가 실패하므로 그땐 멱등성 검사 생략 + 후속 insert 가 fallback 으로 작동.
  const { data: priorRows, error: priorErr } = await supabase
    .from("project_tasks")
    .select("id")
    .eq("project_id", projectId)
    .ilike("description", `%digest:${digestId}%`);
  if (!priorErr && priorRows && priorRows.length > 0) {
    return NextResponse.json({
      inserted: 0,
      with_assignee: 0,
      already: priorRows.length,
      message: "이미 이 디지스트로 만든 태스크가 있어요",
    });
  }

  const { data: members } = await supabase
    .from("project_members")
    .select("user_id, profile:profiles(id, nickname)")
    .eq("project_id", projectId);
  const nickToId = new Map<string, string>();
  for (const m of members || []) {
    const n = ((m as any).profile?.nickname || "").toLowerCase().trim();
    if (n) nickToId.set(n, (m as any).user_id);
  }

  // 3) sort_order 기준 마지막 값 + 1 부터
  const { data: existing } = await supabase
    .from("project_tasks")
    .select("sort_order")
    .eq("project_id", projectId)
    .eq("status", status)
    .order("sort_order", { ascending: false })
    .limit(1);
  let sortStart = ((existing?.[0] as any)?.sort_order ?? -1) + 1;

  // 4) 일괄 insert
  const rows = items
    .filter((it) => it && typeof it.task === "string" && it.task.trim().length > 0)
    .map((it) => {
      const assigneeKey = (it.assignee || "").toLowerCase().trim();
      const assignedTo = assigneeKey ? nickToId.get(assigneeKey) || null : null;
      // 마감일이 있으면 제목 끝에 [~MM/DD] 추가 (project_tasks 에 due 컬럼이 없을 수 있어서)
      let title = it.task.trim().slice(0, 200);
      if (it.due) {
        const m = it.due.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) title += ` [~${m[2]}/${m[3]}]`;
      }
      return {
        project_id: projectId,
        milestone_id: milestoneId,
        title,
        status,
        sort_order: sortStart++,
        assigned_to: assignedTo,
        // metadata 컬럼 — 디지스트 출처 표시 (스키마 없으면 무시되지만 안전하게 description 으로)
        description: `📥 회의록 디지스트에서 자동 생성 (digest:${digestId})${it.assignee && !assignedTo ? `\n원본 담당자명: ${it.assignee}` : ""}`,
      };
    });

  if (rows.length === 0) {
    return NextResponse.json({ inserted: 0, with_assignee: 0 });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("project_tasks")
    .insert(rows)
    .select("id");
  if (insErr) {
    // description 컬럼이 없는 환경 fallback — description 제거 후 재시도
    if (/description/.test(insErr.message || "")) {
      const fallback = rows.map(({ description, ...rest }) => rest);
      const { data: inserted2, error: err2 } = await supabase
        .from("project_tasks")
        .insert(fallback)
        .select("id");
      if (err2) {
        log.error(err2, "chat-digest.to-tasks.fallback_insert_failed");
        return NextResponse.json({ error: err2.message }, { status: 500 });
      }
      const withAssignee = rows.filter((r) => r.assigned_to).length;
      log.info("chat-digest.to-tasks.ok", { count: inserted2?.length, project_id: projectId });
      return NextResponse.json({ inserted: inserted2?.length || 0, with_assignee: withAssignee });
    }
    log.error(insErr, "chat-digest.to-tasks.insert_failed");
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const withAssignee = rows.filter((r) => r.assigned_to).length;
  log.info("chat-digest.to-tasks.ok", { count: inserted?.length, with_assignee: withAssignee, project_id: projectId });
  return NextResponse.json({
    inserted: inserted?.length || 0,
    with_assignee: withAssignee,
    unmatched_assignees: rows.filter((r) => !r.assigned_to).length,
  });
});

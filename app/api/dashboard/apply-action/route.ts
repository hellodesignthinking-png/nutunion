import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ActionSchema = z.object({
  type: z.enum(["task", "event"]),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  due_date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  target_kind: z.enum(["bolt", "nut"]),
  target_id: z.string().uuid(),
});

const BodySchema = z.object({ actions: z.array(ActionSchema).min(1).max(10) });

/**
 * POST /api/dashboard/apply-action
 *
 * AI 가 파싱한 action 배열을 실제 task/event 로 등록.
 * - task + bolt → project_tasks (milestone 필요 — 첫 milestone 에 붙이거나 skip)
 * - event + nut  → events
 * - event + bolt → project_meetings 또는 project_tasks 로 저장
 */
export const POST = withRouteLog("dashboard.apply-action", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const results: { success: boolean; type: string; id?: string; error?: string }[] = [];

  for (const a of parsed.data.actions) {
    try {
      if (a.type === "task" && a.target_kind === "bolt") {
        // 볼트의 첫 milestone 찾기 (없으면 자동 생성)
        const { data: ms } = await supabase.from("project_milestones")
          .select("id").eq("project_id", a.target_id).order("sort_order").limit(1).maybeSingle();
        let milestoneId = (ms as { id: string } | null)?.id;
        if (!milestoneId) {
          const { data: newMs } = await supabase.from("project_milestones").insert({
            project_id: a.target_id,
            title: "기본 마일스톤",
            status: "in_progress",
            sort_order: 1,
          }).select("id").single();
          milestoneId = (newMs as { id: string } | null)?.id;
        }
        if (!milestoneId) {
          results.push({ success: false, type: a.type, error: "milestone 생성 실패" });
          continue;
        }
        const { data: task, error } = await supabase.from("project_tasks").insert({
          milestone_id: milestoneId,
          title: a.title,
          status: "todo",
          assigned_to: user.id,
          due_date: a.due_date ?? null,
        }).select("id").single();
        if (error) results.push({ success: false, type: a.type, error: error.message });
        else results.push({ success: true, type: a.type, id: (task as { id: string }).id });
      } else if (a.type === "event" && a.target_kind === "nut") {
        // KST(+09:00) 타임존 명시 — 없으면 UTC 해석되어 9시간 shift
        const startAt = a.due_date && a.start_time
          ? `${a.due_date}T${a.start_time}:00+09:00`
          : a.due_date ? `${a.due_date}T09:00:00+09:00` : new Date().toISOString();
        const endAt = a.end_time && a.due_date
          ? `${a.due_date}T${a.end_time}:00+09:00`
          : null;
        const { data: ev, error } = await supabase.from("events").insert({
          group_id: a.target_id,
          title: a.title,
          description: a.description ?? null,
          start_at: startAt,
          end_at: endAt,
          created_by: user.id,
        }).select("id").single();
        if (error) results.push({ success: false, type: a.type, error: error.message });
        else results.push({ success: true, type: a.type, id: (ev as { id: string }).id });
      } else if (a.type === "event" && a.target_kind === "bolt") {
        // bolt 에는 events 가 없음 → project_tasks 로 fallback (일정 task)
        const { data: ms } = await supabase.from("project_milestones")
          .select("id").eq("project_id", a.target_id).order("sort_order").limit(1).maybeSingle();
        const milestoneId = (ms as { id: string } | null)?.id;
        if (!milestoneId) {
          results.push({ success: false, type: a.type, error: "볼트에 마일스톤 없음" });
          continue;
        }
        const { data: task, error } = await supabase.from("project_tasks").insert({
          milestone_id: milestoneId,
          title: `[일정] ${a.title}`,
          status: "todo",
          assigned_to: user.id,
          due_date: a.due_date ?? null,
        }).select("id").single();
        if (error) results.push({ success: false, type: a.type, error: error.message });
        else results.push({ success: true, type: a.type, id: (task as { id: string }).id });
      } else {
        // task + nut — 너트는 task 없으므로 event 로 대체
        results.push({ success: false, type: a.type, error: "너트에 task 저장 불가" });
      }
    } catch (err) {
    log.error(err, "dashboard.apply-action.failed");
      results.push({ success: false, type: a.type, error: err instanceof Error ? err.message : "unknown" });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  return NextResponse.json({ success: successCount > 0, applied: successCount, results });
});

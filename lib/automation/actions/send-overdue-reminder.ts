/**
 * Action: send_overdue_reminder — find tasks past due_date that are still open,
 * send notification + optional chat ping to each assignee.
 *
 * Invoked daily by the schedule.daily_9am cron trigger.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchNotification } from "@/lib/notifications/dispatch";

type Ctx = {
  admin: SupabaseClient;
  rule: any;
  payload: any;
  params: Record<string, any>;
};

export default async function sendOverdueReminder({ admin, rule }: Ctx) {
  const today = new Date().toISOString().slice(0, 10);

  // Fetch overdue tasks assigned to this owner's scope
  const scope = rule.scope || {};
  const kind = scope.kind;
  const ids: string[] = Array.isArray(scope.ids) ? scope.ids : [];

  let q = admin
    .from("tasks")
    .select("id, title, assignee_id, due_date, project_id, status, completed_at")
    .lt("due_date", today)
    .is("completed_at", null)
    .neq("status", "done");

  if (kind === "project" && ids.length) q = q.in("project_id", ids);

  const { data: tasks, error } = await q;
  if (error) {
    // table may differ in schema; degrade gracefully
    if (/relation .* does not exist|column .* does not exist/i.test(error.message)) {
      return { skipped: true, reason: error.message };
    }
    throw new Error(error.message);
  }
  if (!tasks || tasks.length === 0) return { reminded: 0 };

  // Group by assignee
  const byAssignee = new Map<string, any[]>();
  for (const t of tasks as any[]) {
    if (!t.assignee_id) continue;
    const arr = byAssignee.get(t.assignee_id) || [];
    arr.push(t);
    byAssignee.set(t.assignee_id, arr);
  }

  let count = 0;
  for (const [userId, userTasks] of byAssignee.entries()) {
    const body = `기한이 지난 Task 가 ${userTasks.length}개 있어요. 확인해 주세요.`;
    await dispatchNotification({
      recipientId: userId,
      eventType: "task_overdue_reminder",
      title: "⏰ 기한 초과 Task 리마인더",
      body,
      metadata: { task_ids: userTasks.map((t) => t.id), rule_id: rule.id },
    });
    count++;
  }

  return { reminded: count, total_overdue: tasks.length };
}

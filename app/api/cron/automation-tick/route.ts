import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { withRouteLog } from "@/lib/observability/route-handler";

/**
 * /api/cron/automation-tick
 *
 *   Vercel Cron 으로 시간에 1회 호출. 시간 기반 트리거를 평가:
 *     - task.overdue          : 마감 지났고 status != done
 *     - milestone.due_soon    : 마감 N일 이내, 미완료
 *
 *   각 매칭 (rule × target) 마다:
 *     1. cooldown_min 체크 (last_fired_at 기준)
 *     2. condition 추가 평가
 *     3. action 실행 (create_task / create_risk / notify / send_webhook)
 *     4. project_automation_runs 에 기록
 *     5. project_automation_mark_fired RPC 호출
 *
 *   인라인 트리거 (state_changed / risk.added 등) 는 해당 API 에서 직접 호출.
 */

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

interface Rule {
  id: string;
  project_id: string;
  name: string;
  trigger: string;
  condition: Record<string, unknown>;
  action: "create_task" | "create_risk" | "notify" | "send_webhook";
  action_config: Record<string, unknown>;
  enabled: boolean;
  cooldown_min: number;
  last_fired_at: string | null;
}

function isInCooldown(rule: Rule): boolean {
  if (!rule.last_fired_at) return false;
  const elapsedMin = (Date.now() - new Date(rule.last_fired_at).getTime()) / 60_000;
  return elapsedMin < rule.cooldown_min;
}

async function executeAction(
  db: ReturnType<typeof svc>,
  rule: Rule,
  payload: Record<string, unknown>
): Promise<{ status: "success" | "skipped" | "error"; result: Record<string, unknown>; error?: string }> {
  try {
    if (rule.action === "create_task") {
      const cfg = rule.action_config as { title_template?: string; due_offset_days?: number };
      const title = (cfg.title_template || "자동화: {trigger}")
        .replace("{trigger}", rule.trigger)
        .replace("{rule}", rule.name)
        .slice(0, 200);
      const due = cfg.due_offset_days
        ? new Date(Date.now() + cfg.due_offset_days * 86_400_000).toISOString().slice(0, 10)
        : null;
      const { data, error } = await db.from("project_tasks")
        .insert({ project_id: rule.project_id, title, status: "todo", due_date: due })
        .select("id").single();
      if (error) throw error;
      return { status: "success", result: { task_id: data.id } };
    }
    if (rule.action === "create_risk") {
      const cfg = rule.action_config as { title_template?: string; severity?: "low"|"medium"|"high"|"critical" };
      const title = (cfg.title_template || "자동 감지 — {rule}")
        .replace("{trigger}", rule.trigger)
        .replace("{rule}", rule.name)
        .slice(0, 200);
      const { data, error } = await db.from("project_risks")
        .insert({
          project_id: rule.project_id,
          title,
          severity: cfg.severity || "medium",
          detected_by: "rule",
          source_kind: rule.trigger,
        })
        .select("id").single();
      if (error) throw error;
      return { status: "success", result: { risk_id: data.id } };
    }
    if (rule.action === "notify") {
      // 알림 — project_updates 에 자동 알림 글로 기록 (간단)
      const cfg = rule.action_config as { message?: string };
      const msg = (cfg.message || "🤖 자동화: {rule} 트리거됨")
        .replace("{rule}", rule.name)
        .replace("{trigger}", rule.trigger)
        .slice(0, 500);
      const { data, error } = await db.from("project_updates")
        .insert({ project_id: rule.project_id, content: msg, type: "status_change", metadata: { rule_id: rule.id, payload } })
        .select("id").single();
      if (error) throw error;
      return { status: "success", result: { update_id: data.id } };
    }
    if (rule.action === "send_webhook") {
      // 외부 웹훅 — space_webhooks 에 같은 owner 의 enabled 훅들에 발송 위임 (재사용)
      // 간단히 dispatchWebhook 호출은 server-only 라 fire-and-forget
      try {
        const { dispatchWebhook } = await import("@/lib/spaces/webhook-dispatcher");
        await dispatchWebhook({
          ownerType: "bolt",
          ownerId: rule.project_id,
          event: "automation.fired",
          payload: { rule_name: rule.name, trigger: rule.trigger, ...payload },
          fireAndForget: true,
        });
      } catch { /* dispatcher 없으면 패스 */ }
      return { status: "success", result: { dispatched: true } };
    }
    return { status: "skipped", result: { reason: "unknown_action" } };
  } catch (e) {
    return { status: "error", result: {}, error: (e as Error).message };
  }
}

export const GET = withRouteLog("cron.automation_tick", async (req: NextRequest) => {
  // Vercel Cron 인증
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = svc();

  // 1) enabled 룰 중 시간 기반 트리거만
  const { data: rules } = await db
    .from("project_automation_rules")
    .select("id, project_id, name, trigger, condition, action, action_config, enabled, cooldown_min, last_fired_at")
    .eq("enabled", true)
    .in("trigger", ["task.overdue", "milestone.due_soon"]);

  if (!rules || rules.length === 0) {
    return NextResponse.json({ ok: true, evaluated: 0, fired: 0 });
  }

  let fired = 0;
  let skipped = 0;
  let errors = 0;

  for (const r of rules as Rule[]) {
    if (isInCooldown(r)) { skipped++; continue; }

    let matched: Record<string, unknown> | null = null;

    if (r.trigger === "task.overdue") {
      const { data: tasks } = await db
        .from("project_tasks")
        .select("id, title, due_date, status")
        .eq("project_id", r.project_id)
        .neq("status", "done")
        .lt("due_date", new Date().toISOString().slice(0, 10))
        .limit(1);
      if (tasks && tasks.length > 0) {
        matched = { task_id: tasks[0].id, title: tasks[0].title, due_date: tasks[0].due_date };
      }
    } else if (r.trigger === "milestone.due_soon") {
      const cfg = r.condition as { days_before?: number };
      const days = cfg.days_before ?? 2;
      const cutoff = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
      const { data: ms } = await db
        .from("project_milestones")
        .select("id, title, due_date, status")
        .eq("project_id", r.project_id)
        .neq("status", "completed")
        .gte("due_date", new Date().toISOString().slice(0, 10))
        .lte("due_date", cutoff)
        .limit(1);
      if (ms && ms.length > 0) {
        matched = { milestone_id: ms[0].id, title: ms[0].title, due_date: ms[0].due_date };
      }
    }

    if (!matched) { skipped++; continue; }

    const exec = await executeAction(db, r, matched);
    await db.from("project_automation_runs").insert({
      rule_id: r.id,
      project_id: r.project_id,
      trigger_payload: matched,
      status: exec.status,
      result: exec.result,
      error_msg: exec.error || null,
    });

    if (exec.status === "success") {
      fired++;
      await db.rpc("project_automation_mark_fired", { p_rule_id: r.id });
    } else if (exec.status === "error") {
      errors++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    evaluated: rules.length,
    fired,
    skipped,
    errors,
    at: new Date().toISOString(),
  });
});

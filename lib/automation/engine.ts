/**
 * lib/automation/engine — Nut-mation scoped execution engine.
 *
 * Core API:
 *   - dispatchEvent(eventType, payload) → enumerates active rules, evaluates scope,
 *     either executes immediately or queues for HITL approval.
 *   - executeActions(rule, payload) → runs action handlers sequentially, logs results.
 *
 * Uses service-role admin client so it can be invoked from API routes regardless
 * of the caller's RLS context. All errors are swallowed at the dispatch layer so
 * event sources (meeting conclude, etc.) are never blocked.
 */
import "server-only";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";

type Action = { type: string; params?: Record<string, any> };
type AutomationRule = {
  id: string;
  owner_id: string;
  template_id: string;
  name: string;
  trigger_type: string;
  conditions: Record<string, any> | null;
  actions: Action[] | null;
  scope: { kind?: "group" | "project" | "all" | "both"; ids?: string[] } | null;
  is_active: boolean;
  require_approval: boolean;
  run_count: number | null;
};

function getAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

/** Evaluate whether a rule's scope/conditions match this payload. */
function matchesScope(rule: AutomationRule, payload: any): boolean {
  const scope = rule.scope || {};
  const kind = scope.kind || "all";
  const ids = Array.isArray(scope.ids) ? scope.ids : [];

  if (kind === "all") return true;

  if (kind === "group") {
    const gid = payload?.group_id || payload?.groupId;
    if (!gid) return false;
    return ids.length === 0 ? true : ids.includes(gid);
  }
  if (kind === "project") {
    const pid = payload?.project_id || payload?.projectId;
    if (!pid) return false;
    return ids.length === 0 ? true : ids.includes(pid);
  }
  if (kind === "both") {
    const gid = payload?.group_id || payload?.groupId;
    const pid = payload?.project_id || payload?.projectId;
    if (ids.length === 0) return true;
    return (gid && ids.includes(gid)) || (pid && ids.includes(pid));
  }
  return true;
}

/**
 * Evaluate custom conditions JSON against the event payload.
 * Supported keys (all optional, combined with AND):
 *   - keyword_filter: string — case-insensitive substring match against
 *     payload.title / payload.name / payload.text / payload.content / payload.message
 *   - min_participants: number — payload.participant_count >= value
 *   - max_participants: number — payload.participant_count <= value
 *   - sender_id: string — payload.sender_id / payload.user_id exact match
 *   - exclude_keywords: string[] — if ANY of these substrings appear, skip
 */
function matchesConditions(rule: AutomationRule, payload: any): boolean {
  const c = rule.conditions || {};
  if (!c || typeof c !== "object") return true;

  const textCandidates = [
    payload?.title,
    payload?.name,
    payload?.text,
    payload?.content,
    payload?.message,
    payload?.milestone_name,
  ]
    .filter(Boolean)
    .map((v: any) => String(v).toLowerCase())
    .join(" \n ");

  if (typeof c.keyword_filter === "string" && c.keyword_filter.trim()) {
    const needle = c.keyword_filter.trim().toLowerCase();
    if (!textCandidates.includes(needle)) return false;
  }

  if (Array.isArray(c.exclude_keywords)) {
    for (const kw of c.exclude_keywords) {
      if (typeof kw === "string" && kw.trim() && textCandidates.includes(kw.trim().toLowerCase())) {
        return false;
      }
    }
  }

  if (typeof c.min_participants === "number") {
    const count = Number(payload?.participant_count);
    if (!Number.isFinite(count) || count < c.min_participants) return false;
  }
  if (typeof c.max_participants === "number") {
    const count = Number(payload?.participant_count);
    if (!Number.isFinite(count) || count > c.max_participants) return false;
  }

  if (typeof c.sender_id === "string" && c.sender_id) {
    const sid = payload?.sender_id || payload?.user_id;
    if (sid !== c.sender_id) return false;
  }

  return true;
}

/** Primary entry point — called from event source routes. */
export async function dispatchEvent(eventType: string, payload: any): Promise<void> {
  try {
    const admin = getAdmin();
    if (!admin) return;

    const { data: rules, error } = await admin
      .from("automation_rules")
      .select("*")
      .eq("trigger_type", eventType)
      .eq("is_active", true);

    if (error) {
      // Migration probably not applied. Degrade silently.
      if (/relation .* does not exist/i.test(error.message)) return;
      console.warn("[automation] fetch rules failed", error.message);
      return;
    }
    if (!rules || rules.length === 0) return;

    for (const rule of rules as AutomationRule[]) {
      if (!matchesScope(rule, payload)) continue;
      if (!matchesConditions(rule, payload)) continue;

      if (rule.require_approval) {
        await queueApproval(admin, rule, payload);
      } else {
        await executeActions(admin, rule, payload);
      }
    }
  } catch (e: any) {
    console.warn("[automation] dispatchEvent failed", e?.message);
  }
}

async function queueApproval(admin: SupabaseClient, rule: AutomationRule, payload: any) {
  // Create pending log + approval row
  const { data: log, error: logErr } = await admin
    .from("automation_logs")
    .insert({
      rule_id: rule.id,
      trigger_payload: payload,
      status: "pending_approval",
    })
    .select("id")
    .single();
  if (logErr || !log) {
    console.warn("[automation] queueApproval log insert failed", logErr?.message);
    return;
  }

  await admin.from("automation_approvals").insert({
    log_id: log.id,
    rule_id: rule.id,
    owner_id: rule.owner_id,
    rule_name: rule.name,
    preview: { actions: rule.actions || [], payload },
    status: "pending",
  });
}

/** Execute all actions for a rule and write a log row. */
export async function executeActions(
  admin: SupabaseClient,
  rule: AutomationRule,
  payload: any,
): Promise<{ status: "success" | "failed"; results: any[]; error?: string }> {
  const actions: Action[] = Array.isArray(rule.actions) ? rule.actions : [];
  const results: any[] = [];
  let status: "success" | "failed" = "success";
  let errMsg: string | undefined;

  for (const action of actions) {
    try {
      const handler = await loadHandler(action.type);
      if (!handler) {
        results.push({ type: action.type, ok: false, error: "unknown action type" });
        status = "failed";
        continue;
      }
      const r = await handler({ admin, rule, payload, params: action.params || {} });
      results.push({ type: action.type, ok: true, result: r });
    } catch (e: any) {
      status = "failed";
      errMsg = e?.message || String(e);
      results.push({ type: action.type, ok: false, error: errMsg });
    }
  }

  // log + bump counter
  await admin.from("automation_logs").insert({
    rule_id: rule.id,
    trigger_payload: payload,
    status,
    action_results: results,
    error: errMsg || null,
  });

  await admin
    .from("automation_rules")
    .update({
      run_count: (rule.run_count || 0) + 1,
      last_run_at: new Date().toISOString(),
    })
    .eq("id", rule.id);

  return { status, results, error: errMsg };
}

/** Dynamic handler loader — keeps each action isolated. */
async function loadHandler(type: string) {
  switch (type) {
    case "ai_summary":
      return (await import("./actions/ai-summary")).default;
    case "send_chat_message":
      return (await import("./actions/send-chat-message")).default;
    case "send_welcome_dm":
      return (await import("./actions/send-welcome-dm")).default;
    case "send_overdue_reminder":
      return (await import("./actions/send-overdue-reminder")).default;
    case "post_file_to_chat":
      return (await import("./actions/post-file-to-chat")).default;
    case "ai_suggest_talents":
      return (await import("./actions/ai-suggest-talents")).default;
    case "ai_sentiment_branch":
      return (await import("./actions/ai-sentiment-branch")).default;
    case "webhook_notify":
      return (await import("./actions/webhook-notify")).default;
    case "grant_member_access":
      return (await import("./actions/grant-member-access")).default;
    default:
      return null;
  }
}

export { getAdmin };
export type { AutomationRule, Action };

import { createClient } from "@/lib/supabase/client";
import type { Integration } from "@/lib/types";

// --- Core send ---

export async function sendWebhook(
  url: string,
  payload: Record<string, any>
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return { ok: res.ok, status: res.status };
  } catch (err: any) {
    return { ok: false, status: 0, error: err.message };
  }
}

// --- Slack Block Kit format ---

export function formatSlackMessage(
  event: string,
  data: Record<string, any>
): Record<string, any> {
  const title = eventTitle(event, data);
  const description = eventDescription(event, data);

  return {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: title,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: description,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*NutUnion* | ${new Date().toLocaleString("ko-KR")}`,
          },
        ],
      },
    ],
  };
}

// --- Discord embed format ---

export function formatDiscordMessage(
  event: string,
  data: Record<string, any>
): Record<string, any> {
  const title = eventTitle(event, data);
  const description = eventDescription(event, data);

  return {
    embeds: [
      {
        title,
        description,
        color: 0xff5a8a, // nu-pink hex
        footer: {
          text: "NutUnion",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

// --- Trigger all active integrations for a workspace ---

export async function triggerIntegrations(
  workspaceType: "crew" | "project",
  workspaceId: string,
  eventType: string,
  data: Record<string, any>
): Promise<void> {
  const supabase = createClient();

  // Fetch all active integrations for this workspace
  const { data: integrations, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("workspace_type", workspaceType)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true);

  if (error || !integrations || integrations.length === 0) {
    return;
  }

  const promises = integrations.map(async (integration: Integration) => {
    // For custom webhooks, check if event is in the configured events list
    if (integration.type === "webhook" && integration.config.events) {
      const allowedEvents = (integration.config.events as string)
        .split(",")
        .map((e: string) => e.trim().toLowerCase());

      if (
        allowedEvents.length > 0 &&
        allowedEvents[0] !== "" &&
        !allowedEvents.includes(eventType.toLowerCase())
      ) {
        return;
      }
    }

    const webhookUrl =
      integration.config.webhook_url || integration.config.page_url;

    if (!webhookUrl) return;

    let payload: Record<string, any>;

    switch (integration.type) {
      case "slack":
        payload = formatSlackMessage(eventType, data);
        break;
      case "discord":
        payload = formatDiscordMessage(eventType, data);
        break;
      default:
        payload = {
          event: eventType,
          workspace_type: workspaceType,
          workspace_id: workspaceId,
          data,
          timestamp: new Date().toISOString(),
        };
    }

    const result = await sendWebhook(webhookUrl, payload);

    // Log the result
    await supabase.from("integration_logs").insert({
      integration_id: integration.id,
      event_type: eventType,
      payload,
      status: result.ok ? "success" : "error",
      response_code: result.status,
      error_message: result.error ?? null,
    });
  });

  await Promise.allSettled(promises);
}

// --- Helpers ---

function eventTitle(event: string, data: Record<string, any>): string {
  const titles: Record<string, string> = {
    member_joined: `${data.member_name ?? "새 와셔"}님이 참여했습니다`,
    member_left: `${data.member_name ?? "와셔"}님이 나갔습니다`,
    task_completed: `작업 완료: ${data.task_title ?? ""}`,
    task_created: `새 작업: ${data.task_title ?? ""}`,
    milestone_updated: `마일스톤 업데이트: ${data.milestone_title ?? ""}`,
    milestone_completed: `마일스톤 완료: ${data.milestone_title ?? ""}`,
    project_update: `볼트 소식이 등록되었습니다`,
    application_received: `새 지원서가 도착했습니다`,
    application_approved: `지원서가 승인되었습니다`,
    application_rejected: `지원서가 거절되었습니다`,
    status_change: `상태 변경: ${data.new_status ?? ""}`,
    test: "NutUnion 테스트 알림",
  };

  return titles[event] ?? `NutUnion 알림: ${event}`;
}

function eventDescription(event: string, data: Record<string, any>): string {
  const parts: string[] = [];

  if (data.project_title) {
    parts.push(`볼트: ${data.project_title}`);
  }
  if (data.crew_name) {
    parts.push(`너트: ${data.crew_name}`);
  }
  if (data.member_name) {
    parts.push(`와셔: ${data.member_name}`);
  }
  if (data.message) {
    parts.push(data.message);
  }

  return parts.length > 0 ? parts.join("\n") : "상세 내용이 없습니다.";
}

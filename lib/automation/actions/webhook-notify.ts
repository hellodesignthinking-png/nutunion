/**
 * Action: webhook_notify
 *
 * POSTs a formatted message to a user-provided webhook (Slack / Discord / Kakao).
 * Kakao is a placeholder — full Biz channel integration requires business account
 * setup and is not wired here.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type Ctx = {
  admin: SupabaseClient;
  rule: any;
  payload: any;
  params: {
    webhook_url?: string;
    service?: "slack" | "discord" | "kakao";
    message?: string;
  };
};

function interpolate(tpl: string, payload: any): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = payload?.[k];
    return v == null ? `{${k}}` : String(v);
  });
}

export default async function webhookNotify({ rule, payload, params }: Ctx) {
  const url = (params.webhook_url || "").trim();
  const service = (params.service || "discord").toLowerCase();
  const rawTpl = params.message || `🔔 [${rule.name}] 이벤트`;
  const message = interpolate(rawTpl, payload);

  if (!url) {
    throw new Error("webhook_url is required");
  }

  let body: any;
  let headers: Record<string, string> = { "Content-Type": "application/json" };

  if (service === "slack") {
    body = { text: message };
  } else if (service === "discord") {
    body = { content: message };
  } else if (service === "kakao") {
    // Kakao Biz Channel placeholder — real impl needs template_id + linkMobile/linkPc.
    body = {
      template_object: {
        object_type: "text",
        text: message,
        link: {
          web_url: payload?.link || "https://nutunion.com",
          mobile_web_url: payload?.link || "https://nutunion.com",
        },
      },
    };
  } else {
    throw new Error(`unsupported service: ${service}`);
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  return { ok: res.ok, status_code: res.status, service, url_host: safeHost(url) };
}

function safeHost(u: string): string {
  try {
    return new URL(u).host;
  } catch {
    return "";
  }
}

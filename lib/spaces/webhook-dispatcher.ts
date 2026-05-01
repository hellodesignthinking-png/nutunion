import "server-only";
import { createHmac } from "node:crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { log } from "@/lib/observability/logger";

/**
 * 웹훅 디스패처 — 너트/볼트의 활동을 외부 URL 로 POST.
 *
 * 호출 패턴 (애플리케이션 측에서 명시 호출):
 *   await dispatchWebhook({
 *     ownerType: 'nut',
 *     ownerId,
 *     event: 'page.shared',
 *     payload: { page_id, title, share_token },
 *   });
 *
 * 1) space_webhooks 에서 owner + event 매칭 + enabled 인 행 조회
 * 2) 각 webhook 의 url 로 POST (preset 별 페이로드 변환)
 * 3) 결과를 space_webhook_deliveries 에 기록 + last_status 갱신
 *
 * 실패해도 호출 흐름은 막지 않음 — fire-and-forget 권장.
 */

interface DispatchInput {
  ownerType: "nut" | "bolt";
  ownerId: string;
  event: string;
  payload: Record<string, unknown>;
  /** 발송 후 await 안 하고 백그라운드로. 라우트 핸들러에서 응답 빨라야 할 때. */
  fireAndForget?: boolean;
}

const SERVICE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getServiceClient() {
  if (!SERVICE_KEY) return null;
  return createServiceClient(SERVICE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface WebhookRow {
  id: string;
  url: string;
  secret: string | null;
  preset: "slack" | "discord" | "generic" | null;
  events: string[];
  name: string;
}

/** Slack incoming webhook 페이로드 변환. */
function toSlack(event: string, payload: Record<string, unknown>): Record<string, unknown> {
  const lines = [`*${event}*`];
  for (const [k, v] of Object.entries(payload).slice(0, 10)) {
    if (v == null) continue;
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    lines.push(`• \`${k}\`: ${s.slice(0, 200)}`);
  }
  return { text: lines.join("\n") };
}

/** Discord webhook — content 최대 2000자. */
function toDiscord(event: string, payload: Record<string, unknown>): Record<string, unknown> {
  const lines = [`**${event}**`];
  for (const [k, v] of Object.entries(payload).slice(0, 10)) {
    if (v == null) continue;
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    lines.push(`• \`${k}\`: ${s.slice(0, 200)}`);
  }
  return { content: lines.join("\n").slice(0, 1900) };
}

export async function dispatchWebhook(input: DispatchInput): Promise<void> {
  const promise = doDispatch(input);
  if (input.fireAndForget) {
    void promise.catch((e) => log.warn("webhook.dispatch.failed", { err: String(e) }));
    return;
  }
  await promise.catch((e) => log.warn("webhook.dispatch.failed", { err: String(e) }));
}

async function doDispatch(input: DispatchInput): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase) return; // SERVICE_KEY 없음 — 발송 불가

  const { data: rows, error } = await supabase
    .from("space_webhooks")
    .select("id, url, secret, preset, events, name")
    .eq("owner_type", input.ownerType)
    .eq("owner_id", input.ownerId)
    .eq("enabled", true);
  if (error || !rows) return;

  const matching = (rows as WebhookRow[]).filter((w) => w.events.includes(input.event));
  if (matching.length === 0) return;

  await Promise.all(matching.map((w) => deliver(supabase, w, input.event, input.payload)));
}

async function deliver(
  supabase: ReturnType<typeof getServiceClient>,
  webhook: WebhookRow,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!supabase) return;
  const start = Date.now();
  let status = 0;
  let response = "";
  let body: Record<string, unknown>;

  // preset 별 페이로드 변환
  const preset = webhook.preset || "generic";
  if (preset === "slack")        body = toSlack(event, payload);
  else if (preset === "discord") body = toDiscord(event, payload);
  else                            body = { event, payload, sent_at: new Date().toISOString() };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "nutunion-webhook/1.0",
    "X-Nutunion-Event": event,
  };

  // HMAC SHA-256 서명 — secret 있을 때만
  if (webhook.secret && preset === "generic") {
    const sig = createHmac("sha256", webhook.secret)
      .update(JSON.stringify(body))
      .digest("hex");
    headers["X-Nutunion-Signature"] = `sha256=${sig}`;
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    status = res.status;
    const text = await res.text().catch(() => "");
    response = text.slice(0, 500);
  } catch (e) {
    response = e instanceof Error ? e.message.slice(0, 500) : String(e).slice(0, 500);
  }

  const duration = Date.now() - start;

  // 발송 이력 + last_* 갱신 — 실패해도 무시
  void Promise.all([
    supabase.from("space_webhook_deliveries").insert({
      webhook_id: webhook.id,
      event,
      payload: body,
      status,
      response,
      duration_ms: duration,
    }),
    supabase.from("space_webhooks").update({
      last_called_at: new Date().toISOString(),
      last_status: status,
      last_error: status === 0 || status >= 400 ? response : null,
    }).eq("id", webhook.id),
  ]).catch(() => undefined);
}

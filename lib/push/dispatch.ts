// 푸시 발송 유틸 — 웹(web-push) + 모바일(Expo) 동시 지원.
// 서버 전용.

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendPush, type SubscriptionRow } from "./web-push-client";

export interface DispatchPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * 여러 사용자에게 웹 푸시 + Expo 푸시 동시 발송.
 * service_role 필요 (RLS 우회).
 */
export async function dispatchPushToUsers(
  userIds: string[],
  payload: DispatchPayload
): Promise<{ web_sent: number; expo_sent: number; errors: number }> {
  if (userIds.length === 0) return { web_sent: 0, expo_sent: 0, errors: 0 };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[dispatch-push] service_role 미설정");
    return { web_sent: 0, expo_sent: 0, errors: 0 };
  }

  const admin = createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let webSent = 0;
  let expoSent = 0;
  let errors = 0;

  // ── 웹 푸시 (push_subscriptions) ──
  const { data: webSubs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .in("user_id", userIds);

  const expiredWebIds: string[] = [];
  if (webSubs && webSubs.length > 0) {
    await Promise.all(
      webSubs.map(async (s) => {
        const row: SubscriptionRow = {
          endpoint: s.endpoint as string,
          p256dh: s.p256dh as string,
          auth_key: s.auth_key as string,
        };
        const r = await sendPush(row, payload);
        if (r.ok) webSent += 1;
        else if (r.expired) expiredWebIds.push(s.id as string);
        else errors += 1;
      })
    );
    if (expiredWebIds.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", expiredWebIds);
    }
  }

  // ── Expo 푸시 (expo_push_tokens) ──
  const { data: expoTokens } = await admin
    .from("expo_push_tokens")
    .select("id, token")
    .in("user_id", userIds);

  if (expoTokens && expoTokens.length > 0) {
    const messages = expoTokens.map((t) => ({
      to: t.token as string,
      title: payload.title,
      body: payload.body,
      data: { url: payload.url ?? "/" },
      sound: "default" as const,
    }));

    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(messages),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        errors += expoTokens.length;
        console.warn("[expo-push]", body);
      } else {
        // Expo 는 배열 tickets 반환 — 각 ticket.status === 'ok' 카운트
        const tickets = (body?.data as { status: string; message?: string; details?: { error?: string } }[] | undefined) ?? [];
        for (let i = 0; i < tickets.length; i++) {
          const t = tickets[i];
          if (t.status === "ok") expoSent += 1;
          else {
            errors += 1;
            // DeviceNotRegistered → 토큰 정리
            if (t.details?.error === "DeviceNotRegistered") {
              const rowId = expoTokens[i].id as string;
              await admin.from("expo_push_tokens").delete().eq("id", rowId);
            }
          }
        }
      }
    } catch (err) {
      errors += expoTokens.length;
      console.warn("[expo-push] fetch err", err);
    }
  }

  return { web_sent: webSent, expo_sent: expoSent, errors };
}

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendAlimtalk, type AlimtalkTemplate } from "@/lib/alimtalk/send";
import { dispatchPushToUsers } from "@/lib/push/dispatch";

/**
 * 통합 알림 발송 — in-app / email / kakao / push 채널 중 Preferences 에 맞는 것만.
 *
 * 환경변수:
 *   RESEND_API_KEY   — Resend 이메일 (없으면 이메일 스킵)
 *   RESEND_FROM      — 발신자 (예: "nutunion <noreply@nutunion.co.kr>")
 */

export type NotificationChannel = "inapp" | "email" | "kakao" | "push";

export interface DispatchPayload {
  recipientId: string;
  eventType: string;            // 'bolt.applicant' 등
  title: string;
  body: string;
  linkUrl?: string;
  channels?: NotificationChannel[];   // 기본: ['inapp']
  // 선택 컨텍스트
  email?: string;
  phone?: string;
  alimtalkTemplate?: AlimtalkTemplate;
  alimtalkVars?: Record<string, string>;
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE service credentials missing");
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export async function dispatchNotification(p: DispatchPayload) {
  const channels = p.channels ?? ["inapp"];
  const delivered: NotificationChannel[] = [];
  const db = getServiceClient();

  // 1) in-app
  if (channels.includes("inapp")) {
    const { error } = await db.from("notifications").insert({
      user_id: p.recipientId,
      type: p.eventType,
      title: p.title,
      body: p.body,
      link_url: p.linkUrl ?? null,
      is_read: false,
    });
    if (!error) delivered.push("inapp");
  }

  // 2) email (Resend)
  if (channels.includes("email") && p.email && process.env.RESEND_API_KEY) {
    try {
      const from = process.env.RESEND_FROM || "nutunion <noreply@nutunion.co.kr>";
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [p.email],
          subject: p.title,
          html: emailTemplate(p),
        }),
      });
      if (r.ok) delivered.push("email");
    } catch {}
  }

  // 3) 카카오 알림톡
  if (channels.includes("kakao") && p.phone && p.alimtalkTemplate) {
    const res = await sendAlimtalk({
      userId: p.recipientId,
      phone: p.phone,
      template: p.alimtalkTemplate,
      variables: p.alimtalkVars ?? {},
    });
    if (res.ok) delivered.push("kakao");
  }

  // 4) Web Push
  if (channels.includes("push")) {
    try {
      await dispatchPushToUsers([p.recipientId], {
        title: p.title,
        body: p.body,
        url: p.linkUrl ?? "/notifications",
      });
      delivered.push("push");
    } catch {}
  }

  return { delivered };
}

function emailTemplate(p: DispatchPayload): string {
  const ctaLink = p.linkUrl ? `https://nutunion.co.kr${p.linkUrl}` : "https://nutunion.co.kr";
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><title>${escape(p.title)}</title></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:32px">
        <tr><td>
          <p style="margin:0 0 8px;font-family:monospace;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#737373">nutunion</p>
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#1a1a1a;line-height:1.35">${escape(p.title)}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.75;color:#1a1a1a">${escape(p.body)}</p>
          <a href="${ctaLink}" style="display:inline-block;padding:10px 20px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">확인하기 →</a>
          <p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#737373;line-height:1.6">
            이 메일은 nutunion 활동 알림으로 발송됐어요. <a href="https://nutunion.co.kr/settings/notifications" style="color:#737373">알림 설정</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

import crypto from "crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * Naver Cloud SENS 알림톡 발송 유틸.
 *
 * 환경변수:
 *   NCP_SENS_SERVICE_ID   — 서비스 ID
 *   NCP_SENS_ACCESS_KEY   — Access Key ID
 *   NCP_SENS_SECRET_KEY   — Secret Key
 *   NCP_SENS_KAKAO_CHANNEL_ID — 카카오 비즈 채널 ID (@nutunion 등)
 *   NCP_SENS_SENDER_PHONE — 대체 문자 발신번호
 *
 * 템플릿은 카카오 비즈 센터에서 사전 승인 필요 — 아래 CODES 에 등록된 것만 사용.
 *
 * Docs: https://api.ncloud-docs.com/docs/ai-application-service-sens-alimtalkv2
 */

export const ALIMTALK_TEMPLATES = {
  REVIEW_REQUEST: {
    code: "REVIEW_REQUEST_V1",
    text: "#{nickname}님,\n#{projectTitle} 볼트가 마감됐어요.\n동료 와셔에게 리뷰를 남겨주세요.\n▶ #{link}",
  },
  APPLICATION_APPROVED: {
    code: "APP_APPROVED_V1",
    text: "#{nickname}님, #{projectTitle} 볼트에 합류가 승인됐어요! 🎉\n▶ #{link}",
  },
  APPLICATION_REJECTED: {
    code: "APP_REJECTED_V1",
    text: "#{nickname}님, 아쉽게도 #{projectTitle} 볼트 지원이 반영되지 못했어요.\n다음 볼트에서 다시 만나요.",
  },
  MILESTONE_DUE_SOON: {
    code: "MILESTONE_DUE_V1",
    text: "#{nickname}님, \"#{milestoneTitle}\" 마일스톤이 #{daysLeft}일 후 마감이에요.\n▶ #{link}",
  },
  WEEKLY_MATCH: {
    code: "WEEKLY_MATCH_V1",
    text: "#{nickname}님, 이번 주 어울릴 볼트 TOP 3를 골라봤어요.\n▶ #{link}",
  },
} as const;

export type AlimtalkTemplate = keyof typeof ALIMTALK_TEMPLATES;

export interface SendAlimtalkParams {
  userId?: string;
  phone: string;                      // 010-0000-0000 또는 숫자만
  template: AlimtalkTemplate;
  variables: Record<string, string>;
}

function sanitizePhone(p: string) {
  return p.replace(/[^0-9]/g, "");
}

function render(text: string, vars: Record<string, string>) {
  return text.replace(/#\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function sign(method: string, url: string, timestamp: string, accessKey: string, secretKey: string) {
  const space = " ";
  const newLine = "\n";
  const hmac = crypto.createHmac("sha256", secretKey);
  hmac.update(method).update(space).update(url).update(newLine)
    .update(timestamp).update(newLine).update(accessKey);
  return hmac.digest("base64");
}

export async function sendAlimtalk({ userId, phone, template, variables }: SendAlimtalkParams) {
  const serviceId = process.env.NCP_SENS_SERVICE_ID;
  const accessKey = process.env.NCP_SENS_ACCESS_KEY;
  const secretKey = process.env.NCP_SENS_SECRET_KEY;
  const channelId = process.env.NCP_SENS_KAKAO_CHANNEL_ID;

  const tpl = ALIMTALK_TEMPLATES[template];
  const rendered = render(tpl.text, variables);
  const cleanPhone = sanitizePhone(phone);

  // 로그 먼저 기록 (환경 누락이어도 DB 로 trace)
  let logId: string | null = null;
  try {
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const svcKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supaUrl && svcKey) {
      const db = createServiceClient(supaUrl, svcKey, { auth: { persistSession: false } });
      const { data } = await db.from("alimtalk_logs").insert({
        user_id: userId || null,
        phone: cleanPhone,
        template_code: tpl.code,
        variables,
        provider: "ncp",
        status: "queued",
      }).select("id").maybeSingle();
      logId = data?.id ?? null;
    }
  } catch {}

  if (!serviceId || !accessKey || !secretKey || !channelId) {
    return { ok: false, error: "NCP SENS env missing", stubbed: true, preview: rendered, logId };
  }

  const timestamp = Date.now().toString();
  const apiUrl = `/alimtalk/v2/services/${serviceId}/messages`;
  const signature = sign("POST", apiUrl, timestamp, accessKey, secretKey);

  try {
    const res = await fetch(`https://sens.apigw.ntruss.com${apiUrl}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "x-ncp-apigw-timestamp": timestamp,
        "x-ncp-iam-access-key": accessKey,
        "x-ncp-apigw-signature-v2": signature,
      },
      body: JSON.stringify({
        plusFriendId: channelId,
        templateCode: tpl.code,
        messages: [{
          to: cleanPhone,
          content: rendered,
        }],
      }),
    });
    const data = await res.json();

    // 로그 업데이트
    if (logId) {
      try {
        const db = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } }
        );
        await db.from("alimtalk_logs").update({
          status: res.ok ? "sent" : "failed",
          provider_msg_id: data.requestId || null,
          sent_at: res.ok ? new Date().toISOString() : null,
          error: res.ok ? null : JSON.stringify(data).slice(0, 500),
        }).eq("id", logId);
      } catch {}
    }

    if (!res.ok) return { ok: false, error: data.error || "send failed", logId };
    return { ok: true, requestId: data.requestId, logId };
  } catch (err: any) {
    return { ok: false, error: err.message || "network error", logId };
  }
}

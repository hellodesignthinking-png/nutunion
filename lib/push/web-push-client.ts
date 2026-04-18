// Web Push 유틸 — 서버 전용.
// VAPID 키는 환경변수로 주입 (public key 는 클라이언트에도 노출 가능).
//
// 환경변수 설정:
//   npm i -g web-push (또는 npx web-push generate-vapid-keys) 로 키 생성 후
//   Vercel env 에 추가:
//     NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
//     VAPID_PRIVATE_KEY=<private key>
//     VAPID_SUBJECT=mailto:admin@nutunion.co.kr

import webpush from "web-push";

let configured = false;

function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@nutunion.co.kr";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys 미설정 — NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY 필요");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

/** 단일 구독에 푸시 발송. 404/410 = 만료된 구독 (호출측에서 DB 삭제) */
export async function sendPush(
  sub: SubscriptionRow,
  payload: PushPayload
): Promise<{ ok: true } | { ok: false; expired: boolean; error: string }> {
  configure();
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key },
      },
      JSON.stringify(payload),
      { TTL: 3600 * 24 }
    );
    return { ok: true };
  } catch (err: unknown) {
    const statusCode =
      err && typeof err === "object" && "statusCode" in err
        ? Number((err as { statusCode: number }).statusCode)
        : 0;
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      expired: statusCode === 404 || statusCode === 410,
      error: message,
    };
  }
}

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 매일 아침 9시 KST (UTC 00:00) 실행.
 * - 각 와셔의 지난 24h 미읽음 알림 3개 이상이면 digest 이메일 1통.
 * - notification_preferences.email.daily_digest === true 만 발송.
 * - Resend 환경변수 필요.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "SUPABASE env missing" }, { status: 501 });
  const db = createServiceClient(url, key, { auth: { persistSession: false } });

  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || "nutunion <noreply@nutunion.co.kr>";

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // digest 수신자 — daily_digest true
  const { data: prefs } = await db
    .from("notification_preferences")
    .select("user_id, email")
    .not("email", "is", null);

  const eligible = (prefs ?? []).filter((p: any) => p.email?.daily_digest === true);
  if (eligible.length === 0) return NextResponse.json({ sent: 0, reason: "no eligible users" });

  let sent = 0, skipped = 0, failed = 0;

  for (const p of eligible) {
    // 미읽음 알림 조회
    const { data: unread } = await db
      .from("notifications")
      .select("title, body, type, link_url, created_at")
      .eq("user_id", p.user_id)
      .eq("is_read", false)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!unread || unread.length < 3) { skipped++; continue; }

    const { data: profile } = await db.from("profiles").select("email, nickname").eq("id", p.user_id).maybeSingle();
    if (!profile?.email) { skipped++; continue; }

    // Email 발송
    if (!resendKey) { skipped++; continue; }

    const items = unread.slice(0, 8).map((n: any) =>
      `<li style="margin-bottom:14px">
        <div style="font-size:15px;font-weight:600;color:#1a1a1a;margin-bottom:4px">${escape(n.title)}</div>
        ${n.body ? `<div style="font-size:13px;color:#737373;line-height:1.6">${escape(n.body.slice(0, 120))}</div>` : ""}
        ${n.link_url ? `<a href="https://nutunion.co.kr${n.link_url}" style="font-size:12px;color:#FF3D88;text-decoration:none">확인하기 →</a>` : ""}
      </li>`
    ).join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>nutunion 어제의 브리프</title></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:32px">
<tr><td>
<p style="margin:0 0 4px;font-family:monospace;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#737373">nutunion · 어제의 브리프</p>
<h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#1a1a1a">${escape(profile.nickname || "와셔")}님, 어제 이런 일들이 있었어요</h1>
<p style="margin:0 0 24px;font-size:14px;color:#737373">읽지 않은 알림 ${unread.length}개 중 최근 ${Math.min(8, unread.length)}개</p>
<ul style="list-style:none;padding:0;margin:0">${items}</ul>
<p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#737373;line-height:1.6">
  <a href="https://nutunion.co.kr/notifications" style="color:#1a1a1a">전체 알림 보기</a> ·
  <a href="https://nutunion.co.kr/settings/notifications" style="color:#737373">알림 설정</a>
</p>
</td></tr>
</table>
</td></tr></table></body></html>`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: resendFrom,
          to: [profile.email],
          subject: `nutunion · 어제의 브리프 (${unread.length}건)`,
          html,
        }),
      });
      if (res.ok) sent++;
      else failed++;
    } catch { failed++; }
  }

  return NextResponse.json({ eligible: eligible.length, sent, skipped, failed });
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

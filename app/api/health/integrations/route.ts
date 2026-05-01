import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/health/integrations — admin only.
 * 모든 외부 서비스 연결 상태를 한눈에.
 * 각 서비스: { name, envPresent, connected?, note }
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  type Status = { name: string; category: string; envPresent: boolean; connected?: boolean; note?: string };

  const statuses: Status[] = [];

  // ── AI Gateway / Claude ───────────────────────────
  const hasGatewayKey = !!process.env.AI_GATEWAY_API_KEY;
  const hasOidc = !!process.env.VERCEL_OIDC_TOKEN;
  const hasLegacyAnthropic = !!process.env.ANTHROPIC_API_KEY;
  statuses.push({
    name: "AI Gateway (Claude)",
    category: "AI",
    envPresent: hasGatewayKey || hasOidc || hasLegacyAnthropic,
    note: hasOidc ? "Vercel OIDC 자동 인증" :
          hasGatewayKey ? "AI_GATEWAY_API_KEY 사용 중" :
          hasLegacyAnthropic ? "⚠ 레거시 ANTHROPIC_API_KEY — Gateway 전환 권장" :
          "Gateway 또는 key 설정 필요 (Vercel Dashboard → AI Gateway)",
  });

  // ── Resend (이메일) ───────────────────────────────
  statuses.push({
    name: "Resend",
    category: "Email",
    envPresent: !!process.env.RESEND_API_KEY,
    note: !process.env.RESEND_API_KEY ? "RESEND_API_KEY 없음 — 이메일 알림·Digest 비활성" :
          !process.env.RESEND_FROM ? "RESEND_FROM 권장 (기본: nutunion <noreply@nutunion.co.kr>)" : "OK",
  });

  // ── NCP SENS (카카오 알림톡) ──────────────────────
  const sens = ["NCP_SENS_SERVICE_ID", "NCP_SENS_ACCESS_KEY", "NCP_SENS_SECRET_KEY", "NCP_SENS_KAKAO_CHANNEL_ID"];
  const sensPresent = sens.every((k) => !!process.env[k]);
  statuses.push({
    name: "NCP SENS (카카오 알림톡)",
    category: "Messaging",
    envPresent: sensPresent,
    note: sensPresent ? "OK · 템플릿 사전 승인 필수" :
          `부족: ${sens.filter((k) => !process.env[k]).join(", ")}`,
  });

  // ── Popbill (세금계산서) ──────────────────────────
  const popbill = ["POPBILL_LINK_ID", "POPBILL_SECRET_KEY", "POPBILL_CORP_NUM"];
  const popbillPresent = popbill.every((k) => !!process.env[k]);
  statuses.push({
    name: "Popbill (세금계산서)",
    category: "Finance",
    envPresent: popbillPresent,
    note: popbillPresent
      ? `Mode: ${process.env.POPBILL_MODE || "TEST"}`
      : `부족: ${popbill.filter((k) => !process.env[k]).join(", ")}`,
  });

  // ── 결제 (Toss / PortOne) ─────────────────────────
  statuses.push({
    name: "Toss Payments",
    category: "Payment",
    envPresent: !!process.env.TOSS_SECRET_KEY && !!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
    note: !process.env.TOSS_SECRET_KEY ? "TOSS_SECRET_KEY 없음" :
          process.env.TOSS_SECRET_KEY?.startsWith("test_") ? "TEST mode" : "LIVE mode",
  });
  statuses.push({
    name: "PortOne (V1)",
    category: "Payment",
    envPresent: !!process.env.PORTONE_API_KEY && !!process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
    note: process.env.PORTONE_API_KEY ? "OK" : "PORTONE_API_KEY / STORE_ID 필요",
  });

  // ── OAuth (Slack / Notion / GitHub) ───────────────
  for (const p of [
    { name: "Slack", keys: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"] },
    { name: "Notion", keys: ["NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET"] },
    { name: "GitHub", keys: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"] },
  ]) {
    statuses.push({
      name: `OAuth · ${p.name}`,
      category: "Integrations",
      envPresent: p.keys.every((k) => !!process.env[k]),
      note: p.keys.every((k) => !!process.env[k])
        ? `Redirect: /api/integrations/${p.name.toLowerCase()}/callback`
        : `키 부족: ${p.keys.filter((k) => !process.env[k]).join(", ")}`,
    });
  }

  // ── 전자서명 ──────────────────────────────────────
  statuses.push({
    name: "모두싸인 (eSign)",
    category: "Legal",
    envPresent: !!process.env.MODUSIGN_API_KEY && !!process.env.MODUSIGN_USER_EMAIL,
    note: !process.env.MODUSIGN_API_KEY ? "API_KEY + USER_EMAIL 필요" : "OK",
  });

  // ── Google OAuth ──────────────────────────────────
  statuses.push({
    name: "Google OAuth",
    category: "Integrations",
    envPresent: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
    note: process.env.GOOGLE_CLIENT_ID ? "OK" : "캘린더/드라이브 연동 비활성",
  });

  // ── Web Push (VAPID) ──────────────────────────────
  statuses.push({
    name: "Web Push (VAPID)",
    category: "Messaging",
    envPresent: !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY,
    note: !process.env.VAPID_PRIVATE_KEY ? "npm i -g web-push && web-push generate-vapid-keys" : "OK",
  });

  // ── Supabase Service Role ─────────────────────────
  statuses.push({
    name: "Supabase Service Role",
    category: "Core",
    envPresent: !!(process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY),
    note: (process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY) ? "OK" : "웹훅/Cron 동작 불가",
  });

  // ── Cron Secret ───────────────────────────────────
  statuses.push({
    name: "CRON_SECRET",
    category: "Core",
    envPresent: !!process.env.CRON_SECRET,
    note: process.env.CRON_SECRET ? "OK — Authorization: Bearer CRON_SECRET" : "cron 엔드포인트 무방비",
  });

  // ── pg_cron 상태 (Supabase) ──────────────────────
  try {
    const { data: extCheck } = await supabase.rpc("pg_extension_check" as any, {} as any);
    // 이 RPC 는 존재하지 않을 수도 있음 — 참고용
  } catch {}

  // ── DB 집계 테이블 존재 체크 ──────────────────────
  const [dmCount, seCount] = await Promise.all([
    supabase.from("daily_metrics").select("date", { count: "exact", head: true }).then((r) => r, () => ({ count: null })),
    supabase.from("stiffness_events").select("id", { count: "exact", head: true }).then((r) => r, () => ({ count: null })),
  ]);

  const summary = {
    total: statuses.length,
    configured: statuses.filter((s) => s.envPresent).length,
    missing: statuses.filter((s) => !s.envPresent).length,
    categories: {} as Record<string, { total: number; configured: number }>,
  };
  for (const s of statuses) {
    summary.categories[s.category] = summary.categories[s.category] || { total: 0, configured: 0 };
    summary.categories[s.category].total += 1;
    if (s.envPresent) summary.categories[s.category].configured += 1;
  }

  return NextResponse.json({
    summary,
    services: statuses,
    db: {
      daily_metrics_rows: (dmCount as any).count,
      stiffness_events_rows: (seCount as any).count,
    },
    ts: new Date().toISOString(),
  });
}

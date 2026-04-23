/**
 * POST /api/bolts/[id]/sync-integrations
 *
 * Carriage 볼트의 integrations 설정을 읽어 Vercel/PostHog 데이터 수집 → bolt_metrics upsert.
 * 수동 호출(UI 버튼) 또는 cron 에서 사용.
 *
 * RLS: can_write_bolt 를 통과한 사용자만 호출 가능 (owner/member/admin).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncCarriageDaily } from "@/lib/bolt/integrations";

export const maxDuration = 30;

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 1) 볼트 타입 + integrations 로드
  const [projRes, carRes] = await Promise.all([
    supabase.from("projects").select("id, type").eq("id", id).maybeSingle(),
    supabase.from("project_carriage").select("integrations").eq("project_id", id).maybeSingle(),
  ]);

  if (!projRes.data) return NextResponse.json({ error: "bolt not found" }, { status: 404 });
  if ((projRes.data as any).type !== "carriage") {
    return NextResponse.json({ error: "not a carriage bolt" }, { status: 400 });
  }

  const cfg = ((carRes.data as any)?.integrations as Record<string, string>) || {};

  // 2) 외부 API 호출
  const result = await syncCarriageDaily(cfg);

  // 볼트 제목 — 알림용
  const title = ((projRes.data as any).title as string) || "플랫폼";

  if (Object.keys(result.metrics).length === 0) {
    await supabase.from("notifications").insert({
      user_id: auth.user.id,
      type: "carriage_sync_skipped",
      title: `${title} 동기화 건너뜀`,
      body: "Vercel/PostHog 프로젝트 ID 또는 서버 환경 변수(VERCEL_API_TOKEN / POSTHOG_API_KEY)가 없어요.",
      metadata: { project_id: id, link: `/projects/${id}` },
    });
    return NextResponse.json({
      synced: false,
      reason: "Vercel/PostHog 연결 설정 또는 환경 변수 누락",
      config: cfg,
    });
  }

  // 3) 오늘 daily metrics 에 upsert
  const today = new Date().toISOString().slice(0, 10);
  const { error: upErr } = await supabase.from("bolt_metrics").upsert(
    {
      project_id: id,
      period_type: "daily",
      period_start: today,
      metrics: result.metrics,
      memo: "자동 동기화 · Vercel/PostHog",
      entered_by: auth.user.id,
      entered_at: new Date().toISOString(),
    },
    { onConflict: "project_id,period_type,period_start" },
  );

  if (upErr) {
    console.error("[sync upsert]", upErr);
    await supabase.from("notifications").insert({
      user_id: auth.user.id,
      type: "carriage_sync_failed",
      title: `${title} 동기화 실패`,
      body: upErr.message,
      metadata: { project_id: id, link: `/projects/${id}`, error: upErr.message },
    });
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // 성공 알림 — 연결된 provider 요약
  const providers = [
    result.vercel !== null ? "Vercel" : null,
    result.posthog !== null ? "PostHog" : null,
  ].filter(Boolean).join(" · ");
  await supabase.from("notifications").insert({
    user_id: auth.user.id,
    type: "carriage_sync_succeeded",
    title: `${title} 동기화 완료`,
    body: `${providers} 에서 오늘 지표를 가져왔어요.`,
    metadata: { project_id: id, link: `/projects/${id}`, metrics: result.metrics },
  });

  return NextResponse.json({
    synced: true,
    metrics: result.metrics,
    providers: {
      vercel: result.vercel !== null,
      posthog: result.posthog !== null,
    },
  });
}

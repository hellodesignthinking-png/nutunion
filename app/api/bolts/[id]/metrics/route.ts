/**
 * /api/bolts/[id]/metrics
 *
 * POST   — 일일/주간/월간 마감 upsert (period_type + period_start unique)
 * GET    — 기간 범위 조회 (?period_type=daily&since=YYYY-MM-DD&until=YYYY-MM-DD)
 *
 * RLS 는 bolt_metrics_insert / metrics_update 정책이 강제
 * (owner / member 또는 admin 만 쓰기 가능).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

const ALLOWED_PERIODS = ["daily", "weekly", "monthly"] as const;

export async function GET(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const supabase = await createClient();

  const url = new URL(req.url);
  const periodType = url.searchParams.get("period_type") || "daily";
  const since = url.searchParams.get("since");
  const until = url.searchParams.get("until");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 366);

  if (!ALLOWED_PERIODS.includes(periodType as any)) {
    return NextResponse.json({ error: "invalid period_type" }, { status: 400 });
  }

  let q = supabase
    .from("bolt_metrics")
    .select("*")
    .eq("project_id", id)
    .eq("period_type", periodType)
    .order("period_start", { ascending: false })
    .limit(limit);

  if (since) q = q.gte("period_start", since);
  if (until) q = q.lte("period_start", until);

  const { data, error } = await q;
  if (error) {
    console.error("[bolt_metrics.GET]", { id, periodType, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const { period_type, period_start, metrics, memo } = body as {
    period_type?: string;
    period_start?: string;
    metrics?: Record<string, unknown>;
    memo?: string;
  };

  if (!ALLOWED_PERIODS.includes(period_type as any)) {
    return NextResponse.json({ error: "invalid period_type" }, { status: 400 });
  }
  if (!period_start || !/^\d{4}-\d{2}-\d{2}$/.test(period_start)) {
    return NextResponse.json({ error: "invalid period_start (YYYY-MM-DD)" }, { status: 400 });
  }
  if (!metrics || typeof metrics !== "object") {
    return NextResponse.json({ error: "metrics required" }, { status: 400 });
  }

  // upsert on (project_id, period_type, period_start)
  const { data, error } = await supabase
    .from("bolt_metrics")
    .upsert(
      {
        project_id: id,
        period_type,
        period_start,
        metrics,
        memo: memo ?? null,
        entered_by: auth.user.id,
        entered_at: new Date().toISOString(),
      },
      { onConflict: "project_id,period_type,period_start" },
    )
    .select()
    .maybeSingle();

  if (error) {
    console.error("[bolt_metrics.POST]", { id, period_type, period_start, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ row: data });
}

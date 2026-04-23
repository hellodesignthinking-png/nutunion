/**
 * GET /api/cron/sync-carriage
 *
 * 모든 Carriage 볼트의 Vercel/PostHog 데이터를 수집해 bolt_metrics 에 upsert.
 * Vercel Cron 매일 00:10 KST = 15:10 UTC 호출.
 *
 * 인증: CRON_SECRET (Authorization: Bearer ...)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncCarriageDaily } from "@/lib/bolt/integrations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "SUPABASE env missing" }, { status: 501 });
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  // 1) 모든 Carriage 볼트 조회
  const { data: bolts, error: listErr } = await db
    .from("projects")
    .select("id, title, created_by")
    .eq("type", "carriage")
    .neq("status", "archived");
  if (listErr) {
    console.error("[cron sync-carriage] list", listErr);
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  if (!bolts || bolts.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, reason: "no carriage bolts" });
  }

  // 2) integrations 조회 (한 번에)
  const ids = bolts.map((b) => b.id);
  const { data: carriageRows } = await db
    .from("project_carriage")
    .select("project_id, integrations")
    .in("project_id", ids);
  const intMap = new Map<string, Record<string, string>>();
  for (const r of carriageRows || []) {
    intMap.set((r as any).project_id, ((r as any).integrations as Record<string, string>) || {});
  }

  // 3) 각 볼트 sync (병렬, 실패 허용)
  const today = new Date().toISOString().slice(0, 10);
  const results = await Promise.allSettled(
    bolts.map(async (b) => {
      const cfg = intMap.get(b.id) || {};
      const synced = await syncCarriageDaily(cfg);
      if (Object.keys(synced.metrics).length === 0) {
        return { id: b.id, title: b.title, skipped: true, reason: "no integrations configured" };
      }
      const { error: upErr } = await db.from("bolt_metrics").upsert(
        {
          project_id: b.id,
          period_type: "daily",
          period_start: today,
          metrics: synced.metrics,
          memo: "자동 동기화 (cron)",
          entered_by: null,
          entered_at: new Date().toISOString(),
        },
        { onConflict: "project_id,period_type,period_start" },
      );
      if (upErr) {
        // 실패 알림 — 볼트 owner 에게
        if (b.created_by) {
          await db.from("notifications").insert({
            user_id: b.created_by,
            type: "carriage_sync_failed",
            title: `${b.title} 자동 동기화 실패`,
            body: upErr.message,
            metadata: { project_id: b.id, link: `/projects/${b.id}`, error: upErr.message },
          });
        }
        throw new Error(upErr.message);
      }
      return { id: b.id, title: b.title, metrics: synced.metrics };
    }),
  );

  const summary = {
    ok: true,
    processed: bolts.length,
    succeeded: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
    details: results.map((r, i) => ({
      bolt: bolts[i].title,
      status: r.status,
      ...(r.status === "fulfilled" ? { value: (r as any).value } : { error: (r as any).reason?.message }),
    })),
  };

  console.log("[cron sync-carriage]", summary);
  return NextResponse.json(summary);
}

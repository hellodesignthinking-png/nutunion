/**
 * POST /api/admin/storage/cleanup-drive-edits
 *
 * 방치된 Drive 편집 사본을 일괄 정리. admin/staff 전용.
 *
 * Body: { older_than_days: number, dry_run?: boolean }
 *  - older_than_days: 이 일수보다 오래된 사본 (synced_at 또는 created_at 기준)
 *  - dry_run: true 면 실제 삭제 안 하고 대상만 반환
 *
 * 동작:
 *  - file_drive_edits 에서 대상 row 찾음
 *  - 각 row 의 user_id 로 Drive client 만들어 휴지통 처리
 *    (토큰 만료/미연결인 사용자 → DB row 만 정리, Drive 사본은 그대로 — 보고)
 *  - file_drive_edits 와 130 미러 컬럼 정리
 */

import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getGoogleClient } from "@/lib/google/auth";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withRouteLog("admin.storage.cleanup-drive-edits", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "staff") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const days = Number(body?.older_than_days);
  const dryRun = body?.dry_run === true;
  if (!Number.isFinite(days) || days < 7) {
    return NextResponse.json({ error: "older_than_days >= 7 필요 (안전을 위해)" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) return NextResponse.json({ error: "service role missing" }, { status: 500 });
  const svc = createServiceClient(url, key, { auth: { persistSession: false } });

  const cutoff = new Date(Date.now() - days * 86400_000);
  const cutoffIso = cutoff.toISOString();

  // 후보 — synced_at 가 cutoff 이전이거나, synced_at 가 null 이고 created_at 이 cutoff 이전
  const { data: candidates } = await svc
    .from("file_drive_edits")
    .select("id, resource_table, resource_id, user_id, drive_file_id, synced_at, created_at")
    .or(`synced_at.lt.${cutoffIso},and(synced_at.is.null,created_at.lt.${cutoffIso})`);

  const list = candidates || [];
  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      count: list.length,
      sample: list.slice(0, 10),
    });
  }

  let driveOk = 0;
  let driveSkipped = 0;
  let dbCleaned = 0;
  const errors: string[] = [];

  for (const e of list) {
    // Drive 휴지통 처리 — 사용자 토큰 필요
    try {
      const driveAuth = await getGoogleClient(e.user_id);
      const drive = google.drive({ version: "v3", auth: driveAuth });
      await drive.files.update({
        fileId: e.drive_file_id,
        requestBody: { trashed: true },
      });
      driveOk++;
    } catch (err: any) {
      driveSkipped++;
      errors.push(`drive ${e.id}: ${err?.message || "skip"}`);
    }

    // DB row 정리 (service role)
    const { error: delErr } = await svc.from("file_drive_edits").delete().eq("id", e.id);
    if (!delErr) {
      dbCleaned++;
      // 130 미러 컬럼 정리 — 같은 resource 의 drive_edit_user_id 가 이 user 면 비우기
      await svc
        .from(e.resource_table)
        .update({
          drive_edit_file_id: null,
          drive_edit_user_id: null,
          drive_edit_link: null,
          drive_edit_synced_at: null,
        })
        .eq("id", e.resource_id)
        .eq("drive_edit_user_id", e.user_id);
    }
  }

  log.info("admin.storage.cleanup_drive_edits.done", {
    days,
    candidates: list.length,
    drive_ok: driveOk,
    drive_skipped: driveSkipped,
    db_cleaned: dbCleaned,
  });

  return NextResponse.json({
    dry_run: false,
    candidates: list.length,
    drive_ok: driveOk,
    drive_skipped: driveSkipped,
    db_cleaned: dbCleaned,
    errors_sample: errors.slice(0, 5),
  });
});

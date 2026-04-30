/**
 * GET /api/cron/auto-sync-drive
 *
 * 활성 Drive 편집 사본을 폴링해서 modifiedTime > synced_at 이면 sync-from-drive 로직 실행.
 * Drive Push Notification (webhook) 대신 폴링으로 인프라 단순화.
 *
 * 인증: Bearer ${CRON_SECRET}
 *
 * 처리 정책:
 *  - 최근 7일 안에 sync 됐거나 14일 안에 만들어진 사본만 (활성 편집 가정)
 *  - 한 회당 최대 20개 (Vercel 함수 시간 제한 고려)
 *  - 각 사본별 OAuth 토큰 필요 — 토큰 만료/미연결은 건너뜀
 *  - Drive 변경 감지: modifiedTime > synced_at + 1초
 *  - 변경 발견 시: drive.files.export → R2 PUT (덮어쓰기) → synced_at 갱신
 *  - 백업까지 하면 시간 부담 → 자동 sync 는 백업 생략 (수동 sync 만 백업)
 *
 * 환경변수:
 *  - CRON_SECRET — 호출 인증
 *  - SUPABASE_SERVICE_ROLE_KEY — RLS 우회 (file_drive_edits 전체 조회)
 *  - R2_*  — 업로드 대상
 */

import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, isR2Configured } from "@/lib/storage/r2";
import { getGoogleClient } from "@/lib/google/auth";
import { log } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min

const BATCH_LIMIT = 20;
const ACTIVE_WINDOW_DAYS = 14;
const RECENT_SYNC_DAYS = 7;
const MAX_BYTES = 100 * 1024 * 1024;

const EXPORT_TARGET: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: "docx",
  },
  "application/vnd.google-apps.spreadsheet": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: "xlsx",
  },
  "application/vnd.google-apps.presentation": {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ext: "pptx",
  },
};

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  }
  if (!isR2Configured()) {
    return NextResponse.json({ error: "R2 not configured" }, { status: 500 });
  }

  const supabase = createServiceClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 86400_000).toISOString();
  const recentSyncSince = new Date(now.getTime() - RECENT_SYNC_DAYS * 86400_000).toISOString();

  // 활성 사본 — 최근 14일 안에 생성됐거나 7일 안에 sync 됨
  const { data: edits, error: editsErr } = await supabase
    .from("file_drive_edits")
    .select("id, resource_table, resource_id, user_id, drive_file_id, synced_at, created_at")
    .or(`created_at.gte.${activeSince},synced_at.gte.${recentSyncSince}`)
    .order("synced_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_LIMIT);

  if (editsErr) {
    log.error(editsErr, "cron.auto_sync_drive.edits_query_failed");
    return NextResponse.json({ error: editsErr.message }, { status: 500 });
  }

  let checked = 0;
  let synced = 0;
  let unchanged = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const e of edits || []) {
    checked++;
    try {
      // 1) 자료실 행에서 storage_key 조회
      const { data: row } = await supabase
        .from(e.resource_table)
        .select("storage_key, storage_type")
        .eq("id", e.resource_id)
        .maybeSingle();
      if (!row || (row as any).storage_type !== "r2" || !(row as any).storage_key) {
        skipped++;
        continue;
      }
      const storageKey = (row as any).storage_key as string;

      // 2) 사용자 OAuth client
      let driveAuth;
      try {
        driveAuth = await getGoogleClient(e.user_id);
      } catch {
        // 토큰 만료/미연결 → 다음 회차로
        skipped++;
        continue;
      }
      const drive = google.drive({ version: "v3", auth: driveAuth });

      // 3) Drive 메타 — 변경 시각 + MIME
      const meta = await drive.files.get({
        fileId: e.drive_file_id,
        fields: "id, mimeType, modifiedTime, trashed",
      });
      if (meta.data.trashed) {
        skipped++;
        continue;
      }
      const driveMime = meta.data.mimeType || "";
      const driveModified = meta.data.modifiedTime;
      if (!driveModified) {
        skipped++;
        continue;
      }
      const driveTs = new Date(driveModified).getTime();
      const syncedTs = e.synced_at ? new Date(e.synced_at).getTime() : 0;
      // 변경 없음 → 스킵
      if (Number.isFinite(driveTs) && driveTs <= syncedTs + 1000) {
        unchanged++;
        continue;
      }

      // 4) Drive → 바이트 (Office export 또는 raw)
      let buf: Buffer;
      let effectiveMime: string;
      const exportTarget = EXPORT_TARGET[driveMime];
      if (driveMime.startsWith("application/vnd.google-apps.")) {
        if (!exportTarget) {
          skipped++;
          continue;
        }
        const exportRes = await drive.files.export(
          { fileId: e.drive_file_id, mimeType: exportTarget.mime },
          { responseType: "arraybuffer" },
        );
        buf = Buffer.from(exportRes.data as ArrayBuffer);
        effectiveMime = exportTarget.mime;
      } else {
        const mediaRes = await drive.files.get(
          { fileId: e.drive_file_id, alt: "media" },
          { responseType: "arraybuffer" },
        );
        buf = Buffer.from(mediaRes.data as ArrayBuffer);
        effectiveMime = driveMime || "application/octet-stream";
      }

      if (buf.byteLength > MAX_BYTES) {
        skipped++;
        continue;
      }

      // 5) R2 PUT (백업 생략 — 자동 sync 는 가벼운 미러링)
      await getR2Client().send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET!,
          Key: storageKey,
          Body: buf,
          ContentType: effectiveMime,
        }),
      );

      // 6) synced_at 갱신
      const nowIso = new Date().toISOString();
      await supabase
        .from("file_drive_edits")
        .update({ synced_at: nowIso })
        .eq("id", e.id);
      await supabase
        .from(e.resource_table)
        .update({
          drive_edit_synced_at: nowIso,
          ...(e.resource_table === "file_attachments" ? { file_size: buf.byteLength } : {}),
        })
        .eq("id", e.resource_id);

      synced++;
    } catch (err: any) {
      errors.push(`${e.id}: ${err?.message || String(err)}`);
      log.warn("cron.auto_sync_drive.entry_failed", {
        edit_id: e.id,
        error_message: err?.message,
      });
    }
  }

  log.info("cron.auto_sync_drive.done", { checked, synced, unchanged, skipped, errors_count: errors.length });
  return NextResponse.json({
    ok: true,
    checked,
    synced,
    unchanged,
    skipped,
    errors_count: errors.length,
    errors: errors.slice(0, 5),
  });
}

/**
 * POST /api/files/sync-from-drive
 *
 * Drive 에서 편집한 사본을 R2 원본 파일에 다시 덮어쓰기 — 자료실 카드 한 줄에서
 * 편집 사이클이 닫히도록.
 *
 * Body: { link_table: "file_attachments" | "project_resources", link_id: string }
 *
 * 동작:
 *  1) 자료실 행 조회 — drive_edit_file_id, drive_edit_user_id, storage_key, storage_type
 *  2) 권한: 사본을 만든 본인만 덮어쓸 수 있음 (다른 사람 사본을 강제로 덮어쓰면 변경 충돌)
 *  3) Drive 사본 → Office MIME 으로 export → buffer
 *  4) 같은 R2 키에 PutObject (덮어쓰기)
 *  5) drive_edit_synced_at, file_size, file_type 갱신
 */

import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { getR2Client, isR2Configured } from "@/lib/storage/r2";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/observability/logger";
import { tryAcquireLease, releaseLease } from "@/lib/locks/lease";

const VERSION_LIMIT = 5;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

// Google 네이티브 → Office export 매핑 (편집 사본은 보통 google-apps.* 형식)
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

type LinkTable = "file_attachments" | "project_resources";

export async function POST(req: NextRequest) {
  const span = log.span("files.sync_from_drive");
  const userId = await getCurrentUserId();
  if (!userId) {
    span.end({ status: 401 });
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }
  if (!isR2Configured()) {
    span.end({ status: 500, reason: "r2_not_configured" });
    return NextResponse.json({ error: "R2 가 구성되지 않았습니다" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const linkTable: LinkTable | undefined = body?.link_table;
  const linkId: string | undefined = body?.link_id;
  if (!linkId || (linkTable !== "file_attachments" && linkTable !== "project_resources")) {
    span.end({ status: 400 });
    return NextResponse.json({ error: "link_table + link_id 필요" }, { status: 400 });
  }

  const supabase = await createClient();

  // 1) 자료실 행 조회 — storage_type/key 만 필요
  const selectFields = linkTable === "file_attachments"
    ? "id, file_name, file_url, file_type, storage_type, storage_key"
    : "id, name, url, mime_type, storage_type, storage_key";
  const { data: row, error: fetchErr } = await supabase
    .from(linkTable)
    .select(selectFields)
    .eq("id", linkId)
    .maybeSingle();
  if (fetchErr) {
    span.end({ status: 500 });
    return NextResponse.json({ error: fetchErr.message || "자료 조회 실패" }, { status: 500 });
  }
  if (!row) {
    span.end({ status: 404 });
    return NextResponse.json({ error: "자료를 찾을 수 없습니다" }, { status: 404 });
  }

  // 2) 본인의 Drive 사본 조회 — Migration 131 우선, 130 폴백
  let driveFileId: string | null = null;
  const { data: fde, error: fdeErr } = await supabase
    .from("file_drive_edits")
    .select("drive_file_id")
    .eq("resource_table", linkTable)
    .eq("resource_id", linkId)
    .eq("user_id", userId)
    .maybeSingle();
  if (fdeErr) {
    // Migration 131 미적용 가능성 — 130 폴백 시도
    log.warn("files.sync_from_drive.fde_query_failed", {
      hint: "migration_131_may_be_missing",
      error_message: fdeErr.message,
    });
  }
  if (fde?.drive_file_id) {
    driveFileId = fde.drive_file_id;
  } else {
    // 130 폴백
    const { data: legacy } = await supabase
      .from(linkTable)
      .select("drive_edit_file_id, drive_edit_user_id")
      .eq("id", linkId)
      .maybeSingle();
    if ((legacy as any)?.drive_edit_user_id === userId && (legacy as any)?.drive_edit_file_id) {
      driveFileId = (legacy as any).drive_edit_file_id;
    }
  }

  const storageType = (row as any).storage_type;
  const storageKey = (row as any).storage_key;

  if (!driveFileId) {
    span.end({ status: 400, reason: "no_drive_copy" });
    return NextResponse.json(
      { error: "본인의 Drive 사본이 없습니다 — 먼저 'Drive에서 편집' 하세요" },
      { status: 400 },
    );
  }
  if (storageType !== "r2" || !storageKey) {
    span.end({ status: 400, reason: "not_r2" });
    return NextResponse.json(
      { error: "R2 에 저장된 파일만 Drive 변경분을 덮어쓸 수 있습니다" },
      { status: 400 },
    );
  }

  // 2-pre) 동시성 가드 — 같은 사용자가 30초 이내에 동기화 끝낸 직후 또 누르면 no-op
  const { data: lastSync } = await supabase
    .from("file_drive_edits")
    .select("synced_at")
    .eq("resource_table", linkTable)
    .eq("resource_id", linkId)
    .eq("user_id", userId)
    .maybeSingle();
  const lastSyncedAt = (lastSync?.synced_at as string | null) || null;

  // body.force=true 면 변경 검사 건너뛰기 (사용자가 명시적으로 강제)
  const force: boolean = body?.force === true;

  // 분산 lock — 같은 자료실 행에 대해 사용자/cron 이 동시에 sync 하면 R2 PUT 이 중복되고
  // 백업 _versions 도 두 벌이 만들어진다. lease 로 직렬화해서 낭비를 차단.
  // 마이그레이션 136 미적용 환경에선 graceful degrade — lock 없이 그대로 진행.
  const lockKey = `drive_sync:${linkTable}:${linkId}`;
  const lease = await tryAcquireLease(supabase, lockKey, userId, 90);
  if (!lease.acquired) {
    span.end({ status: 423, reason: "locked" });
    return NextResponse.json(
      { error: "다른 동기화가 진행 중입니다 — 잠시 후 다시 시도해 주세요", code: "SYNC_IN_PROGRESS" },
      { status: 423 },
    );
  }

  try {
    const auth = await getGoogleClient(userId);
    const drive = google.drive({ version: "v3", auth });

    // 2) Drive 사본 메타 조회 — modifiedTime + md5Checksum 으로 변경 감지
    const meta = await drive.files.get({
      fileId: driveFileId,
      fields: "id, name, mimeType, size, trashed, modifiedTime, md5Checksum",
    });
    if (meta.data.trashed) {
      span.end({ status: 410, reason: "trashed" });
      return NextResponse.json(
        { error: "Drive 사본이 휴지통에 있습니다 — 복원하거나 새로 'Drive에서 편집' 하세요" },
        { status: 410 },
      );
    }
    const driveMime = meta.data.mimeType || "";
    const exportTarget = EXPORT_TARGET[driveMime];

    // 2b) 변경 없음 감지 — Drive modifiedTime 이 마지막 동기화 이후 미변경이면 no-op
    if (!force && lastSyncedAt && meta.data.modifiedTime) {
      const driveTs = new Date(meta.data.modifiedTime).getTime();
      const syncedTs = new Date(lastSyncedAt).getTime();
      // Drive 가 동기화 시점 이후 변경되지 않았으면 PUT 생략
      if (Number.isFinite(driveTs) && Number.isFinite(syncedTs) && driveTs <= syncedTs + 1000) {
        span.end({ status: 200, reason: "unchanged" });
        return NextResponse.json({
          ok: true,
          unchanged: true,
          synced_at: lastSyncedAt,
          message: "Drive 사본에 변경사항이 없어요",
        });
      }
    }

    // 3) Drive → 바이트
    let buf: Buffer;
    let effectiveMime: string;
    if (driveMime.startsWith("application/vnd.google-apps.")) {
      if (!exportTarget) {
        span.end({ status: 400, reason: "google_native_unsupported", mime: driveMime });
        return NextResponse.json(
          { error: "이 Google 네이티브 형식은 자동 동기화를 지원하지 않습니다", mime: driveMime },
          { status: 400 },
        );
      }
      const exportRes = await drive.files.export(
        { fileId: driveFileId, mimeType: exportTarget.mime },
        { responseType: "arraybuffer" },
      );
      buf = Buffer.from(exportRes.data as ArrayBuffer);
      effectiveMime = exportTarget.mime;
    } else {
      // Office 그대로 (변환 없이 업로드된 사본)
      const mediaRes = await drive.files.get(
        { fileId: driveFileId, alt: "media" },
        { responseType: "arraybuffer" },
      );
      buf = Buffer.from(mediaRes.data as ArrayBuffer);
      effectiveMime = driveMime || "application/octet-stream";
    }

    if (buf.byteLength > MAX_SIZE) {
      span.end({ status: 413, bytes: buf.byteLength });
      return NextResponse.json(
        { error: `파일이 너무 큽니다 (최대 ${MAX_SIZE / 1024 / 1024}MB)` },
        { status: 413 },
      );
    }

    // 3b) 백업 — 현재 R2 객체를 _versions/ 경로로 복사 후 file_versions 테이블에 기록.
    //     실패해도 덮어쓰기는 진행 (백업이 안 됐다고 sync 자체를 막진 않음, 경고만).
    const ts = Date.now();
    const backupKey = `_versions/${storageKey}.${ts}.bak`;
    let backupOk = false;
    try {
      await getR2Client().send(
        new CopyObjectCommand({
          Bucket: process.env.R2_BUCKET!,
          CopySource: `${process.env.R2_BUCKET!}/${encodeURIComponent(storageKey).replace(/%2F/g, "/")}`,
          Key: backupKey,
        }),
      );
      const { error: insErr } = await supabase.from("file_versions").insert({
        resource_table: linkTable,
        resource_id: linkId,
        backup_storage_key: backupKey,
        bytes: null, // 모름 — 복원 시 HEAD 로 확인
        content_type: null,
        created_by: userId,
        label: "Drive 동기화 직전",
      });
      if (insErr) {
        log.warn("files.sync_from_drive.version_insert_failed", {
          hint: "migration_132_may_be_missing",
          error_message: insErr.message,
        });
      } else {
        backupOk = true;

        // 오래된 버전 정리 — 최신 5개만 유지
        const { data: versions } = await supabase
          .from("file_versions")
          .select("id, backup_storage_key")
          .eq("resource_table", linkTable)
          .eq("resource_id", linkId)
          .order("created_at", { ascending: false });
        if (versions && versions.length > VERSION_LIMIT) {
          const toDelete = versions.slice(VERSION_LIMIT);
          for (const v of toDelete) {
            try {
              await getR2Client().send(
                new DeleteObjectCommand({
                  Bucket: process.env.R2_BUCKET!,
                  Key: v.backup_storage_key,
                }),
              );
            } catch (e: any) {
              log.warn("files.sync_from_drive.old_version_r2_delete_failed", {
                key: v.backup_storage_key,
                error_message: e?.message,
              });
            }
            await supabase.from("file_versions").delete().eq("id", v.id);
          }
        }
      }
    } catch (e: any) {
      log.warn("files.sync_from_drive.backup_failed", {
        storage_key: storageKey,
        error_message: e?.message,
      });
    }

    // 4) 같은 R2 키에 덮어쓰기 — 3회 재시도 (지수 backoff). 마지막까지 실패하면 명확한 에러.
    //    R2 가 PUT 을 받았는지/안 받았는지 모르는 부분 실패는 idempotent (덮어쓰기) 라 재시도 안전.
    let r2PutErr: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await getR2Client().send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET!,
            Key: storageKey,
            Body: buf,
            ContentType: effectiveMime,
          }),
        );
        r2PutErr = null;
        break;
      } catch (e: any) {
        r2PutErr = e instanceof Error ? e : new Error(String(e));
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt)));
        }
      }
    }
    if (r2PutErr) {
      span.end({ status: 502, reason: "r2_put_failed", attempts: 3 });
      log.error(r2PutErr, "files.sync_from_drive.r2_put_failed", {
        storage_key: storageKey,
        bytes: buf.byteLength,
      });
      return NextResponse.json(
        {
          error: `R2 업로드 실패 (3회 재시도) — ${r2PutErr.message}. Drive 사본은 그대로 보존돼 있어 잠시 후 다시 시도해 주세요.`,
          code: "R2_PUT_FAILED",
        },
        { status: 502 },
      );
    }

    // 5) DB 갱신 — 크기, 동기화 시각
    const nowIso = new Date().toISOString();

    // 5a) file_drive_edits 본인 row synced_at 갱신
    const { error: fdeUpdateErr } = await supabase
      .from("file_drive_edits")
      .update({ synced_at: nowIso })
      .eq("resource_table", linkTable)
      .eq("resource_id", linkId)
      .eq("user_id", userId);
    if (fdeUpdateErr) {
      log.warn("files.sync_from_drive.fde_update_failed", { error_message: fdeUpdateErr.message });
    }

    // 5b) 자료실 행 갱신 (130 컬럼 미러 + 크기)
    const updateFields: Record<string, any> = {
      drive_edit_synced_at: nowIso,
    };
    if (linkTable === "file_attachments") {
      updateFields.file_size = buf.byteLength;
      // file_type 은 사용자가 지정한 원본 MIME 유지 — Drive export 가 변경한 MIME 으로 덮지 않음
    }
    await supabase.from(linkTable).update(updateFields).eq("id", linkId);

    span.end({ bytes: buf.byteLength, status: 200 });
    log.info("files.sync_from_drive.ok", {
      user_id: userId,
      link_table: linkTable,
      bytes: buf.byteLength,
    });

    return NextResponse.json({
      ok: true,
      unchanged: false,
      bytes: buf.byteLength,
      synced_at: nowIso,
      previous_synced_at: lastSyncedAt,
      drive_modified_time: meta.data.modifiedTime || null,
      backup_saved: backupOk,
    });
  } catch (err: unknown) {
    const e = err as Error & { code?: number };
    if (e?.message === "GOOGLE_NOT_CONNECTED") {
      span.end({ status: 401, reason: "not_connected" });
      return NextResponse.json({ error: "Google 계정이 연결되지 않았습니다", code: "GOOGLE_NOT_CONNECTED" }, { status: 401 });
    }
    if (e?.message === "GOOGLE_TOKEN_EXPIRED") {
      span.end({ status: 401, reason: "token_expired" });
      return NextResponse.json({ error: "Google 토큰이 만료되었습니다", code: "GOOGLE_TOKEN_EXPIRED" }, { status: 401 });
    }
    log.error(e, "files.sync_from_drive.failed", { user_id: userId });
    span.end({ status: 500 });
    return NextResponse.json({ error: e.message || "동기화 실패" }, { status: 500 });
  } finally {
    await releaseLease(supabase, lockKey, userId);
  }
}

/**
 * POST /api/files/versions/restore
 *
 * 백업본을 메인 storage_key 로 복사 → 자료실 행은 그대로, 파일 콘텐츠만 과거 버전으로 되돌림.
 * 복원 시 현재 콘텐츠도 새 버전으로 백업 (유저가 다시 되돌릴 수 있게).
 *
 * Body: { version_id: string }
 *
 * 권한: 자료실 행에 대한 업로더/그룹 매니저/프로젝트 호스트 중 하나 (기존 delete 라우트 패턴 재사용).
 */

import { NextRequest, NextResponse } from "next/server";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { getR2Client, isR2Configured } from "@/lib/storage/r2";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

export const dynamic = "force-dynamic";

export const POST = withRouteLog("files.versions.restore", async (req: NextRequest) => {
  const span = log.span("files.versions.restore");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    span.end({ status: 401 });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isR2Configured()) {
    span.end({ status: 500, reason: "r2_not_configured" });
    return NextResponse.json({ error: "R2 가 구성되지 않았습니다" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const versionId: string | undefined = body?.version_id;
  if (!versionId) {
    span.end({ status: 400 });
    return NextResponse.json({ error: "version_id 필요" }, { status: 400 });
  }

  // 1) 버전 정보 조회
  const { data: version, error: vErr } = await supabase
    .from("file_versions")
    .select("id, resource_table, resource_id, backup_storage_key")
    .eq("id", versionId)
    .maybeSingle();
  if (vErr || !version) {
    span.end({ status: 404 });
    return NextResponse.json({ error: "백업본을 찾을 수 없습니다" }, { status: 404 });
  }

  // 2) 자료실 행 조회 + 권한 검사
  const table = version.resource_table as "file_attachments" | "project_resources";
  const { data: row } = await supabase
    .from(table)
    .select(table === "file_attachments"
      ? "id, storage_key, uploaded_by, target_type, target_id"
      : "id, storage_key, uploaded_by, project_id")
    .eq("id", version.resource_id)
    .maybeSingle();
  if (!row || !(row as any).storage_key) {
    span.end({ status: 404, reason: "resource_missing_or_not_r2" });
    return NextResponse.json({ error: "원본 자료를 찾을 수 없거나 R2 가 아닙니다" }, { status: 404 });
  }

  // 권한 — 업로더 / 매니저 / 호스트
  let allowed = (row as any).uploaded_by === auth.user.id;
  if (!allowed && table === "file_attachments") {
    const targetType = (row as any).target_type;
    const targetId = (row as any).target_id;
    if (targetType === "group" && targetId) {
      const { data: gm } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", targetId)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (gm?.role === "host" || gm?.role === "manager") allowed = true;
    }
  }
  if (!allowed && table === "project_resources") {
    const projectId = (row as any).project_id;
    if (projectId) {
      const { data: pj } = await supabase
        .from("projects")
        .select("host_id")
        .eq("id", projectId)
        .maybeSingle();
      if (pj?.host_id === auth.user.id) allowed = true;
    }
  }
  if (!allowed) {
    span.end({ status: 403 });
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const mainKey = (row as any).storage_key as string;
  const backupKey = version.backup_storage_key;

  try {
    // 3) 현재 메인 → 새 백업 (복원 직전 스냅샷)
    const preRestoreTs = Date.now();
    const preRestoreKey = `_versions/${mainKey}.${preRestoreTs}.bak`;
    try {
      await getR2Client().send(
        new CopyObjectCommand({
          Bucket: process.env.R2_BUCKET!,
          CopySource: `${process.env.R2_BUCKET!}/${encodeURIComponent(mainKey).replace(/%2F/g, "/")}`,
          Key: preRestoreKey,
        }),
      );
      await supabase.from("file_versions").insert({
        resource_table: table,
        resource_id: version.resource_id,
        backup_storage_key: preRestoreKey,
        created_by: auth.user.id,
        label: "복원 직전 자동 백업",
      });
    } catch (e: any) {
      log.warn("files.versions.restore.pre_backup_failed", { error_message: e?.message });
      // 진행 — 복원 자체는 막지 않음
    }

    // 4) 백업본 → 메인 키 복사 (덮어쓰기)
    await getR2Client().send(
      new CopyObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        CopySource: `${process.env.R2_BUCKET!}/${encodeURIComponent(backupKey).replace(/%2F/g, "/")}`,
        Key: mainKey,
      }),
    );

    // 5) drive_edit_synced_at 무효화 — 다음 sync-from-drive 가 강제로 다시 가져오도록
    await supabase.from(table).update({ drive_edit_synced_at: null }).eq("id", version.resource_id);
    await supabase
      .from("file_drive_edits")
      .update({ synced_at: null })
      .eq("resource_table", table)
      .eq("resource_id", version.resource_id);

    span.end({ status: 200 });
    log.info("files.versions.restore.ok", {
      user_id: auth.user.id,
      version_id: versionId,
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const e = err as Error;
    log.error(e, "files.versions.restore.failed", { user_id: auth.user.id, version_id: versionId });
    span.end({ status: 500 });
    return NextResponse.json({ error: e.message || "복원 실패" }, { status: 500 });
  }
});

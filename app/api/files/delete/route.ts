/**
 * POST /api/files/delete
 *
 * 자료실 파일 삭제 — DB 행 + 실제 스토리지 객체(R2/Supabase) 같이 제거.
 *
 * Body: { id: string, table: "file_attachments" | "project_resources" }
 *
 * 권한:
 *  - 파일 업로더 본인
 *  - (file_attachments) 그룹 매니저 / 호스트
 *  - (project_resources) 프로젝트 리드
 *
 * 동작:
 *  1) 행 조회 (storage_type, storage_key, file_url, uploaded_by, target_id|project_id)
 *  2) 권한 검사
 *  3) storage_type 별 객체 삭제 (실패해도 DB 삭제는 진행 — 고아 row 방지)
 *  4) DB 행 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { deleteObject as deleteR2Object, isR2Configured } from "@/lib/storage/r2";
import { getGoogleClient } from "@/lib/google/auth";

export const dynamic = "force-dynamic";

type Table = "file_attachments" | "project_resources";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id: string | undefined = body?.id;
  const table: Table | undefined = body?.table;
  if (!id || !table) return NextResponse.json({ error: "id + table required" }, { status: 400 });
  if (table !== "file_attachments" && table !== "project_resources") {
    return NextResponse.json({ error: "invalid table" }, { status: 400 });
  }

  // 1) 행 조회
  const { data: row, error: fetchErr } = await supabase
    .from(table)
    .select(table === "file_attachments"
      ? "id, file_url, storage_type, storage_key, uploaded_by, target_type, target_id"
      : "id, url, storage_type, storage_key, uploaded_by, project_id")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr || !row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // 2) 권한 검사
  const ownerId: string | null = (row as any).uploaded_by ?? null;
  let allowed = ownerId === auth.user.id;

  if (!allowed && table === "file_attachments") {
    const targetId: string | null = (row as any).target_id ?? null;
    const targetType: string | null = (row as any).target_type ?? null;
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
    const projectId: string | null = (row as any).project_id ?? null;
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
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 3) 스토리지 객체 삭제 — 실패해도 DB 삭제는 계속 진행
  const fileUrl: string | null = (row as any).file_url ?? (row as any).url ?? null;
  const storageKey: string | null = (row as any).storage_key ?? null;
  const storageType: string | null = (row as any).storage_type ?? null;

  const storageWarnings: string[] = [];

  if (storageType === "r2" && storageKey) {
    if (!isR2Configured()) {
      storageWarnings.push("R2 not configured — object not deleted");
    } else {
      try {
        await deleteR2Object(storageKey);
      } catch (e: any) {
    log.error(e, "files.delete.failed");
        storageWarnings.push(`R2 delete failed: ${e?.message || "unknown"}`);
      }
    }
  } else if (storageType === "supabase" && fileUrl) {
    const path = fileUrl.split("/media/")[1];
    if (path) {
      const { error: rmErr } = await supabase.storage.from("media").remove([path]);
      if (rmErr) storageWarnings.push(`Supabase delete failed: ${rmErr.message}`);
    }
  } else if (!storageType && fileUrl?.includes("/media/")) {
    // 레거시 — storage_type 없는 Supabase 업로드
    const path = fileUrl.split("/media/")[1];
    if (path) {
      const { error: rmErr } = await supabase.storage.from("media").remove([path]);
      if (rmErr) storageWarnings.push(`Supabase legacy delete failed: ${rmErr.message}`);
    }
  }
  // google_drive / external / drive-link → 외부 자원이므로 건드리지 않음

  // 3b) Drive 사본 정리 — 본인 사본만 휴지통 (옵션, body.cleanup_drive_copy=true 일 때).
  //     기본은 cleanup=true: 자료실에서 지웠으면 본인 Drive 도 정리하는 게 자연스러움.
  //     다른 멤버의 Drive 사본은 그쪽 데이터라 건드리지 않음.
  const cleanupDrive: boolean = body?.cleanup_drive_copy !== false;
  if (cleanupDrive) {
    const { data: myCopy } = await supabase
      .from("file_drive_edits")
      .select("id, drive_file_id")
      .eq("resource_table", table)
      .eq("resource_id", id)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (myCopy?.drive_file_id) {
      try {
        const driveAuth = await getGoogleClient(auth.user.id);
        const drive = google.drive({ version: "v3", auth: driveAuth });
        // 휴지통 (delete 하면 영구삭제 — 휴지통이 더 안전)
        await drive.files.update({
          fileId: myCopy.drive_file_id,
          requestBody: { trashed: true },
        });
        // file_drive_edits row 정리
        await supabase
          .from("file_drive_edits")
          .delete()
          .eq("id", myCopy.id);
      } catch (e: any) {
    log.error(e, "files.delete.failed");
        // Google 토큰 만료/미연결 등은 무시 (자료 삭제는 계속 진행)
        storageWarnings.push(`Drive 사본 정리 건너뜀: ${e?.message || "unknown"}`);
      }
    }
  }

  // 4) DB 행 삭제
  const { error: delErr } = await supabase.from(table).delete().eq("id", id);
  if (delErr) {
    return NextResponse.json(
      { error: "DB delete failed", message: delErr.message, storage_warnings: storageWarnings },
      { status: 500 },
    );
  }

  // 5) 다른 멤버의 file_drive_edits 매핑 row 정리 (Drive 사본 자체는 그쪽 소유라 못 건드림 —
  //    매핑 정보만 정리해서 고아 row 남지 않도록). Service role 필요 (RLS 우회).
  try {
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const svc = createServiceClient(url, key, { auth: { persistSession: false } });
      await svc
        .from("file_drive_edits")
        .delete()
        .eq("resource_table", table)
        .eq("resource_id", id);
    }
  } catch (e: any) {
    log.error(e, "files.delete.failed");
    storageWarnings.push(`file_drive_edits 정리 실패: ${e?.message || "unknown"}`);
  }

  return NextResponse.json({ ok: true, storage_warnings: storageWarnings });
}

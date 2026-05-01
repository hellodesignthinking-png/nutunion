/**
 * [DEPRECATED — Drive migration Phase A]
 * 이 라우트는 더 이상 신규 너트/볼트 자료 저장을 위해 사용되지 않습니다.
 * 신규 콘텐츠는 Cloudflare R2 에 저장됩니다.
 * 과거 Drive 데이터 일회성 정리를 위해서만 `?force=1` 쿼리와 함께 호출하세요.
 * 향후 Phase 에서 완전 제거될 예정입니다.
 *
 * POST /api/admin/drive/backfill
 *
 * Admin 이 호출 — google_drive_folder_id 가 NULL 인 **모든 활성 너트/볼트**의
 * Google Drive 공유 폴더를 일괄 생성.
 *
 * 전제:
 *   1) 호출자가 role='admin' 이어야 함 (또는 은폐 env ADMIN_BACKFILL_TOKEN 일치)
 *   2) 호출자의 Google OAuth 가 연결되어 있어야 함
 *   3) (권장) GOOGLE_SHARED_DRIVE_ID 설정 — 조직 소유로 생성해야 호스트 탈퇴 영향 없음
 *      미설정 시 admin 의 개인 Drive 에 생성되어 다른 멤버는 접근 불가 → 경고 표시
 *
 * 반환:
 *   { processed, created, failed, details: [...] }
 */

import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getGoogleClient } from "@/lib/google/auth";
import { asGoogleErr } from "@/lib/google/error-helpers";
import {
  getDriveStorageTarget,
  withParents,
  driveRequestOptions,
} from "@/lib/google/drive-config";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5분 — 많은 너트/볼트 처리

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

interface BackfillItemResult {
  kind: "group" | "project";
  id: string;
  name: string;
  status: "created" | "skipped" | "failed";
  folderId?: string;
  webViewLink?: string;
  error?: string;
}

export const POST = withRouteLog("admin.drive.backfill", async (req: NextRequest) => {
  // [Drive shared-folder mode — 2026-04 rewire]
  // 단일 공유 폴더 모드에서는 그룹/프로젝트별 폴더 백필이 무의미하다.
  // env 가 설정돼 있으면 즉시 종료.
  if (process.env.GOOGLE_DRIVE_SHARED_FOLDER_ID?.trim()) {
    log.info("drive.backfill.shared_folder_mode_skip", { path: req.nextUrl.pathname });
    return NextResponse.json({
      processed: 0,
      created: 0,
      failed: 0,
      skipped: 0,
      sharedFolderMode: true,
      message: "Shared folder mode active — backfill skipped",
    });
  }

  // [Drive migration Phase A] Deprecation guard — require ?force=1 for legacy cleanup runs.
  const force = req.nextUrl.searchParams.get("force");
  if (force !== "1") {
    log.info("drive.backfill.deprecated_call_blocked", { path: req.nextUrl.pathname });
    return NextResponse.json(
      {
        error: "DEPRECATED",
        message:
          "Drive backfill is deprecated. Group/project content now stores on Cloudflare R2. Pass ?force=1 to run legacy cleanup.",
      },
      { status: 501 },
    );
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 권한 — admin 만
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "관리자만 실행할 수 있어요" }, { status: 403 });
  }

  // Google OAuth 확인
  let googleAuth;
  try {
    googleAuth = await getGoogleClient(auth.user.id);
  } catch (err) {
    const e = asGoogleErr(err);
    log.error(err, "drive.backfill.google_auth_failed", { user_id: auth.user.id });
    return NextResponse.json(
      {
        error: "Google 계정이 연결되지 않았어요",
        code: e.message === "GOOGLE_NOT_CONNECTED" ? "NOT_CONNECTED" : "TOKEN_EXPIRED",
      },
      { status: 403 },
    );
  }
  const drive = google.drive({ version: "v3", auth: googleAuth });

  const target = getDriveStorageTarget();
  const sharedDriveMode = target.strategy === "shared-drive";

  log.info("drive.backfill.started", {
    user_id: auth.user.id,
    shared_drive_mode: sharedDriveMode,
    shared_drive_id_hint: target.driveId ? target.driveId.slice(0, 6) + "..." : null,
    parent_folder_hint: target.parentFolderId ? target.parentFolderId.slice(0, 6) + "..." : null,
  });

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_role 미설정" }, { status: 501 });

  const results: BackfillItemResult[] = [];

  // 옵션 parsing
  const body = await req.json().catch(() => ({}));
  const onlyKind = body?.only as "group" | "project" | undefined;
  const dryRun = !!body?.dry_run;

  // ── 1) 활성 너트 순회 ────────────────────────────────────
  if (!onlyKind || onlyKind === "group") {
    const { data: groups } = await admin
      .from("groups")
      .select("id, name, host_id, is_active, google_drive_folder_id")
      .is("google_drive_folder_id", null)
      .eq("is_active", true);

    for (const g of ((groups as any[]) || [])) {
      if (dryRun) {
        results.push({ kind: "group", id: g.id, name: g.name, status: "skipped", error: "dry_run" });
        continue;
      }
      try {
        const folderRes = await drive.files.create({
          requestBody: withParents(
            { name: `[nutunion 너트] ${g.name}`, mimeType: "application/vnd.google-apps.folder" },
            target,
          ),
          fields: "id, webViewLink",
          ...driveRequestOptions(target),
        });
        const folderId = folderRes.data.id!;
        const webViewLink = folderRes.data.webViewLink || "";

        // 서브폴더 3개 (회의록 / 탭 / 자료)
        const subIds: Record<string, string> = {};
        for (const sub of ["회의록", "탭", "자료"]) {
          try {
            const s = await drive.files.create({
              requestBody: { name: sub, mimeType: "application/vnd.google-apps.folder", parents: [folderId] },
              fields: "id",
              ...driveRequestOptions(target),
            });
            subIds[sub] = s.data.id!;
          } catch {}
        }

        // 호스트 Drive 모드에선 공개 링크 부여 (legacy)
        if (!sharedDriveMode) {
          try {
            await drive.permissions.create({
              fileId: folderId,
              requestBody: { role: "reader", type: "anyone" },
            });
          } catch {}
        }

        await admin
          .from("groups")
          .update({
            google_drive_folder_id: folderId,
            google_drive_url: webViewLink,
            google_drive_meetings_folder_id: subIds["회의록"] || null,
            google_drive_wiki_folder_id: subIds["탭"] || null,
            google_drive_resources_folder_id: subIds["자료"] || null,
          } as any)
          .eq("id", g.id);

        results.push({ kind: "group", id: g.id, name: g.name, status: "created", folderId, webViewLink });
        log.info("drive.backfill.created", { kind: "group", id: g.id, name: g.name, folder_id: folderId });
      } catch (err) {
        const e = asGoogleErr(err);
        // 구글 API 원본 에러까지 자세히 기록
        const details = (err as any)?.response?.data?.error || (err as any)?.errors?.[0] || null;
        log.error(err, "drive.backfill.group_failed", {
          group_id: g.id,
          group_name: g.name,
          google_api_error: details,
        });
        results.push({
          kind: "group",
          id: g.id,
          name: g.name,
          status: "failed",
          error: details?.message || details?.reason || e.message,
        });
      }
    }
  }

  // ── 2) 볼트 순회 ─────────────────────────────────────────
  if (!onlyKind || onlyKind === "project") {
    const { data: projects } = await admin
      .from("projects")
      .select("id, title, created_by, google_drive_folder_id")
      .is("google_drive_folder_id", null);

    for (const p of ((projects as any[]) || [])) {
      if (dryRun) {
        results.push({ kind: "project", id: p.id, name: p.title, status: "skipped", error: "dry_run" });
        continue;
      }
      try {
        const folderRes = await drive.files.create({
          requestBody: withParents(
            { name: `[nutunion 볼트] ${p.title}`, mimeType: "application/vnd.google-apps.folder" },
            target,
          ),
          fields: "id, webViewLink",
          ...driveRequestOptions(target),
        });
        const folderId = folderRes.data.id!;
        const webViewLink = folderRes.data.webViewLink || "";

        const subIds: Record<string, string> = {};
        for (const sub of ["기획", "중간산출", "증빙", "최종"]) {
          try {
            const s = await drive.files.create({
              requestBody: { name: sub, mimeType: "application/vnd.google-apps.folder", parents: [folderId] },
              fields: "id",
              ...driveRequestOptions(target),
            });
            subIds[sub] = s.data.id!;
          } catch {}
        }

        if (!sharedDriveMode) {
          try {
            await drive.permissions.create({
              fileId: folderId,
              requestBody: { role: "reader", type: "anyone" },
            });
          } catch {}
        }

        await admin
          .from("projects")
          .update({
            google_drive_folder_id: folderId,
            google_drive_url: webViewLink,
            google_drive_planning_folder_id: subIds["기획"] || null,
            google_drive_interim_folder_id: subIds["중간산출"] || null,
            google_drive_evidence_folder_id: subIds["증빙"] || null,
            google_drive_final_folder_id: subIds["최종"] || null,
          } as any)
          .eq("id", p.id);

        results.push({ kind: "project", id: p.id, name: p.title, status: "created", folderId, webViewLink });
      } catch (err) {
        const e = asGoogleErr(err);
        results.push({ kind: "project", id: p.id, name: p.title, status: "failed", error: e.message });
      }
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  return NextResponse.json({
    processed: results.length,
    created,
    failed,
    skipped,
    sharedDriveMode,
    warning: sharedDriveMode
      ? null
      : "⚠ GOOGLE_SHARED_DRIVE_ID 가 설정되지 않아 관리자 개인 Drive 에 생성됐습니다. 멤버 접근을 위해 공유 드라이브 설정을 권장합니다.",
    details: results,
  });
});

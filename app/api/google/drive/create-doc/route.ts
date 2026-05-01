/**
 * POST /api/google/drive/create-doc
 *
 * 새 Google Docs/Sheets/Slides 문서를 사용자의 Drive 에 생성한다.
 *
 * Body: { type: "doc"|"sheet"|"slide", title: string, scope?: "group"|"project", scope_id?: string }
 * Response: { id, web_view_link, name, mime_type }
 *
 * 권한: 링크 공유(anyone with link can edit) — 사용자가 추후 수동으로 좁힐 수 있음.
 */
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSharedFolderId, getDriveOwnerUserId } from "@/lib/google/drive-config";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

const TYPE_TO_PROJECT_RESOURCE_TYPE: Record<string, string> = {
  doc: "google_doc",
  sheet: "google_sheet",
  slide: "google_slide",
  drawing: "google_drawing",
};

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TYPE_TO_MIME: Record<string, string> = {
  doc: "application/vnd.google-apps.document",
  sheet: "application/vnd.google-apps.spreadsheet",
  slide: "application/vnd.google-apps.presentation",
  drawing: "application/vnd.google-apps.drawing",
};

export const POST = withRouteLog("google.drive.create-doc", async (req: NextRequest) => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const type: string = body?.type;
  const title: string = (body?.title || "").trim() || "제목 없는 문서";
  const scope: string | undefined = body?.scope;
  const scopeId: string | undefined = body?.scope_id;
  const mimeType = TYPE_TO_MIME[type];
  if (!mimeType) {
    return NextResponse.json({ error: "type 은 doc/sheet/slide 중 하나여야 합니다" }, { status: 400 });
  }

  try {
    const driveOwnerId = getDriveOwnerUserId();
    const auth = await getGoogleClient(driveOwnerId || userId);
    const drive = google.drive({ version: "v3", auth });

    const sharedFolderId = getSharedFolderId();
    const created = await drive.files.create({
      requestBody: {
        name: title,
        mimeType,
        ...(sharedFolderId && { parents: [sharedFolderId] }),
      },
      fields: "id, name, mimeType, webViewLink",
      supportsAllDrives: true,
    });

    const fileId = created.data.id;
    if (!fileId) {
      return NextResponse.json({ error: "Drive 생성 실패 (id 없음)" }, { status: 500 });
    }

    // 링크 공유 — anyone with link can edit (사용자가 추후 좁힐 수 있도록).
    // best-effort: 실패해도 파일 생성은 유효.
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: "writer", type: "anyone" },
      });
    } catch (e) {
      log.warn("drive.create_doc.permission_failed", { user_id: userId, file_id: fileId });
    }

    // ── 자료실 자동 등록 (admin client → RLS 우회) ──
    let registered = false;
    if (scope && scopeId) {
      const admin = getAdminClient();
      if (admin) {
        try {
          if (scope === "group") {
            await admin.from("file_attachments").insert({
              target_type: "group",
              target_id: scopeId,
              uploaded_by: userId,
              file_name: title,
              file_url: created.data.webViewLink,
              file_size: 0,
              file_type: `drive-${type}`,
              storage_type: "drive",
              storage_key: fileId,
            });
            registered = true;
          } else if (scope === "project") {
            await admin.from("project_resources").insert({
              project_id: scopeId,
              name: title,
              url: created.data.webViewLink,
              type: TYPE_TO_PROJECT_RESOURCE_TYPE[type] || "google_doc",
              stage: "planning",
              description: `Google Drive ${type.toUpperCase()}`,
              uploaded_by: userId,
            });
            registered = true;
          }
        } catch (regErr) {
          log.warn("drive.create_doc.register_failed", {
            user_id: userId,
            file_id: fileId,
            scope,
            scope_id: scopeId,
            error: (regErr as Error)?.message,
          });
        }
      }
    }

    log.info("drive.create_doc.ok", {
      user_id: userId,
      type,
      file_id: fileId,
      registered,
    });

    return NextResponse.json({
      id: fileId,
      web_view_link: created.data.webViewLink,
      name: created.data.name,
      mime_type: created.data.mimeType,
      registered,
    });
  } catch (err: unknown) {
    const e = err as Error & { code?: number };
    if (e?.message === "GOOGLE_NOT_CONNECTED") {
      return NextResponse.json(
        { error: "Google 계정이 연결되지 않았습니다. /settings/integrations 에서 연결해주세요.", code: "NOT_CONNECTED" },
        { status: 403 },
      );
    }
    if (e?.message === "GOOGLE_TOKEN_EXPIRED") {
      return NextResponse.json(
        { error: "Google 토큰이 만료되었습니다. 다시 연결해주세요.", code: "TOKEN_EXPIRED" },
        { status: 401 },
      );
    }
    log.error(e, "drive.create_doc.failed", { user_id: userId, type });
    return NextResponse.json({ error: e.message || "Drive 생성 실패" }, { status: 500 });
  }
});

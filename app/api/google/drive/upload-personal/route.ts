/**
 * /api/google/drive/upload-personal
 *
 * POST { file_url, file_name, convert?: boolean }
 *  → 사용자 본인의 Google Drive 에 파일 업로드
 *  → convert=true + Office 포맷이면 Google 문서로 변환하여 업로드
 *  → 반환: { drive_file_id, web_view_link, mime_type }
 *
 * 용도: FilePreviewPanel 에서 "📝 Google Docs 에서 편집" 버튼을 눌렀을 때
 *       R2 에 있는 .docx/.xlsx/.pptx 를 내 Drive 로 복사하면서 Google Docs/Sheets/Slides
 *       로 변환해 바로 편집할 수 있도록 한다.
 */

import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type LinkTable = "file_attachments" | "project_resources";

const OFFICE_MIME: Record<string, { source: string; google: string }> = {
  docx: {
    source: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    google: "application/vnd.google-apps.document",
  },
  xlsx: {
    source: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    google: "application/vnd.google-apps.spreadsheet",
  },
  pptx: {
    source: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    google: "application/vnd.google-apps.presentation",
  },
  // 한글 (Hancom HWP) — Google Drive 가 HWP → Docs 변환 지원
  hwp: {
    source: "application/x-hwp",
    google: "application/vnd.google-apps.document",
  },
  hwpx: {
    source: "application/vnd.hancom.hwpx",
    google: "application/vnd.google-apps.document",
  },
};

function extOf(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const fileUrl: string | undefined = body?.file_url;
  const fileName: string = body?.file_name || "upload";
  const convert: boolean = body?.convert !== false; // default true

  // 자료실 행과 Drive 사본을 묶을 때 — 두 번째 클릭부터는 새 사본을 만들지 않고 기존 link 재사용.
  const linkTable: LinkTable | undefined = body?.link_table;
  const linkId: string | undefined = body?.link_id;
  const linkValid = linkId && (linkTable === "file_attachments" || linkTable === "project_resources");

  if (!fileUrl) {
    return NextResponse.json({ error: "file_url required" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const auth = await getGoogleClient(userId);
    const drive = google.drive({ version: "v3", auth });

    // 0) 기존 Drive 사본이 있으면 재사용 — Migration 131 의 file_drive_edits 우선,
    // 미적용 시 130 의 drive_edit_* 컬럼으로 폴백.
    if (linkValid) {
      // a) 131: 본인의 사본
      const { data: fde, error: fdeErr } = await supabase
        .from("file_drive_edits")
        .select("drive_file_id, drive_link")
        .eq("resource_table", linkTable!)
        .eq("resource_id", linkId!)
        .eq("user_id", userId)
        .maybeSingle();

      let candidateFileId: string | null = fde?.drive_file_id || null;
      let candidateLink: string | null = fde?.drive_link || null;

      // b) 131 미적용 가능성 — 130 폴백
      if (!candidateFileId && (fdeErr || true)) {
        const { data: existing } = await supabase
          .from(linkTable!)
          .select("drive_edit_file_id, drive_edit_user_id, drive_edit_link")
          .eq("id", linkId!)
          .maybeSingle();
        if (existing?.drive_edit_file_id && existing.drive_edit_user_id === userId) {
          candidateFileId = existing.drive_edit_file_id;
          candidateLink = existing.drive_edit_link;
        }
      }

      if (candidateFileId) {
        try {
          const meta = await drive.files.get({
            fileId: candidateFileId,
            fields: "id, webViewLink, mimeType, trashed",
          });
          if (meta.data.id && !meta.data.trashed) {
            return NextResponse.json({
              drive_file_id: meta.data.id,
              web_view_link: meta.data.webViewLink || candidateLink,
              mime_type: meta.data.mimeType,
              reused: true,
              sync_back_available: true,
            });
          }
        } catch {
          // 사본이 휴지통에 갔거나 삭제됨 → 새로 생성
        }
      }
    }

    // 1) Fetch binary
    const resp = await fetch(fileUrl);
    if (!resp.ok) {
      return NextResponse.json({ error: `원본 파일을 불러올 수 없습니다 (${resp.status})` }, { status: 400 });
    }
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2) Determine source + target mime
    const ext = extOf(fileName);
    const office = OFFICE_MIME[ext];
    const sourceMime = office?.source || resp.headers.get("content-type") || "application/octet-stream";
    const targetMime = convert && office ? office.google : sourceMime;

    // 4) Upload — if converting, set mimeType=target, media.mimeType=source (Drive will convert)
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const requestBody: { name: string; mimeType?: string } = { name: fileName };
    if (convert && office) {
      requestBody.mimeType = targetMime;
    }

    const driveRes = await drive.files.create({
      requestBody,
      media: {
        mimeType: sourceMime,
        body: stream,
      },
      fields: "id, name, mimeType, webViewLink",
    });

    log.info("drive.upload_personal.ok", {
      user_id: userId,
      ext,
      converted: convert && !!office,
    });

    // 5) Drive 사본 정보 기록 — file_drive_edits (131) 우선, drive_edit_* (130) 미러링.
    let linkUpdateFailed = false;
    if (linkValid && driveRes.data.id) {
      // a) 131: 본인 사본 upsert
      const { error: fdeErr } = await supabase
        .from("file_drive_edits")
        .upsert(
          {
            resource_table: linkTable!,
            resource_id: linkId!,
            user_id: userId,
            drive_file_id: driveRes.data.id,
            drive_link: driveRes.data.webViewLink || null,
          },
          { onConflict: "resource_table,resource_id,user_id" },
        );
      if (fdeErr) {
        linkUpdateFailed = true;
        log.warn("drive.upload_personal.fde_upsert_failed", {
          hint: "migration_131_may_be_missing",
          error_message: fdeErr.message,
        });
      }

      // b) 130 미러링 — 배지/카드 호환용. 다른 사람 사본이 이미 적혀 있어도 본인 것으로 덮어 OK
      // (배지는 어차피 본인 != 사본 소유자일 때 별도 표시).
      const { error: updateErr } = await supabase
        .from(linkTable!)
        .update({
          drive_edit_file_id: driveRes.data.id,
          drive_edit_user_id: userId,
          drive_edit_link: driveRes.data.webViewLink || null,
        })
        .eq("id", linkId!);
      if (updateErr) {
        log.warn("drive.upload_personal.legacy_mirror_failed", {
          hint: "migration_130_may_be_missing",
          error_message: updateErr.message,
        });
      }
    }

    return NextResponse.json({
      drive_file_id: driveRes.data.id,
      web_view_link: driveRes.data.webViewLink,
      mime_type: driveRes.data.mimeType,
      reused: false,
      // 클라이언트가 sync-back 가능 여부 판단용 — false 면 마이그레이션 안 된 상태
      sync_back_available: linkValid && !linkUpdateFailed,
    });
  } catch (err: unknown) {
    const e = err as Error & { code?: number };
    if (e?.message === "GOOGLE_NOT_CONNECTED") {
      return NextResponse.json(
        { error: "Google 계정이 연결되지 않았습니다. 설정에서 먼저 연결해주세요.", code: "NOT_CONNECTED" },
        { status: 403 },
      );
    }
    if (e?.message === "GOOGLE_TOKEN_EXPIRED") {
      return NextResponse.json(
        { error: "Google 토큰이 만료되었습니다. 다시 연결해주세요.", code: "TOKEN_EXPIRED" },
        { status: 401 },
      );
    }
    if (e?.code === 403) {
      return NextResponse.json(
        { error: "Drive 업로드 권한이 없습니다.", code: "SCOPE_INSUFFICIENT" },
        { status: 403 },
      );
    }
    log.error(e, "drive.upload_personal.failed", { user_id: userId });
    return NextResponse.json({ error: e.message || "업로드 실패" }, { status: 500 });
  }
}

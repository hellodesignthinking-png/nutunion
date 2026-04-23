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
import { log } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  if (!fileUrl) {
    return NextResponse.json({ error: "file_url required" }, { status: 400 });
  }

  try {
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

    // 3) Get user's Google client
    const auth = await getGoogleClient(userId);
    const drive = google.drive({ version: "v3", auth });

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

    return NextResponse.json({
      drive_file_id: driveRes.data.id,
      web_view_link: driveRes.data.webViewLink,
      mime_type: driveRes.data.mimeType,
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

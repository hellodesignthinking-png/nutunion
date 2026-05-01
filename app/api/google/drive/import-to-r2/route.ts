// [Phase 4] POST /api/google/drive/import-to-r2
// Body: { driveFileId: string, prefix?: "chat"|"resources"|"avatars"|"uploads", scopeId?: string }
// Flow:
//   1) auth check
//   2) fetch Drive metadata (size cap 100MB)
//   3) download file bytes via drive.files.get alt=media
//   4) PUT into R2 with key `${prefix||'uploads'}/${userId}/${ts}_${safe}`
//   5) respond with { url, key, name, size, mime }

import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { getR2Client, isR2Configured, getPublicUrl } from "@/lib/storage/r2";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

const ALLOWED_PREFIXES = new Set(["chat", "resources", "avatars", "uploads"]);

export const POST = withRouteLog("google.drive.import-to-r2", async (req: NextRequest) => {
  const span = log.span("drive.import_to_r2");
  const userId = await getCurrentUserId();
  if (!userId) {
    span.end({ status: 401 });
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  if (!isR2Configured()) {
    span.end({ status: 500, reason: "r2_not_configured" });
    return NextResponse.json(
      { error: "R2 스토리지가 구성되지 않았습니다" },
      { status: 500 },
    );
  }

  let body: { driveFileId?: string; prefix?: string; scopeId?: string };
  try {
    body = await req.json();
  } catch {
    span.end({ status: 400 });
    return NextResponse.json({ error: "잘못된 요청 바디" }, { status: 400 });
  }

  const { driveFileId } = body;
  const prefix = body.prefix && ALLOWED_PREFIXES.has(body.prefix) ? body.prefix : "uploads";
  const scopeId = body.scopeId;

  if (!driveFileId) {
    span.end({ status: 400 });
    return NextResponse.json({ error: "driveFileId가 필요합니다" }, { status: 400 });
  }

  try {
    const auth = await getGoogleClient(userId);
    const drive = google.drive({ version: "v3", auth });

    // 1) Metadata
    const metaRes = await drive.files.get({
      fileId: driveFileId,
      fields: "id, name, mimeType, size",
    });
    const meta = metaRes.data;
    const rawName = meta.name || "file";
    const mime = meta.mimeType || "application/octet-stream";
    const size = meta.size ? Number(meta.size) : 0;

    // Google 네이티브 문서 — export 로 다운로드 가능 형식 변환
    // (Docs → docx / Sheets → xlsx / Slides → pptx / Drawing → png)
    const NATIVE_EXPORT: Record<string, { mime: string; ext: string }> = {
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
      "application/vnd.google-apps.drawing": {
        mime: "image/png",
        ext: "png",
      },
    };

    const exportTarget = NATIVE_EXPORT[mime];
    let exportedBuffer: Buffer | null = null;
    let effectiveMime = mime;
    let effectiveName = rawName;

    if (mime.startsWith("application/vnd.google-apps.")) {
      if (!exportTarget) {
        span.end({ status: 400, reason: "google_native_unsupported" });
        return NextResponse.json(
          {
            error:
              "이 형식의 Google 네이티브 문서는 지원하지 않습니다 (Form/Site/Script 등). Docs/Sheets/Slides/Drawing 만 지원.",
            code: "GOOGLE_NATIVE_UNSUPPORTED",
            mime,
          },
          { status: 400 },
        );
      }
      // export 로 변환
      try {
        const exportRes = await drive.files.export(
          { fileId: driveFileId, mimeType: exportTarget.mime },
          { responseType: "arraybuffer" },
        );
        exportedBuffer = Buffer.from(exportRes.data as ArrayBuffer);
        effectiveMime = exportTarget.mime;
        // 확장자 부여 (원본 이름에 없으면)
        if (!rawName.toLowerCase().endsWith(`.${exportTarget.ext}`)) {
          effectiveName = `${rawName}.${exportTarget.ext}`;
        }
      } catch (err: any) {
        span.end({ status: 502, reason: "google_native_export_failed" });
        log.error(err, "drive.import_to_r2.export_failed", { drive_file_id: driveFileId, mime });
        return NextResponse.json(
          { error: "Google 문서 변환 실패: " + (err?.message || "unknown") },
          { status: 502 },
        );
      }
    }

    if (size && size > MAX_SIZE) {
      span.end({ status: 413, bytes: size });
      return NextResponse.json(
        { error: `파일이 너무 큽니다 (최대 ${MAX_SIZE / 1024 / 1024}MB)` },
        { status: 413 },
      );
    }

    // 2) Bytes — 네이티브 문서면 이미 export 한 buffer 사용, 아니면 download
    let buf: Buffer;
    if (exportedBuffer) {
      buf = exportedBuffer;
    } else {
      const mediaRes = await drive.files.get(
        { fileId: driveFileId, alt: "media" },
        { responseType: "arraybuffer" },
      );
      buf = Buffer.from(mediaRes.data as ArrayBuffer);
    }
    const bytes = buf.byteLength;

    if (bytes > MAX_SIZE) {
      span.end({ status: 413, bytes });
      return NextResponse.json(
        { error: `파일이 너무 큽니다 (최대 ${MAX_SIZE / 1024 / 1024}MB)` },
        { status: 413 },
      );
    }

    // 3) PUT to R2 — 변환된 파일명/MIME 사용
    const safeName = effectiveName.replace(/[^\w.\-]/g, "_").slice(0, 80);
    const scopeSeg = scopeId ? `${scopeId.replace(/[^\w.\-]/g, "_")}/` : "";
    const key = `${prefix}/${userId}/${scopeSeg}${Date.now()}_${safeName}`;

    await getR2Client().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        Body: buf,
        ContentType: effectiveMime,
      }),
    );

    const url = getPublicUrl(key);

    span.end({ bytes, prefix, status: 200, exported: !!exportedBuffer });
    return NextResponse.json({
      url,
      key,
      storage_key: key,
      name: effectiveName,
      size: bytes,
      mime: effectiveMime,
      exported: !!exportedBuffer,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "GOOGLE_NOT_CONNECTED") {
      span.end({ status: 401, reason: "not_connected" });
      return NextResponse.json(
        { error: "Google 계정이 연결되지 않았습니다", code: "GOOGLE_NOT_CONNECTED" },
        { status: 401 },
      );
    }
    if (msg === "GOOGLE_TOKEN_EXPIRED") {
      span.end({ status: 401, reason: "token_expired" });
      return NextResponse.json(
        { error: "Google 토큰이 만료되었습니다", code: "GOOGLE_TOKEN_EXPIRED" },
        { status: 401 },
      );
    }
    span.fail(err);
    log.error(err, "drive.import_to_r2.failed", { userId, driveFileId });
    return NextResponse.json(
      { error: "Drive → R2 가져오기 실패: " + msg },
      { status: 500 },
    );
  }
});

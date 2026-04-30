/**
 * POST /api/personal/hwp-preview
 *
 * HWP 인라인 미리보기 — Google Drive 변환 → PDF export → 클라에 PDF 스트림.
 *
 * 흐름:
 *  1. R2 의 .hwp / .hwpx 다운로드
 *  2. 사용자 Drive 에 업로드 (convert=true → Google Doc 자동 변환)
 *  3. Drive API export(mimeType=application/pdf) 로 PDF 바이너리 획득
 *  4. (옵션) 임시 Doc 삭제 — 사용자 Drive 깨끗하게 유지
 *  5. PDF 스트림 응답 → 클라가 blob URL 만들어 iframe 으로 미리보기
 *
 * Body: { file_url, file_name }
 * Response: PDF binary stream (Content-Type: application/pdf)
 *
 * 에러:
 *  401 — 미로그인
 *  403 — Google 계정 미연결
 *  413 — 파일 너무 큼 (50MB+)
 */
import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { google } from "googleapis";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { log } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HWP_MAX_BYTES = 50 * 1024 * 1024; // 50MB

const HWP_SOURCE_MIME: Record<string, string> = {
  hwp: "application/x-hwp",
  hwpx: "application/vnd.hancom.hwpx",
};

/** 5분 in-memory 캐시 (변환 비용 절감 + iframe 재로드 시 빠른 응답) */
type CacheEntry = { pdf: Buffer; name: string; expires: number };
const PDF_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60_000;

function cleanCache() {
  const now = Date.now();
  for (const [k, v] of PDF_CACHE.entries()) {
    if (v.expires < now) PDF_CACHE.delete(k);
  }
}

/** GET — iframe 에서 직접 호출 가능. file_url + file_name query.
 *  same-origin URL 이라 브라우저 PDF 뷰어 인라인 렌더 보장. */
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return new NextResponse("로그인이 필요합니다", { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const fileUrl = params.get("file_url");
  const fileName = params.get("file_name") || "preview.hwp";
  if (!fileUrl) {
    return new NextResponse("file_url required", { status: 400 });
  }

  // 캐시 키 = userId + fileUrl
  cleanCache();
  const cacheKey = `${userId}::${fileUrl}`;
  const cached = PDF_CACHE.get(cacheKey);
  if (cached) {
    const safeName = encodeURIComponent(cached.name.replace(/\.(hwp|hwpx)$/i, ".pdf"));
    return new NextResponse(cached.pdf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
        "Cache-Control": "private, max-age=300",
        "X-Hwp-Cache": "HIT",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const { pdf, error, status, code } = await convertHwpToPdf({ userId, fileUrl, fileName });
  if (error) {
    return new NextResponse(error, { status: status || 500 });
  }
  if (pdf) {
    PDF_CACHE.set(cacheKey, { pdf, name: fileName, expires: Date.now() + CACHE_TTL_MS });
    const safeName = encodeURIComponent(fileName.replace(/\.(hwp|hwpx)$/i, ".pdf"));
    return new NextResponse(pdf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
        "Cache-Control": "private, max-age=300",
        "X-Hwp-Cache": "MISS",
        "X-Content-Type-Options": "nosniff",
        ...(code ? { "X-Hwp-Code": code } : {}),
      },
    });
  }
  return new NextResponse("변환 실패", { status: 500 });
}

/** 공통 변환 헬퍼 — GET + POST 양쪽에서 호출. */
async function convertHwpToPdf(args: { userId: string; fileUrl: string; fileName: string }): Promise<{
  pdf?: Buffer;
  error?: string;
  status?: number;
  code?: string;
}> {
  const { userId, fileUrl, fileName } = args;
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (!["hwp", "hwpx"].includes(ext)) {
    return { error: "HWP / HWPX 파일만 지원합니다", status: 400 };
  }

  let driveFileId: string | null = null;
  try {
    const resp = await fetch(fileUrl);
    if (!resp.ok) return { error: `원본 파일을 불러올 수 없습니다 (${resp.status})`, status: 400 };
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length > HWP_MAX_BYTES) {
      return {
        error: `파일이 너무 큽니다 (${Math.round(buffer.length / 1024 / 1024)}MB) — 최대 50MB`,
        status: 413,
      };
    }

    const auth = await getGoogleClient(userId);
    if (!auth) return { error: "Google 계정 연결이 필요합니다", status: 403, code: "NOT_CONNECTED" };
    const drive = google.drive({ version: "v3", auth });

    const sourceMime = HWP_SOURCE_MIME[ext];
    const uploadRes = await drive.files.create({
      requestBody: {
        name: `[nutunion 임시] ${fileName}`,
        mimeType: "application/vnd.google-apps.document",
      },
      media: { mimeType: sourceMime, body: Readable.from(buffer) },
      fields: "id",
    });

    driveFileId = uploadRes.data.id || null;
    if (!driveFileId) return { error: "Drive 변환 실패", status: 500 };

    const exportRes = await drive.files.export(
      { fileId: driveFileId, mimeType: "application/pdf" },
      { responseType: "arraybuffer" },
    );
    const pdfBuffer = Buffer.from(exportRes.data as ArrayBuffer);

    // 임시 Doc 삭제 (best-effort)
    drive.files.delete({ fileId: driveFileId }).catch(() => {
      log.warn("hwp_preview.cleanup_failed", { drive_file_id: driveFileId });
    });

    return { pdf: pdfBuffer };
  } catch (err: any) {
    if (driveFileId) {
      try {
        const auth = await getGoogleClient(userId);
        if (auth) {
          const drive = google.drive({ version: "v3", auth });
          await drive.files.delete({ fileId: driveFileId });
        }
      } catch {}
    }
    log.error(err, "hwp_preview.failed", { file_name: fileName });
    const errCode = err?.response?.data?.error?.code || err?.code;
    if (errCode === 401 || errCode === "TOKEN_EXPIRED") {
      return { error: "Google 토큰이 만료됐어요. 다시 연결해주세요.", status: 403, code: "TOKEN_EXPIRED" };
    }
    return { error: err?.message || "변환 중 오류", status: 500 };
  }
}

/** POST — 클라이언트에서 명시적 호출 시 (raw PDF binary 응답) */
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const fileUrl: string | undefined = body?.file_url;
  const fileName: string = body?.file_name || "preview.hwp";
  if (!fileUrl) return NextResponse.json({ error: "file_url required" }, { status: 400 });

  const { pdf, error, status, code } = await convertHwpToPdf({ userId, fileUrl, fileName });
  if (error) {
    return NextResponse.json({ error, code }, { status: status || 500 });
  }
  if (!pdf) return NextResponse.json({ error: "변환 실패" }, { status: 500 });

  // 캐시에 저장 — 곧이어 GET iframe 재요청 시 재사용
  const cacheKey = `${userId}::${fileUrl}`;
  PDF_CACHE.set(cacheKey, { pdf, name: fileName, expires: Date.now() + CACHE_TTL_MS });

  const safeName = encodeURIComponent(fileName.replace(/\.(hwp|hwpx)$/i, ".pdf"));
  return new NextResponse(pdf as any, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": pdf.length.toString(),
      "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

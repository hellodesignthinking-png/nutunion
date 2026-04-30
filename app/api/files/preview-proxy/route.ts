/**
 * GET /api/files/preview-proxy?url=<file_url>
 *
 * 자료실에 업로드된 파일을 인라인으로 브라우저에 렌더링하기 위한 프록시.
 *
 * 왜 필요한가:
 *  - R2 r2.dev 퍼블릭 도메인이 일부 MIME 에 Content-Disposition: attachment 를 붙여
 *    iframe 안에서 다운로드가 트리거되는 케이스가 있다.
 *  - Supabase fallback 업로드는 media 버킷 제약 때문에 PDF/문서를 video/mp4 로 위장해
 *    저장한다(lib/storage/upload-client.ts). 결과적으로 iframe 이 PDF 를 비디오로
 *    오인해 인라인 렌더가 안 된다.
 *
 * 동작:
 *  1) 로그인 확인
 *  2) 허용된 스토리지 도메인(R2 / Supabase / 커스텀 CDN) 만 통과
 *  3) 원본을 fetch 해서 그대로 스트림
 *  4) Content-Type 은 파일 확장자 기준으로 보정 (위장된 video/mp4 → application/pdf 등)
 *  5) Content-Disposition: inline 강제
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_HOST_PATTERNS: RegExp[] = [
  /\.r2\.dev$/i,
  /\.r2\.cloudflarestorage\.com$/i,
  /\.supabase\.co$/i,
  /^cdn\.nutunion\.co\.kr$/i,
];

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  flac: "audio/flac",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  hwp: "application/x-hwp",
  hwpx: "application/vnd.hancom.hwpx",
  zip: "application/zip",
};

function isAllowed(url: URL): boolean {
  return ALLOWED_HOST_PATTERNS.some((rx) => rx.test(url.hostname));
}

export async function GET(req: NextRequest) {
  // 인증 — 로그인 사용자만 (자료실 자체가 권한 게이트가 있는 영역)
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse("url required", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse("invalid url", { status: 400 });
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return new NextResponse("invalid protocol", { status: 400 });
  }
  if (!isAllowed(target)) {
    return new NextResponse("forbidden host", { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), { redirect: "follow" });
  } catch (e) {
    return new NextResponse("upstream fetch failed", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return new NextResponse(`upstream ${upstream.status}`, { status: upstream.status || 502 });
  }

  // 파일명 추출 — pathname 의 마지막 세그먼트
  const pathName = target.pathname.split("/").pop() || "file";
  const decodedName = (() => {
    try {
      return decodeURIComponent(pathName);
    } catch {
      return pathName;
    }
  })();
  const ext = decodedName.split(".").pop()?.toLowerCase() || "";

  // 확장자 기반 Content-Type 보정 (Supabase 위장 MIME 복구 + R2 누락 보정)
  const upstreamCT = upstream.headers.get("content-type") || "";
  const correctedCT =
    EXT_TO_MIME[ext] ||
    (upstreamCT && !/^application\/octet-stream/i.test(upstreamCT) ? upstreamCT : "application/octet-stream");

  const headers = new Headers();
  headers.set("Content-Type", correctedCT);
  headers.set(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(decodedName)}`,
  );
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "private, max-age=300");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);

  return new NextResponse(upstream.body, { status: 200, headers });
}

// Supabase Storage 헬퍼 (영수증/서명)
//
// 설계:
//   · 클라이언트가 base64 data URL 을 JSON body 로 보냄 (기존 방식 유지)
//   · 서버가 decode → Storage 업로드 → signed URL 반환
//   · DB 에는 `storage:<bucket>/<path>` 형식의 참조 URL 저장 (base64 대체)
//   · 조회 시 signed URL 생성 (기본 1시간)
//
// 하위 호환:
//   · DB 에 기존 base64 data URL 이 있으면 그대로 렌더링 (마이그레이션 불필요)
//   · 새 업로드만 Storage 로 감

import type { SupabaseClient } from "@supabase/supabase-js";

export const RECEIPT_BUCKET = "finance-receipts";
export const SIGNATURE_BUCKET = "finance-signatures";

const STORAGE_REF_PREFIX = "storage:";

export interface UploadResult {
  /** DB 에 저장할 참조 문자열 (예: "storage:finance-receipts/tx-123/abc.png") */
  ref: string;
  /** Storage 버킷 내 경로 */
  path: string;
}

/** data URL 이 Storage 참조인지 판정 */
export function isStorageRef(url: string | null | undefined): boolean {
  return !!url && url.startsWith(STORAGE_REF_PREFIX);
}

/** Storage 참조에서 { bucket, path } 추출 */
export function parseStorageRef(ref: string): { bucket: string; path: string } | null {
  if (!isStorageRef(ref)) return null;
  const rest = ref.slice(STORAGE_REF_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash < 0) return null;
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

function buildRef(bucket: string, path: string): string {
  return `${STORAGE_REF_PREFIX}${bucket}/${path}`;
}

/** data URL → { mime, buffer } 디코딩 */
function decodeDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) throw new Error("잘못된 data URL 형식");
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  return { mime, buffer };
}

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "application/pdf") return "pdf";
  return "bin";
}

/**
 * base64 data URL 을 Storage 에 업로드하고 DB 참조 문자열 리턴.
 * 실패 시 throw.
 */
export async function uploadDataUrl(
  supabase: SupabaseClient,
  opts: {
    bucket: string;
    /** 파일 디렉토리 prefix — 예: `tx-${id}`, `employee-${id}` */
    prefix: string;
    dataUrl: string;
  }
): Promise<UploadResult> {
  const { mime, buffer } = decodeDataUrl(opts.dataUrl);
  const ext = extForMime(mime);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const path = `${opts.prefix}/${filename}`;

  const { error } = await supabase.storage
    .from(opts.bucket)
    .upload(path, buffer, {
      contentType: mime,
      upsert: false,
    });

  if (error) throw new Error(`Storage 업로드 실패: ${error.message}`);

  return { ref: buildRef(opts.bucket, path), path };
}

/**
 * Storage 참조 또는 base64 URL → 브라우저가 로드할 수 있는 URL.
 * - Storage ref: signed URL 생성 (기본 1시간)
 * - base64 data URL: 그대로 반환 (하위 호환)
 * - http(s) URL: 그대로 반환
 */
export async function resolveFileUrl(
  supabase: SupabaseClient,
  ref: string | null | undefined,
  options: { expiresIn?: number } = {}
): Promise<string | null> {
  if (!ref) return null;
  if (!isStorageRef(ref)) return ref;  // base64 / http 는 passthrough

  const parsed = parseStorageRef(ref);
  if (!parsed) return null;

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, options.expiresIn ?? 3600);

  if (error || !data) {
    console.error("[storage] signed URL 생성 실패:", error?.message);
    return null;
  }
  return data.signedUrl;
}

/** Storage 에서 삭제. 참조가 base64 면 no-op. */
export async function deleteStorageRef(
  supabase: SupabaseClient,
  ref: string | null | undefined
): Promise<{ ok: boolean; error?: string }> {
  if (!ref || !isStorageRef(ref)) return { ok: true };
  const parsed = parseStorageRef(ref);
  if (!parsed) return { ok: false, error: "invalid ref" };
  const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

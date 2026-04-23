/**
 * Cloudflare R2 storage client — S3 호환 API.
 *
 * 목적:
 *  - Presigned PUT URL 발급 (브라우저에서 R2로 직접 업로드 → Vercel 4.5MB 우회)
 *  - Public URL 생성 (Public 버킷 또는 CDN 커스텀 도메인)
 *  - 오브젝트 삭제 / 존재 확인
 *
 * 환경 변수 (Vercel Dashboard 또는 .env.local) — 5개 모두 필요:
 *
 *   | 키                     | 필수 | 어디서 가져오나                                                       |
 *   | R2_ACCOUNT_ID          |  ●   | Cloudflare dashboard → R2 → 상단의 'Account ID' 복사                  |
 *   | R2_ACCESS_KEY_ID       |  ●   | Cloudflare R2 → Manage R2 API Tokens → Create API Token              |
 *   | R2_SECRET_ACCESS_KEY   |  ●   | 위 토큰 생성 시 함께 발급되는 secret                                  |
 *   | R2_BUCKET              |  ●   | 생성한 버킷 이름 (예: nutunion-media)                                 |
 *   | R2_PUBLIC_URL          |  △   | R2 bucket Settings → Public access → 커스텀 도메인 또는 r2.dev URL    |
 *                                    (누락 시 https://pub-${R2_ACCOUNT_ID}.r2.dev/... 폴백 시도)
 *
 * 진단: GET /api/admin/storage/r2-health (admin/staff 전용) 또는 /admin/storage 페이지.
 * R2 가 설정 안 된 환경에서는 `isR2Configured()` false — Supabase Storage 로 fallback.
 */

import { S3Client, DeleteObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  );
}

let _client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (_client) return _client;
  if (!isR2Configured()) {
    throw new Error("R2 not configured — set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET");
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return _client;
}

/** 브라우저가 직접 PUT 업로드할 수 있는 Presigned URL 발급 */
export async function generatePresignedPutUrl(opts: {
  key: string;
  contentType: string;
  expiresIn?: number;  // 초 (default 600 = 10분)
}): Promise<string> {
  const { key, contentType, expiresIn = 600 } = opts;
  const cmd = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getR2Client(), cmd, { expiresIn });
}

/** 업로드 후 조회용 public URL 생성 */
export function getPublicUrl(key: string): string {
  const base = process.env.R2_PUBLIC_URL;
  if (base) return `${base.replace(/\/+$/, "")}/${key}`;
  // R2 공식 퍼블릭 URL — 관리자가 bucket > Public Access 를 켜두어야 동작
  return `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${key}`;
}

/** 오브젝트 삭제 */
export async function deleteObject(key: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }),
  );
}

/** 오브젝트 존재 확인 */
export async function objectExists(key: string): Promise<boolean> {
  try {
    await getR2Client().send(
      new HeadObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }),
    );
    return true;
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

/** 경로 prefix 생성 규칙 — 도메인별 네임스페이스 */
export function r2Key(prefix: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-]/g, "_").slice(0, 80);
  return `${prefix.replace(/^\/+|\/+$/g, "")}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
}

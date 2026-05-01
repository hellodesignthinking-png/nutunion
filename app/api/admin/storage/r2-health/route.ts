/**
 * GET /api/admin/storage/r2-health
 *
 * Cloudflare R2 설정 상태 진단 엔드포인트.
 * 관리자(role=admin|staff)만 호출 가능.
 *
 * Returns:
 *  {
 *    configured: boolean,
 *    missing_env: string[],
 *    bucket_reachable: boolean | null,
 *    bucket_error?: string,
 *    presign_ok: boolean | null,
 *    presign_error?: string,
 *    public_url_example: string | null,
 *    advice: string[]
 *  }
 */

import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getPublicUrl, generatePresignedPutUrl, isR2Configured } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

const REQUIRED_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin" && profile?.role !== "staff") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const missing_env = REQUIRED_VARS.filter((v) => !process.env[v]);
  const configured = isR2Configured();

  let bucket_reachable: boolean | null = null;
  let bucket_error: string | undefined;
  let presign_ok: boolean | null = null;
  let presign_error: string | undefined;
  let public_url_example: string | null = null;

  if (configured) {
    // 버킷 접근 확인 — R2 "Object Read & Write" 범위 토큰은 HeadBucket/ListObjectsV2 를
    // UnknownError 로 거부하는 경우가 많음. 실제 업로드 권한이 있는지만 확인하면 되므로
    // 작은 테스트 오브젝트를 PUT → DELETE 하는 real write-test 로 판단.
    const client = getR2Client();
    const testKey = `_diagnostic/healthcheck_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.txt`;
    try {
      await client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: testKey,
        Body: "nutunion-healthcheck",
        ContentType: "text/plain",
      }));
      bucket_reachable = true;
      // cleanup — 실패해도 무시 (이미 성공 판정)
      try {
        await client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: testKey }));
      } catch {}
    } catch (putErr: any) {
    log.error(putErr, "admin.storage.r2-health.failed");
      // PUT 도 실패하면 ListObjectsV2 / HeadBucket 으로 fallback
      try {
        await client.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET!, MaxKeys: 1 }));
        bucket_reachable = true;
      } catch (listErr: any) {
    log.error(listErr, "admin.storage.r2-health.failed");
        try {
          await client.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET! }));
          bucket_reachable = true;
        } catch (headErr: any) {
    log.error(headErr, "admin.storage.r2-health.failed");
          bucket_reachable = false;
          bucket_error = `put: ${putErr?.name || ""}: ${putErr?.message || putErr}`.slice(0, 240);
        }
      }
    }

    // presign 시도
    try {
      const url = await generatePresignedPutUrl({
        key: `diagnostic/${Date.now()}_healthcheck.txt`,
        contentType: "text/plain",
        expiresIn: 60,
      });
      presign_ok = !!url && url.startsWith("http");
    } catch (err: any) {
    log.error(err, "admin.storage.r2-health.failed");
      presign_ok = false;
      presign_error = err?.message || String(err);
    }

    try {
      public_url_example = getPublicUrl("test/example.png");
    } catch {
      public_url_example = null;
    }
  }

  const advice: string[] = [];
  if (missing_env.includes("R2_ACCOUNT_ID"))
    advice.push("R2_ACCOUNT_ID 누락: Cloudflare dashboard → R2 → 상단의 'Account ID' 복사 → Vercel env 에 추가");
  if (missing_env.includes("R2_ACCESS_KEY_ID") || missing_env.includes("R2_SECRET_ACCESS_KEY"))
    advice.push("Access key 누락: Cloudflare R2 → Manage R2 API Tokens → Create API Token (Object Read & Write) 발급 후 Vercel env 설정");
  if (missing_env.includes("R2_BUCKET"))
    advice.push("R2_BUCKET 누락: 생성한 R2 버킷 이름 (예: nutunion-media) 을 Vercel env 에 추가");
  if (missing_env.includes("R2_PUBLIC_URL"))
    advice.push("R2_PUBLIC_URL 누락: R2 bucket Settings → Public access 설정 → 커스텀 도메인(예: https://cdn.nutunion.co.kr) 또는 r2.dev 퍼블릭 URL 을 Vercel env 에 추가");
  if (configured && bucket_reachable === false)
    advice.push(`버킷 접근 실패: R2 API Token 권한(Object Read & Write) 및 버킷 이름 철자 확인 (${bucket_error ?? ""})`);
  if (configured && presign_ok === false)
    advice.push(`Presign 실패: AWS SDK 에러 원인 확인 (${presign_error ?? ""})`);
  if (configured && bucket_reachable && presign_ok)
    advice.push("R2 설정 정상. 업로드 시 CORS 가 막혀 있다면 버킷 CORS 설정도 확인하세요.");

  return NextResponse.json({
    configured,
    missing_env,
    bucket_reachable,
    bucket_error,
    presign_ok,
    presign_error,
    public_url_example,
    advice,
  });
}

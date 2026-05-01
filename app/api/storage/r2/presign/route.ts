/**
 * POST /api/storage/r2/presign
 *
 * Body: {
 *   prefix: string,
 *   fileName: string,
 *   contentType: string,
 *   size?: number,
 *   overwrite_key?: string   // 기존 R2 key 를 재업로드 (in-place edit)
 * }
 * Returns: { url: string, key: string, publicUrl: string, configured: boolean }
 *
 * 클라이언트가 이 URL 에 PUT 요청하면 R2 에 직접 업로드됩니다 (Vercel 4.5MB 바디 제한 우회).
 * R2 env 가 설정 안 됐으면 { configured: false } 반환 → 클라이언트는 Supabase Storage 로 fallback.
 *
 * 보안:
 *  - 로그인 필수
 *  - prefix 는 허용 목록만 (chat / avatars / resources / taps / uploads)
 *  - 크기 제한 (200MB)
 *  - overwrite_key 사용 시:
 *    - resources/ 로 시작하는 key 만 허용
 *    - file_attachments / project_resources 에서 storage_key 로 소유자(uploaded_by) 조회
 *    - 요청자가 소유자가 아니면 403
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { generatePresignedPutUrl, getPublicUrl, isR2Configured, r2Key } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

const ALLOWED_PREFIXES = new Set(["chat", "avatars", "resources", "taps", "uploads"]);
const MAX_SIZE_BYTES = 200 * 1024 * 1024;

export const POST = withRouteLog("storage.r2.presign", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!isR2Configured()) {
    const REQUIRED = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];
    const missing_env = REQUIRED.filter((v) => !process.env[v]);
    return NextResponse.json({ configured: false, missing_env });
  }

  const body = await req.json().catch(() => null);
  if (!body?.fileName || !body?.contentType) {
    return NextResponse.json({ error: "fileName + contentType required" }, { status: 400 });
  }

  const prefix = typeof body.prefix === "string" ? body.prefix : "uploads";
  if (!ALLOWED_PREFIXES.has(prefix)) {
    return NextResponse.json({ error: `prefix must be one of ${[...ALLOWED_PREFIXES].join(", ")}` }, { status: 400 });
  }

  if (typeof body.size === "number" && body.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: `파일 크기 ${Math.round(MAX_SIZE_BYTES / 1024 / 1024)}MB 초과` }, { status: 413 });
  }

  // ── Overwrite mode: use existing key after ownership check ──
  let key: string;
  const overwriteKey: string | undefined =
    typeof body.overwrite_key === "string" && body.overwrite_key.length > 0 ? body.overwrite_key : undefined;

  if (overwriteKey) {
    // 1) resources/ prefix scope
    if (!overwriteKey.startsWith("resources/")) {
      return NextResponse.json(
        { error: "overwrite_key must start with 'resources/'" },
        { status: 400 },
      );
    }

    // 2) Lookup ownership across file_attachments / project_resources
    let ownerId: string | null = null;
    const { data: fa } = await supabase
      .from("file_attachments")
      .select("uploaded_by")
      .eq("storage_key", overwriteKey)
      .maybeSingle();
    if (fa?.uploaded_by) ownerId = fa.uploaded_by;

    if (!ownerId) {
      const { data: pr } = await supabase
        .from("project_resources")
        .select("uploaded_by")
        .eq("storage_key", overwriteKey)
        .maybeSingle();
      if (pr?.uploaded_by) ownerId = pr.uploaded_by;
    }

    if (!ownerId) {
      return NextResponse.json(
        { error: "overwrite target not found — storage_key has no matching row" },
        { status: 404 },
      );
    }
    if (ownerId !== auth.user.id) {
      // TODO: expand to include group hosts / project leads if desired.
      return NextResponse.json(
        { error: "forbidden — only the original uploader can overwrite this file" },
        { status: 403 },
      );
    }

    key = overwriteKey;
  } else {
    // Normal: user-scoped new key
    key = r2Key(`${prefix}/${auth.user.id}`, body.fileName);
  }

  try {
    const url = await generatePresignedPutUrl({
      key,
      contentType: body.contentType,
    });
    const publicUrl = getPublicUrl(key);
    return NextResponse.json({ configured: true, url, key, publicUrl });
  } catch (err: unknown) {
    log.error(err, "storage.r2.presign.failed");
    const e = err as { message?: string; name?: string };
    console.error("[r2 presign]", err);
    return NextResponse.json(
      { configured: true, error: e?.message || "presign failed", name: e?.name || null },
      { status: 500 },
    );
  }
});

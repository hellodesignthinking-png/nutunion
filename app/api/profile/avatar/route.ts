/**
 * POST /api/profile/avatar
 *
 * 입력: multipart/form-data { file }
 * 동작:
 *  1) 인증 체크
 *  2) service_role 로 Supabase Storage('media') 업로드 — RLS 우회
 *  3) profiles.avatar_url 갱신
 *  4) publicUrl 반환
 *
 * 아바타는 작은 이미지(<1MB) 라서 Vercel 4.5MB 제한에 안 걸림.
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "multipart/form-data required" }, { status: 400 });
  }

  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file missing" }, { status: 400 });

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `파일 크기 ${Math.round(MAX_SIZE / 1024 / 1024)}MB 초과` },
      { status: 413 },
    );
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "JPG / PNG / WEBP / GIF 만 허용" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE env 미설정 — 관리자에게 문의" },
      { status: 501 },
    );
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `avatars/${auth.user.id}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage
    .from("media")
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (upErr) {
    console.error("[avatar upload]", upErr);
    return NextResponse.json({ error: "업로드 실패: " + upErr.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("media").getPublicUrl(path);

  // profiles.avatar_url 갱신
  const { error: updateErr } = await admin
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", auth.user.id);
  if (updateErr) {
    console.warn("[avatar upload] profile update failed", updateErr);
  }

  return NextResponse.json({ url: publicUrl, storage: "supabase" });
}

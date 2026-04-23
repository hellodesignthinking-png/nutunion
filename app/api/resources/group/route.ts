/**
 * POST /api/resources/group — 너트 자료실에 파일 등록 (service_role 로 RLS 우회).
 *
 * Body (JSON):
 *  { group_id, file_name, file_url, file_size, file_type, storage_type?, storage_key? }
 * 또는 multipart (file + group_id) — 이 경로로도 받아서 Storage 업로드 + 자료실 등록 한 번에.
 *
 * 권한: 해당 그룹의 멤버 또는 host.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { dispatchEvent } from "@/lib/automation/engine";
// [Drive migration Phase 3a] content now stored on R2 — drive-mirror import removed
// import { mirrorToDrive, getGroupResourcesFolder } from "@/lib/google/drive-mirror";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE env 미설정" }, { status: 501 });

  const contentType = req.headers.get("content-type") || "";

  let groupId: string | null = null;
  let fileName = "";
  let fileUrl = "";
  let fileSize = 0;
  let fileType = "application/octet-stream";
  let storageType: string = "supabase";
  let storageKey: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    // 멀티파트 — 파일 직접 받아서 Storage 에 업로드까지
    const form = await req.formData();
    groupId = (form.get("group_id") as string) || null;
    const file = form.get("file") as File | null;
    if (!groupId || !file) {
      return NextResponse.json({ error: "group_id + file required" }, { status: 400 });
    }
    fileName = file.name;
    fileSize = file.size;
    fileType = file.type || "application/octet-stream";

    // Storage 업로드 (service_role → RLS 우회)
    const safeName = fileName.replace(/[^\w.\-]/g, "_").slice(0, 80);
    const path = `crews/${groupId}/${Date.now()}-${safeName}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from("media")
      .upload(path, buf, { contentType: fileType, upsert: false });
    if (upErr) {
      return NextResponse.json({ error: "Storage 업로드 실패: " + upErr.message }, { status: 500 });
    }
    const { data: pub } = admin.storage.from("media").getPublicUrl(path);
    fileUrl = pub.publicUrl;
    storageType = "supabase";
    storageKey = path;
  } else {
    // JSON — 이미 업로드된 파일 메타만 등록
    const body = await req.json().catch(() => null);
    if (!body?.group_id || !body?.file_url) {
      return NextResponse.json({ error: "group_id + file_url required" }, { status: 400 });
    }
    groupId = body.group_id;
    fileName = body.file_name || "file";
    fileUrl = body.file_url;
    fileSize = Number(body.file_size) || 0;
    fileType = body.file_type || "application/octet-stream";
    storageType = body.storage_type || "supabase";
    storageKey = body.storage_key || null;
  }

  // 권한 체크 — 멤버 또는 host
  const [{ data: grp }, { data: membership }] = await Promise.all([
    admin.from("groups").select("host_id").eq("id", groupId).maybeSingle(),
    admin
      .from("group_members")
      .select("status, role")
      .eq("group_id", groupId)
      .eq("user_id", auth.user.id)
      .maybeSingle(),
  ]);
  const isHost = (grp as any)?.host_id === auth.user.id;
  const isActive = (membership as any)?.status === "active";
  if (!isHost && !isActive) {
    return NextResponse.json(
      { error: "그룹 멤버만 자료를 등록할 수 있습니다" },
      { status: 403 },
    );
  }

  // file_attachments 삽입
  const payload: any = {
    target_type: "group",
    target_id: groupId,
    uploaded_by: auth.user.id,
    file_name: fileName,
    file_url: fileUrl,
    file_size: fileSize,
    file_type: fileType,
    storage_type: storageType,
    storage_key: storageKey,
  };
  let { data, error } = await admin
    .from("file_attachments")
    .insert(payload)
    .select("id")
    .maybeSingle();
  if (error && /storage_type|storage_key/.test(error.message)) {
    delete payload.storage_type;
    delete payload.storage_key;
    ({ data, error } = await admin.from("file_attachments").insert(payload).select("id").maybeSingle());
  }
  if (error) {
    console.error("[resources group]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // [Drive migration Phase 3a] content now stored on R2 — Drive 자동 미러링 제거.
  // R2 가 canonical. 과거 Drive 데이터는 별도 admin 마이그레이션 도구로 이관 예정.

  // Nut-mation: resource.uploaded
  try {
    await dispatchEvent("resource.uploaded", {
      group_id: groupId,
      file_name: fileName,
      file_url: fileUrl,
      file_size: fileSize,
      file_type: fileType,
      uploader_id: auth.user.id,
    });
  } catch (e: any) {
    console.warn("[resources.group] automation dispatch failed", e?.message);
  }

  return NextResponse.json({ id: (data as any)?.id, url: fileUrl, storage_type: storageType });
}

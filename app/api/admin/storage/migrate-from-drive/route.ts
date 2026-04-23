/**
 * Admin — Drive → R2 migration.
 *
 * GET:  Drive 에 남아있는 이관 후보(파일/리소스/채팅 첨부) 목록을 조회.
 * POST: 선택된 행을 하나씩 다운로드 → R2 업로드 → DB 갱신.
 *
 * 본 라우트는 Phase 5 의 레거시 정리 전용입니다. 신규 업로드는 이미 R2 를 사용하므로
 * 이 경로는 점진적으로 "Drive 0" 상태로 수렴시키기 위한 일회성 마이그레이션 용입니다.
 */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { getGoogleClient } from "@/lib/google/auth";
import { getR2Client, getPublicUrl, isR2Configured } from "@/lib/storage/r2";
import { log } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE_LIMIT = 50;
const BATCH_LIMIT = 10;

type Table = "file_attachments" | "project_resources" | "chat_messages";

interface Candidate {
  table: Table;
  id: string;
  url: string;
  name: string;
  created_at?: string | null;
  storage_type?: string | null;
  drive_file_id?: string | null;
  context?: string | null;
}

function isDriveUrl(u: string | null | undefined): boolean {
  if (!u) return false;
  return /(?:drive|docs)\.google\.com/.test(u);
}

function extractDriveFileId(url: string): string | null {
  const m1 = url.match(/\/file\/d\/([^/?#]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([^&#]+)/);
  if (m2) return m2[1];
  const m3 = url.match(/\/document\/d\/([^/?#]+)/);
  if (m3) return m3[1];
  const m4 = url.match(/\/spreadsheets\/d\/([^/?#]+)/);
  if (m4) return m4[1];
  const m5 = url.match(/\/presentation\/d\/([^/?#]+)/);
  if (m5) return m5[1];
  return null;
}

function safeName(s: string): string {
  return (s || "file").replace(/[^\w.\-]/g, "_").slice(0, 80);
}

async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "UNAUTHORIZED" };
  const { data: me } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "admin") return { ok: false as const, status: 403, error: "FORBIDDEN" };
  return { ok: true as const, user, supabase: sb };
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSbClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getServiceClient();
  const out: Candidate[] = [];

  // 1) file_attachments
  try {
    const { data } = await db
      .from("file_attachments")
      .select("id, file_url, file_name, file_type, storage_type, created_at")
      .or("file_type.eq.drive-link,storage_type.eq.google_drive,file_url.ilike.%drive.google.com%,file_url.ilike.%docs.google.com%")
      .neq("storage_type", "r2")
      .order("created_at", { ascending: false })
      .limit(PAGE_LIMIT);
    for (const r of data ?? []) {
      if (!isDriveUrl(r.file_url) && r.storage_type !== "google_drive" && r.file_type !== "drive-link") continue;
      out.push({
        table: "file_attachments",
        id: r.id,
        url: r.file_url,
        name: r.file_name || "file",
        created_at: r.created_at,
        storage_type: r.storage_type,
        drive_file_id: extractDriveFileId(r.file_url || ""),
      });
    }
  } catch (err) {
    log.warn("migrate-from-drive.file_attachments.query_failed", { error: String(err) });
  }

  // 2) project_resources
  try {
    const { data } = await db
      .from("project_resources")
      .select("id, url, name, kind, storage_type, created_at")
      .or("kind.eq.drive-link,storage_type.eq.google_drive,url.ilike.%drive.google.com%,url.ilike.%docs.google.com%")
      .neq("storage_type", "r2")
      .order("created_at", { ascending: false })
      .limit(PAGE_LIMIT);
    for (const r of data ?? []) {
      if (!isDriveUrl(r.url) && r.storage_type !== "google_drive" && r.kind !== "drive-link") continue;
      out.push({
        table: "project_resources",
        id: r.id,
        url: r.url,
        name: r.name || "file",
        created_at: r.created_at,
        storage_type: r.storage_type,
        drive_file_id: extractDriveFileId(r.url || ""),
      });
    }
  } catch (err) {
    log.warn("migrate-from-drive.project_resources.query_failed", { error: String(err) });
  }

  // 3) chat_messages (drive URL 포함 메시지)
  try {
    const { data } = await db
      .from("chat_messages")
      .select("id, content, attachment_url, attachment_name, storage_type, created_at")
      .or("attachment_url.ilike.%drive.google.com%,attachment_url.ilike.%docs.google.com%")
      .neq("storage_type", "r2")
      .order("created_at", { ascending: false })
      .limit(PAGE_LIMIT);
    for (const r of data ?? []) {
      const url = r.attachment_url;
      if (!isDriveUrl(url)) continue;
      out.push({
        table: "chat_messages",
        id: r.id,
        url,
        name: r.attachment_name || "chat-file",
        created_at: r.created_at,
        storage_type: r.storage_type,
        drive_file_id: extractDriveFileId(url || ""),
      });
    }
  } catch (err) {
    // attachment_url 컬럼이 없을 수도 있으므로 경고만
    log.warn("migrate-from-drive.chat_messages.query_failed", { error: String(err) });
  }

  // 전체 summary
  let totalFA = 0, totalR2 = 0, totalDrive = 0;
  try {
    const [{ count: c1 }, { count: c2 }, { count: c3 }] = await Promise.all([
      db.from("file_attachments").select("id", { count: "exact", head: true }),
      db.from("file_attachments").select("id", { count: "exact", head: true }).eq("storage_type", "r2"),
      db.from("file_attachments").select("id", { count: "exact", head: true }).eq("storage_type", "google_drive"),
    ]);
    totalFA = c1 ?? 0; totalR2 = c2 ?? 0; totalDrive = c3 ?? 0;
  } catch {}

  return NextResponse.json({
    ok: true,
    candidates: out,
    summary: { total: totalFA, r2: totalR2, drive: totalDrive, pending: out.length },
  });
}

interface MigrateInput { table: Table; id: string }

async function migrateOne(
  db: ReturnType<typeof getServiceClient>,
  userId: string,
  input: MigrateInput,
): Promise<{ row_id: string; table: Table; status: "ok" | "failed"; r2_url?: string; error?: string }> {
  const { table, id } = input;
  try {
    // 1) fetch row
    let url = "";
    let name = "file";
    let driveId: string | null = null;
    if (table === "file_attachments") {
      const { data } = await db.from("file_attachments").select("file_url, file_name, storage_type").eq("id", id).single();
      if (!data) throw new Error("row_not_found");
      if (data.storage_type === "r2") return { row_id: id, table, status: "ok", error: "already_r2" };
      url = data.file_url; name = data.file_name || "file"; driveId = extractDriveFileId(url);
    } else if (table === "project_resources") {
      const { data } = await db.from("project_resources").select("url, name, storage_type").eq("id", id).single();
      if (!data) throw new Error("row_not_found");
      if (data.storage_type === "r2") return { row_id: id, table, status: "ok", error: "already_r2" };
      url = data.url; name = data.name || "file"; driveId = extractDriveFileId(url);
    } else {
      const { data } = await db.from("chat_messages").select("attachment_url, attachment_name, storage_type").eq("id", id).single();
      if (!data) throw new Error("row_not_found");
      if (data.storage_type === "r2") return { row_id: id, table, status: "ok", error: "already_r2" };
      url = data.attachment_url; name = data.attachment_name || "chat-file"; driveId = extractDriveFileId(url);
    }
    if (!driveId) throw new Error("cannot_extract_drive_id");

    // 2) download via Drive API
    const authClient = await getGoogleClient(userId);
    const drive = google.drive({ version: "v3", auth: authClient });
    const meta = await drive.files.get({ fileId: driveId, fields: "id,name,mimeType,size", supportsAllDrives: true });
    const mimeType = meta.data.mimeType || "application/octet-stream";
    const fileName = name || meta.data.name || "file";

    // Google-native docs 는 export 가 필요 (지금은 미지원 → 원본 link 로 남김)
    if (/^application\/vnd\.google-apps\./.test(mimeType)) {
      throw new Error(`native_google_doc_unsupported:${mimeType}`);
    }

    const dl = await drive.files.get(
      { fileId: driveId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    );
    const buf = Buffer.from(dl.data as ArrayBuffer);

    // 3) R2 put
    const key = `migrated/${userId}/${Date.now()}_${safeName(fileName)}`;
    await getR2Client().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: buf,
      ContentType: mimeType,
      ContentLength: buf.length,
    }));
    const newUrl = getPublicUrl(key);

    // 4) DB update
    if (table === "file_attachments") {
      await db.from("file_attachments")
        .update({ file_url: newUrl, storage_type: "r2", storage_key: key })
        .eq("id", id);
    } else if (table === "project_resources") {
      await db.from("project_resources")
        .update({ url: newUrl, storage_type: "r2", storage_key: key })
        .eq("id", id);
    } else {
      await db.from("chat_messages")
        .update({ attachment_url: newUrl, storage_type: "r2" })
        .eq("id", id);
    }

    log.info("migrate-from-drive.ok", { table, id, key, bytes: buf.length });
    return { row_id: id, table, status: "ok", r2_url: newUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn("migrate-from-drive.failed", { table, id, error: msg });
    return { row_id: id, table, status: "failed", error: msg };
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isR2Configured()) return NextResponse.json({ error: "R2_NOT_CONFIGURED" }, { status: 501 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "BAD_JSON" }, { status: 400 }); }
  const rows: MigrateInput[] = Array.isArray(body?.rows) ? body.rows.slice(0, BATCH_LIMIT) : [];
  if (rows.length === 0) return NextResponse.json({ error: "NO_ROWS" }, { status: 400 });

  const db = getServiceClient();
  const results = [] as Awaited<ReturnType<typeof migrateOne>>[];
  for (const r of rows) {
    results.push(await migrateOne(db, auth.user.id, r));
  }
  return NextResponse.json({
    ok: true,
    results,
    counts: {
      ok: results.filter(r => r.status === "ok").length,
      failed: results.filter(r => r.status === "failed").length,
    },
  });
}

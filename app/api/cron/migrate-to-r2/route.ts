/**
 * GET /api/cron/migrate-to-r2
 *
 * 기존 Supabase Storage 파일을 Cloudflare R2 로 백그라운드 복사.
 * - file_attachments / project_resources 에서 storage_type='supabase' + supabase.co URL 대상
 * - 한 번 실행에 최대 MIGRATE_BATCH (기본 25) 개 처리
 * - 파일 다운로드 → R2 PUT → DB URL/storage_type 갱신
 * - Supabase 원본은 성공 후 삭제 (SUPABASE_CLEANUP_AFTER_MIGRATION=true 일 때만)
 *
 * Vercel Cron: vercel.json 에 등록 (예: 매 시간 정각).
 * 인증: CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient } from "@supabase/supabase-js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getPublicUrl, isR2Configured, r2Key } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5분

const BATCH = Number(process.env.MIGRATE_BATCH || "25");
const CLEANUP = process.env.SUPABASE_CLEANUP_AFTER_MIGRATION === "true";

interface Target {
  table: "file_attachments" | "project_resources";
  urlCol: string;
  nameCol: string;
  typeCol: string;
  idCol: string;
  keyCol: string;
  prefix: string;
}
const TARGETS: Target[] = [
  {
    table: "file_attachments",
    urlCol: "file_url",
    nameCol: "file_name",
    typeCol: "storage_type",
    idCol: "id",
    keyCol: "storage_key",
    prefix: "resources",
  },
  {
    table: "project_resources",
    urlCol: "url",
    nameCol: "name",
    typeCol: "storage_type",
    idCol: "id",
    keyCol: "storage_key",
    prefix: "resources",
  },
];

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isR2Configured()) {
    return NextResponse.json({ ok: false, reason: "R2 not configured" }, { status: 501 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "SUPABASE env missing" }, { status: 501 });
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const r2 = getR2Client();
  const bucket = process.env.R2_BUCKET!;

  const report: any[] = [];
  let totalProcessed = 0;

  for (const t of TARGETS) {
    // storage_type='supabase' 만 대상 (아직 이관 안 된 것)
    const { data: rows, error } = await db
      .from(t.table)
      .select(`${t.idCol}, ${t.urlCol}, ${t.nameCol}`)
      .eq(t.typeCol, "supabase")
      .ilike(t.urlCol, "%supabase.co/storage/%")
      .limit(Math.max(1, BATCH - totalProcessed));

    if (error) {
      report.push({ table: t.table, error: error.message });
      continue;
    }
    if (!rows || rows.length === 0) continue;

    for (const row of rows as any[]) {
      const oldUrl: string = row[t.urlCol];
      const name: string = row[t.nameCol] || "file";
      try {
        // 1) 다운로드
        const res = await fetch(oldUrl);
        if (!res.ok) throw new Error(`download ${res.status}`);
        const arr = new Uint8Array(await res.arrayBuffer());
        const contentType = res.headers.get("content-type") || "application/octet-stream";

        // 2) R2 업로드
        const newKey = r2Key(`${t.prefix}/migrated`, name);
        await r2.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: newKey,
            Body: arr,
            ContentType: contentType,
            ContentLength: arr.length,
          }),
        );
        const newUrl = getPublicUrl(newKey);

        // 3) DB 갱신
        await db
          .from(t.table)
          .update({ [t.urlCol]: newUrl, [t.typeCol]: "r2", [t.keyCol]: newKey })
          .eq(t.idCol, row[t.idCol]);

        // 4) Supabase 원본 정리 (opt-in)
        if (CLEANUP) {
          try {
            // Supabase Storage URL 에서 버킷/경로 추출
            const m = oldUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
            if (m) {
              const [, sbBucket, sbPath] = m;
              await db.storage.from(sbBucket).remove([decodeURIComponent(sbPath)]);
            }
          } catch (err: any) {
    log.error(err, "cron.migrate-to-r2.failed");
            console.warn("[migrate cleanup]", err?.message);
          }
        }

        report.push({ table: t.table, id: row[t.idCol], status: "migrated", newKey });
        totalProcessed++;
        if (totalProcessed >= BATCH) break;
      } catch (err: any) {
    log.error(err, "cron.migrate-to-r2.failed");
        report.push({ table: t.table, id: row[t.idCol], status: "error", error: err?.message });
      }
    }
    if (totalProcessed >= BATCH) break;
  }

  return NextResponse.json({
    ok: true,
    processed: totalProcessed,
    batch: BATCH,
    cleanup: CLEANUP,
    report,
  });
}

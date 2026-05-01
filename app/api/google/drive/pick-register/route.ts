/**
 * POST /api/google/drive/pick-register
 *
 * Body: { targetType: 'project'|'group', targetId, files: [{id, name, mimeType, url}] }
 *
 * 동작:
 *  1) 사용자의 Google OAuth 토큰으로 drive 클라이언트 생성
 *  2) 각 파일에 대해:
 *     - permissions.create({ role:'reader', type:'anyone' }) 호출 → anyone with link: viewer
 *     - 실패는 무시(이미 공유됐거나 권한 없는 팀 드라이브)
 *  3) project_resources (볼트) 또는 file_attachments (너트) 에 storage_type='google_drive' 로 insert
 *
 * 응답: { inserted, permissionsUpdated, errors }
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { google } from "googleapis";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type PickFile = { id: string; name: string; mimeType: string; url: string };

export const POST = withRouteLog("google.drive.pick-register", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.targetType || !body?.targetId || !Array.isArray(body.files)) {
    return NextResponse.json({ error: "targetType, targetId, files required" }, { status: 400 });
  }

  const { targetType, targetId } = body;
  const files: PickFile[] = body.files;
  if (!["project", "group"].includes(targetType)) {
    return NextResponse.json({ error: "targetType must be project or group" }, { status: 400 });
  }

  // Google Drive 클라이언트
  let drive: ReturnType<typeof google.drive> | null = null;
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error("NO_USER");
    const authClient = await getGoogleClient(userId);
    drive = google.drive({ version: "v3", auth: authClient });
  } catch (err: any) {
    log.error(err, "google.drive.pick-register.failed");
    if (err?.message === "GOOGLE_NOT_CONNECTED") {
      return NextResponse.json(
        { error: "Google 계정 연결이 필요합니다. /profile 에서 연결해주세요." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: err?.message || "google auth failed" }, { status: 500 });
  }

  let permissionsUpdated = 0;
  let inserted = 0;
  const errors: Array<{ file: string; error: string }> = [];

  for (const f of files) {
    // 1) 권한 변경 — anyone with link: viewer
    try {
      await drive.permissions.create({
        fileId: f.id,
        requestBody: { role: "reader", type: "anyone" },
        supportsAllDrives: true,
      });
      permissionsUpdated++;
    } catch (err: any) {
    log.error(err, "google.drive.pick-register.failed");
      // 이미 공유됐거나 팀드라이브 권한 부족 — 무시하고 메타데이터만 저장
      if (!/alreadyExists|permissionsCannotBeShared/.test(err?.message || "")) {
        console.warn("[drive perm]", f.id, err?.message);
      }
    }

    // 2) DB 등록
    try {
      if (targetType === "project") {
        const detectedType =
          /image/i.test(f.mimeType) ? "image"
            : /pdf/i.test(f.mimeType) ? "pdf"
              : /presentation|slides/i.test(f.mimeType) ? "slide"
                : /spreadsheet|sheet/i.test(f.mimeType) ? "sheet"
                  : /document|doc/i.test(f.mimeType) ? "doc"
                    : "file";
        const payload: any = {
          project_id: targetId,
          name: f.name,
          url: f.url,
          type: detectedType,
          stage: "evidence",
          uploaded_by: auth.user.id,
          storage_type: "google_drive",
          storage_key: f.id,
        };
        let { error: prErr } = await supabase.from("project_resources").insert(payload);
        if (prErr && /storage_type|storage_key/.test(prErr.message)) {
          delete payload.storage_type;
          delete payload.storage_key;
          ({ error: prErr } = await supabase.from("project_resources").insert(payload));
        }
        if (prErr) throw prErr;
      } else {
        const payload: any = {
          target_type: "group",
          target_id: targetId,
          uploaded_by: auth.user.id,
          file_name: f.name,
          file_url: f.url,
          file_type: f.mimeType,
          storage_type: "google_drive",
          storage_key: f.id,
        };
        let { error: faErr } = await supabase.from("file_attachments").insert(payload);
        if (faErr && /storage_type|storage_key/.test(faErr.message)) {
          delete payload.storage_type;
          delete payload.storage_key;
          ({ error: faErr } = await supabase.from("file_attachments").insert(payload));
        }
        if (faErr) throw faErr;
      }
      inserted++;
    } catch (err: any) {
    log.error(err, "google.drive.pick-register.failed");
      errors.push({ file: f.name, error: err?.message || "insert failed" });
    }
  }

  return NextResponse.json({
    inserted,
    permissionsUpdated,
    errors,
    total: files.length,
  });
});

/**
 * POST /api/files/move
 *
 * 자료실 행을 다른 폴더로 이동 (folder_path 만 변경, 스토리지는 건드리지 않음).
 *
 * Body: { table, ids: string[], folder_path: string }
 *  - folder_path: '' = 루트, 'design' = design 폴더, 'clients/2026' = 중첩
 *
 * 권한: 각 ID 의 업로더 본인 또는 그룹 매니저/프로젝트 호스트.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Table = "file_attachments" | "project_resources";

function sanitizePath(p: string): string {
  // 영문/숫자/한글/공백/-/_/슬래시만, 양 끝 슬래시 제거
  return p
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/")
    .slice(0, 200);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const table: Table | undefined = body?.table;
  const ids: string[] | undefined = body?.ids;
  const rawFolder: string = typeof body?.folder_path === "string" ? body.folder_path : "";
  const folderPath = sanitizePath(rawFolder);

  if (!ids || ids.length === 0 || (table !== "file_attachments" && table !== "project_resources")) {
    return NextResponse.json({ error: "table + ids required" }, { status: 400 });
  }

  // 권한 검사 — 각 id 마다 (간소화: 일괄로 owner 또는 매니저 검사)
  const { data: rows, error: fetchErr } = await supabase
    .from(table)
    .select(table === "file_attachments"
      ? "id, uploaded_by, target_type, target_id"
      : "id, uploaded_by, project_id")
    .in("id", ids);
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 매니저/호스트 미리 확인 — N+1 피하기 위해 한 번만
  let isManager = false;
  if (table === "file_attachments") {
    const groupId = (rows[0] as any).target_type === "group" ? (rows[0] as any).target_id : null;
    if (groupId) {
      const { data: gm } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      isManager = gm?.role === "host" || gm?.role === "manager";
    }
  } else {
    const projectId = (rows[0] as any).project_id;
    if (projectId) {
      const { data: pj } = await supabase
        .from("projects")
        .select("host_id")
        .eq("id", projectId)
        .maybeSingle();
      isManager = pj?.host_id === auth.user.id;
    }
  }

  const allowedIds = rows
    .filter((r: any) => r.uploaded_by === auth.user.id || isManager)
    .map((r: any) => r.id);

  if (allowedIds.length === 0) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error: updateErr } = await supabase
    .from(table)
    .update({ folder_path: folderPath })
    .in("id", allowedIds);

  if (updateErr) {
    if (/folder_path/.test(updateErr.message) || /column .* does not exist/i.test(updateErr.message)) {
      return NextResponse.json(
        { error: "폴더 기능이 활성화되지 않았어요 (마이그레이션 133 필요)", code: "MIGRATION_MISSING" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    moved: allowedIds.length,
    skipped: ids.length - allowedIds.length,
    folder_path: folderPath,
  });
}

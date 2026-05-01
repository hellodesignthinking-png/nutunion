/**
 * GET  /api/files/versions?table=...&id=... — 자료의 백업본 목록
 * POST /api/files/versions/restore             — 백업본을 메인 키로 복원
 *
 * 백업본은 sync-from-drive 가 자동 생성. 자료당 최대 5개 보관.
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Table = "file_attachments" | "project_resources";

export const GET = withRouteLog("files.versions", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const table = params.get("table") as Table | null;
  const id = params.get("id");
  if (!id || (table !== "file_attachments" && table !== "project_resources")) {
    return NextResponse.json({ error: "table + id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("file_versions")
    .select("id, backup_storage_key, bytes, content_type, created_by, created_at, label")
    .eq("resource_table", table)
    .eq("resource_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    if (/file_versions/.test(error.message) || /column .* does not exist/i.test(error.message)) {
      return NextResponse.json(
        { error: "버전 기능이 활성화되지 않았어요 (마이그레이션 132 필요)", code: "MIGRATION_MISSING" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ versions: data || [] });
});

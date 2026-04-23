/**
 * GET /api/google/drive/storage-status
 *
 * 현재 Drive 저장 전략 확인용. admin UI 에서 표시.
 *
 * 응답:
 *  - strategy: "shared-drive" | "host-drive"
 *  - driveId: Shared Drive ID (일부만)
 *  - rootFolderId: 루트 폴더 ID (있을 때)
 *  - description: 사람이 읽는 설명
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDriveStorageTarget,
  describeStorageStrategy,
} from "@/lib/google/drive-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // admin/staff 만 조회 가능
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const target = getDriveStorageTarget();
  return NextResponse.json({
    strategy: target.strategy,
    driveId: target.driveId ? target.driveId.slice(0, 8) + "..." : null,
    hasRootFolder: target.parentFolderId && target.parentFolderId !== target.driveId,
    description: describeStorageStrategy(),
    recommendation:
      target.strategy === "host-drive"
        ? "GOOGLE_SHARED_DRIVE_ID 환경변수 설정 시 호스트 탈퇴 영향 없는 공유 드라이브로 전환됩니다."
        : null,
  });
}

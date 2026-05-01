/**
 * POST /api/google/drive/shared-folder
 *
 * [Drive 단일 공유 폴더 모드 — 2026-04 rewire]
 * 폴더 생성 없이 그룹/프로젝트 레코드에 GOOGLE_DRIVE_SHARED_FOLDER_ID URL 만 기록한다.
 * 호출자 응답 호환을 위해 { folderUrl, sharedFolder: true } 형태 유지.
 */
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { getCurrentUserId } from "@/lib/google/auth";
import { createClient } from "@/lib/supabase/server";
import { getSharedFolderId } from "@/lib/google/drive-config";

export const POST = withRouteLog("google.drive.shared-folder.post", async (req: NextRequest) => {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { targetType, targetId } = await req.json();
  if (!targetType || !targetId) {
    return NextResponse.json({ error: "targetType, targetId 필요" }, { status: 400 });
  }

  const sharedFolderId = getSharedFolderId();
  if (!sharedFolderId) {
    return NextResponse.json(
      {
        error: "GOOGLE_DRIVE_SHARED_FOLDER_ID 가 설정되지 않았습니다.",
        code: "SHARED_FOLDER_NOT_CONFIGURED",
      },
      { status: 500 },
    );
  }
  const folderUrl = `https://drive.google.com/drive/folders/${sharedFolderId}`;

  const supabase = await createClient();

  // 권한 체크 (기존과 동일)
  if (targetType === "group") {
    const { data: group } = await supabase
      .from("groups")
      .select("host_id")
      .eq("id", targetId)
      .single();
    if (!group) return NextResponse.json({ error: "그룹을 찾을 수 없습니다" }, { status: 404 });

    const { data: isMod } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", targetId)
      .eq("user_id", userId)
      .in("role", ["host", "moderator"])
      .eq("status", "active")
      .maybeSingle();

    if ((group as any).host_id !== userId && !isMod) {
      return NextResponse.json(
        { error: "호스트 또는 관리자만 공유 폴더를 만들 수 있습니다" },
        { status: 403 },
      );
    }

    await supabase
      .from("groups")
      .update({ google_drive_url: folderUrl } as any)
      .eq("id", targetId);
  } else if (targetType === "project") {
    const { data: project } = await supabase
      .from("projects")
      .select("created_by")
      .eq("id", targetId)
      .single();
    if (!project) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다" }, { status: 404 });
    }

    const { data: isLead } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", targetId)
      .eq("user_id", userId)
      .in("role", ["lead", "manager"])
      .maybeSingle();

    if ((project as any).created_by !== userId && !isLead) {
      return NextResponse.json({ error: "리더만 공유 폴더를 만들 수 있습니다" }, { status: 403 });
    }

    await supabase
      .from("projects")
      .update({ google_drive_url: folderUrl } as any)
      .eq("id", targetId);
  } else {
    return NextResponse.json({ error: "올바르지 않은 targetType" }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    sharedFolder: true,
    folderUrl,
    folderName: "nutunion 공유 자료",
  });
});

/**
 * GET — 호환용. 항상 공유 폴더 URL 반환.
 */
export const GET = withRouteLog("google.drive.shared-folder.get", async (req: NextRequest) => {
  const sharedFolderId = getSharedFolderId();
  const { searchParams } = new URL(req.url);
  const targetType = searchParams.get("targetType");
  const targetId = searchParams.get("targetId");

  if (!sharedFolderId) return NextResponse.json({ folder: null });

  const folderUrl = `https://drive.google.com/drive/folders/${sharedFolderId}`;
  const folder = { id: sharedFolderId, url: folderUrl };

  if (!targetType || !targetId) return NextResponse.json({ folder });

  const supabase = await createClient();
  if (targetType === "group") {
    const { data } = await supabase
      .from("groups")
      .select("host_id")
      .eq("id", targetId)
      .single();
    return NextResponse.json({ folder, hostId: (data as any)?.host_id });
  } else if (targetType === "project") {
    const { data } = await supabase
      .from("projects")
      .select("created_by")
      .eq("id", targetId)
      .single();
    return NextResponse.json({ folder, hostId: (data as any)?.created_by });
  }

  return NextResponse.json({ folder });
});

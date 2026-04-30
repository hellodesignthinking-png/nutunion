/**
 * POST /api/google/drive/folder
 *
 * [Drive 단일 공유 폴더 모드 — 2026-04 rewire]
 * 더 이상 그룹/프로젝트별 Drive 폴더를 만들지 않는다.
 * 모든 Drive 쓰기는 GOOGLE_DRIVE_SHARED_FOLDER_ID 가 가리키는 단일 공유 폴더로 라우팅된다.
 *
 * 이 라우트는 호환성을 위해 유지되며, 다음 동작만 수행한다:
 *   - 그룹/프로젝트/스태프 레코드의 google_drive_url 컬럼을 공유 폴더 URL 로 업데이트
 *   - *_folder_id 컬럼은 NULL 로 유지 (기존 값은 보존)
 *   - { folderUrl, sharedFolder: true } 반환 — 호출자 호환
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/google/auth";
import { createClient } from "@/lib/supabase/server";
import { getSharedFolderId } from "@/lib/google/drive-config";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const { groupId, projectId, staffProjectId } = await req.json();

    if (!groupId && !projectId && !staffProjectId) {
      return NextResponse.json(
        { error: "groupId, projectId, 또는 staffProjectId가 필요합니다" },
        { status: 400 },
      );
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

    // 권한 체크 — 기존과 동일하게 호스트/리드만 허용.
    if (staffProjectId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (!profile || ((profile as any).role !== "staff" && (profile as any).role !== "admin")) {
        return NextResponse.json(
          { error: "스태프만 드라이브 폴더를 설정할 수 있습니다" },
          { status: 403 },
        );
      }
      await supabase
        .from("staff_projects")
        .update({ drive_folder_url: folderUrl })
        .eq("id", staffProjectId);
    } else if (projectId) {
      const { data: membership } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .single();
      if (!membership || (membership as any).role !== "lead") {
        return NextResponse.json(
          { error: "프로젝트 리드만 드라이브 폴더를 설정할 수 있습니다" },
          { status: 403 },
        );
      }
      await supabase
        .from("projects")
        .update({ google_drive_url: folderUrl } as any)
        .eq("id", projectId);
    } else {
      const { data: group } = await supabase
        .from("groups")
        .select("host_id")
        .eq("id", groupId)
        .single();
      if (!group || (group as any).host_id !== userId) {
        return NextResponse.json(
          { error: "호스트만 드라이브 폴더를 설정할 수 있습니다" },
          { status: 403 },
        );
      }
      await supabase
        .from("groups")
        .update({ google_drive_url: folderUrl } as any)
        .eq("id", groupId);
    }

    return NextResponse.json({
      success: true,
      sharedFolder: true,
      folderUrl,
      webViewLink: folderUrl,
      subFolders: {},
    });
  } catch (err) {
    console.error("Drive folder (shared) update error:", err);
    return NextResponse.json({ error: "폴더 URL 저장 실패" }, { status: 500 });
  }
}

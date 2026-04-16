/**
 * POST /api/google/drive/shared-folder
 * Host creates a shared Google Drive folder for a group or project.
 * Folder is set to "anyone with link = reader" and saved in DB.
 */
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { targetType, targetId, folderName } = await req.json();
  if (!targetType || !targetId) return NextResponse.json({ error: "targetType, targetId 필요" }, { status: 400 });

  const supabase = await createClient();

  // ── Verify requester is host/lead ───────────────────────────
  if (targetType === "group") {
    const { data: group } = await supabase.from("groups").select("host_id").eq("id", targetId).single();
    if (!group) return NextResponse.json({ error: "그룹을 찾을 수 없습니다" }, { status: 404 });

    const { data: isMod } = await supabase.from("group_members").select("role")
      .eq("group_id", targetId).eq("user_id", userId)
      .in("role", ["host", "moderator"]).eq("status", "active").maybeSingle();

    if (group.host_id !== userId && !isMod) {
      return NextResponse.json({ error: "호스트 또는 관리자만 공유 폴더를 만들 수 있습니다" }, { status: 403 });
    }
  } else if (targetType === "project") {
    const { data: project } = await supabase.from("projects").select("created_by").eq("id", targetId).single();
    if (!project) return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다" }, { status: 404 });

    const { data: isLead } = await supabase.from("project_members").select("role")
      .eq("project_id", targetId).eq("user_id", userId)
      .in("role", ["lead", "manager"]).maybeSingle();

    if (project.created_by !== userId && !isLead) {
      return NextResponse.json({ error: "리더만 공유 폴더를 만들 수 있습니다" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "올바르지 않은 targetType" }, { status: 400 });
  }

  // ── Create folder in host's Drive ───────────────────────────
  try {
    const auth = await getGoogleClient(userId);
    const drive = google.drive({ version: "v3", auth });

    const name = folderName || (targetType === "group" ? "너트 공유 자료실" : "볼트 공유 자료실");

    const folderRes = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id, name, webViewLink",
    });

    const folderId = folderRes.data.id!;
    const folderUrl = folderRes.data.webViewLink!;

    // Set "anyone with link = reader" so links are publicly viewable
    try {
      await drive.permissions.create({
        fileId: folderId,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch (e) {
      console.warn("Could not set folder permission:", e);
    }

    // ── Save folder ID to DB ─────────────────────────────────
    if (targetType === "group") {
      await supabase.from("groups").update({
        google_drive_folder_id: folderId,
        google_drive_url: folderUrl,
      }).eq("id", targetId);
    } else if (targetType === "project") {
      await supabase.from("projects").update({
        google_drive_folder_id: folderId,
        google_drive_url: folderUrl,
      }).eq("id", targetId);
    }

    return NextResponse.json({
      success: true,
      folderId,
      folderUrl,
      folderName: folderRes.data.name,
    });

  } catch (err: any) {
    if (err.message === "GOOGLE_NOT_CONNECTED") {
      return NextResponse.json({ error: "Google 계정을 먼저 연결해주세요.", code: "NOT_CONNECTED" }, { status: 403 });
    }
    console.error("Shared folder creation error:", err);
    return NextResponse.json({ error: "폴더 생성 실패: " + err.message }, { status: 500 });
  }
}

/**
 * GET /api/google/drive/shared-folder?targetType=group&targetId=xxx
 * Returns the current shared folder info for a group/project
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetType = searchParams.get("targetType");
  const targetId = searchParams.get("targetId");

  if (!targetType || !targetId) return NextResponse.json({ folder: null });

  const supabase = await createClient();

  if (targetType === "group") {
    const { data } = await supabase.from("groups")
      .select("google_drive_folder_id, google_drive_url, host_id")
      .eq("id", targetId).single();
    return NextResponse.json({
      folder: data?.google_drive_folder_id ? {
        id: data.google_drive_folder_id,
        url: data.google_drive_url,
      } : null,
      hostId: data?.host_id,
    });
  } else if (targetType === "project") {
    const { data } = await supabase.from("projects")
      .select("google_drive_folder_id, google_drive_url, created_by")
      .eq("id", targetId).single();
    return NextResponse.json({
      folder: data?.google_drive_folder_id ? {
        id: data.google_drive_folder_id,
        url: data.google_drive_url,
      } : null,
      hostId: data?.created_by,
    });
  }

  return NextResponse.json({ folder: null });
}

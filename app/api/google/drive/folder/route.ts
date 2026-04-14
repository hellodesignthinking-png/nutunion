import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/google/drive/folder
 * Creates a Google Drive folder for a group and saves the folder ID to the group record.
 */
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const { groupId, staffProjectId, folderName } = await req.json();

    if ((!groupId && !staffProjectId) || !folderName) {
      return NextResponse.json({ error: "groupId 또는 staffProjectId와 folderName이 필요합니다" }, { status: 400 });
    }

    const authSupabase = await createClient();

    if (staffProjectId) {
      // Staff project: verify user is staff/admin
      const { data: profile } = await authSupabase.from("profiles").select("role").eq("id", userId).single();
      if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
        return NextResponse.json({ error: "스태프만 드라이브 폴더를 설정할 수 있습니다" }, { status: 403 });
      }
    } else {
      // Group: verify user is the host
      const { data: group } = await authSupabase.from("groups").select("host_id").eq("id", groupId).single();
      if (!group || group.host_id !== userId) {
        return NextResponse.json({ error: "호스트만 드라이브 폴더를 설정할 수 있습니다" }, { status: 403 });
      }
    }

    const auth = await getGoogleClient(userId);
    const drive = google.drive({ version: "v3", auth });

    // Create folder in Google Drive
    const folderRes = await drive.files.create({
      requestBody: {
        name: `[nutunion] ${folderName}`,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id, name, webViewLink",
    });

    const folderId = folderRes.data.id!;
    const webViewLink = folderRes.data.webViewLink!;

    // Set "anyone with link can view" permission
    try {
      await drive.permissions.create({
        fileId: folderId,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch (permErr: any) {
      console.warn("Folder permission setting skipped:", permErr.message);
    }

    // Create sub-folders: 회의록, 위키, 자료
    const subFolders: Record<string, string> = {};
    for (const subName of ["회의록", "탭", "자료"]) {
      try {
        const subRes = await drive.files.create({
          requestBody: {
            name: subName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [folderId],
          },
          fields: "id, name",
        });
        subFolders[subName] = subRes.data.id!;
      } catch (subErr: any) {
        console.warn(`Sub-folder ${subName} creation skipped:`, subErr.message);
      }
    }

    // Save folder info to the relevant record
    const supabase = await createClient();
    if (staffProjectId) {
      const { error: updateErr } = await supabase
        .from("staff_projects")
        .update({
          drive_folder_id: folderId,
          drive_folder_url: webViewLink,
        })
        .eq("id", staffProjectId);
      if (updateErr) console.error("Staff project Drive update failed:", updateErr.message);
    } else {
      const { error: updateErr } = await supabase
        .from("groups")
        .update({
          google_drive_url: webViewLink,
          google_drive_folder_id: folderId,
          google_drive_wiki_folder_id: subFolders["탭"] || null,
          google_drive_meetings_folder_id: subFolders["회의록"] || null,
          google_drive_resources_folder_id: subFolders["자료"] || null,
        } as any)
        .eq("id", groupId);
      if (updateErr) console.error("Group Drive update failed:", updateErr.message);
    }

    return NextResponse.json({
      success: true,
      folderId,
      webViewLink,
      folderName: folderRes.data.name,
      subFolders,
    });
  } catch (err: any) {
    if (err.message === "GOOGLE_NOT_CONNECTED") {
      return NextResponse.json(
        { error: "Google 계정이 연결되지 않았습니다.", code: "NOT_CONNECTED" },
        { status: 403 }
      );
    }
    if (err.message === "GOOGLE_TOKEN_EXPIRED") {
      return NextResponse.json(
        { error: "Google 토큰이 만료되었습니다. 다시 연결해주세요.", code: "TOKEN_EXPIRED" },
        { status: 401 }
      );
    }
    console.error("Drive folder creation error:", err);
    return NextResponse.json(
      { error: "폴더 생성 실패" },
      { status: 500 }
    );
  }
}

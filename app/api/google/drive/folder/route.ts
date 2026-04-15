import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/google/drive/folder
 * Creates a Google Drive folder for a group, project(bolt), or staff project.
 * - Groups: 3 subfolders (회의록, 탭, 자료)
 * - Projects (bolt): 4 subfolders (기획, 중간산출, 증빙, 최종)
 * - Staff: plain folder
 *
 * Members are auto-shared via "anyone with link can view" (no individual email sharing needed).
 * The folder URL is stored in the DB so all members can access it through the UI.
 */
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const { groupId, projectId, staffProjectId, folderName } = await req.json();

    if ((!groupId && !projectId && !staffProjectId) || !folderName) {
      return NextResponse.json({ error: "groupId, projectId, 또는 staffProjectId와 folderName이 필요합니다" }, { status: 400 });
    }

    const authSupabase = await createClient();

    // Authorization checks
    if (staffProjectId) {
      const { data: profile } = await authSupabase.from("profiles").select("role").eq("id", userId).single();
      if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
        return NextResponse.json({ error: "스태프만 드라이브 폴더를 설정할 수 있습니다" }, { status: 403 });
      }
    } else if (projectId) {
      // Bolt project: verify user is lead
      const { data: membership } = await authSupabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .single();
      if (!membership || membership.role !== "lead") {
        return NextResponse.json({ error: "프로젝트 리드만 드라이브 폴더를 설정할 수 있습니다" }, { status: 403 });
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

    // Determine folder prefix
    const prefix = projectId ? "볼트" : staffProjectId ? "스태프" : "너트";

    // Create folder in Google Drive
    const folderRes = await drive.files.create({
      requestBody: {
        name: `[nutunion ${prefix}] ${folderName}`,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id, name, webViewLink",
    });

    const folderId = folderRes.data.id!;
    const webViewLink = folderRes.data.webViewLink!;

    // Set "anyone with link can view" — no individual sharing needed.
    // All nut/bolt members access the folder through the nutunion UI link.
    try {
      await drive.permissions.create({
        fileId: folderId,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch (permErr: any) {
      console.warn("Folder permission setting skipped:", permErr.message);
    }

    // Create context-appropriate sub-folders
    const subFolders: Record<string, string> = {};
    const subNames = projectId
      ? ["기획", "중간산출", "증빙", "최종"]       // Bolt (project stages)
      : staffProjectId
        ? []                                          // Staff: flat
        : ["회의록", "탭", "자료"];                    // Nut (group)

    for (const subName of subNames) {
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
        // Inherit "anyone with link" permission
        try {
          await drive.permissions.create({
            fileId: subRes.data.id!,
            requestBody: { role: "reader", type: "anyone" },
          });
        } catch { /* inherits parent perm */ }
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
    } else if (projectId) {
      // Save to projects table
      const { error: updateErr } = await supabase
        .from("projects")
        .update({
          google_drive_url: webViewLink,
          google_drive_folder_id: folderId,
          google_drive_planning_folder_id: subFolders["기획"] || null,
          google_drive_interim_folder_id: subFolders["중간산출"] || null,
          google_drive_evidence_folder_id: subFolders["증빙"] || null,
          google_drive_final_folder_id: subFolders["최종"] || null,
        } as any)
        .eq("id", projectId);
      if (updateErr) console.error("Project Drive update failed:", updateErr.message);
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

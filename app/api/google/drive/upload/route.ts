import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { createClient } from "@/lib/supabase/server";
import { Readable } from "stream";

// ── MIME type whitelist ────────────────────────────────────────
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  "text/plain", "text/csv", "text/markdown",
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
  "video/mp4", "video/webm",
  "audio/mpeg", "audio/wav",
];

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const targetType = formData.get("targetType") as string | null; // "group" | "project"
    const targetId   = formData.get("targetId")   as string | null;
    const stage      = formData.get("stage")       as string | null;
    // Manual folderId override (advanced use)
    let folderId = formData.get("folderId") as string | null;

    if (!file) return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
    if (file.size > 50 * 1024 * 1024)
      return NextResponse.json({ error: "파일 크기는 50MB 이하여야 합니다" }, { status: 400 });
    if (file.type && !ALLOWED_TYPES.includes(file.type))
      return NextResponse.json({ error: "허용되지 않는 파일 형식입니다" }, { status: 400 });

    const supabase = await createClient();

    // ── 1. Resolve shared folder & uploader identity ───────────
    // When a group/project has a shared Google Drive folder,
    // we upload using the HOST's token so members don't need to connect Google.
    let uploaderUserId = userId;  // default: use current user's credentials
    let sharedFolderId: string | null = folderId;
    let hostId: string | null = null;

    if (targetType === "group" && targetId) {
      // Check membership
      const { data: membership } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", targetId)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      // Fetch group — try with google_drive_folder_id, fallback to just host_id
      // (column may not exist in production until migration is applied)
      let group: { host_id: string; google_drive_folder_id?: string | null } | null = null;
      {
        const { data, error } = await supabase
          .from("groups")
          .select("host_id, google_drive_folder_id")
          .eq("id", targetId)
          .single();
        if (!error && data) {
          group = data;
        } else {
          const { data: fallback } = await supabase
            .from("groups")
            .select("host_id")
            .eq("id", targetId)
            .single();
          group = fallback;
        }
      }

      if (!membership && group?.host_id !== userId) {
        return NextResponse.json({ error: "그룹 멤버만 파일을 업로드할 수 있습니다" }, { status: 403 });
      }

      if (group) {
        hostId = group.host_id;
        if (group.google_drive_folder_id) {
          sharedFolderId = group.google_drive_folder_id;
          uploaderUserId = group.host_id;
        }
      }
    } else if (targetType === "project" && targetId) {
      const { data: membership } = await supabase
        .from("project_members")
        .select("id")
        .eq("project_id", targetId)
        .eq("user_id", userId)
        .maybeSingle();

      // Fetch project — try with drive columns, fallback to just created_by
      let project: { created_by: string; google_drive_folder_id?: string | null; google_drive_planning_folder_id?: string | null; google_drive_interim_folder_id?: string | null; google_drive_evidence_folder_id?: string | null; google_drive_final_folder_id?: string | null } | null = null;
      {
        const { data, error } = await supabase
          .from("projects")
          .select("created_by, google_drive_folder_id, google_drive_planning_folder_id, google_drive_interim_folder_id, google_drive_evidence_folder_id, google_drive_final_folder_id")
          .eq("id", targetId)
          .single();
        if (!error && data) {
          project = data;
        } else {
          const { data: fallback } = await supabase
            .from("projects")
            .select("created_by")
            .eq("id", targetId)
            .single();
          project = fallback;
        }
      }
      if (!membership && project?.created_by !== userId) {
        return NextResponse.json({ error: "프로젝트 멤버만 파일을 업로드할 수 있습니다" }, { status: 403 });
      }

      if (project?.created_by) {
        hostId = project.created_by;
        // Pick stage-specific subfolder or root folder
        const stageFolder =
          stage === "planning"  ? project.google_drive_planning_folder_id :
          stage === "interim"   ? project.google_drive_interim_folder_id :
          stage === "evidence"  ? project.google_drive_evidence_folder_id :
          stage === "final"     ? project.google_drive_final_folder_id :
          null;

        const resolvedFolder = stageFolder || project.google_drive_folder_id || null;
        if (resolvedFolder) {
          sharedFolderId = resolvedFolder;
          uploaderUserId = project.created_by;
        }
      }
    }

    // ── 2. Get Google client (host's if shared folder exists) ──
    const auth = await getGoogleClient(uploaderUserId);
    const drive = google.drive({ version: "v3", auth });

    // ── 3. Upload to Drive ─────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata: any = { name: file.name };
    if (sharedFolderId) fileMetadata.parents = [sharedFolderId];

    const driveRes = await drive.files.create({
      requestBody: fileMetadata,
      media: { mimeType: file.type || "application/octet-stream", body: stream },
      fields: "id, name, mimeType, webViewLink, size",
    });

    const fileId = driveRes.data.id!;
    const webViewLink = driveRes.data.webViewLink!;

    // ── 4. Set share permission (anyone with link = reader) ────
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch (permErr: any) {
      console.warn("Permission setting skipped:", permErr.message);
    }

    // ── 5. Register in DB ──────────────────────────────────────
    if (targetType && targetId) {
      if (targetType === "group") {
        await supabase.from("file_attachments").insert({
          target_type: "group",
          target_id: targetId,
          uploaded_by: userId, // always the actual uploader
          file_name: driveRes.data.name || file.name,
          file_url: webViewLink,
          file_size: driveRes.data.size ? parseInt(driveRes.data.size) : file.size,
          file_type: "drive-link",
        });
      } else if (targetType === "project") {
        const mime = driveRes.data.mimeType || file.type || "";
        let resourceType = "drive";
        if (mime.includes("document") || mime.includes("word")) resourceType = "google_doc";
        else if (mime.includes("spreadsheet") || mime.includes("excel")) resourceType = "google_sheet";
        else if (mime.includes("presentation") || mime.includes("slide")) resourceType = "google_slide";

        await supabase.from("project_resources").insert({
          project_id: targetId,
          name: driveRes.data.name || file.name,
          url: webViewLink,
          type: resourceType,
          stage: stage || "evidence",
          uploaded_by: userId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      sharedFolder: !!sharedFolderId,
      file: {
        id: fileId,
        name: driveRes.data.name,
        mimeType: driveRes.data.mimeType,
        webViewLink,
        size: driveRes.data.size,
      },
    });

  } catch (err: any) {
    if (err.code === 403 || err.message?.includes("insufficient") || err.message?.includes("Insufficient Permission")) {
      return NextResponse.json({ error: "업로드 권한이 없습니다. 호스트가 Google 계정을 연결했는지 확인해주세요.", code: "SCOPE_INSUFFICIENT" }, { status: 403 });
    }
    if (err.message === "GOOGLE_NOT_CONNECTED") {
      return NextResponse.json({ error: "호스트의 Google 계정이 연결되지 않았습니다.", code: "NOT_CONNECTED" }, { status: 403 });
    }
    if (err.message === "GOOGLE_TOKEN_EXPIRED") {
      return NextResponse.json({ error: "Google 토큰이 만료되었습니다. 호스트가 다시 연결해주세요.", code: "TOKEN_EXPIRED" }, { status: 401 });
    }
    console.error("Drive upload error:", err);
    return NextResponse.json({ error: "파일 업로드 실패: " + err.message }, { status: 500 });
  }
}

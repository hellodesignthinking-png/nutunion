import { google } from "googleapis";
import { log } from "@/lib/observability/logger";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { createClient } from "@/lib/supabase/server";
import { Readable } from "stream";
import { getSharedFolderId, getDriveOwnerUserId } from "@/lib/google/drive-config";

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
  "audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac",
  "audio/wav", "audio/webm", "audio/ogg", "audio/flac",
];

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const fileUrl = formData.get("fileUrl") as string | null;
    const fileName = formData.get("fileName") as string | null;
    const mimeType = formData.get("mimeType") as string | null;
    const targetType = formData.get("targetType") as string | null; // "group" | "project"
    const targetId   = formData.get("targetId")   as string | null;
    const stage      = formData.get("stage")       as string | null;
    const requireSharedFolder = formData.get("requireSharedFolder") === "true";
    // Manual folderId override (advanced use)
    const folderId = formData.get("folderId") as string | null;

    let buffer: Buffer;
    let fileSizeBytes: number;
    let finalFileName = fileName || "upload_file";
    let finalFileType = mimeType || "application/octet-stream";

    if (file) {
      if (file.size > 50 * 1024 * 1024)
        return NextResponse.json({ error: "파일 크기는 50MB 이하여야 합니다" }, { status: 400 });
      finalFileType = file.type || finalFileType;
      finalFileName = file.name || finalFileName;
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      fileSizeBytes = file.size;
    } else if (fileUrl) {
      const resp = await fetch(fileUrl);
      if (!resp.ok) return NextResponse.json({ error: "URL 파일 다운로드 실패" }, { status: 400 });
      const arrayBuffer = await resp.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      fileSizeBytes = buffer.length;
    } else {
      return NextResponse.json({ error: "파일 또는 fileUrl이 필요합니다" }, { status: 400 });
    }

    const normalizedFileType = finalFileType.split(";")[0];
    if (normalizedFileType && !ALLOWED_TYPES.includes(normalizedFileType))
      return NextResponse.json({ error: "허용되지 않는 파일 형식입니다: " + normalizedFileType }, { status: 400 });

    const supabase = await createClient();

    // ── 1. Resolve shared folder & uploader identity ───────────
    // 단일 공유 폴더 모드: 모든 업로드를 환경변수의 폴더 ID로 라우팅하고,
    // owner user(있으면) 의 토큰으로 인증. legacy per-그룹/프로젝트 폴더 컬럼 무시.
    const envSharedFolderId = getSharedFolderId();
    const driveOwnerId = getDriveOwnerUserId();
    let uploaderUserId = userId;  // default: use current user's credentials
    let sharedFolderId: string | null = envSharedFolderId || folderId;

    // Membership verification only — folder/host resolution skipped in shared-folder mode.
    if (targetType === "group" && targetId) {
      // Check membership
      const { data: membership } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", targetId)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      // Fetch group — try with google_drive_folder_id and google_drive_url
      let group: {
        host_id: string;
        google_drive_folder_id?: string | null;
        google_drive_meetings_folder_id?: string | null;
        google_drive_resources_folder_id?: string | null;
        google_drive_url?: string | null;
      } | null = null;
      {
        const { data, error } = await supabase
          .from("groups")
          .select("host_id, google_drive_folder_id, google_drive_meetings_folder_id, google_drive_resources_folder_id, google_drive_url")
          .eq("id", targetId)
          .single();
        if (!error && data) {
          group = data;
        } else {
          const { data: fallback } = await supabase
            .from("groups")
            .select("host_id, google_drive_folder_id, google_drive_url")
            .eq("id", targetId)
            .single();
          if (fallback) {
            group = fallback;
          } else {
            const { data: minimal } = await supabase
              .from("groups")
              .select("host_id")
              .eq("id", targetId)
              .single();
            group = minimal;
          }
        }
      }

      if (!membership && group?.host_id !== userId) {
        return NextResponse.json({ error: "그룹 멤버만 파일을 업로드할 수 있습니다" }, { status: 403 });
      }

      // shared-folder 모드: 그룹 폴더 컬럼 무시. envSharedFolderId 가 있으면 항상 그것을 사용.
      if (!envSharedFolderId && group) {
        let extractedFromUrl = null;
        if (group.google_drive_url) {
          const parts = group.google_drive_url.split("/folders/");
          if (parts.length > 1) {
            extractedFromUrl = parts[1].split("?")[0].split("/")[0];
          }
        }

        const resolvedFolder =
          stage === "meeting"
            ? group.google_drive_meetings_folder_id || group.google_drive_folder_id || extractedFromUrl
            : stage === "resource"
              ? group.google_drive_resources_folder_id || group.google_drive_folder_id || extractedFromUrl
              : group.google_drive_folder_id || extractedFromUrl;

        if (resolvedFolder) {
          sharedFolderId = resolvedFolder;
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
      let project: { created_by: string; google_drive_folder_id?: string | null; google_drive_planning_folder_id?: string | null; google_drive_interim_folder_id?: string | null; google_drive_evidence_folder_id?: string | null; google_drive_final_folder_id?: string | null; google_drive_url?: string | null; } | null = null;
      {
        const { data, error } = await supabase
          .from("projects")
          .select("created_by, google_drive_folder_id, google_drive_planning_folder_id, google_drive_interim_folder_id, google_drive_evidence_folder_id, google_drive_final_folder_id, google_drive_url")
          .eq("id", targetId)
          .single();
        if (!error && data) {
          project = data;
        } else {
          const { data: fallback } = await supabase
            .from("projects")
            .select("created_by, google_drive_folder_id, google_drive_url")
            .eq("id", targetId)
            .single();
          if (fallback) {
            project = fallback;
          } else {
            const { data: minimal } = await supabase
              .from("projects")
              .select("created_by")
              .eq("id", targetId)
              .single();
            project = minimal;
          }
        }
      }
      if (!membership && project?.created_by !== userId) {
        return NextResponse.json({ error: "프로젝트 멤버만 파일을 업로드할 수 있습니다" }, { status: 403 });
      }

      if (!envSharedFolderId && project) {
        let extractedFromUrl = null;
        if (project.google_drive_url) {
          const parts = project.google_drive_url.split("/folders/");
          if (parts.length > 1) {
            extractedFromUrl = parts[1].split("?")[0].split("/")[0];
          }
        }

        const stageFolder =
          stage === "planning"  ? project.google_drive_planning_folder_id :
          stage === "interim"   ? project.google_drive_interim_folder_id :
          stage === "evidence"  ? project.google_drive_evidence_folder_id :
          stage === "final"     ? project.google_drive_final_folder_id :
          null;

        const resolvedFolder = stageFolder || project.google_drive_folder_id || extractedFromUrl || null;
        if (resolvedFolder) {
          sharedFolderId = resolvedFolder;
          uploaderUserId = project.created_by;
        }
      }
    }

    if (requireSharedFolder && !sharedFolderId) {
      return NextResponse.json(
        { error: "연결된 Google Drive 공유 폴더가 없습니다. 먼저 너트/볼트에 Drive 폴더를 설정해주세요.", code: "SHARED_FOLDER_REQUIRED" },
        { status: 400 }
      );
    }

    // ── 2. Get Google client — owner if set, else uploaderUserId ──
    const resolvedAuthUserId = driveOwnerId || uploaderUserId;
    const auth = await getGoogleClient(resolvedAuthUserId);
    const drive = google.drive({ version: "v3", auth });

    // ── 3. Upload to Drive ─────────────────────────────────────
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata: { name: string; parents?: string[] } = { name: finalFileName };
    if (sharedFolderId) fileMetadata.parents = [sharedFolderId];

    const driveRes = await drive.files.create({
      requestBody: fileMetadata,
      media: { mimeType: normalizedFileType || finalFileType, body: stream },
      fields: "id, name, mimeType, webViewLink, size",
      supportsAllDrives: true,
    });

    const fileId = driveRes.data.id!;
    const webViewLink = driveRes.data.webViewLink!;

    // ── 4. Set share permission (anyone with link = reader) ────
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch (permErr: unknown) {
    log.error(permErr, "google.drive.upload.failed");
      console.warn(
        "Permission setting skipped:",
        permErr instanceof Error ? permErr.message : "unknown error"
      );
    }

    // ── 5. Register in DB ──────────────────────────────────────
    if (targetType && targetId) {
      if (targetType === "group") {
        await supabase.from("file_attachments").insert({
          target_type: "group",
          target_id: targetId,
          uploaded_by: userId, // always the actual uploader
          file_name: driveRes.data.name || finalFileName,
          file_url: webViewLink,
          file_size: driveRes.data.size ? parseInt(driveRes.data.size) : fileSizeBytes,
          file_type: "drive-link",
        });
      } else if (targetType === "project") {
        const mime = driveRes.data.mimeType || finalFileType;
        let resourceType = "drive";
        if (mime.includes("document") || mime.includes("word")) resourceType = "google_doc";
        else if (mime.includes("spreadsheet") || mime.includes("excel")) resourceType = "google_sheet";
        else if (mime.includes("presentation") || mime.includes("slide")) resourceType = "google_slide";

        await supabase.from("project_resources").insert({
          project_id: targetId,
          name: driveRes.data.name || finalFileName,
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

  } catch (err: unknown) {
    log.error(err, "google.drive.upload.failed");
    const error = err instanceof Error ? err : new Error("알 수 없는 업로드 오류");
    const errorWithCode = error as Error & { code?: number };
    if (errorWithCode.code === 403 || error.message.includes("insufficient") || error.message.includes("Insufficient Permission")) {
      return NextResponse.json({ error: "업로드 권한이 없습니다. 호스트가 Google 계정을 연결했는지 확인해주세요.", code: "SCOPE_INSUFFICIENT" }, { status: 403 });
    }
    if (error.message === "GOOGLE_NOT_CONNECTED") {
      return NextResponse.json({ error: "호스트의 Google 계정이 연결되지 않았습니다.", code: "NOT_CONNECTED" }, { status: 403 });
    }
    if (error.message === "GOOGLE_TOKEN_EXPIRED") {
      return NextResponse.json({ error: "Google 토큰이 만료되었습니다. 호스트가 다시 연결해주세요.", code: "TOKEN_EXPIRED" }, { status: 401 });
    }
    console.error("Drive upload error:", error);
    return NextResponse.json({ error: "파일 업로드 실패: " + error.message }, { status: 500 });
  }
}

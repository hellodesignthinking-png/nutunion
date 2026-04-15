import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { createClient } from "@/lib/supabase/server";
import { Readable } from "stream";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folderId = formData.get("folderId") as string | null;
    // Optional: auto-register in DB
    const targetType = formData.get("targetType") as string | null; // "group" | "project"
    const targetId = formData.get("targetId") as string | null;
    const stage = formData.get("stage") as string | null;

    // Membership verification for group/project uploads
    if (targetType && targetId) {
      const supabase = await createClient();

      if (targetType === "group") {
        // Check if user is an active member or the host of the group
        const { data: membership } = await supabase
          .from("group_members")
          .select("id")
          .eq("group_id", targetId)
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();

        if (!membership) {
          const { data: group } = await supabase
            .from("groups")
            .select("host_id")
            .eq("id", targetId)
            .single();

          if (!group || group.host_id !== userId) {
            return NextResponse.json(
              { error: "그룹 멤버만 파일을 업로드할 수 있습니다" },
              { status: 403 }
            );
          }
        }
      } else if (targetType === "project") {
        // Check if user is a member of the project
        const { data: membership } = await supabase
          .from("project_members")
          .select("id")
          .eq("project_id", targetId)
          .eq("user_id", userId)
          .maybeSingle();

        if (!membership) {
          return NextResponse.json(
            { error: "프로젝트 멤버만 파일을 업로드할 수 있습니다" },
            { status: 403 }
          );
        }
      }
    }

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
    }

    // File size limit (50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "파일 크기는 50MB 이하여야 합니다" }, { status: 400 });
    }

    // MIME type whitelist
    const ALLOWED_TYPES = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.google-apps.document",
      "application/vnd.google-apps.spreadsheet",
      "application/vnd.google-apps.presentation",
      "text/plain",
      "text/csv",
      "text/markdown",
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "video/mp4",
      "video/webm",
      "audio/mpeg",
      "audio/wav",
    ];
    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "허용되지 않는 파일 형식입니다" }, { status: 400 });
    }

    const auth = await getGoogleClient(userId);
    const drive = google.drive({ version: "v3", auth });

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata: any = { name: file.name };
    if (folderId) {
      fileMetadata.parents = [folderId];
    }

    // Upload to Google Drive
    const driveRes = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType: file.type || "application/octet-stream",
        body: stream,
      },
      fields: "id, name, mimeType, webViewLink, size",
    });

    const fileId = driveRes.data.id!;
    const webViewLink = driveRes.data.webViewLink!;

    // Set "anyone with link can view" permission
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch (permErr: any) {
      // If scope insufficient (drive.file doesn't support permissions.create on some accounts)
      // Log but don't fail — file is still uploaded
      console.warn("Permission setting skipped:", permErr.message);
    }

    // Auto-register in DB if targetType + targetId provided
    if (targetType && targetId) {
      const supabase = await createClient();

      if (targetType === "group") {
        await supabase.from("file_attachments").insert({
          target_type: "group",
          target_id: targetId,
          uploaded_by: userId,
          file_name: driveRes.data.name || file.name,
          file_url: webViewLink,
          file_size: driveRes.data.size ? parseInt(driveRes.data.size) : file.size,
          file_type: "drive-link",
        });
      } else if (targetType === "project") {
        // Detect resource type from mimeType
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
      file: {
        id: fileId,
        name: driveRes.data.name,
        mimeType: driveRes.data.mimeType,
        webViewLink,
        size: driveRes.data.size,
      },
    });
  } catch (err: any) {
    // Scope insufficient — user needs to re-authenticate with broader scope
    if (
      err.code === 403 ||
      err.message?.includes("insufficient") ||
      err.message?.includes("Insufficient Permission")
    ) {
      return NextResponse.json(
        {
          error: "업로드 권한이 없습니다. Google 계정을 다시 연결해주세요.",
          code: "SCOPE_INSUFFICIENT",
        },
        { status: 403 }
      );
    }
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
    console.error("Drive upload error:", err);
    return NextResponse.json(
      { error: "파일 업로드 실패" },
      { status: 500 }
    );
  }
}

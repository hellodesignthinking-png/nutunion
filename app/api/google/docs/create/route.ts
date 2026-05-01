import { google } from "googleapis";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { createClient } from "@/lib/supabase/server";
import { Readable } from "stream";
import { asGoogleErr } from "@/lib/google/error-helpers";
import { getSharedFolderId, getDriveOwnerUserId } from "@/lib/google/drive-config";

/**
 * POST /api/google/docs/create
 * Creates a Google Doc with meeting notes content and archives it to Drive.
 * Optionally registers the doc in group file_attachments or project_resources.
 */
export const POST = withRouteLog("google.docs.create", async (req: NextRequest) => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, content, folderId, targetType, targetId, meetingId } = body;

    if (!title) {
      return NextResponse.json(
        { error: "제목이 필요합니다" },
        { status: 400 }
      );
    }

    // Membership verification when targetType is provided
    if (targetType && targetId) {
      const supabase = await createClient();

      if (targetType === "group") {
        const { data: membership } = await supabase
          .from("group_members")
          .select("id")
          .eq("group_id", targetId)
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();

        if (!membership) {
          // Check if user is the host of the group
          const { data: group } = await supabase
            .from("groups")
            .select("host_id")
            .eq("id", targetId)
            .single();

          if (!group || group.host_id !== userId) {
            return NextResponse.json(
              { error: "그룹 멤버만 문서를 생성할 수 있습니다" },
              { status: 403 }
            );
          }
        }
      } else if (targetType === "project") {
        const { data: membership } = await supabase
          .from("project_members")
          .select("id")
          .eq("project_id", targetId)
          .eq("user_id", userId)
          .maybeSingle();

        if (!membership) {
          return NextResponse.json(
            { error: "프로젝트 멤버만 문서를 생성할 수 있습니다" },
            { status: 403 }
          );
        }
      }
    }

    const driveOwnerId = getDriveOwnerUserId();
    const auth = await getGoogleClient(driveOwnerId || userId);
    const drive = google.drive({ version: "v3", auth });

    // Create Google Doc via Drive API (drive.file scope covers this)
    const docContent = content || "";
    // Convert markdown-ish content to plain text for the doc
    const plainContent = docContent
      .replace(/^#+\s*/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1");

    // 단일 공유 폴더 모드: 항상 공유 폴더에 저장. 없으면 호출자가 보낸 folderId 사용.
    const sharedFolderId = getSharedFolderId();
    const parents = sharedFolderId ? [sharedFolderId] : (folderId ? [folderId] : undefined);
    const buffer = Buffer.from(plainContent, "utf-8");
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const driveRes = await drive.files.create({
      requestBody: {
        name: title,
        mimeType: "application/vnd.google-apps.document",
        ...(parents && { parents }),
      },
      media: {
        mimeType: "text/plain",
        body: stream,
      },
      fields: "id, name, mimeType, webViewLink, size",
      supportsAllDrives: true,
    });

    const fileId = driveRes.data.id!;
    const webViewLink = driveRes.data.webViewLink!;

    // Set "anyone with link can view" permission
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch (permErr: unknown) {
    log.error(permErr, "google.docs.create.failed");
      console.warn("Permission setting skipped:", asGoogleErr(permErr).message);
    }

    // Auto-register in DB
    if (targetType && targetId) {
      const supabase = await createClient();

      if (targetType === "group") {
        await supabase.from("file_attachments").insert({
          target_type: "group",
          target_id: targetId,
          uploaded_by: userId,
          file_name: title,
          file_url: webViewLink,
          file_size: buffer.length,
          file_type: "drive-link",
        });
      } else if (targetType === "project") {
        await supabase.from("project_resources").insert({
          project_id: targetId,
          name: title,
          url: webViewLink,
          type: "google_doc",
          stage: "evidence",
          uploaded_by: userId,
        });
      }

      // Try to update the meeting record with the doc link (column added in migration 105)
      if (meetingId) {
        try {
          const { error: meetUpdateErr } = await supabase
            .from("meetings")
            .update({ google_doc_url: webViewLink, google_doc_id: fileId } as any)
            .eq("id", meetingId);
          if (meetUpdateErr) {
            console.warn(
              `[docs/create] meetings.google_doc_url update failed (meetingId=${meetingId}):`,
              meetUpdateErr.message,
            );
          }
        } catch (metaErr) {
    log.error(metaErr, "google.docs.create.failed");
          console.warn(
            `[docs/create] meetings.google_doc_url update threw (meetingId=${meetingId}):`,
            (metaErr as Error)?.message,
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      documentId: fileId,
      webViewLink,
      title: driveRes.data.name,
    });
  } catch (err: unknown) {
    log.error(err, "google.docs.create.failed");
    const e = asGoogleErr(err);
    if (
      e.code === 403 ||
      e.message?.includes("insufficient") ||
      e.message?.includes("Insufficient Permission")
    ) {
      return NextResponse.json(
        {
          error: "Google Docs 생성 권한이 없습니다. Google 계정을 다시 연결해주세요.",
          code: "SCOPE_INSUFFICIENT",
        },
        { status: 403 }
      );
    }
    if (e.message === "GOOGLE_NOT_CONNECTED") {
      return NextResponse.json(
        { error: "Google 계정이 연결되지 않았습니다.", code: "NOT_CONNECTED" },
        { status: 403 }
      );
    }
    if (e.message === "GOOGLE_TOKEN_EXPIRED") {
      return NextResponse.json(
        { error: "Google 토큰이 만료되었습니다. 다시 연결해주세요.", code: "TOKEN_EXPIRED" },
        { status: 401 }
      );
    }
    console.error("Google Docs create error:", err);
    return NextResponse.json(
      { error: "Google Docs 생성 실패" },
      { status: 500 }
    );
  }
});

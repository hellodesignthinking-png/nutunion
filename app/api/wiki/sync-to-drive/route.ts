// [Phase 3b] Deprecated auto-sync.
// Wiki content is canonical on DB/R2. This route is kept for manual export to a
// user's personal Drive (explicit button click only — never auto-called).
import { google } from "googleapis";
import { log } from "@/lib/observability/logger";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { createClient } from "@/lib/supabase/server";
import { Readable } from "stream";
import { getSharedFolderId, getDriveOwnerUserId } from "@/lib/google/drive-config";

/**
 * POST /api/wiki/sync-to-drive
 * Syncs a wiki page to Google Docs in the group's Drive wiki folder.
 * If the page already has a google_doc_id, updates it. Otherwise creates new.
 *
 * [Phase 3b] Opt-in manual export only. Do not call automatically.
 */
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const { pageId, groupId, title, content } = await req.json();

    if (!groupId || !title || !content) {
      return NextResponse.json({ error: "필수 정보가 부족합니다" }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify user is a member or host of the group
    const [{ data: membership }, { data: groupHost }] = await Promise.all([
      supabase
        .from("group_members")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("groups")
        .select("host_id")
        .eq("id", groupId)
        .single(),
    ]);

    const isHost = groupHost?.host_id === userId;
    const isMember = !!membership;

    if (!isHost && !isMember) {
      return NextResponse.json(
        { error: "이 그룹의 멤버만 위키를 동기화할 수 있습니다" },
        { status: 403 }
      );
    }

    const driveOwnerId = getDriveOwnerUserId();
    const auth = await getGoogleClient(driveOwnerId || userId);
    const drive = google.drive({ version: "v3", auth });

    // 단일 공유 폴더 모드: env 의 폴더 ID 항상 사용. 없으면 legacy fallback.
    const envSharedFolderId = getSharedFolderId();
    const { data: group } = await supabase
      .from("groups")
      .select("google_drive_wiki_folder_id, google_drive_folder_id, name")
      .eq("id", groupId)
      .single();

    type GroupRow = { name?: string; google_drive_wiki_folder_id?: string; google_drive_folder_id?: string };
    const g = group as GroupRow | null;
    const parentFolderId =
      envSharedFolderId ||
      g?.google_drive_wiki_folder_id ||
      g?.google_drive_folder_id ||
      null;

    // Check if this wiki page already has a Google Doc
    let existingDocId: string | null = null;
    if (pageId) {
      const { data: page } = await supabase
        .from("wiki_pages")
        .select("google_doc_id")
        .eq("id", pageId)
        .single();
      existingDocId = (page as { google_doc_id?: string } | null)?.google_doc_id || null;
    }

    // Format content: add header with metadata
    const formattedContent = `${title}\n${"=".repeat(title.length)}\n\n너트: ${group?.name || ""}\n최종 수정: ${new Date().toLocaleDateString("ko")}\n\n---\n\n${content}`;

    const buffer = Buffer.from(formattedContent, "utf-8");
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    let fileId: string;
    let webViewLink: string;

    if (existingDocId) {
      // Update existing Google Doc content
      const updateStream = new Readable();
      updateStream.push(buffer);
      updateStream.push(null);

      await drive.files.update({
        fileId: existingDocId,
        media: {
          mimeType: "text/plain",
          body: updateStream,
        },
        supportsAllDrives: true,
      });

      const fileRes = await drive.files.get({
        fileId: existingDocId,
        fields: "id, webViewLink",
        supportsAllDrives: true,
      });

      fileId = existingDocId;
      webViewLink = fileRes.data.webViewLink!;
    } else {
      // Create new Google Doc
      const fileMetadata: { name: string; mimeType: string; parents?: string[] } = {
        name: `[탭] ${title}`,
        mimeType: "application/vnd.google-apps.document",
      };
      if (parentFolderId) {
        fileMetadata.parents = [parentFolderId];
      }

      const driveRes = await drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType: "text/plain",
          body: stream,
        },
        fields: "id, name, webViewLink",
        supportsAllDrives: true,
      });

      fileId = driveRes.data.id!;
      webViewLink = driveRes.data.webViewLink!;

      // Set "anyone with link can view"
      try {
        await drive.permissions.create({
          fileId,
          requestBody: { role: "reader", type: "anyone" },
        });
      } catch {
        // Non-critical
      }
    }

    // Save google_doc_id to wiki_pages (column may not exist yet -- use upsert pattern)
    if (pageId) {
      try {
        await supabase
          .from("wiki_pages")
          .update({ google_doc_id: fileId, google_doc_url: webViewLink } as any)
          .eq("id", pageId);
      } catch {
        // Columns may not exist yet -- silently fail
      }
    }

    // Also register as file_attachment for the resources page
    if (!existingDocId) {
      await supabase.from("file_attachments").insert({
        target_type: "group",
        target_id: groupId,
        uploaded_by: userId,
        file_name: `[탭] ${title}`,
        file_url: webViewLink,
        file_size: buffer.length,
        file_type: "drive-link",
      });
    }

    return NextResponse.json({
      success: true,
      documentId: fileId,
      webViewLink,
      isUpdate: !!existingDocId,
    });
  } catch (err: unknown) {
    log.error(err, "wiki.sync-to-drive.failed");
    const errObj = err as { message?: string; code?: number; response?: { data?: { error?: { message?: string; code?: number } } } };
    if (errObj.message === "GOOGLE_NOT_CONNECTED") {
      return NextResponse.json(
        { error: "Google 계정이 연결되지 않았습니다. 설정에서 연결해주세요.", code: "NOT_CONNECTED" },
        { status: 403 }
      );
    }
    if (errObj.message === "GOOGLE_TOKEN_EXPIRED") {
      return NextResponse.json(
        { error: "Google 토큰이 만료되었습니다.", code: "TOKEN_EXPIRED" },
        { status: 401 }
      );
    }
    console.error("Wiki sync to Drive error:", err);
    return NextResponse.json(
      { error: "Google Docs 동기화 실패: " + (errObj.message || "알 수 없는 오류") },
      { status: 500 }
    );
  }
}

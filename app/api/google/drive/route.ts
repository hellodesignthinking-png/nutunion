import { google } from "googleapis";
import { log } from "@/lib/observability/logger";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { asGoogleErr } from "@/lib/google/error-helpers";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const auth = await getGoogleClient(userId);
    const drive = google.drive({ version: "v3", auth });

    const fileId = req.nextUrl.searchParams.get("fileId");

    // Single file lookup
    if (fileId) {
      const fileRes = await drive.files.get({
        fileId,
        fields: "id, name, mimeType, webViewLink, iconLink, thumbnailLink, modifiedTime, size, parents",
      });
      return NextResponse.json({ file: fileRes.data });
    }

    const q = req.nextUrl.searchParams.get("q") || "";
    const folderId = req.nextUrl.searchParams.get("folderId");
    const pageToken = req.nextUrl.searchParams.get("pageToken") || undefined;

    // Escape user input to prevent query injection
    const escQ = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

    // Build query
    let query = "trashed = false";
    if (folderId) {
      query = `'${escQ(folderId)}' in parents and trashed = false`;
    } else if (q) {
      query = `name contains '${escQ(q)}' and trashed = false`;
    }

    const res = await drive.files.list({
      pageSize: 30,
      q: query,
      pageToken,
      fields:
        "nextPageToken, files(id, name, mimeType, webViewLink, iconLink, thumbnailLink, modifiedTime, size, parents, owners(displayName))",
      orderBy: "modifiedTime desc",
    });

    return NextResponse.json({
      files: res.data.files || [],
      nextPageToken: res.data.nextPageToken || null,
    });
  } catch (err: unknown) {
    log.error(err, "google.drive.failed");
    const e = asGoogleErr(err);
    if (e.message === "GOOGLE_NOT_CONNECTED") {
      return NextResponse.json({ error: "Google 계정이 연결되지 않았습니다.", code: "NOT_CONNECTED" }, { status: 403 });
    }
    if (e.message === "GOOGLE_TOKEN_EXPIRED") {
      return NextResponse.json({ error: "Google 토큰이 만료되었습니다. 다시 연결해주세요.", code: "TOKEN_EXPIRED" }, { status: 401 });
    }
    console.error("Drive API error:", err);
    return NextResponse.json({ error: "Drive API 오류" }, { status: 500 });
  }
}

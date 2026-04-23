// [Phase 4] GET /api/google/drive/list
// Returns the user's 15 most-recent Drive files so the browser can pick one
// for import into R2 (see drive-import-button.tsx + import-to-r2 route).

import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { log } from "@/lib/observability/logger";

export async function GET() {
  const span = log.span("drive.list");
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const auth = await getGoogleClient(userId);
    const drive = google.drive({ version: "v3", auth });

    const res = await drive.files.list({
      pageSize: 15,
      orderBy: "modifiedTime desc",
      q: "trashed=false",
      fields:
        "files(id, name, mimeType, modifiedTime, size, webViewLink, thumbnailLink, iconLink)",
    });

    const files = (res.data.files || []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
      size: f.size ? Number(f.size) : null,
      webViewLink: f.webViewLink,
      thumbnailLink: f.thumbnailLink || f.iconLink || null,
    }));

    span.end({ count: files.length });
    return NextResponse.json({ files });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "GOOGLE_NOT_CONNECTED") {
      span.end({ status: 401, reason: "not_connected" });
      return NextResponse.json(
        { error: "Google 계정이 연결되지 않았습니다", code: "GOOGLE_NOT_CONNECTED" },
        { status: 401 },
      );
    }
    if (msg === "GOOGLE_TOKEN_EXPIRED") {
      span.end({ status: 401, reason: "token_expired" });
      return NextResponse.json(
        { error: "Google 토큰이 만료되었습니다", code: "GOOGLE_TOKEN_EXPIRED" },
        { status: 401 },
      );
    }
    span.fail(err);
    log.error(err, "drive.list.failed", { userId });
    return NextResponse.json({ error: "Drive 목록 조회 실패: " + msg }, { status: 500 });
  }
}

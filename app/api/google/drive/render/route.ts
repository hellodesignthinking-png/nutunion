import { google } from "googleapis";
import { log } from "@/lib/observability/logger";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";

import { asGoogleErr } from "@/lib/google/error-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return new NextResponse("Unauthorized. Please log in.", { status: 401 });
  }

  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!fileId) {
    return new NextResponse("Missing fileId", { status: 400 });
  }

  try {
    const auth = await getGoogleClient(userId);
    const drive = google.drive({ version: "v3", auth });

    // Download the file content
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    const data = Buffer.from(res.data as ArrayBuffer);

    // Return the HTML with sandbox headers to prevent XSS (forces unique origin)
    return new NextResponse(data, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "sandbox allow-scripts;",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: unknown) {
    log.error(err, "google.drive.render.failed");
    const e = asGoogleErr(err);
    console.error("Drive render error:", err);
    return new NextResponse(
      "Failed to load the HTML file from Google Drive. Please ensure the file is accessible.",
      { status: 500 }
    );
  }
}

import { google } from "googleapis";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";

import { asGoogleErr } from "@/lib/google/error-helpers";

export const GET = withRouteLog("google.docs", async (req: NextRequest) => {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const docId = req.nextUrl.searchParams.get("docId");
  if (!docId) return NextResponse.json({ error: "docId 파라미터가 필요합니다." }, { status: 400 });

  try {
    const auth = await getGoogleClient(userId);
    const docs = google.docs({ version: "v1", auth });

    const doc = await docs.documents.get({ documentId: docId });

    // Extract text content from document body
    const content =
      doc.data.body?.content
        ?.map((block) => {
          if (block.paragraph?.elements) {
            return block.paragraph.elements
              .map((el) => el.textRun?.content || "")
              .join("");
          }
          if (block.table) {
            return block.table.tableRows
              ?.map((row) =>
                row.tableCells
                  ?.map((cell) =>
                    cell.content
                      ?.map((c) =>
                        c.paragraph?.elements
                          ?.map((el) => el.textRun?.content || "")
                          .join("") || ""
                      )
                      .join("")
                  )
                  .join(" | ")
              )
              .join("\n") || "";
          }
          return "";
        })
        .join("") || "";

    return NextResponse.json({
      documentId: doc.data.documentId,
      title: doc.data.title,
      content,
      revisionId: doc.data.revisionId,
    });
  } catch (err: unknown) {
    log.error(err, "google.docs.failed");
    const e = asGoogleErr(err);
    if (e.message === "GOOGLE_NOT_CONNECTED") {
      return NextResponse.json({ error: "Google 계정이 연결되지 않았습니다.", code: "NOT_CONNECTED" }, { status: 403 });
    }
    console.error("Docs API error:", err);
    return NextResponse.json({ error: "Docs API 오류" }, { status: 500 });
  }
});

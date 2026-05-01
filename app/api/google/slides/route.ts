import { google } from "googleapis";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";

import { asGoogleErr } from "@/lib/google/error-helpers";

export const GET = withRouteLog("google.slides", async (req: NextRequest) => {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const presentationId = req.nextUrl.searchParams.get("presentationId");
  if (!presentationId)
    return NextResponse.json({ error: "presentationId 파라미터가 필요합니다." }, { status: 400 });

  try {
    const auth = await getGoogleClient(userId);
    const slides = google.slides({ version: "v1", auth });

    const presentation = await slides.presentations.get({ presentationId });

    // Extract text from each slide
    const slidesSummary = (presentation.data.slides || []).map(
      (slide, idx) => {
        const texts: string[] = [];
        (slide.pageElements || []).forEach((el) => {
          if (el.shape?.text?.textElements) {
            el.shape.text.textElements.forEach((te) => {
              if (te.textRun?.content?.trim()) {
                texts.push(te.textRun.content.trim());
              }
            });
          }
          // Also check tables in slides
          if (el.table?.tableRows) {
            el.table.tableRows.forEach((row) => {
              row.tableCells?.forEach((cell) => {
                cell.text?.textElements?.forEach((te) => {
                  if (te.textRun?.content?.trim()) {
                    texts.push(te.textRun.content.trim());
                  }
                });
              });
            });
          }
        });
        return {
          slideNumber: idx + 1,
          objectId: slide.objectId,
          texts,
        };
      }
    );

    return NextResponse.json({
      presentationId: presentation.data.presentationId,
      title: presentation.data.title,
      totalSlides: presentation.data.slides?.length || 0,
      slides: slidesSummary,
      embedUrl: `https://docs.google.com/presentation/d/${presentationId}/embed`,
      viewUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
    });
  } catch (err: unknown) {
    log.error(err, "google.slides.failed");
    const e = asGoogleErr(err);
    if (e.message === "GOOGLE_NOT_CONNECTED") {
      return NextResponse.json({ error: "Google 계정이 연결되지 않았습니다.", code: "NOT_CONNECTED" }, { status: 403 });
    }
    console.error("Slides API error:", err);
    return NextResponse.json({ error: "Slides API 오류" }, { status: 500 });
  }
});

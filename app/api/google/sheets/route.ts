import { google } from "googleapis";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";

import { asGoogleErr } from "@/lib/google/error-helpers";

export const GET = withRouteLog("google.sheets", async (req: NextRequest) => {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sheetId = req.nextUrl.searchParams.get("sheetId");
  if (!sheetId) return NextResponse.json({ error: "sheetId 파라미터가 필요합니다." }, { status: 400 });

  const rangeParam = req.nextUrl.searchParams.get("range"); // optional

  try {
    const auth = await getGoogleClient(userId);
    const sheets = google.sheets({ version: "v4", auth });

    // 1. Get spreadsheet metadata (sheet names)
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const sheetNames =
      meta.data.sheets?.map((s) => s.properties?.title || "Sheet") || [];

    // 2. Determine range: use param, or auto-detect first sheet name
    const range = rangeParam || `'${sheetNames[0]}'!A1:Z100`;

    // 3. Get data
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    const rows = res.data.values || [];
    const headers = rows[0] || [];
    const data = rows.slice(1).map((row) =>
      Object.fromEntries(
        headers.map((h: string, i: number) => [h, row[i] || ""])
      )
    );

    return NextResponse.json({
      title: meta.data.properties?.title,
      sheetNames,
      headers,
      data,
      totalRows: data.length,
    });
  } catch (err: unknown) {
    log.error(err, "google.sheets.failed");
    const e = asGoogleErr(err);
    if (e.message === "GOOGLE_NOT_CONNECTED") {
      return NextResponse.json({ error: "Google 계정이 연결되지 않았습니다.", code: "NOT_CONNECTED" }, { status: 403 });
    }
    const detail = e?.errors?.[0]?.message || e?.message || "Unknown error";
    console.error("Sheets API error:", detail);
    return NextResponse.json({ error: "Sheets API 오류" }, { status: 500 });
  }
});

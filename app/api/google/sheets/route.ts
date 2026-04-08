import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sheetId = req.nextUrl.searchParams.get("sheetId");
  if (!sheetId) return NextResponse.json({ error: "sheetId 파라미터가 필요합니다." }, { status: 400 });

  const range = req.nextUrl.searchParams.get("range") || "Sheet1!A1:Z100";

  try {
    const auth = await getGoogleClient(userId);
    const sheets = google.sheets({ version: "v4", auth });

    // Get spreadsheet metadata (sheet names)
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const sheetNames =
      meta.data.sheets?.map((s) => s.properties?.title || "Sheet") || [];

    // Get data
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
  } catch (err: any) {
    if (err.message === "GOOGLE_NOT_CONNECTED") {
      return NextResponse.json({ error: "Google 계정이 연결되지 않았습니다.", code: "NOT_CONNECTED" }, { status: 403 });
    }
    console.error("Sheets API error:", err);
    return NextResponse.json({ error: "Sheets API 오류" }, { status: 500 });
  }
}

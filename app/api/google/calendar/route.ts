import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";

// GET: 일정 목록 조회
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const auth = await getGoogleClient(userId);
    const calendar = google.calendar({ version: "v3", auth });

    const daysAhead = parseInt(req.nextUrl.searchParams.get("lookahead") || req.nextUrl.searchParams.get("days") || "30") || 30;
    const lookback = parseInt(req.nextUrl.searchParams.get("lookback") || "0") || 0;
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - lookback);
    const future = new Date(now);
    future.setDate(now.getDate() + daysAhead);

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: start.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });

    const events = (res.data.items || []).map((e) => ({
      id: e.id,
      summary: e.summary,
      description: e.description,
      location: e.location,
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      htmlLink: e.htmlLink,
      attendees: e.attendees?.map((a) => ({
        email: a.email,
        displayName: a.displayName,
        responseStatus: a.responseStatus,
      })),
    }));

    return NextResponse.json({ events, totalEvents: events.length });
  } catch (err: any) {
    if (err.message === "GOOGLE_NOT_CONNECTED") {
      return NextResponse.json({ error: "Google 계정이 연결되지 않았습니다.", code: "NOT_CONNECTED" }, { status: 403 });
    }
    console.error("Calendar API error:", err);
    return NextResponse.json({ error: "Calendar API 오류" }, { status: 500 });
  }
}

// POST: 새 일정 생성
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, description, location, startTime, endTime, attendees } = body;

    if (!title || !startTime || !endTime) {
      return NextResponse.json(
        { error: "title, startTime, endTime은 필수입니다." },
        { status: 400 }
      );
    }

    const auth = await getGoogleClient(userId);
    const calendar = google.calendar({ version: "v3", auth });

    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: title,
        description: description || "",
        location: location || "",
        start: { dateTime: startTime, timeZone: "Asia/Seoul" },
        end: { dateTime: endTime, timeZone: "Asia/Seoul" },
        attendees: attendees?.map((email: string) => ({ email })) || [],
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: 30 }],
        },
      },
    });

    return NextResponse.json({
      id: event.data.id,
      summary: event.data.summary,
      htmlLink: event.data.htmlLink,
      start: event.data.start,
      end: event.data.end,
    });
  } catch (err: any) {
    if (err.message === "GOOGLE_NOT_CONNECTED") {
      return NextResponse.json({ error: "Google 계정이 연결되지 않았습니다.", code: "NOT_CONNECTED" }, { status: 403 });
    }
    console.error("Calendar create error:", err);
    return NextResponse.json({ error: "Calendar 일정 생성 오류" }, { status: 500 });
  }
}

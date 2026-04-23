import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { asGoogleErr } from "@/lib/google/error-helpers";

export const dynamic = "force-dynamic";

// 간단 in-memory cache (5-min TTL per user per range)
type CacheEntry = { ts: number; data: unknown };
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

/**
 * GET /api/personal/google-calendar?since=ISO&until=ISO
 * Returns normalized events for unified calendar
 */
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const until = url.searchParams.get("until");
  if (!since || !until) {
    return NextResponse.json({ error: "since & until required" }, { status: 400 });
  }

  const cacheKey = `${userId}:${since}:${until}`;
  const now = Date.now();
  const cached = CACHE.get(cacheKey);
  if (cached && now - cached.ts < TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const auth = await getGoogleClient(userId);
    const calendar = google.calendar({ version: "v3", auth });

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: since,
      timeMax: until,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });

    const events = (res.data.items || []).map((e) => ({
      id: e.id,
      title: e.summary || "(제목 없음)",
      start_at: e.start?.dateTime || e.start?.date,
      end_at: e.end?.dateTime || e.end?.date,
      location: e.location || null,
      source: "google_calendar" as const,
      html_link: e.htmlLink || null,
      all_day: !!e.start?.date && !e.start?.dateTime,
    }));

    const payload = { events };
    CACHE.set(cacheKey, { ts: now, data: payload });
    // cleanup old
    if (CACHE.size > 500) {
      const cutoff = now - TTL_MS;
      for (const [k, v] of CACHE.entries()) if (v.ts < cutoff) CACHE.delete(k);
    }
    return NextResponse.json(payload);
  } catch (err: unknown) {
    const e = asGoogleErr(err);
    if (e.message === "GOOGLE_NOT_CONNECTED" || e.message === "GOOGLE_TOKEN_EXPIRED") {
      return NextResponse.json({ events: [], not_connected: true });
    }
    console.error("[personal/google-calendar] error:", err);
    return NextResponse.json({ events: [], error: "google_calendar_error" }, { status: 200 });
  }
}

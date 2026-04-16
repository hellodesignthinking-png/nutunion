import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleClient } from "@/lib/google/auth";
import { google } from "googleapis";

export interface UnifiedEvent {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start: string; // ISO string
  end: string;   // ISO string
  source: "google" | "meeting" | "project_meeting" | "milestone";
  sourceLabel?: string; // e.g. group name
  sourceId?: string; // group_id or project_id
  htmlLink?: string | null;
  color?: string;  // CSS color for display
  status?: string;
  attendees?: { email: string; responseStatus: string }[];
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lookback = parseInt(req.nextUrl.searchParams.get("lookback") || "60");
  const lookahead = parseInt(req.nextUrl.searchParams.get("lookahead") || "90");
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(now.getDate() - lookback);
  const timeMax = new Date(now);
  timeMax.setDate(now.getDate() + lookahead);

  const allEvents: UnifiedEvent[] = [];
  let googleConnected = false;

  // ── 1. Google Calendar events ────────────────────────────────────
  try {
    const auth = await getGoogleClient(user.id);
    const cal = google.calendar({ version: "v3", auth });
    const res = await cal.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });
    googleConnected = true;
    for (const e of res.data.items || []) {
      const startStr = e.start?.dateTime || e.start?.date || "";
      const endStr = e.end?.dateTime || e.end?.date || startStr;
      allEvents.push({
        id: `google:${e.id}`,
        title: e.summary || "(제목 없음)",
        description: e.description,
        location: e.location,
        start: startStr,
        end: endStr,
        source: "google",
        sourceLabel: "Google 캘린더",
        htmlLink: e.htmlLink,
        color: "#4F46E5",
        status: e.status || undefined,
        attendees: e.attendees?.map((a) => ({
          email: a.email || "",
          responseStatus: a.responseStatus || "accepted",
        })),
      });
    }
  } catch {
    // Google not connected — silently skip
    googleConnected = false;
  }

  // ── 2. Nutunion group meetings ────────────────────────────────────
  try {
    // Get user's active group memberships
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    const groupIds = (memberships || []).map((m: any) => m.group_id);

    // Also include groups where user is host
    const { data: hostedGroups } = await supabase
      .from("groups")
      .select("id, name")
      .eq("host_id", user.id);
    const hostedIds = (hostedGroups || []).map((g: any) => g.id);

    const allGroupIds = [...new Set([...groupIds, ...hostedIds])];

    if (allGroupIds.length > 0) {
      // Get group names for labels
      const { data: groups } = await supabase
        .from("groups")
        .select("id, name")
        .in("id", allGroupIds);
      const groupNameMap: Record<string, string> = {};
      for (const g of groups || []) groupNameMap[g.id] = g.name;

      // Fetch meetings
      const { data: meetings } = await supabase
        .from("meetings")
        .select("id, group_id, title, description, scheduled_at, duration_min, location, status")
        .in("group_id", allGroupIds)
        .neq("status", "cancelled")
        .gte("scheduled_at", timeMin.toISOString())
        .lte("scheduled_at", timeMax.toISOString())
        .order("scheduled_at", { ascending: true });

      for (const m of meetings || []) {
        const start = new Date(m.scheduled_at);
        const end = new Date(start.getTime() + (m.duration_min || 60) * 60_000);
        allEvents.push({
          id: `meeting:${m.id}`,
          title: m.title,
          description: m.description,
          location: m.location,
          start: start.toISOString(),
          end: end.toISOString(),
          source: "meeting",
          sourceLabel: groupNameMap[m.group_id] || "너트",
          sourceId: m.group_id,
          htmlLink: `/groups/${m.group_id}/meetings/${m.id}`,
          color: "#EC4899",
          status: m.status,
        });
      }
    }
  } catch (err) {
    console.error("Group meetings fetch error:", err);
  }

  // ── 3. Project meetings ───────────────────────────────────────────
  try {
    const { data: projectMembers } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", user.id);

    const { data: createdProjects } = await supabase
      .from("projects")
      .select("id, title")
      .eq("created_by", user.id);

    const projectMemberIds = (projectMembers || []).map((p: any) => p.project_id);
    const createdProjectIds = (createdProjects || []).map((p: any) => p.id);
    const allProjectIds = [...new Set([...projectMemberIds, ...createdProjectIds])];

    if (allProjectIds.length > 0) {
      const { data: projects } = await supabase
        .from("projects")
        .select("id, title")
        .in("id", allProjectIds);
      const projectNameMap: Record<string, string> = {};
      for (const p of projects || []) projectNameMap[p.id] = p.title;

      // Project meetings (if project_meetings table exists)
      try {
        const { data: projectMeetings } = await supabase
          .from("project_meetings")
          .select("id, project_id, title, description, scheduled_at, duration_min, location, status")
          .in("project_id", allProjectIds)
          .neq("status", "cancelled")
          .gte("scheduled_at", timeMin.toISOString())
          .lte("scheduled_at", timeMax.toISOString())
          .order("scheduled_at", { ascending: true });

        for (const m of projectMeetings || []) {
          const start = new Date(m.scheduled_at);
          const end = new Date(start.getTime() + (m.duration_min || 60) * 60_000);
          allEvents.push({
            id: `project_meeting:${m.id}`,
            title: m.title,
            description: m.description,
            location: m.location,
            start: start.toISOString(),
            end: end.toISOString(),
            source: "project_meeting",
            sourceLabel: projectNameMap[m.project_id] || "볼트",
            sourceId: m.project_id,
            htmlLink: `/projects/${m.project_id}`,
            color: "#F59E0B",
            status: m.status,
          });
        }
      } catch {
        // project_meetings table may not exist
      }

      // Project milestones with due dates
      try {
        const { data: milestones } = await supabase
          .from("project_milestones")
          .select("id, project_id, title, description, due_date, status")
          .in("project_id", allProjectIds)
          .not("due_date", "is", null)
          .neq("status", "cancelled")
          .gte("due_date", timeMin.toISOString().split("T")[0])
          .lte("due_date", timeMax.toISOString().split("T")[0])
          .order("due_date", { ascending: true });

        for (const ms of milestones || []) {
          const start = new Date(ms.due_date + "T09:00:00");
          const end = new Date(ms.due_date + "T10:00:00");
          allEvents.push({
            id: `milestone:${ms.id}`,
            title: `🏁 ${ms.title}`,
            description: ms.description,
            start: start.toISOString(),
            end: end.toISOString(),
            source: "milestone",
            sourceLabel: projectNameMap[ms.project_id] || "볼트",
            sourceId: ms.project_id,
            htmlLink: `/projects/${ms.project_id}`,
            color: "#10B981",
            status: ms.status,
          });
        }
      } catch {
        // project_milestones table may not exist
      }
    }
  } catch (err) {
    console.error("Project meetings fetch error:", err);
  }

  // Sort all events by start time
  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return NextResponse.json({
    events: allEvents,
    googleConnected,
    totalEvents: allEvents.length,
  });
}

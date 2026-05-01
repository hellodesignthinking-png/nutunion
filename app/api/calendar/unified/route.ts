import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
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

  // Run Google + group meetings + project meetings sections in parallel.
  // Previously these were three sequential await blocks (~3x the latency).
  const googleTask = (async () => {
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
  })();

  const groupTask = (async () => {
  // ── 2. Nutunion group meetings ────────────────────────────────────
  try {
    // Get user's active group memberships + hosted groups in parallel
    const [{ data: memberships }, { data: hostedGroups }] = await Promise.all([
      supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id)
        .eq("status", "active"),
      supabase
        .from("groups")
        .select("id, name")
        .eq("host_id", user.id),
    ]);

    const groupIds = ((memberships ?? []) as { group_id: string }[]).map((m) => m.group_id);
    const hostedIds = ((hostedGroups ?? []) as { id: string }[]).map((g) => g.id);
    const hostedNames = (hostedGroups ?? []) as { id: string; name: string }[];

    const allGroupIds = [...new Set([...groupIds, ...hostedIds])];

    if (allGroupIds.length > 0) {
      // Get group names for labels — but skip the round-trip if all ids are
      // already hostedGroups (we already have names) or just a few extra.
      const knownNames = new Map<string, string>();
      for (const g of hostedNames) knownNames.set(g.id, g.name);
      const missingIds = allGroupIds.filter((id) => !knownNames.has(id));

      const [groupsRes, meetingsRes] = await Promise.all([
        missingIds.length > 0
          ? supabase.from("groups").select("id, name").in("id", missingIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        supabase
          .from("meetings")
          .select("id, group_id, title, description, scheduled_at, duration_min, location, status")
          .in("group_id", allGroupIds)
          .neq("status", "cancelled")
          .gte("scheduled_at", timeMin.toISOString())
          .lte("scheduled_at", timeMax.toISOString())
          .order("scheduled_at", { ascending: true }),
      ]);
      const { data: groups } = groupsRes;
      const { data: meetings } = meetingsRes;
      const groupNameMap: Record<string, string> = Object.fromEntries(knownNames);
      for (const g of groups || []) groupNameMap[g.id] = g.name;

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
    log.error(err, "calendar.unified.failed");
    console.error("Group meetings fetch error:", err);
  }
  })();

  const projectTask = (async () => {
  // ── 3. Project meetings ───────────────────────────────────────────
  try {
    const [{ data: projectMembers }, { data: createdProjects }] = await Promise.all([
      supabase
      .from("project_members")
      .select("project_id")
        .eq("user_id", user.id),
      supabase
      .from("projects")
      .select("id, title")
        .eq("created_by", user.id),
    ]);

    const projectMemberIds = ((projectMembers ?? []) as { project_id: string }[]).map((p) => p.project_id);
    const createdProjectsArr = (createdProjects ?? []) as { id: string; title: string }[];
    const createdProjectIds = createdProjectsArr.map((p) => p.id);
    const allProjectIds = [...new Set([...projectMemberIds, ...createdProjectIds])];

    if (allProjectIds.length > 0) {
      const knownNames = new Map<string, string>();
      for (const p of createdProjectsArr) knownNames.set(p.id, p.title);
      const missingIds = allProjectIds.filter((id) => !knownNames.has(id));

      // Run all 3 queries (project name lookup + meetings + milestones) in parallel.
      const [projectsRes, projectMeetingsRes, milestonesRes] = await Promise.all([
        missingIds.length > 0
          ? supabase.from("projects").select("id, title").in("id", missingIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
        supabase
          .from("project_meetings")
          .select("id, project_id, title, description, scheduled_at, duration_min, location, status")
          .in("project_id", allProjectIds)
          .neq("status", "cancelled")
          .gte("scheduled_at", timeMin.toISOString())
          .lte("scheduled_at", timeMax.toISOString())
          .order("scheduled_at", { ascending: true })
          .then((r) => r, () => ({ data: [] as any[] })),
        supabase
          .from("project_milestones")
          .select("id, project_id, title, description, due_date, status")
          .in("project_id", allProjectIds)
          .not("due_date", "is", null)
          .neq("status", "cancelled")
          .gte("due_date", timeMin.toISOString().split("T")[0])
          .lte("due_date", timeMax.toISOString().split("T")[0])
          .order("due_date", { ascending: true })
          .then((r) => r, () => ({ data: [] as any[] })),
      ]);

      const { data: projects } = projectsRes;
      const projectNameMap: Record<string, string> = Object.fromEntries(knownNames);
      for (const p of projects || []) projectNameMap[p.id] = p.title;

      const projectMeetings = (projectMeetingsRes as any).data;
      const milestones = (milestonesRes as any).data;

      try {

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

      // Project milestones with due dates (already fetched above in parallel)
      try {
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
    log.error(err, "calendar.unified.failed");
    console.error("Project meetings fetch error:", err);
  }
  })();

  // Run all three sources concurrently — drops total wait time from sum to max.
  await Promise.all([googleTask, groupTask, projectTask]);

  // Sort all events by start time
  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return NextResponse.json({
    events: allEvents,
    googleConnected,
    totalEvents: allEvents.length,
  });
}

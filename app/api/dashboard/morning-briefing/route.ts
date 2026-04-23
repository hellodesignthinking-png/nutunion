import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateObjectForUser, generateTextForUser } from "@/lib/ai/vault";
import { log } from "@/lib/observability/logger";
import { kstTodayStartISO, kstTodayEndISO } from "@/lib/time-kst";

export const dynamic = "force-dynamic";

const KST_OFFSET_MIN = 9 * 60;

function kstNow() {
  const d = new Date();
  return new Date(d.getTime() + (KST_OFFSET_MIN - d.getTimezoneOffset()) * 60000);
}

function kstTodayDateStr(): string {
  return kstNow().toISOString().slice(0, 10);
}

// ── 날씨 캐시: in-memory, date+hour 키 ────────────────────────────────────
interface Weather {
  temp_C: number;
  feels_like_C: number;
  desc: string;
  precip_mm: number;
  humidity: number;
  wind_kph: number;
  hi_C?: number;
  lo_C?: number;
  outfit_hint: string;
}
const weatherCache = new Map<string, { ts: number; w: Weather | null }>();
const WEATHER_TTL_MS = 30 * 60 * 1000;

function outfitHint(temp: number, precip: number, _wind: number): string {
  const wet = precip >= 0.5;
  if (wet) {
    if (temp < 5) return "비·우산 필수, 방수 겉옷·두꺼운 니트";
    if (temp < 15) return "비, 우산·가벼운 트렌치 추천";
    return "비, 얇은 우비·우산 챙기기";
  }
  if (temp <= 0) return "한파, 패딩·목도리·장갑";
  if (temp <= 8) return "쌀쌀, 코트·니트 레이어드";
  if (temp <= 16) return "가벼운 자켓·가디건";
  if (temp <= 22) return "긴팔·얇은 겉옷";
  if (temp <= 27) return "반팔·린넨 셔츠";
  if (temp <= 31) return "반팔 + 수분 충전 필수";
  return "폭염, 통풍 잘 되는 옷·자외선 차단";
}

async function fetchWeather(): Promise<Weather | null> {
  const n = kstNow();
  const key = `${n.toISOString().slice(0, 10)}-${n.getUTCHours()}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.ts < WEATHER_TTL_MS) return cached.w;

  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch("https://wttr.in/Seoul?format=j1", {
      signal: ctl.signal,
      headers: { "User-Agent": "nutunion-dashboard/1.0" },
    });
    clearTimeout(to);
    if (!res.ok) throw new Error(`wttr ${res.status}`);
    const j = await res.json();
    const c = j?.current_condition?.[0];
    const today = j?.weather?.[0];
    if (!c) throw new Error("no current_condition");
    const temp = Number(c.temp_C);
    const precip = Number(c.precipMM ?? 0);
    const wind = Number(c.windspeedKmph ?? 0);
    const w: Weather = {
      temp_C: temp,
      feels_like_C: Number(c.FeelsLikeC ?? temp),
      desc:
        c.lang_ko?.[0]?.value ||
        c.weatherDesc?.[0]?.value ||
        "",
      precip_mm: precip,
      humidity: Number(c.humidity ?? 0),
      wind_kph: wind,
      hi_C: today?.maxtempC ? Number(today.maxtempC) : undefined,
      lo_C: today?.mintempC ? Number(today.mintempC) : undefined,
      outfit_hint: outfitHint(temp, precip, wind),
    };
    weatherCache.set(key, { ts: Date.now(), w });
    return w;
  } catch (err: any) {
    log.warn("morning_briefing.weather_failed", { error: err?.message });
    weatherCache.set(key, { ts: Date.now(), w: null });
    return null;
  }
}

interface ScheduleHighlight {
  title: string;
  why: string;
  time?: string | null;
  source?: string | null;
}

interface RawItem {
  title: string;
  time: string | null;
  source: string;
  due?: string | null;
  is_overdue?: boolean;
}

interface BriefingPayload {
  greeting: string;
  weather: Weather | null;
  schedule_highlights: ScheduleHighlight[];
  activity_tip: string;
  strategy_tip: string;
  text: string;
  context_summary: {
    meetings_today: number;
    tasks_overdue: number;
    tasks_today: number;
    unread_chats: number;
    tasks_no_due: number;
    upcoming_events: number;
  };
  raw_items: RawItem[];
  model_used: string | null;
  nickname: string;
  date: string;
  cached?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Core briefing generation — returns the full payload, no caching.
// ─────────────────────────────────────────────────────────────────────────
async function generateBriefing(userId: string, supabase: any): Promise<BriefingPayload> {
  // profile (migration 102 fallback)
  let profile: any = null;
  {
    const res = await supabase
      .from("profiles")
      .select("nickname, specialty, skill_tags, birth_date, gender, address_region")
      .eq("id", userId)
      .maybeSingle();
    if (res.error && /birth_date|gender|address_region/.test(res.error.message || "")) {
      const fb = await supabase
        .from("profiles")
        .select("nickname, specialty, skill_tags")
        .eq("id", userId)
        .maybeSingle();
      profile = fb.data;
    } else {
      profile = res.data;
    }
  }

  const todayStart = kstTodayStartISO();
  const todayEnd = kstTodayEndISO();
  const todayDate = kstTodayDateStr();

  // ── 내 너트/볼트 (host + member 모두 포함, MyCalendarWidget 과 일치) ─────
  const [gmRes, hgRes, pmRes, cpRes] = await Promise.all([
    supabase.from("group_members").select("group_id, groups(name)").eq("user_id", userId).eq("status", "active"),
    supabase.from("groups").select("id, name").eq("host_id", userId),
    supabase.from("project_members").select("project_id, projects(id, title, status)").eq("user_id", userId),
    supabase.from("projects").select("id, title, status").eq("created_by", userId),
  ]);

  const groupIds = [
    ...new Set([
      ...((gmRes.data as any[]) || []).map((m) => m.group_id).filter(Boolean),
      ...((hgRes.data as any[]) || []).map((g) => g.id).filter(Boolean),
    ]),
  ];
  const projectIds = [
    ...new Set([
      ...((pmRes.data as any[]) || []).map((m) => m.project_id).filter(Boolean),
      ...((cpRes.data as any[]) || []).map((p) => p.id).filter(Boolean),
    ]),
  ];
  const projectTitles = [
    ...((pmRes.data as any[]) || []).map((m) => m.projects?.title).filter(Boolean),
    ...((cpRes.data as any[]) || []).map((p) => p.title).filter(Boolean),
  ];

  // ── 오늘 일정 (group events + group meetings + project meetings + personal) ──
  interface DetailItem { title: string; time: string | null; source: string }
  const todayItems: DetailItem[] = [];
  const today = { events: 0, meetings: 0, project_meetings: 0, personal: 0 };

  // group events + group meetings
  if (groupIds.length > 0) {
    const [{ data: evs }, { data: mts }] = await Promise.all([
      supabase.from("events").select("title, start_at, group_id")
        .in("group_id", groupIds).gte("start_at", todayStart).lte("start_at", todayEnd),
      supabase.from("meetings").select("title, scheduled_at, group_id")
        .in("group_id", groupIds).gte("scheduled_at", todayStart).lte("scheduled_at", todayEnd)
        .not("status", "in", "(cancelled,completed)"),
    ]);
    today.events = (evs || []).length;
    today.meetings = (mts || []).length;
    (evs || []).forEach((e: any) => todayItems.push({ title: e.title, time: e.start_at, source: "event" }));
    (mts || []).forEach((m: any) => todayItems.push({ title: m.title, time: m.scheduled_at, source: "meeting" }));
  }

  // project meetings (널리 쓰이는 두 번째 스코프)
  if (projectIds.length > 0) {
    try {
      const { data: pmts } = await supabase.from("meetings")
        .select("title, scheduled_at, project_id")
        .in("project_id", projectIds)
        .gte("scheduled_at", todayStart).lte("scheduled_at", todayEnd)
        .not("status", "in", "(cancelled,completed)");
      today.project_meetings = (pmts || []).length;
      (pmts || []).forEach((m: any) => todayItems.push({ title: m.title, time: m.scheduled_at, source: "project_meeting" }));
    } catch { /* project_id 컬럼 없는 환경 보호 */ }
  }

  // personal events
  try {
    const { data: pevs } = await supabase
      .from("personal_events")
      .select("title, start_at")
      .eq("user_id", userId)
      .gte("start_at", todayStart)
      .lte("start_at", todayEnd);
    today.personal = (pevs || []).length;
    (pevs || []).forEach((e: any) => todayItems.push({ title: e.title, time: e.start_at, source: "personal" }));
  } catch { /* noop */ }

  // ── 할 일 (assigned bolt tasks + personal_tasks + personal_todos) ─────
  let tasksToday = 0, tasksOverdue = 0, tasksNoDue = 0;
  interface TaskItem { title: string; due: string | null; source: string; is_overdue?: boolean }
  const taskItems: TaskItem[] = [];

  // 볼트 할당 — 마감일 없는 것도 포함
  const { data: myTasks } = await supabase
    .from("project_tasks")
    .select("title, due_date, status, projects(title)")
    .eq("assigned_to", userId)
    .in("status", ["todo", "in_progress"]);
  (myTasks as any[] || []).forEach((t) => {
    if (!t.due_date) {
      tasksNoDue++;
      taskItems.push({ title: t.title, due: null, source: "no-due" });
    } else if (t.due_date < todayDate) {
      tasksOverdue++;
      taskItems.push({ title: t.title, due: t.due_date, source: "overdue", is_overdue: true });
    } else if (t.due_date === todayDate) {
      tasksToday++;
      taskItems.push({ title: t.title, due: t.due_date, source: "today" });
    } else {
      // 이번 주 마감 예정
      taskItems.push({ title: t.title, due: t.due_date, source: "upcoming" });
    }
  });

  // personal_tasks
  try {
    const { data: pt } = await supabase
      .from("personal_tasks")
      .select("title, due_date, status")
      .eq("user_id", userId)
      .in("status", ["todo", "in_progress"]);
    (pt as any[] || []).forEach((t) => {
      if (!t.due_date) {
        tasksNoDue++;
        taskItems.push({ title: t.title, due: null, source: "no-due-personal" });
      } else if (t.due_date < todayDate) {
        tasksOverdue++;
        taskItems.push({ title: t.title, due: t.due_date, source: "overdue-personal", is_overdue: true });
      } else if (t.due_date === todayDate) {
        tasksToday++;
        taskItems.push({ title: t.title, due: t.due_date, source: "today-personal" });
      } else {
        taskItems.push({ title: t.title, due: t.due_date, source: "upcoming-personal" });
      }
    });
  } catch { /* noop */ }

  // personal_todos
  try {
    const { data: ptd } = await supabase
      .from("personal_todos")
      .select("title, due_date, done")
      .eq("user_id", userId)
      .eq("done", false);
    (ptd as any[] || []).forEach((t) => {
      if (!t.due_date) {
        tasksNoDue++;
        taskItems.push({ title: t.title, due: null, source: "no-due-todo" });
      } else if (t.due_date < todayDate) {
        tasksOverdue++;
        taskItems.push({ title: t.title, due: t.due_date, source: "overdue-todo", is_overdue: true });
      } else if (t.due_date === todayDate) {
        tasksToday++;
        taskItems.push({ title: t.title, due: t.due_date, source: "today-todo" });
      } else {
        taskItems.push({ title: t.title, due: t.due_date, source: "upcoming-todo" });
      }
    });
  } catch { /* noop */ }

  // ── 향후 7일 일정 (upcomingItems) ──────────────────────────────────────
  const next7End = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  interface DetailItem { title: string; time: string | null; source: string }
  const upcomingItems: DetailItem[] = [];

  if (groupIds.length > 0) {
    try {
      const [{ data: uEvs }, { data: uMts }] = await Promise.all([
        supabase.from("events").select("title, start_at")
          .in("group_id", groupIds).gt("start_at", todayEnd).lte("start_at", next7End).limit(10),
        supabase.from("meetings").select("title, scheduled_at")
          .in("group_id", groupIds).gt("scheduled_at", todayEnd).lte("scheduled_at", next7End)
          .not("status", "in", "(cancelled,completed)").limit(10),
      ]);
      (uEvs || []).forEach((e: any) => upcomingItems.push({ title: e.title, time: e.start_at, source: "event" }));
      (uMts || []).forEach((m: any) => upcomingItems.push({ title: m.title, time: m.scheduled_at, source: "meeting" }));
    } catch { /* noop */ }
  }
  try {
    const { data: upevs } = await supabase.from("personal_events")
      .select("title, start_at").eq("user_id", userId)
      .gt("start_at", todayEnd).lte("start_at", next7End).limit(10);
    (upevs || []).forEach((e: any) => upcomingItems.push({ title: e.title, time: e.start_at, source: "personal" }));
  } catch { /* noop */ }

  // 시간순 정렬
  upcomingItems.sort((a, b) => (a.time || "") < (b.time || "") ? -1 : 1);

  // ── Genesis 최근 생성 공간 (24h) ──────────────────────────────────────
  interface GenesisRecent { title: string; kind: string; target_id: string | null; created_at: string }
  const genesisRecent: GenesisRecent[] = [];
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: gps } = await supabase
      .from("genesis_plans")
      .select("plan, target_kind, target_id, created_at")
      .eq("owner_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(3);
    (gps as any[] || []).forEach((g) => {
      const title = g?.plan?.title || "(제목 없음)";
      genesisRecent.push({ title, kind: g.target_kind, target_id: g.target_id, created_at: g.created_at });
    });
  } catch { /* migration 104 미적용 환경 보호 */ }

  // ── 안 읽은 채팅 ──────────────────────────────────────────────────────
  let unreadChats = 0;
  try {
    const { data: rooms } = await supabase
      .from("chat_members")
      .select("room_id, last_read_at")
      .eq("user_id", userId);
    for (const r of (rooms as any[] || []).slice(0, 20)) {
      const { count } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("room_id", r.room_id)
        .gt("created_at", r.last_read_at || new Date(0).toISOString())
        .neq("sender_id", userId);
      if ((count || 0) > 0) unreadChats++;
    }
  } catch { /* noop */ }

  const nickname = profile?.nickname?.trim() || "사용자";
  const meetings_today_total = today.meetings + today.events + today.personal + today.project_meetings;
  const context_summary = {
    meetings_today: meetings_today_total,
    tasks_overdue: tasksOverdue,
    tasks_today: tasksToday,
    unread_chats: unreadChats,
    tasks_no_due: tasksNoDue,
    upcoming_events: upcomingItems.length,
  };

  // raw_items — UI에서 직접 표시 (오늘 일정 + 할일 + 향후 일정)
  const raw_items: RawItem[] = [
    ...todayItems.map(i => ({ title: i.title, time: i.time, source: i.source })),
    ...taskItems.filter(t => t.source.startsWith("overdue") || t.source.startsWith("today"))
      .map(t => ({ title: t.title, time: null, due: t.due, source: t.source, is_overdue: t.is_overdue })),
    ...taskItems.filter(t => t.source.startsWith("no-due"))
      .slice(0, 5)
      .map(t => ({ title: t.title, time: null, due: null, source: t.source })),
    ...upcomingItems.slice(0, 5).map(i => ({ title: i.title, time: i.time, source: `upcoming-${i.source}` })),
  ];

  const weather = await fetchWeather();

  const kstD = kstNow();
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][kstD.getUTCDay()];

  // ── Prompt (강화) ─────────────────────────────────────────────────────
  const system = `당신은 ${nickname}님의 한국어 퍼스널 비서다.
아래 JSON 스키마에 맞춰 따뜻하고 실용적이며 구체적인 아침 브리핑을 생성한다.
반드시 유효한 JSON 만 반환 (코드펜스·주석·마크다운 없이).
문장은 자연스럽고 명확하게, 이모지는 섹션당 최대 1개.

strategy_tip 작성 규칙 (매우 중요):
- 반드시 아래 숫자 정보를 모두 반영한 구체적인 1-2문장:
  * 미팅 N건 — 가장 중요한 회의 시간·제목 명시
  * 할 일 M건 — 가장 시급한 항목 제목 명시
  * 밀린 일 P건 — 어떤 것을 먼저 처리할지
  * 안 읽음 Q건 — 누구/어디 확인 필요한지
- 실제 고유명사(볼트명, 미팅 제목, Task 제목)를 최소 1개 포함.
- 예시: "오늘은 볼트A 기획미팅(14시) 1건과 밀린 Task 3건 중 'LP 디자인 초안 D-2' 가 최우선, 너트B 안읽음 메시지 먼저 확인"
- 일정·할일이 모두 없으면 "여백이 있는 날 — ..."식 성찰 문장.
- 마크다운·리스트·볼드·별표·개행 금지. 반드시 단일 문장(또는 쉼표 연결).

schedule_highlights 규칙:
- 오늘 실제로 있는 일정/할 일에서 가장 중요한 2~4개 선정.
- 각 항목은 { title, why, time, source }.
- time 은 "HH:MM" 또는 null. source 는 meeting|event|task|personal|project_meeting 중 하나.
- why 는 유저 맥락(진행 중인 볼트, 전문분야)과 연결해 한 문장.

스키마:
{
  "greeting": "${nickname}님 이름 포함, 날짜 포함 한 문장",
  "schedule_highlights": [{"title":"...","why":"...","time":"HH:MM|null","source":"..."}],
  "activity_tip": "날씨/일정 기반 건강·활동 1문장",
  "strategy_tip": "오늘의 전략 1문장 (숫자 포함)"
}`;

  const prompt = `오늘: ${todayDate} (${weekday}요일)
${weather ? `날씨: ${weather.desc}, 기온 ${weather.temp_C}°C (체감 ${weather.feels_like_C}°C), 강수 ${weather.precip_mm}mm, 습도 ${weather.humidity}%${weather.hi_C != null ? `, 최고 ${weather.hi_C}°C / 최저 ${weather.lo_C}°C` : ""}` : "날씨: 정보 없음"}

유저 컨텍스트:
- 활동 중인 볼트: ${projectTitles.slice(0, 5).join(", ") || "(없음)"}
- 전문분야: ${profile?.specialty || "(미지정)"}

오늘의 팩트 (strategy_tip 에 반드시 반영):
- 오늘 일정/미팅: ${meetings_today_total}건
- 오늘 마감 할 일: ${tasksToday}건
- 밀린(지연) 할 일: ${tasksOverdue}건
- 마감일 없는 진행 중 할 일: ${tasksNoDue}건
- 향후 7일 예정 일정: ${upcomingItems.length}건
- 안 읽은 채팅방: ${unreadChats}개

오늘 일정 (${todayItems.length}건):
${todayItems.slice(0, 8).map((i) => `- [${i.source}] ${i.title} @ ${i.time ? new Date(i.time).toISOString() : "시간미정"}`).join("\n") || "(없음)"}

오늘/지연 할 일 (${tasksToday + tasksOverdue}건):
${taskItems.filter(t => t.source.startsWith("today") || t.source.startsWith("overdue")).slice(0, 8).map((t) => `- [${t.is_overdue ? "밀린" : "오늘마감"}] ${t.title} (due ${t.due})`).join("\n") || "(없음)"}

마감일 없는 진행 중 할 일 (${tasksNoDue}건 — 이 중 최우선 1~2개 schedule_highlights 에 포함):
${taskItems.filter(t => t.source.startsWith("no-due")).slice(0, 5).map((t) => `- ${t.title}`).join("\n") || "(없음)"}

향후 7일 예정 일정 (${upcomingItems.length}건):
${upcomingItems.slice(0, 6).map((i) => `- [${i.source}] ${i.title} @ ${i.time ? new Date(i.time).toLocaleDateString("ko", { month: "short", day: "numeric", weekday: "short" }) : "미정"}`).join("\n") || "(없음)"}

${genesisRecent.length > 0 ? `최근 24h Genesis AI 생성 공간:\n${genesisRecent.map((g) => `- [${g.kind}] "${g.title}"`).join("\n")}` : ""}

위를 종합해 schedule_highlights 4~6개와 구체 숫자·항목명이 들어간 strategy_tip 을 작성하라.`;

  let payload: Omit<BriefingPayload, "text" | "weather" | "context_summary" | "model_used" | "nickname" | "date" | "cached"> = {
    greeting: `☀️ ${nickname}님, 좋은 아침입니다. (${todayDate})`,
    schedule_highlights: [],
    activity_tip: "",
    strategy_tip: "",
    raw_items: [],
  };
  let model_used: string | null = null;

  const sanitizeLine = (s: string) => {
    let v = String(s || "")
      .replace(/```(?:json|JSON)?\s*/gi, "")
      .replace(/```/g, "")
      .trim();
    // JSON 덩어리가 그대로 들어온 경우: strategy_tip / summary / greeting 추출 시도
    if (/^\{[\s\S]*\}$/.test(v)) {
      try {
        const obj = JSON.parse(v);
        v = obj.strategy_tip || obj.summary || obj.greeting || obj.activity_tip || v;
      } catch { /* ignore */ }
    }
    // 앞부분에 "key": 패턴이 남아있으면 그 값만 뽑기 (예: `"greeting":"안녕..."` 조각)
    const leaked = v.match(/"(?:greeting|strategy_tip|activity_tip|summary)"\s*:\s*"([^"]+)"/);
    if (leaked) v = leaked[1];
    return v
      .replace(/\*+/g, "")
      .replace(/^[-·•]\s*/gm, "")
      .replace(/\s*\n\s*/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  };

  // 캐시된 payload 가 깨진 JSON 원문을 담고 있는지 감지하는 헬퍼 (route 상단에서도 사용)
  // payload 어느 필드에도 ```json 또는 '{"greeting"' 같은 흔적이 있으면 재생성 대상.
  // ── (아래 readCache 래퍼에서 사용)

  const briefSchema = z.object({
    greeting: z.string().describe("사용자 이름과 날짜를 포함한 한 문장"),
    schedule_highlights: z
      .array(
        z.object({
          title: z.string(),
          why: z.string(),
          time: z.string().nullable().optional(),
          source: z.string().nullable().optional(),
        }),
      )
      .max(6),
    activity_tip: z.string(),
    strategy_tip: z.string(),
  });

  let aiOk = false;
  try {
    const res = await generateObjectForUser<z.infer<typeof briefSchema>>(userId, briefSchema, {
      system,
      prompt,
      tier: "fast",
      maxOutputTokens: 1400,
    });
    model_used = res.model_used;
    const parsed = res.object as z.infer<typeof briefSchema> | undefined;
    if (parsed) {
      payload = {
        greeting: sanitizeLine(parsed.greeting) || payload.greeting,
        schedule_highlights: (parsed.schedule_highlights || []).slice(0, 6).map((h) => ({
          title: sanitizeLine(h?.title || "").slice(0, 120),
          why: sanitizeLine(h?.why || "").slice(0, 200),
          time: h?.time || null,
          source: h?.source || null,
        })),
        activity_tip: sanitizeLine(parsed.activity_tip || "").slice(0, 240),
        strategy_tip: sanitizeLine(parsed.strategy_tip || "").slice(0, 240),
        raw_items,
      };
      aiOk = true;
    }
  } catch (err: any) {
    log.warn("morning_briefing.object_ai_failed", { error: err?.message });
  }

  // Fallback: text 모드 + 공격적 JSON 추출
  if (!aiOk) try {
    const res = await generateTextForUser(userId, {
      system,
      prompt,
      tier: "fast",
      maxOutputTokens: 1400,
    });
    model_used = model_used || res.model_used;
    const raw = (res.text || "").trim();
    // 코드펜스 제거 + { ... } 영역 추출
    const stripped = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    const slice = start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped;
    try {
      const parsed = JSON.parse(slice);
      payload = {
        greeting: sanitizeLine(parsed.greeting || "") || payload.greeting,
        schedule_highlights: Array.isArray(parsed.schedule_highlights)
          ? parsed.schedule_highlights.slice(0, 6).map((h: any) => ({
              title: sanitizeLine(String(h?.title || "")).slice(0, 120),
              why: sanitizeLine(String(h?.why || "")).slice(0, 200),
              time: h?.time || null,
              source: h?.source || null,
            }))
          : [],
        activity_tip: sanitizeLine(parsed.activity_tip || "").slice(0, 240),
        strategy_tip: sanitizeLine(parsed.strategy_tip || "").slice(0, 240),
        raw_items,
      };
      aiOk = true;
    } catch (err: any) {
      // JSON 추출 실패 — raw AI 출력을 strategy_tip 에 절대 덤프하지 않는다.
      // 사용자에게 '```json {...}' 같은 원문이 노출된 버그 재발 방지.
      log.warn("morning_briefing.json_parse_failed", { error: err?.message, raw_head: raw.slice(0, 80) });
      // aiOk 는 false 로 유지 → 아래 catch 블록의 결정적 fallback 으로 진입하도록
      // 강제 throw
      throw new Error("ai_json_unparseable");
    }
  } catch (err: any) {
    log.warn("morning_briefing.ai_failed", { error: err?.message });
    if (meetings_today_total > 0 || taskItems.length > 0 || genesisRecent.length > 0) {
      payload.schedule_highlights = [
        ...genesisRecent.slice(0, 1).map((g) => ({
          title: `어제 생성한 공간: ${g.title}`,
          why: "첫 Task 3개 대기 중 — 오늘 착수를 추천합니다.",
          time: null,
          source: "genesis",
        })),
        ...todayItems.slice(0, 2).map((i) => ({
          title: i.title,
          why: "오늘의 주요 일정입니다.",
          time: i.time ? new Date(i.time).toISOString() : null,
          source: i.source,
        })),
        ...taskItems.slice(0, 2).map((t) => ({
          title: t.title,
          why: t.source.startsWith("overdue") ? "마감 지난 항목 — 우선 정리." : "오늘 마감 — 오전에 처리 권장.",
          time: null,
          source: "task",
        })),
      ];
    }
    payload.activity_tip = weather
      ? `${weather.outfit_hint}. 점심 산책 10분 추천.`
      : "짧게 스트레칭하고 시작하세요.";
    const bits: string[] = [];
    if (meetings_today_total > 0) bits.push(`일정 ${meetings_today_total}건`);
    if (tasksToday > 0) bits.push(`오늘 마감 ${tasksToday}건`);
    if (tasksOverdue > 0) bits.push(`밀린 일 ${tasksOverdue}건`);
    if (genesisRecent.length > 0) {
      payload.strategy_tip = `어제 생성한 ${genesisRecent[0].title} 의 초기 Task 가 아직 미처리 — 오늘 30분 확보 추천${bits.length ? ` (추가: ${bits.join(" + ")})` : ""}.`;
    } else {
      payload.strategy_tip = bits.length
        ? `오늘은 ${bits.join(" + ")} 정리가 최우선입니다.`
        : "여백이 있는 날 — 큰 그림 하나를 떠올려 보세요.";
    }
  }

  // Stat chip 진단용 로그 (문제 3: 숫자가 모두 0 이면 어느 쿼리에서 끊겼는지 확인)
  log.info("briefing.stats", {
    user_id: userId,
    meetings_today: today.meetings,
    group_events_today: today.events,
    project_meetings_today: today.project_meetings,
    personal_events_today: today.personal,
    meetings_total: meetings_today_total,
    tasks_today: tasksToday,
    tasks_overdue: tasksOverdue,
    unread_chats: unreadChats,
    groups: groupIds.length,
    projects: projectIds.length,
  });

  const text = [
    payload.greeting,
    weather ? `🌤 ${weather.desc} · ${weather.temp_C}°C · ${weather.outfit_hint}` : null,
    payload.schedule_highlights.length
      ? payload.schedule_highlights.map((h) => `· ${h.title} — ${h.why}`).join("\n")
      : null,
    payload.activity_tip ? `🏃 ${payload.activity_tip}` : null,
    payload.strategy_tip ? `🎯 ${payload.strategy_tip}` : null,
  ].filter(Boolean).join("\n");

  return {
    ...payload,
    weather,
    text,
    context_summary,
    raw_items,
    model_used,
    nickname,
    date: todayDate,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Cache helpers
// ─────────────────────────────────────────────────────────────────────────
function isCorruptedBriefing(p: any): boolean {
  if (!p || typeof p !== "object") return true;
  const blob = [p.greeting, p.strategy_tip, p.activity_tip, p.text]
    .map((v) => String(v || ""))
    .join("\n");
  if (!blob) return false;
  if (/```/.test(blob)) return true;
  if (/^\s*\{[\s\S]*"greeting"\s*:/.test(blob)) return true;
  if (/"strategy_tip"\s*:\s*"/.test(blob)) return true;
  return false;
}

async function readCache(supabase: any, userId: string, date: string): Promise<BriefingPayload | null> {
  try {
    const { data, error } = await supabase
      .from("daily_briefings")
      .select("payload, model_used")
      .eq("user_id", userId)
      .eq("briefing_date", date)
      .maybeSingle();
    if (error) return null;
    if (!data) return null;
    const payload = data.payload as BriefingPayload;
    // 과거에 AI 원문이 그대로 저장된 경우 자동 무효화 → 재생성 유도
    if (isCorruptedBriefing(payload)) {
      log.info("briefing.cache.corrupted_invalidated", { user_id: userId, date });
      try {
        await supabase
          .from("daily_briefings")
          .delete()
          .eq("user_id", userId)
          .eq("briefing_date", date);
      } catch { /* noop */ }
      return null;
    }
    return { ...payload, cached: true };
  } catch {
    return null;
  }
}

async function writeCache(supabase: any, userId: string, date: string, payload: BriefingPayload): Promise<void> {
  try {
    await supabase.from("daily_briefings").upsert({
      user_id: userId,
      briefing_date: date,
      payload,
      model_used: payload.model_used,
      refreshed_at: new Date().toISOString(),
    });
  } catch (err: any) {
    log.warn("morning_briefing.cache_write_failed", { error: err?.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// GET — 캐시 있으면 반환, 없으면 생성+저장+반환. ?refresh=1 → 재생성
// ─────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const span = log.span("dashboard.morning_briefing");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    span.end({ status: 401 });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";
  const todayDate = kstTodayDateStr();

  if (!forceRefresh) {
    const cached = await readCache(supabase, user.id, todayDate);
    if (cached) {
      log.info("briefing.cache.hit", { user_id: user.id, date: todayDate });
      span.end({ cached: true });
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "private, max-age=60" },
      });
    }
  }
  log.info("briefing.cache.miss", { user_id: user.id, date: todayDate, forced: forceRefresh });

  const result = await generateBriefing(user.id, supabase);
  await writeCache(supabase, user.id, todayDate, result);
  span.end({ cached: false, has_model: !!result.model_used, weather: !!result.weather });
  return NextResponse.json({ ...result, cached: false });
}

// ─────────────────────────────────────────────────────────────────────────
// POST — 명시적 재생성 (client 의 "다시 브리핑" 버튼)
// ─────────────────────────────────────────────────────────────────────────
export async function POST() {
  const span = log.span("dashboard.morning_briefing.refresh");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    span.end({ status: 401 });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const todayDate = kstTodayDateStr();
  const result = await generateBriefing(user.id, supabase);
  await writeCache(supabase, user.id, todayDate, result);
  span.end({ refreshed: true, has_model: !!result.model_used });
  return NextResponse.json({ ...result, cached: false });
}

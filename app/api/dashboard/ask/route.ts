import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { aiError } from "@/lib/ai/error";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
const GEMINI_HEADERS = { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY ?? "" };

const SYSTEM_PROMPT = `당신은 nutunion 유저의 **개인 비서** AI 입니다.

유저가 속한 너트(그룹)와 볼트(프로젝트) 의 현재 상태 + 할일 + 일정을 알고 있습니다.
유저 입력을 받아 두 가지 중 하나로 응답하세요:

1. **질문 모드** (예: "지금 뭐해야 해?", "이번 주 뭐 남았어?"):
   현재 상황(overdue / 오늘 할일 / 임박 볼트 / 활동 저조 볼트) 을 기반으로
   "어떤 순서로 무엇을 해야 하는지" 구체적으로 답변. 각 권고에 근거 포함.

2. **액션 모드** (예: "플래그테일 내일 오전 10시 회의", "제로싸이트 SEO 보고서 금요일까지"):
   유저의 의도를 파싱해 등록할 task/event 제안. 반드시 target(너트/볼트) 명시.

반드시 아래 JSON 형식으로만 응답:

{
  "mode": "answer" 또는 "action",
  "message": "유저에게 보여줄 답변 (자연스러운 한국어, 3~8문장)",
  "priorities": [
    { "order": 1, "action": "무엇을 해야 하는지", "why": "왜 지금 해야 하는지 근거 (마감/중요도)", "target_type": "task|bolt|nut|meeting|none", "target_id": "관련 ID 있으면" }
  ],
  "actions": [
    {
      "type": "task" 또는 "event",
      "title": "제목",
      "description": "상세",
      "due_date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "target_kind": "bolt" 또는 "nut",
      "target_id": "target project_id or group_id (반드시 제공된 목록에서만)",
      "target_title": "매칭된 너트/볼트 이름"
    }
  ]
}

규칙:
- mode=answer 일 때: priorities 배열에 3~5개 항목, actions 는 빈 배열
- mode=action 일 때: actions 배열에 1~3개, priorities 는 빈 배열
- target_id 는 반드시 제공된 너트/볼트 ID 중에서만 선택 (환각 금지)
- 유저가 말한 너트/볼트 이름을 fuzzy 매칭해서 target_id 찾기
- 날짜 해석: "내일"/"다음 주" 등을 today=${new Date().toISOString().slice(0, 10)} 기준으로 YYYY-MM-DD 변환
- 유효 JSON 만 출력`;

const BodySchema = z.object({
  question: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) return aiError("server_error", "dashboard/ask", { internal: "GEMINI_API_KEY missing" });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return aiError("auth", "dashboard/ask");

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return aiError("bad_input", "dashboard/ask");

  const { success } = rateLimit(`ai:${user.id}`, 20, 60_000);
  if (!success) return aiError("rate_limit", "dashboard/ask");

  // 컨텍스트 수집 — /api/dashboard/brief 와 같은 로직
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const [{ data: gm }, { data: hg }, { data: pm }, { data: cp }] = await Promise.all([
    supabase.from("group_members").select("group_id").eq("user_id", user.id).eq("status", "active"),
    supabase.from("groups").select("id").eq("host_id", user.id),
    supabase.from("project_members").select("project_id").eq("user_id", user.id),
    supabase.from("projects").select("id").eq("created_by", user.id),
  ]);

  const groupIds = [...new Set([
    ...((gm as { group_id: string }[] | null) ?? []).map((r) => r.group_id),
    ...((hg as { id: string }[] | null) ?? []).map((r) => r.id),
  ])];
  const projectIds = [...new Set([
    ...((pm as { project_id: string }[] | null) ?? []).map((r) => r.project_id),
    ...((cp as { id: string }[] | null) ?? []).map((r) => r.id),
  ])];

  const [groupsData, projectsData, tasksData, eventsData] = await Promise.all([
    groupIds.length > 0 ? supabase.from("groups").select("id, name").in("id", groupIds) : Promise.resolve({ data: [] }),
    projectIds.length > 0 ? supabase.from("projects").select("id, title, status, venture_stage, end_date").in("id", projectIds) : Promise.resolve({ data: [] }),
    supabase.from("project_tasks").select("id, title, due_date, status, milestone:project_milestones(project:projects(id, title))").eq("assigned_to", user.id).in("status", ["todo", "in_progress"]).order("due_date", { ascending: true }).limit(30),
    groupIds.length > 0 ? supabase.from("events").select("id, group_id, title, start_at").in("group_id", groupIds).gte("start_at", todayStart).order("start_at").limit(20) : Promise.resolve({ data: [] }),
  ]);

  const groups = (groupsData.data as { id: string; name: string }[] | null) ?? [];
  const projects = (projectsData.data as { id: string; title: string; status: string; venture_stage?: string | null; end_date?: string | null }[] | null) ?? [];
  const tasks = (tasksData.data as Array<{ id: string; title: string; due_date: string | null; status: string; milestone?: { project?: { id: string; title: string } | null } | null }> | null) ?? [];
  const events = (eventsData.data as { id: string; group_id: string; title: string; start_at: string }[] | null) ?? [];

  const todayStr = todayStart.slice(0, 10);

  // 프롬프트 컨텍스트
  let ctx = `## 유저 컨텍스트 (오늘: ${todayStr})\n\n`;

  if (groups.length > 0) {
    ctx += `### 내 너트 (${groups.length})\n`;
    for (const g of groups) ctx += `- [nut_id: ${g.id}] ${g.name}\n`;
    ctx += "\n";
  }

  if (projects.length > 0) {
    ctx += `### 내 볼트 (${projects.length})\n`;
    for (const p of projects) {
      const daysLeft = p.end_date ? Math.ceil((new Date(p.end_date).getTime() - today.getTime()) / 86400000) : null;
      ctx += `- [bolt_id: ${p.id}] ${p.title} · ${p.status}${p.venture_stage ? ` · stage: ${p.venture_stage}` : ""}${daysLeft !== null ? ` · D${daysLeft >= 0 ? "-" : "+"}${Math.abs(daysLeft)}` : ""}\n`;
    }
    ctx += "\n";
  }

  if (tasks.length > 0) {
    ctx += `### 내 할일 (${tasks.length})\n`;
    for (const t of tasks) {
      const due = t.due_date
        ? t.due_date < todayStr
          ? `⚠ 지난 ${t.due_date}`
          : t.due_date === todayStr
            ? "🔥 오늘"
            : t.due_date
        : "날짜없음";
      const proj = t.milestone?.project?.title ?? "";
      ctx += `- ${due} · ${t.title}${proj ? ` (${proj})` : ""}\n`;
    }
    ctx += "\n";
  }

  if (events.length > 0) {
    ctx += `### 내 일정 (${events.length})\n`;
    for (const e of events) {
      const nut = groups.find((g) => g.id === e.group_id)?.name ?? "";
      ctx += `- ${new Date(e.start_at).toLocaleString("ko")} · ${e.title}${nut ? ` @ ${nut}` : ""}\n`;
    }
    ctx += "\n";
  }

  if (groups.length === 0 && projects.length === 0) {
    ctx += `### 아직 참여한 너트/볼트 없음 — 탐색부터 안내.\n`;
  }

  ctx += `\n## 유저 입력\n"${parsed.data.question}"\n`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: GEMINI_HEADERS,
      body: JSON.stringify({
        contents: [{ parts: [{ text: SYSTEM_PROMPT }, { text: ctx }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return aiError("ai_unavailable", "dashboard/ask", { internal: `${res.status}: ${errBody.slice(0, 300)}` });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let result: {
      mode?: "answer" | "action";
      message?: string;
      priorities?: Array<{ order: number; action: string; why: string; target_type?: string; target_id?: string }>;
      actions?: Array<{
        type: "task" | "event";
        title: string;
        description?: string;
        due_date?: string;
        start_time?: string;
        end_time?: string;
        target_kind?: "bolt" | "nut";
        target_id?: string;
        target_title?: string;
      }>;
    };
    try {
      result = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return aiError("ai_bad_response", "dashboard/ask");
      result = JSON.parse(m[0]);
    }

    // target_id 환각 방지
    const validGroupIds = new Set(groups.map((g) => g.id));
    const validProjectIds = new Set(projects.map((p) => p.id));
    const cleanedActions = (result.actions ?? []).filter((a) => {
      if (!a.target_id) return false;
      if (a.target_kind === "bolt") return validProjectIds.has(a.target_id);
      if (a.target_kind === "nut") return validGroupIds.has(a.target_id);
      return false;
    });

    return NextResponse.json({
      mode: result.mode ?? "answer",
      message: result.message ?? "",
      priorities: result.priorities ?? [],
      actions: cleanedActions,
    });
  } catch (err) {
    log.error(err, "dashboard.ask.failed");
    return aiError("server_error", "dashboard/ask", { internal: err });
  }
}

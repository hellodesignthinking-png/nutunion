import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateObjectWithFallback } from "@/lib/ai/model";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z.object({
  summary: z.string().describe("입력 전체에 대한 1문장 한국어 요약"),
  items: z.array(z.object({
    type: z.enum(["task", "event", "nut_activity", "bolt_activity", "journal"]),
    title: z.string().min(1).max(200),
    detail: z.string().max(2000).optional(),
    due_at: z.string().optional().describe("ISO 8601 (YYYY-MM-DDTHH:mm:ss+09:00). task/event 에 해당"),
    suggested_target: z.object({
      kind: z.enum(["personal", "group", "project"]),
      id: z.string().nullable(),
      name: z.string().nullable(),
      reason: z.string().max(200),
    }),
    confidence: z.number().min(0).max(1),
  })).max(8),
  recommendations: z.array(z.string()).max(3),
});

const BodySchema = z.object({ text: z.string().min(1).max(4000) });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "bad input" }, { status: 400 });

  const { success } = rateLimit(`ai-secretary:${user.id}`, 20, 60_000);
  if (!success) return NextResponse.json({ error: "rate limit" }, { status: 429 });

  // 컨텍스트 수집 — 내 너트 + 내 볼트
  const [{ data: gm }, { data: hg }, { data: pm }, { data: cp }] = await Promise.all([
    supabase.from("group_members").select("group_id, groups(id, name, description, category)").eq("user_id", user.id).eq("status", "active"),
    supabase.from("groups").select("id, name, description, category").eq("host_id", user.id),
    supabase.from("project_members").select("project_id, projects(id, title, description, status, venture_stage)").eq("user_id", user.id),
    supabase.from("projects").select("id, title, description, status, venture_stage").eq("created_by", user.id),
  ]);

  const groupMap = new Map<string, { id: string; name: string; description?: string; category?: string }>();
  for (const r of ((gm as any[]) || [])) if (r.groups) groupMap.set(r.groups.id, r.groups);
  for (const g of ((hg as any[]) || [])) groupMap.set(g.id, g);
  const groups = Array.from(groupMap.values());

  const projectMap = new Map<string, { id: string; title: string; description?: string; status?: string; venture_stage?: string | null }>();
  for (const r of ((pm as any[]) || [])) if (r.projects) projectMap.set(r.projects.id, r.projects);
  for (const p of ((cp as any[]) || [])) projectMap.set(p.id, p);
  const projects = Array.from(projectMap.values()).filter((p) => ["active", "draft"].includes(p.status || ""));

  const today = new Date();
  const todayKst = today.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD HH:mm:ss
  const todayDate = todayKst.slice(0, 10);
  const weekday = today.toLocaleDateString("ko", { weekday: "long", timeZone: "Asia/Seoul" });

  let ctx = `오늘 날짜: ${todayDate} (${weekday}) KST\n\n`;
  if (groups.length > 0) {
    ctx += `## 내 너트 (${groups.length})\n`;
    for (const g of groups) ctx += `- id=${g.id} | ${g.name} | ${g.category ?? "-"} | ${g.description ?? ""}\n`;
    ctx += "\n";
  }
  if (projects.length > 0) {
    ctx += `## 내 볼트 (${projects.length})\n`;
    for (const p of projects) ctx += `- id=${p.id} | ${p.title} | ${p.status ?? "-"}${p.venture_stage ? ` | stage=${p.venture_stage}` : ""} | ${p.description ?? ""}\n`;
    ctx += "\n";
  }
  if (groups.length === 0 && projects.length === 0) {
    ctx += `사용자는 아직 너트/볼트에 참여하지 않았습니다. 모든 항목을 personal (kind=personal) 로 분류하세요.\n\n`;
  }

  const system = `당신은 nutunion 사용자의 개인 비서입니다. 사용자의 자연어 입력을 분석해서 다음 5가지 중 하나로 분류하세요:
- task: 해야 할 일 (개인 또는 볼트의 할당 작업)
- event: 특정 시각에 일어날 일정/회의
- nut_activity: 너트(커뮤니티 그룹) 안에서 공유할 생각/글감 → 해당 너트의 위키 초안으로 등록
- bolt_activity: 볼트(프로젝트) 관련 활동/태스크
- journal: 개인 기록/메모 (딱히 해야 할 일은 아닌, 떠오른 생각)

각 항목마다:
1) type, title, detail (선택), due_at (task/event 에만, ISO 8601 KST +09:00)
2) suggested_target: kind 는 personal | group | project 중 하나. group/project 면 제공된 id 목록 중에서만 선택. 아무것도 맞지 않으면 kind=personal, id=null, name=null.
3) reason: 왜 이 대상을 골랐는지 30자 내외 한국어 근거
4) confidence: 0~1 사이

규칙:
- target id 환각 금지 — 반드시 제공된 너트/볼트 id 목록 안에서만 고르기.
- 사용자가 특정 너트/볼트 이름을 언급하면 fuzzy 매칭.
- "오늘/내일/다음주" 같은 상대 날짜는 오늘 기준 KST 로 변환.
- items 는 최대 8개. 짧은 입력은 1~2개도 충분.
- summary: 입력 전체를 한 문장 한국어로 요약.
- recommendations: 전체 텍스트를 본 뒤 사용자에게 주는 행동 제안 0~3개 (예: "볼트 X 에 집중하는 게 좋겠어요").

항상 JSON 으로만 응답.`;

  try {
    const { object } = await generateObjectWithFallback(Schema, {
      system,
      prompt: `${ctx}\n## 사용자 입력\n${parsed.data.text}`,
      maxOutputTokens: 2500,
      timeoutMs: 55_000,
    });
    if (!object) throw new Error("AI 응답 없음");

    // id 환각 방지 sweep
    const validGroupIds = new Set(groups.map((g) => g.id));
    const validProjectIds = new Set(projects.map((p) => p.id));
    for (const it of object.items) {
      const t = it.suggested_target;
      if (t.kind === "group") {
        if (!t.id || !validGroupIds.has(t.id)) {
          it.suggested_target = { kind: "personal", id: null, name: null, reason: "해당 너트를 찾지 못해 개인으로 분류" };
        } else {
          const g = groups.find((x) => x.id === t.id);
          t.name = g?.name || t.name;
        }
      } else if (t.kind === "project") {
        if (!t.id || !validProjectIds.has(t.id)) {
          it.suggested_target = { kind: "personal", id: null, name: null, reason: "해당 볼트를 찾지 못해 개인으로 분류" };
        } else {
          const p = projects.find((x) => x.id === t.id);
          t.name = p?.title || t.name;
        }
      } else {
        t.id = null;
        t.name = null;
      }
    }

    return NextResponse.json({
      ...object,
      groups: groups.map((g) => ({ id: g.id, name: g.name })),
      projects: projects.map((p) => ({ id: p.id, title: p.title })),
    });
  } catch (err: any) {
    log.error(err, "dashboard.ai-secretary.failed");
    return NextResponse.json({ error: err?.message || "AI 분석 실패" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { generateObjectWithFallback } from "@/lib/ai/model";

interface RouteContext { params: Promise<{ id: string }>; }

/**
 * GET /api/projects/{id}/pm-brief — AI 프로젝트 매니저 브리핑.
 *
 *   프로젝트의 마일스톤·태스크·리스크·결정·최근 활동을 종합하여
 *   "오늘의 우선순위 / 리스크 / 미완료 / 결정사항 / 다음 액션" 5개 버킷으로 정리.
 *
 *   같은 사용자/프로젝트/날짜 24h 캐시 (project_pm_briefings).
 */

const BriefSchema = z.object({
  todays: z.array(z.object({
    title: z.string(),
    why: z.string(),
    href: z.string().optional(),
  })).max(5).describe("오늘 우선 처리할 일 — 마감 임박 / 중요도 높음"),
  risks: z.array(z.object({
    title: z.string(),
    severity: z.union([z.literal("low"), z.literal("medium"), z.literal("high"), z.literal("critical")]),
    note: z.string(),
  })).max(5),
  blocked: z.array(z.object({
    title: z.string(),
    waiting_on: z.string(),
  })).max(5).describe("진행 막혀있는 항목 + 무엇을 기다리는지"),
  decisions: z.array(z.object({
    title: z.string(),
    when: z.string().optional(),
  })).max(5).describe("최근 주요 결정 — 모든 멤버에게 상기"),
  next: z.array(z.string()).max(5).describe("다음 1주 안에 할 액션"),
  summary: z.string().describe("프로젝트 현 상태 한 문장"),
});

export const GET = withRouteLog("projects.pm_brief.get", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: projectId } = await ctx.params;
  const today = new Date().toISOString().slice(0, 10);
  const force = req.nextUrl.searchParams.get("refresh") === "1";

  // 캐시 조회
  if (!force) {
    const { data: cached } = await supabase
      .from("project_pm_briefings")
      .select("buckets, model_used, created_at")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("brief_date", today)
      .maybeSingle();
    if (cached) {
      return NextResponse.json({
        ...((cached.buckets as Record<string, unknown>) || {}),
        cached: true,
        model_used: cached.model_used || "cache",
      });
    }
  }

  // 데이터 수집 — 병렬
  const [proj, ms, tasks, risks, decisions, recentActivity] = await Promise.all([
    supabase.from("projects").select("title, description, status, deadline, type, total_budget").eq("id", projectId).maybeSingle(),
    supabase.from("project_milestones").select("id, title, status, due_date").eq("project_id", projectId).order("due_date", { ascending: true }).limit(20),
    supabase.from("project_tasks").select("id, title, status, due_date, assigned_to").eq("project_id", projectId).neq("status", "done").order("due_date", { ascending: true }).limit(30),
    supabase.from("project_risks").select("id, title, severity, status, due_at").eq("project_id", projectId).neq("status", "resolved").order("severity", { ascending: false }).limit(15),
    supabase.from("project_decisions").select("id, title, decided_at").eq("project_id", projectId).eq("status", "active").order("decided_at", { ascending: false }).limit(10),
    supabase.from("space_activity_log").select("action, summary, created_at").eq("owner_type", "bolt").eq("owner_id", projectId).order("created_at", { ascending: false }).limit(20),
  ]);

  if (!proj.data) return NextResponse.json({ error: "project_not_found" }, { status: 404 });

  const condensed = {
    project: proj.data,
    milestones: ms.data || [],
    open_tasks: tasks.data || [],
    open_risks: risks.data || [],
    recent_decisions: decisions.data || [],
    recent_activity: recentActivity.data || [],
    today_iso: new Date().toISOString(),
  };

  let buckets: z.infer<typeof BriefSchema>;
  let modelUsed = "fallback";

  try {
    const result = await generateObjectWithFallback(BriefSchema, {
      system: [
        "당신은 NutUnion 의 프로젝트 매니저 AI 입니다.",
        "한국어로, 프로젝트 데이터를 받아서 5개 버킷(todays/risks/blocked/decisions/next) + summary 로 정리합니다.",
        "todays 는 마감 임박 + 중요도 우선. risks 는 severity 내림차순.",
        "blocked 는 외부 답변 대기 / 자료 미수령 같이 다른 사람·자료 때문에 막힌 항목.",
        "decisions 는 active 결정 중 모두에게 상기할 만한 것 3~5개.",
        "next 는 다음 1주 안에 할 일을 짧은 imperative 문장으로.",
      ].join(" "),
      prompt: `다음 프로젝트 데이터를 분석해 주세요:\n\n${JSON.stringify(condensed, null, 2)}`,
      tier: "fast",
      maxOutputTokens: 1200,
      timeoutMs: 30_000,
    });
    if (!result.object) throw new Error("ai returned no object");
    buckets = result.object;
    modelUsed = result.model_used;
  } catch (err) {
    // Rule-based fallback — minimal but useful
    const overdueTask = (condensed.open_tasks as { title: string; due_date: string | null }[])
      .filter((t) => t.due_date && new Date(t.due_date) < new Date());
    buckets = {
      summary: `진행 중 ${condensed.open_tasks.length}개 태스크, 리스크 ${condensed.open_risks.length}건.`,
      todays: overdueTask.slice(0, 5).map((t) => ({
        title: t.title, why: "마감 지났음 — 우선 처리", href: undefined,
      })),
      risks: (condensed.open_risks as { title: string; severity: "low"|"medium"|"high"|"critical" }[]).slice(0, 5).map((r) => ({
        title: r.title, severity: r.severity, note: "확인 필요",
      })),
      blocked: [],
      decisions: (condensed.recent_decisions as { title: string; decided_at: string }[]).slice(0, 5).map((d) => ({
        title: d.title, when: d.decided_at,
      })),
      next: [],
    };
    modelUsed = `fallback:${(err as Error).message.slice(0, 60)}`;
  }

  // 캐시 저장 (best effort)
  await supabase.from("project_pm_briefings").upsert({
    project_id: projectId,
    user_id: user.id,
    brief_date: today,
    buckets: buckets as unknown as Record<string, unknown>,
    model_used: modelUsed,
  }, { onConflict: "project_id,user_id,brief_date" });

  return NextResponse.json({ ...buckets, cached: false, model_used: modelUsed });
});

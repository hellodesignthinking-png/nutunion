import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/finance/rate-limit";
import {
  ClosureSchema,
  SYSTEM_PROMPT,
  buildClosurePrompt,
} from "@/lib/ai/project-closure-prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "anthropic/claude-sonnet-4.5";

const BodySchema = z.object({
  extra_notes: z.string().trim().max(5000).optional(),
  /** true → AI 미호출, 전달된 closure_summary 를 수동 저장. 사용자가 AI 결과를 편집 후 저장할 때. */
  manual_summary: z.string().trim().max(20_000).optional(),
  manual_highlights: z
    .object({
      headline: z.string().max(200).optional(),
      achievements: z.array(z.string()).max(20).optional(),
      challenges: z.array(z.string()).max(20).optional(),
      lessons: z.array(z.string()).max(20).optional(),
      final_outputs: z.array(z.string()).max(20).optional(),
      key_contributors: z
        .array(
          z.object({
            name: z.string(),
            role: z.string().nullable(),
            contribution: z.string(),
          })
        )
        .max(20)
        .optional(),
    })
    .optional(),
  /** 'draft' | 'confirm' — 드래프트 생성만 / 저장 + status=completed */
  mode: z.enum(["draft", "confirm"]).default("draft"),
});

/**
 * POST /api/projects/[id]/close
 *
 * mode=draft:
 *   AI 로 요약 생성 후 반환 (DB 저장 안 함) → 프론트에서 미리보기/편집
 *
 * mode=confirm:
 *   · manual_summary 가 있으면 그대로 사용 (AI 재호출 안 함)
 *   · 없으면 AI 호출해서 생성
 *   · projects.status='completed', closed_at=now(), closure_* 저장
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // rate limit — 마감은 드문 이벤트. 프로젝트당 시간당 3회면 충분
    const rl = await checkRateLimit(supabase, `${user.id}:project-close`, 3, 3600);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      const first = Object.entries(parsed.error.flatten().fieldErrors)[0]?.[1]?.[0] || "입력값 오류";
      return NextResponse.json({ error: first }, { status: 400 });
    }
    const { extra_notes, manual_summary, manual_highlights, mode } = parsed.data;

    // 권한 체크 — admin/staff 또는 프로젝트 owner/manager
    const [{ data: profile }, { data: project }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    ]);
    if (!project) return NextResponse.json({ error: "프로젝트 없음" }, { status: 404 });

    const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
    let canClose = isAdminStaff;
    if (!canClose) {
      const { data: pm } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      // host / manager 권한만 마감 가능
      canClose = pm?.role === "host" || pm?.role === "manager" || pm?.role === "owner";
    }
    if (!canClose) {
      return NextResponse.json({ error: "마감 권한이 없습니다 (admin/staff 또는 볼트 호스트)" }, { status: 403 });
    }

    // 수동 저장 모드
    if (mode === "confirm" && manual_summary) {
      const { error } = await supabase
        .from("projects")
        .update({
          status: "completed",
          closed_at: new Date().toISOString(),
          closed_by: user.id,
          closure_summary: manual_summary,
          closure_highlights: manual_highlights ?? null,
          closure_model: null, // 수동 작성
        })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, confirmed: true, manual: true });
    }

    // 프로젝트 데이터 수집
    const [milestonesRes, membersRes, digestsRes] = await Promise.all([
      supabase
        .from("project_milestones")
        .select("title, status, due_date, description")
        .eq("project_id", id)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(100),
      supabase
        .from("project_members")
        .select("user_id, role, joined_at")
        .eq("project_id", id)
        .limit(200),
      supabase
        .from("chat_digests")
        .select("title, chat_date, summary, decisions")
        .eq("entity_type", "project")
        .eq("entity_id", id)
        .order("created_at", { ascending: true })
        .limit(50),
    ]);

    const memberIds = (membersRes.data ?? []).map((m) => m.user_id);
    const { data: memberProfiles } = memberIds.length
      ? await supabase.from("profiles").select("id, nickname").in("id", memberIds)
      : { data: [] };
    const profileMap = new Map((memberProfiles ?? []).map((p) => [p.id, p.nickname as string]));

    const members = (membersRes.data ?? []).map((m) => ({
      nickname: profileMap.get(m.user_id) ?? "(알 수 없음)",
      role: m.role ?? null,
      joined_at: m.joined_at,
    }));

    const prompt = buildClosurePrompt({
      title: project.title,
      description: project.description,
      category: project.category,
      created_at: project.created_at,
      milestones: (milestonesRes.data ?? []) as {
        title: string;
        status: string;
        due_date: string | null;
        description?: string | null;
      }[],
      members,
      digests: (digestsRes.data ?? []) as {
        title: string;
        chat_date: string | null;
        summary: string;
        decisions: string[];
      }[],
      extra: extra_notes,
    });

    // AI 호출
    const startedAt = Date.now();
    let object, usage;
    try {
      const result = await generateObject({
        model: MODEL,
        schema: ClosureSchema,
        system: SYSTEM_PROMPT,
        prompt,
        maxOutputTokens: 3000,
      });
      object = result.object;
      usage = result.usage;
    } catch (genErr) {
      console.error("[project-close]", genErr);
      return NextResponse.json(
        { error: "AI 요약 생성 실패. 잠시 후 다시 시도해주세요." },
        { status: 500 }
      );
    }

    // AI 사용량 로깅 (draft 도 비용 발생)
    await supabase.from("ai_usage_logs").insert({
      actor_id: user.id,
      actor_email: user.email,
      endpoint: "project-close",
      model: MODEL,
      input_tokens: (usage as { inputTokens?: number })?.inputTokens ?? 0,
      output_tokens: (usage as { outputTokens?: number })?.outputTokens ?? 0,
      content_type: mode,
      entity_type: "project",
      entity_id: id,
      duration_ms: Date.now() - startedAt,
      success: true,
    });

    if (mode === "draft") {
      return NextResponse.json({ success: true, draft: object });
    }

    // confirm — DB 반영
    const { error: upErr } = await supabase
      .from("projects")
      .update({
        status: "completed",
        closed_at: new Date().toISOString(),
        closed_by: user.id,
        closure_summary: object.summary,
        closure_highlights: {
          headline: object.headline,
          achievements: object.achievements,
          challenges: object.challenges,
          lessons: object.lessons,
          key_contributors: object.key_contributors,
          final_outputs: object.final_outputs,
          stats: {
            total_milestones: milestonesRes.data?.length ?? 0,
            completed_milestones:
              milestonesRes.data?.filter((m) => m.status === "completed").length ?? 0,
            total_members: members.length,
            total_digests: digestsRes.data?.length ?? 0,
          },
        },
        closure_model: MODEL,
      })
      .eq("id", id);

    if (upErr) {
      console.error("[project-close confirm]", upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // Venture 모드 볼트가 마감되면 자동으로 결재 상신 (admin/staff 보고용)
    if (project.venture_mode) {
      try {
        await supabase.from("approvals").insert({
          title: `[Venture 마감 보고] ${project.title}`,
          doc_type: "마감보고",
          content: `${object.headline}\n\n${object.summary}\n\n주요 성과:\n${(object.achievements || []).map((a: string) => `- ${a}`).join("\n")}`,
          status: "대기",
          request_date: new Date().toISOString().slice(0, 10),
          requester_id: user.id,
          company: null,
          attachments: { project_id: id, source: "venture-closure" },
        });
      } catch (err) {
        console.warn("[venture-closure approval]", err);
      }
    }

    return NextResponse.json({ success: true, confirmed: true, draft: object });
  } catch (err) {
    console.error("[project-close]", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/close — 마감 취소 (status=active 복원)
 * admin/staff 또는 closed_by 본인만 가능
 */
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: profile }, { data: project }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("projects").select("closed_by, status").eq("id", id).maybeSingle(),
  ]);
  if (!project) return NextResponse.json({ error: "프로젝트 없음" }, { status: 404 });

  const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
  const isCloser = project.closed_by === user.id;
  if (!isAdminStaff && !isCloser) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { error } = await supabase
    .from("projects")
    .update({
      status: "active",
      closed_at: null,
      closed_by: null,
      closure_summary: null,
      closure_highlights: null,
      closure_model: null,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

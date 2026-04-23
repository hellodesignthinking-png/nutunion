import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { generateText, tool } from "ai";
import { z } from "zod";
import { getUserModel } from "@/lib/ai/vault";
import { NU_AI_MODEL, NU_AI_MODEL_LABEL } from "@/lib/ai/model";
import { log } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

const KST_OFFSET_MIN = 9 * 60;
function kstNow() {
  const d = new Date();
  return new Date(d.getTime() + (KST_OFFSET_MIN - d.getTimezoneOffset()) * 60000);
}

interface ActionLog {
  tool: string;
  args: any;
  result: { ok: boolean; id?: string; message: string; href?: string };
}

export async function POST(req: NextRequest) {
  const span = log.span("dashboard.ai_agent");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    span.end({ status: 401 });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { message } = (await req.json().catch(() => ({}))) as { message?: string };
  if (!message || !message.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  // 유저 컨텍스트 로드
  const [{ data: groups }, { data: projects }] = await Promise.all([
    supabase
      .from("group_members")
      .select("group_id, role, groups(id, name, is_active)")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("project_members")
      .select("project_id, role, projects(id, title, status)")
      .eq("user_id", user.id),
  ]);
  const myGroups = ((groups as any[]) || [])
    .filter((g) => g.groups?.is_active !== false)
    .map((g) => ({ id: g.group_id, name: g.groups?.name }));
  const myProjects = ((projects as any[]) || [])
    .filter((p) => p.projects && ["active", "draft"].includes(p.projects.status))
    .map((p) => ({ id: p.project_id, title: p.projects?.title, stage: p.projects?.status }));

  const actions: ActionLog[] = [];
  const db = admin() || supabase;

  // ─────────────── tools ───────────────
  const tools = {
    create_task: tool({
      description: "할 일(태스크)을 생성한다. project_id 가 있으면 해당 볼트의 project_tasks 에, 없으면 개인 personal_tasks 에 생성. due_at 는 YYYY-MM-DD.",
      inputSchema: z.object({
        title: z.string().min(1),
        due_at: z.string().optional().describe("YYYY-MM-DD"),
        project_id: z.string().uuid().optional(),
        assignee_user_id: z.string().uuid().optional(),
        description: z.string().optional(),
      }),
      execute: async (args: any) => {
        try {
          if (args.project_id) {
            // 해당 볼트의 기본(첫) milestone 찾기 or 생성
            const { data: ms } = await db
              .from("project_milestones")
              .select("id")
              .eq("project_id", args.project_id)
              .order("sort_order", { ascending: true })
              .limit(1)
              .maybeSingle();
            let milestoneId = ms?.id;
            if (!milestoneId) {
              const { data: newMs } = await db
                .from("project_milestones")
                .insert({ project_id: args.project_id, title: "기본 마일스톤", status: "in_progress" })
                .select("id")
                .single();
              milestoneId = newMs?.id;
            }
            const { data: t, error } = await db
              .from("project_tasks")
              .insert({
                project_id: args.project_id,
                milestone_id: milestoneId,
                title: args.title,
                description: args.description,
                status: "todo",
                assigned_to: args.assignee_user_id || user.id,
                due_date: args.due_at || null,
              })
              .select("id, project_id")
              .single();
            if (error) throw error;
            const res = { ok: true, id: t!.id, message: "볼트 할 일 추가됨", href: `/projects/${t!.project_id}` };
            actions.push({ tool: "create_task", args, result: res });
            await db.from("user_ai_actions").insert({ user_id: user.id, tool: "create_task", target_table: "project_tasks", target_id: t!.id, args, result: res });
            return res;
          }
          // personal
          const { data: t, error } = await db
            .from("personal_tasks")
            .insert({
              user_id: user.id,
              title: args.title,
              description: args.description,
              status: "todo",
              due_date: args.due_at || null,
            })
            .select("id")
            .single();
          if (error) throw error;
          const res = { ok: true, id: t!.id, message: "개인 할 일 추가됨", href: "/dashboard" };
          actions.push({ tool: "create_task", args, result: res });
          await db.from("user_ai_actions").insert({ user_id: user.id, tool: "create_task", target_table: "personal_tasks", target_id: t!.id, args, result: res });
          return res;
        } catch (err: any) {
          const res = { ok: false, message: "할 일 생성 실패: " + (err?.message || String(err)) };
          actions.push({ tool: "create_task", args, result: res });
          return res;
        }
      },
    }),

    create_event: tool({
      description: "일정(이벤트) 생성. group_id 가 있으면 그 너트의 events 에, is_personal=true 이거나 group_id 없으면 personal_events 에. start_at 는 ISO8601 (KST 가능).",
      inputSchema: z.object({
        title: z.string().min(1),
        start_at: z.string().describe("ISO8601"),
        duration_min: z.number().int().positive().default(60),
        location: z.string().optional(),
        group_id: z.string().uuid().optional(),
        is_personal: z.boolean().optional(),
      }),
      execute: async (args: any) => {
        try {
          const start = new Date(args.start_at);
          const end = new Date(start.getTime() + (args.duration_min || 60) * 60000);
          if (args.group_id && !args.is_personal) {
            const { data: e, error } = await db
              .from("events")
              .insert({
                group_id: args.group_id,
                title: args.title,
                start_at: start.toISOString(),
                end_at: end.toISOString(),
                location: args.location,
                created_by: user.id,
              })
              .select("id, group_id")
              .single();
            if (error) throw error;
            const res = { ok: true, id: e!.id, message: "너트 이벤트 생성됨", href: `/groups/${e!.group_id}/events/${e!.id}` };
            actions.push({ tool: "create_event", args, result: res });
            await db.from("user_ai_actions").insert({ user_id: user.id, tool: "create_event", target_table: "events", target_id: e!.id, args, result: res });
            return res;
          }
          const { data: e, error } = await db
            .from("personal_events")
            .insert({
              user_id: user.id,
              title: args.title,
              start_at: start.toISOString(),
              end_at: end.toISOString(),
              location: args.location,
            })
            .select("id")
            .single();
          if (error) throw error;
          const res = { ok: true, id: e!.id, message: "개인 일정 추가됨", href: "/dashboard" };
          actions.push({ tool: "create_event", args, result: res });
          await db.from("user_ai_actions").insert({ user_id: user.id, tool: "create_event", target_table: "personal_events", target_id: e!.id, args, result: res });
          return res;
        } catch (err: any) {
          const res = { ok: false, message: "이벤트 생성 실패: " + (err?.message || String(err)) };
          actions.push({ tool: "create_event", args, result: res });
          return res;
        }
      },
    }),

    create_meeting: tool({
      description: "회의 생성. 반드시 group_id 또는 project_id 중 하나 필요.",
      inputSchema: z.object({
        title: z.string().min(1),
        scheduled_at: z.string().describe("ISO8601"),
        duration_min: z.number().int().positive().default(60),
        group_id: z.string().uuid().optional(),
        project_id: z.string().uuid().optional(),
        description: z.string().optional(),
      }),
      execute: async (args: any) => {
        try {
          if (!args.group_id && !args.project_id) throw new Error("group_id 또는 project_id 필요");
          const { data: m, error } = await db
            .from("meetings")
            .insert({
              title: args.title,
              scheduled_at: new Date(args.scheduled_at).toISOString(),
              duration_min: args.duration_min || 60,
              group_id: args.group_id || null,
              project_id: args.project_id || null,
              description: args.description,
              created_by: user.id,
              status: "scheduled",
            })
            .select("id, group_id, project_id")
            .single();
          if (error) throw error;
          const href = m!.group_id ? `/groups/${m!.group_id}/meetings/${m!.id}` : `/projects/${m!.project_id}`;
          const res = { ok: true, id: m!.id, message: "회의 생성됨", href };
          actions.push({ tool: "create_meeting", args, result: res });
          await db.from("user_ai_actions").insert({ user_id: user.id, tool: "create_meeting", target_table: "meetings", target_id: m!.id, args, result: res });
          return res;
        } catch (err: any) {
          const res = { ok: false, message: "회의 생성 실패: " + (err?.message || String(err)) };
          actions.push({ tool: "create_meeting", args, result: res });
          return res;
        }
      },
    }),

    create_wiki_draft: tool({
      description: "너트 위키 초안 생성 (draft 상태).",
      inputSchema: z.object({
        group_id: z.string().uuid(),
        title: z.string().min(1),
        content: z.string().min(1),
      }),
      execute: async (args: any) => {
        try {
          const { data: w, error } = await db
            .from("wiki_pages")
            .insert({
              group_id: args.group_id,
              title: args.title,
              content: args.content,
              status: "draft",
              created_by: user.id,
            })
            .select("id, group_id")
            .single();
          if (error) throw error;
          const res = { ok: true, id: w!.id, message: "위키 초안 생성됨", href: `/groups/${w!.group_id}/wiki` };
          actions.push({ tool: "create_wiki_draft", args, result: res });
          await db.from("user_ai_actions").insert({ user_id: user.id, tool: "create_wiki_draft", target_table: "wiki_pages", target_id: w!.id, args, result: res });
          return res;
        } catch (err: any) {
          const res = { ok: false, message: "위키 초안 실패: " + (err?.message || String(err)) };
          actions.push({ tool: "create_wiki_draft", args, result: res });
          return res;
        }
      },
    }),

    send_group_message: tool({
      description: "내가 멤버인 너트(group)의 채팅방에 메시지 전송.",
      inputSchema: z.object({
        group_id: z.string().uuid(),
        content: z.string().min(1),
      }),
      execute: async (args: any) => {
        try {
          // 멤버십 가드 — 내가 active 멤버인 너트만 메시지 전송 허용
          const { data: member } = await db
            .from("group_members")
            .select("status")
            .eq("group_id", args.group_id)
            .eq("user_id", user.id)
            .eq("status", "active")
            .maybeSingle();
          if (!member) {
            const res = { ok: false, message: "해당 너트의 멤버가 아닙니다" };
            actions.push({ tool: "send_group_message", args, result: res });
            return res;
          }
          // group 의 chat_room 찾기
          const { data: room } = await db.from("chat_rooms").select("id").eq("group_id", args.group_id).maybeSingle();
          if (!room) throw new Error("해당 너트의 채팅방이 없음");
          const { data: msg, error } = await db
            .from("chat_messages")
            .insert({
              room_id: room.id,
              sender_id: user.id,
              content: args.content,
            })
            .select("id")
            .single();
          if (error) throw error;
          const res = { ok: true, id: msg!.id, message: "채팅 전송됨", href: `/chat` };
          actions.push({ tool: "send_group_message", args, result: res });
          await db.from("user_ai_actions").insert({ user_id: user.id, tool: "send_group_message", target_table: "chat_messages", target_id: msg!.id, args, result: res });
          return res;
        } catch (err: any) {
          const res = { ok: false, message: "메시지 전송 실패: " + (err?.message || String(err)) };
          actions.push({ tool: "send_group_message", args, result: res });
          return res;
        }
      },
    }),

    design_new_space: tool({
      description:
        "Genesis AI 로 새 너트(group) 또는 볼트(project) 공간 설계. 사용자 의도(intent) 를 받아 phases+wikis+roles+first_tasks 로드맵을 생성한다. auto_provision=true 면 실제 DB 에 즉시 생성까지 수행 (신중히). 기본은 false — 계획만 생성하고 유저가 UI에서 확정.",
      inputSchema: z.object({
        intent: z.string().min(3).describe("한 줄 공간 의도. 예: '20대 개발자 커뮤니티' 또는 'LH 분석 플랫폼 MVP'"),
        kind: z.enum(["group", "project"]),
        auto_provision: z.boolean().optional().default(false),
      }),
      execute: async (args: any) => {
        try {
          const origin = req.nextUrl.origin;
          const cookieHeader = req.headers.get("cookie") || "";

          // Step 1: plan 생성
          const planRes = await fetch(`${origin}/api/genesis/plan`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: cookieHeader },
            body: JSON.stringify({ intent: args.intent, kind: args.kind }),
          });
          if (!planRes.ok) {
            const errText = await planRes.text().catch(() => "");
            throw new Error(`Genesis plan 실패: ${errText.slice(0, 150)}`);
          }
          const planData = await planRes.json();
          const plan = planData.plan;
          const modelUsedPlan = planData.model_used;

          if (!plan) throw new Error("plan 생성 실패 (빈 응답)");

          const phaseCount = plan.phases?.length || 0;
          const taskCount = (plan.first_tasks?.length || 0) +
            (plan.phases || []).reduce((s: number, p: any) => s + (p.milestones?.length || 0), 0);

          // plan 을 genesis_plans 에 임시 저장 (target_id=null, 확정 전)
          let draftId: string | null = null;
          try {
            const { data: draft } = await db
              .from("genesis_plans")
              .insert({
                owner_id: user.id,
                target_kind: args.kind,
                target_id: null,
                intent: args.intent,
                plan,
                model_used: modelUsedPlan || null,
              })
              .select("id")
              .single();
            draftId = draft?.id || null;
          } catch { /* migration 104 미적용 */ }

          if (!args.auto_provision) {
            const res = {
              ok: true,
              id: draftId || undefined,
              message: `계획 생성됨: ${plan.title} (Phase ${phaseCount}개, Task ${taskCount}개) — '확정 생성' 버튼을 눌러주세요.`,
              href: draftId ? `/genesis?draft=${draftId}` : `/genesis`,
              // 특수 필드 — UI 가 genesis_plan 미리보기 카드로 렌더
              genesis_plan: {
                draft_id: draftId,
                kind: args.kind,
                intent: args.intent,
                plan,
                model_used: modelUsedPlan,
                phase_count: phaseCount,
                task_count: taskCount,
              },
            };
            actions.push({ tool: "design_new_space", args, result: res });
            await db.from("user_ai_actions").insert({
              user_id: user.id,
              tool: "design_new_space",
              target_table: "genesis_plans",
              target_id: draftId,
              args,
              result: { ok: true, message: res.message, draft_id: draftId },
            });
            return res;
          }

          // auto_provision=true → 즉시 provision
          const provRes = await fetch(`${origin}/api/genesis/provision`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: cookieHeader },
            body: JSON.stringify({
              kind: args.kind,
              plan,
              intent: args.intent,
              model_used: modelUsedPlan,
            }),
          });
          if (!provRes.ok) {
            const errText = await provRes.text().catch(() => "");
            throw new Error(`Genesis provision 실패: ${errText.slice(0, 150)}`);
          }
          const provData = await provRes.json();
          const href = args.kind === "group" ? `/groups/${provData.target_id}` : `/projects/${provData.target_id}`;
          const res = {
            ok: true,
            id: provData.target_id,
            message: `✨ ${plan.title} 공간이 생성되었습니다 (위키 ${provData.summary?.wikis_created || 0}, Task ${provData.summary?.tasks_created || 0}, 폴더 ${provData.summary?.folders_scaffolded || 0}).`,
            href,
          };
          actions.push({ tool: "design_new_space", args, result: res });
          await db.from("user_ai_actions").insert({
            user_id: user.id,
            tool: "design_new_space",
            target_table: args.kind === "group" ? "groups" : "projects",
            target_id: provData.target_id,
            args,
            result: res,
          });
          return res;
        } catch (err: any) {
          const res = { ok: false, message: "Genesis 설계 실패: " + (err?.message || String(err)) };
          actions.push({ tool: "design_new_space", args, result: res });
          return res;
        }
      },
    }),

    summarize: tool({
      description: "사용자의 현재 상태를 요약 텍스트로 반환. scope: today | groups | projects | tasks",
      inputSchema: z.object({
        scope: z.enum(["today", "groups", "projects", "tasks"]),
      }),
      execute: async (args: any) => {
        try {
          const lines: string[] = [];
          if (args.scope === "today" || args.scope === "groups") {
            lines.push(`내 너트: ${myGroups.map((g) => g.name).join(", ") || "없음"}`);
          }
          if (args.scope === "today" || args.scope === "projects") {
            lines.push(`내 볼트: ${myProjects.map((p) => p.title).join(", ") || "없음"}`);
          }
          if (args.scope === "tasks" || args.scope === "today") {
            const { data: tks } = await db
              .from("project_tasks")
              .select("title, due_date, status")
              .eq("assigned_to", user.id)
              .in("status", ["todo", "in_progress"])
              .limit(10);
            lines.push(`할 일: ${(tks || []).map((t: any) => `${t.title}${t.due_date ? "(" + t.due_date + ")" : ""}`).join(", ") || "없음"}`);
          }
          const res = { ok: true, message: lines.join("\n") };
          actions.push({ tool: "summarize", args, result: res });
          return res;
        } catch (err: any) {
          const res = { ok: false, message: "요약 실패: " + (err?.message || String(err)) };
          actions.push({ tool: "summarize", args, result: res });
          return res;
        }
      },
    }),
  };

  // 최근 태스크/이벤트 (컨텍스트용)
  const { data: recentTasks } = await supabase
    .from("project_tasks")
    .select("title, due_date, status, project_id")
    .eq("assigned_to", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const today = kstNow().toISOString().slice(0, 10);

  const system = `당신은 한국어 퍼스널 AI 비서이다. 사용자의 자연어 요청을 파악해 필요하면 도구(tool)를 호출해 실제 데이터를 생성/조회한다.

오늘 날짜(KST): ${today}
사용자 너트(groups): ${JSON.stringify(myGroups)}
사용자 볼트(projects): ${JSON.stringify(myProjects)}
최근 할 일: ${JSON.stringify((recentTasks || []).slice(0, 5))}

규칙:
- 이름으로 너트/볼트를 지칭하면 위 id 로 매핑
- 날짜/시간은 KST. "내일 오후 3시" → 오늘+1 15:00 KST (ISO8601 with +09:00)
- 생성 계열 도구는 꼭 필요할 때만 호출 (애매하면 summarize 로 조회 먼저)
- 도구 실행 후 짧은 한국어 확인 메시지를 마지막에 쓴다 (1-2문장)
- "새 너트/볼트 만들어줘", "~~ 프로젝트 시작하려는데 공간 만들어줘" 등 공간 설계 요청 → design_new_space 사용 (기본은 auto_provision=false 로 계획만 제시)`;

  let replyText = "";
  let modelLabel = NU_AI_MODEL_LABEL;
  const runAgent = async (model: any, label: string) => {
    const { text } = await generateText({
      model,
      system,
      prompt: message,
      tools: tools as any,
      stopWhen: [{ stepCount: 5 } as any, { toolCallCount: 5 } as any] as any,
      maxOutputTokens: 800,
    });
    modelLabel = label;
    return text;
  };

  const userModel = await getUserModel(user.id, "fast");
  // 1차: 유저 키 → 2차: 플랫폼(NU_AI_MODEL, 넛유니온 제공) → 3차: 정중한 실패 메시지
  if (userModel) {
    try {
      replyText = await runAgent(userModel.model, `${userModel.label} (user)`);
    } catch (err: any) {
      log.warn("ai_agent.user_key_failed_fallback_platform", { error: err?.message, label: userModel.label });
      try {
        replyText = await runAgent(NU_AI_MODEL, `${NU_AI_MODEL_LABEL} (platform fallback)`);
      } catch (err2: any) {
        log.warn("ai_agent.platform_failed", { error: err2?.message });
        replyText = `죄송해요, AI 실행에 실패했어요: ${err2?.message || "unknown"}`;
      }
    }
  } else {
    // 유저 키 미설정 — 넛유니온 플랫폼 AI 가 수행
    try {
      replyText = await runAgent(NU_AI_MODEL, `${NU_AI_MODEL_LABEL} (nutunion platform)`);
    } catch (err: any) {
      log.warn("ai_agent.platform_failed_no_user_key", { error: err?.message });
      replyText = `죄송해요, AI 실행에 실패했어요: ${err?.message || "unknown"}`;
    }
  }

  span.end({ actions: actions.length, model: modelLabel });
  return NextResponse.json({ reply: replyText, actions, model_used: modelLabel });
}

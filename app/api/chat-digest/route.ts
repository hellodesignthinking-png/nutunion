import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/finance/rate-limit";
import {
  ChatDigestSchema,
  SYSTEM_PROMPT,
  buildUserPrompt,
} from "@/lib/ai/chat-digest-prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

import { NU_AI_MODEL, NU_AI_MODEL_LABEL } from "@/lib/ai/model";
const MODEL = NU_AI_MODEL;
const MODEL_LABEL = NU_AI_MODEL_LABEL;
const MAX_CHAT_LENGTH = 60_000; // 글자수

const RequestSchema = z.object({
  entity_type: z.enum(["project", "member", "group"]),
  entity_id: z.string().uuid("entity_id 는 UUID 여야 합니다"),
  title: z.string().trim().min(1, "제목 필수").max(200),
  chat: z.string().trim().min(20, "대화가 너무 짧습니다").max(MAX_CHAT_LENGTH),
  chat_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
    .optional(),
  source: z.enum(["kakao", "slack", "manual", "other"]).optional().default("kakao"),
  save_raw: z.boolean().optional().default(false),
});

/**
 * POST /api/chat-digest
 * 대화 로그를 AI 로 회의록 형태로 요약해 저장.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // rate limit: 분당 3건, 시간당 15건 (AI 비용 보호)
    const rl1 = await checkRateLimit(supabase, `${user.id}:chat-digest:min`, 3, 60);
    if (!rl1.allowed) return rateLimitResponse(rl1);
    const rl2 = await checkRateLimit(supabase, `${user.id}:chat-digest:hour`, 15, 3600);
    if (!rl2.allowed) return rateLimitResponse(rl2);

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const first =
        Object.entries(flat.fieldErrors)[0]?.[1]?.[0] ||
        flat.formErrors[0] ||
        "입력값 오류";
      return NextResponse.json({ error: first }, { status: 400 });
    }
    const d = parsed.data;

    // 엔터티 접근 권한 간단 검증 (project: 멤버 여부 / member: 본인 또는 admin/staff)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();
    const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";

    if (d.entity_type === "member") {
      if (!isAdminStaff && d.entity_id !== user.id) {
        return NextResponse.json({ error: "본인 또는 admin 만 가능" }, { status: 403 });
      }
    } else if (d.entity_type === "project") {
      // 프로젝트 멤버 여부 확인 (admin/staff 는 모두 허용)
      if (!isAdminStaff) {
        const { data: member } = await supabase
          .from("project_members")
          .select("user_id")
          .eq("project_id", d.entity_id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!member) {
          return NextResponse.json({ error: "프로젝트 멤버만 가능" }, { status: 403 });
        }
      }
    }

    // 엔터티 컨텍스트 조회 (AI 프롬프트 품질 향상)
    let entityContext: string | undefined;
    if (d.entity_type === "project") {
      const { data: p } = await supabase
        .from("projects")
        .select("title, description, category")
        .eq("id", d.entity_id)
        .maybeSingle();
      if (p) {
        entityContext = [p.title, p.category, p.description]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 300);
      }
    }

    // AI 호출
    const startedAt = Date.now();
    let object, usage;
    try {
      const result = await generateObject({
        model: MODEL,
        schema: ChatDigestSchema,
        system: SYSTEM_PROMPT,
        prompt: buildUserPrompt({
          title: d.title,
          chatDate: d.chat_date,
          entityContext,
          chat: d.chat,
        }),
        maxOutputTokens: 2500,
      });
      object = result.object;
      usage = result.usage;
    } catch (genErr) {
    log.error(genErr, "chat-digest.failed");
      console.error("[chat-digest]", genErr);
      return NextResponse.json(
        { error: "AI 요약 생성 실패. 잠시 후 다시 시도해주세요." },
        { status: 500 }
      );
    }

    // DB 저장
    const { data: inserted, error: dbErr } = await supabase
      .from("chat_digests")
      .insert({
        entity_type: d.entity_type,
        entity_id: d.entity_id,
        title: d.title,
        chat_date: d.chat_date ?? null,
        source: d.source,
        raw_chat: d.save_raw ? d.chat : null,
        summary: object.summary,
        topics: object.topics,
        decisions: object.decisions,
        action_items: object.action_items,
        participants: object.participants,
        tone: object.tone,
        model: MODEL,
        input_tokens: (usage as { inputTokens?: number })?.inputTokens ?? 0,
        output_tokens: (usage as { outputTokens?: number })?.outputTokens ?? 0,
        created_by: user.id,
      })
      .select()
      .single();

    if (dbErr) {
      console.error("[chat-digest insert]", dbErr);
      return NextResponse.json({ error: "저장 실패" }, { status: 500 });
    }

    // AI 사용량 로그 (별도 테이블)
    await supabase.from("ai_usage_logs").insert({
      actor_id: user.id,
      actor_email: user.email,
      endpoint: "chat-digest",
      model: MODEL,
      input_tokens: (usage as { inputTokens?: number })?.inputTokens ?? 0,
      output_tokens: (usage as { outputTokens?: number })?.outputTokens ?? 0,
      content_type: d.source,
      entity_type: d.entity_type,
      entity_id: d.entity_id,
      duration_ms: Date.now() - startedAt,
      success: true,
    });

    return NextResponse.json({ success: true, digest: inserted });
  } catch (err) {
    log.error(err, "chat-digest.failed");
    console.error("[chat-digest]", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { generateObjectForUser } from "@/lib/ai/vault";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/spaces/blocks/{id}/ai
 *   body: { action: "rewrite" | "summarize" | "expand" | "continue" | "improve" | "translate", instruction?: string, target_lang?: string }
 *   → { suggestion: string, model_used: string }
 *
 * Notion 의 AI 는 별도 UI 인 반면, 우리는 어떤 블록에서든 Cmd+I 로 즉시 호출.
 * 결과는 클라이언트가 preview 후 accept/discard.
 */
const AI_ACTIONS = ["rewrite", "summarize", "expand", "continue", "improve", "translate"] as const;

const AiBlockSchema = z.object({
  suggestion: z.string().min(1).max(8000),
});

export const POST = withRouteLog("spaces.blocks.ai", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rl = rateLimit(`block-ai:${user.id}`, 20, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "분당 20회 한도 초과", code: "RATE_LIMITED" }, { status: 429 });
  }

  const { id: blockId } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    action?: string;
    instruction?: string;
    target_lang?: string;
  } | null;
  if (!body?.action || !AI_ACTIONS.includes(body.action as typeof AI_ACTIONS[number])) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  // 블록 가져오기 (RLS 로 권한 자동 검증)
  const { data: block, error: blockErr } = await supabase
    .from("space_page_blocks")
    .select("id, type, content, page_id")
    .eq("id", blockId)
    .single();
  if (blockErr || !block) {
    return NextResponse.json({ error: "block_not_found" }, { status: 404 });
  }

  const content = String(block.content || "").slice(0, 4000);
  const action = body.action as typeof AI_ACTIONS[number];
  const instruction = body.instruction?.trim() || "";
  const targetLang = body.target_lang?.trim() || "한국어";

  // 액션별 prompt
  let prompt: string;
  switch (action) {
    case "rewrite":
      prompt = `다음 텍스트를 더 명확하고 자연스럽게 다시 써줘. ${instruction ? `추가 지시: ${instruction}` : "원래 의미와 길이는 유지."}\n\n원문:\n${content}`;
      break;
    case "summarize":
      prompt = `다음 텍스트를 1~2문장으로 요약해. 핵심만 남기고 군더더기 제거.${instruction ? `\n추가: ${instruction}` : ""}\n\n원문:\n${content}`;
      break;
    case "expand":
      prompt = `다음 짧은 메모를 3~5문장으로 자연스럽게 확장해. 추가 맥락과 예시 포함.${instruction ? `\n방향: ${instruction}` : ""}\n\n원문:\n${content}`;
      break;
    case "continue":
      prompt = `다음 텍스트의 자연스러운 이어쓰기를 1~3문장 만들어. 기존 톤·스타일 유지.${instruction ? `\n방향: ${instruction}` : ""}\n\n현재까지 쓴 글:\n${content}`;
      break;
    case "improve":
      prompt = `다음 텍스트의 문법·표현·가독성을 개선해. 의미와 길이는 유지.${instruction ? `\n특히: ${instruction}` : ""}\n\n원문:\n${content}`;
      break;
    case "translate":
      prompt = `다음 텍스트를 ${targetLang} 로 번역해.${instruction ? `\n참고: ${instruction}` : ""}\n\n원문:\n${content}`;
      break;
    default:
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  try {
    type AiResult = z.infer<typeof AiBlockSchema>;
    const res = await generateObjectForUser<AiResult>(user.id, AiBlockSchema, {
      system: "당신은 nutunion 의 글쓰기 어시스턴트. 사용자 의도에 맞춰 마크다운 텍스트를 변환하되 JSON 만 응답. suggestion 필드에 결과 텍스트.",
      prompt,
      maxOutputTokens: 1500,
      tier: "fast",
    });
    return NextResponse.json({
      suggestion: res.object?.suggestion ?? "",
      model_used: res.model_used,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "AI 호출 실패", detail: msg }, { status: 502 });
  }
});

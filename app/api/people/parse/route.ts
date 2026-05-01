import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateObjectForUser } from "@/lib/ai/vault";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParseSchema = z.object({
  summary: z.string(),
  inferred_person: z.object({
    name: z.string().nullable(),
    role_hint: z.string().nullable(),
    kakao_id: z.string().nullable(),
  }).nullable(),
  events: z.array(z.object({
    kind: z.enum(["birthday","anniversary","founding_day","memorial","milestone","note"]),
    title: z.string(),
    event_date: z.string().nullable(),
    detail: z.string().optional(),
  })),
  context_notes: z.array(z.string()),
});

/**
 * POST /api/people/parse
 * 카톡/문자 대화 원문을 AI 로 분석 — 인물/이벤트/맥락 단서 추출.
 * SECURITY: 원문은 메모리에서만 처리, 절대 저장/로그하지 않음.
 */
export const POST = withRouteLog("people.parse", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const raw = typeof body?.text === "string" ? body.text : "";
  if (!raw.trim() || raw.length < 20) {
    return NextResponse.json({ error: "text too short" }, { status: 400 });
  }
  if (raw.length > 30000) {
    return NextResponse.json({ error: "text too long (max 30,000 chars)" }, { status: 413 });
  }

  const personHint = typeof body?.person_hint === "string" ? body.person_hint.slice(0, 200) : "";

  const prompt = `아래 카톡/문자 대화 원문을 분석하여 JSON 으로 반환하라.
- summary: 2~3문장 한국어 요약.
- inferred_person: 대화 상대 정보 (알 수 있으면 이름/역할/카카오ID; 모르면 null).
- events: 대화에서 언급된 생일/기념일/창립일/마일스톤 등 중요 이벤트. event_date 는 YYYY-MM-DD, 추정 불가면 null.
- context_notes: 상대에 관한 작은 단서 (가족/취미/근황/관심사) 를 짧은 문장 배열로.

${personHint ? `[힌트] 이 사람과의 대화: ${personHint}\n` : ""}
[대화 원문]
${raw}`;

  try {
    const res = await generateObjectForUser<z.infer<typeof ParseSchema>>(
      auth.user.id,
      ParseSchema,
      {
        system: "당신은 사용자의 인맥 맥락을 대화에서 추출하는 비서다. 반드시 지정된 JSON 스키마로만 답하라.",
        prompt,
        tier: "fast",
        maxOutputTokens: 2000,
      },
    );
    // 원문은 여기서 discarded — 메모리 밖으로 가지 않음
    return NextResponse.json({ result: res.object, model_used: res.model_used });
  } catch (err: any) {
    log.error(err, "people.parse.failed", { user_id: auth.user.id, text_len: raw.length });
    return NextResponse.json({ error: "parse_failed", detail: err?.message || "" }, { status: 500 });
  }
});

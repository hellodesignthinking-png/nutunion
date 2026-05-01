import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { generateObjectForUser } from "@/lib/ai/vault";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ ownerType: string; ownerId: string }>;
}

const ALLOWED_TYPES = [
  "text", "h1", "h2", "h3", "bullet", "numbered", "todo",
  "code", "divider", "quote", "callout", "table",
] as const;

const GeneratedPageSchema = z.object({
  title: z.string().min(1).max(120),
  icon: z.string().min(1).max(4),
  blocks: z
    .array(
      z.object({
        type: z.enum(ALLOWED_TYPES),
        content: z.string().max(2000).default(""),
        data: z.record(z.string(), z.unknown()).optional().default({}),
      }),
    )
    .min(3)
    .max(40),
});

const SYSTEM = `당신은 nutunion 의 한국어 워크스페이스 작성 어시스턴트.
사용자의 한 줄 요청을 바탕으로 노션 풍 블록 페이지를 즉시 만들어준다.

## 출력 규칙
- title: 한국어, 30자 이내, 명사구.
- icon: 이모지 1자 (📝/🚀/📊/💡/🎯/🔍/🧭 등 의미 맞춤).
- blocks: 3~40개. 페이지의 골격 + 채워진 초안.

## 블록 type 사용 가이드
- h1: 페이지 큰 섹션 (한 페이지에 0~1개)
- h2: 주 섹션 (보통 3~6개)
- h3: 하위 섹션
- text: 일반 단락 (1~3문장 단위)
- bullet: 글머리 리스트 (한 항목 = 한 블록)
- numbered: 순서 있는 리스트
- todo: 액션 아이템 (체크박스). 보통 마지막에 묶임
- callout: 주목할 안내 (data.icon 으로 이모지). 페이지당 1~2개
- quote: 인용/원칙
- code: 코드 (data.lang)
- divider: 큰 섹션 구분
- table: data: { columns: [{name}, ...], rows: [[..], ..] } — 표 필요 시

## 작성 톤
- 한국어 비즈니스 한국어 워크 톤 — 군더더기 없음, 행동 중심.
- 비어있는 placeholder 가 아닌, 사용자 의도에 맞춘 *실제 초안*.
- callout 으로 한 줄 컨텍스트 + h2 들로 골격 + bullet/todo 로 디테일.

## 절대 금지
- 마크다운 문법을 content 안에 넣지 말 것 (e.g., "## 제목" — h2 type 으로 분리).
- 빈 content "" 는 가능하지만 최소화.
- 영어 응답 금지.`;

export const POST = withRouteLog("spaces.generate-page", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rl = rateLimit(`gen-page:${user.id}`, 8, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "분당 8회 한도 초과", code: "RATE_LIMITED" }, { status: 429 });
  }

  const { ownerType, ownerId } = await ctx.params;
  if (ownerType !== "nut" && ownerType !== "bolt") {
    return NextResponse.json({ error: "invalid_owner_type" }, { status: 400 });
  }

  const body = await req.json().catch(() => null) as { intent?: string; parent_page_id?: string | null } | null;
  const intent = (body?.intent ?? "").trim();
  if (!intent || intent.length < 4) {
    return NextResponse.json({ error: "의도 4자 이상 필요" }, { status: 400 });
  }
  if (intent.length > 500) {
    return NextResponse.json({ error: "의도는 500자 이내" }, { status: 400 });
  }

  // AI 호출 — plan 생성
  let plan: z.infer<typeof GeneratedPageSchema>;
  try {
    type PlanResult = z.infer<typeof GeneratedPageSchema>;
    const res = await generateObjectForUser<PlanResult>(user.id, GeneratedPageSchema, {
      system: SYSTEM,
      prompt: `사용자 의도: ${intent}\n\n위 의도에 맞춘 블록 페이지를 생성해.`,
      maxOutputTokens: 4000,
      tier: "fast",
    });
    if (!res.object) throw new Error("AI 응답 비어있음");
    plan = res.object;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "AI 페이지 생성 실패", detail: msg }, { status: 502 });
  }

  // 페이지 생성
  const parentPageId = body?.parent_page_id ?? null;
  let nextPos = 0;
  if (parentPageId === null) {
    const { data: rs } = await supabase
      .from("space_pages")
      .select("position")
      .eq("owner_type", ownerType)
      .eq("owner_id", ownerId)
      .is("parent_page_id", null)
      .order("position", { ascending: false })
      .limit(1);
    nextPos = (rs?.[0]?.position ?? -1) + 1;
  } else {
    const { data: cs } = await supabase
      .from("space_pages")
      .select("position")
      .eq("parent_page_id", parentPageId)
      .order("position", { ascending: false })
      .limit(1);
    nextPos = (cs?.[0]?.position ?? -1) + 1;
  }

  const { data: page, error: pageErr } = await supabase
    .from("space_pages")
    .insert({
      owner_type: ownerType,
      owner_id: ownerId,
      parent_page_id: parentPageId,
      title: plan.title,
      icon: plan.icon,
      content: "",
      position: nextPos,
      created_by: user.id,
    })
    .select("id, title, icon, position, parent_page_id, content, created_by, created_at, updated_at")
    .single();
  if (pageErr || !page) {
    return NextResponse.json({ error: pageErr?.message || "페이지 생성 실패" }, { status: 500 });
  }

  // 블록 일괄 insert (position 부여)
  const blockRows = plan.blocks.map((b, i) => ({
    page_id: page.id,
    type: b.type,
    content: b.content || "",
    data: b.data || {},
    position: i,
    created_by: user.id,
  }));
  const { error: blocksErr } = await supabase.from("space_page_blocks").insert(blockRows);
  if (blocksErr) {
    return NextResponse.json({ error: blocksErr.message, page }, { status: 500 });
  }

  return NextResponse.json({
    page,
    blocks_created: blockRows.length,
  });
});

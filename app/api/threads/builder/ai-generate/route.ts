import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateObjectForUser } from "@/lib/ai/vault";
import { z } from "zod";

const FieldSchema = z.object({
  key: z.string(),
  type: z.enum([
    "text", "longtext", "number", "date", "datetime", "checkbox",
    "select", "multiselect", "tags", "person", "url", "location", "file", "currency",
  ]),
  label: z.string(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});
const ViewSchema = z.object({
  kind: z.enum(["list", "table", "calendar", "kanban", "chart", "gallery"]),
  primary_field: z.string().optional(),
  group_by: z.string().optional(),
});
const ActionSchema = z.object({
  kind: z.enum(["add", "edit", "delete", "export", "notify"]),
  label: z.string(),
});

const SpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  scope: z.array(z.enum(["nut", "bolt"])).min(1),
  category: z.enum(["communication", "project", "finance", "space_ops", "platform_ops", "growth", "custom", "integration", "ai"]),
  fields: z.array(FieldSchema).min(1),
  views: z.array(ViewSchema).min(1),
  actions: z.array(ActionSchema).min(1),
  reasoning: z.string(),
});

const SYSTEM_PROMPT = `당신은 Thread Builder Assistant입니다.
사용자의 자연어 요구사항을 받아 Thread 스펙(JSON)을 생성합니다.

규칙:
1. 사용자가 명시한 기능만 포함 — 임의로 추가 금지
2. 필드 타입은 정해진 14개 중 선택: text, longtext, number, currency, date, datetime, checkbox, select, multiselect, tags, person, url, location, file
3. 뷰는 데이터에 가장 적합한 것 1-2개 (list/table/calendar/kanban/chart/gallery)
   - 날짜 기반 → calendar
   - 상태 분류 → kanban (group_by 필수)
   - 숫자 추세 → chart
   - 이미지 위주 → gallery
   - 기본은 list
4. 액션은 add/edit/delete 기본 + 필요한 것만 추가 (export, notify)
5. select/multiselect 필드는 options 배열 필수
6. kanban 뷰는 select 필드 하나를 group_by 로 지정
7. field key 는 영문 snake_case (예: book_title, due_date)
8. 카테고리는 정해진 9개 중 가장 적절한 것 선택
9. icon 은 이모지 1개
10. scope 는 ['nut'] 또는 ['bolt'] 또는 둘 다 — 개인용/소규모는 bolt, 커뮤니티 공용은 nut
11. reasoning 에 1-2 문장으로 설계 의도를 한국어로 설명

응답은 반드시 정해진 JSON 스키마를 따라야 합니다.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const prompt = body?.prompt;
  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
    return NextResponse.json({ error: "prompt_too_short" }, { status: 400 });
  }

  try {
    const result = await generateObjectForUser<z.infer<typeof SpecSchema>>(
      user.id,
      SpecSchema,
      {
        system: SYSTEM_PROMPT,
        prompt: `사용자 요구사항:\n${prompt}\n\n위 요구사항을 충족하는 Thread 스펙을 생성하세요.`,
        tier: "fast",
        maxOutputTokens: 2500,
      },
    );
    return NextResponse.json({ spec: result.object, model_used: result.model_used });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "ai_generation_failed" }, { status: 500 });
  }
}

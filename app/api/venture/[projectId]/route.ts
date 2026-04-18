import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

/** POST — 엔티티별 생성. body.kind 로 분기 */
const InsightSchema = z.object({
  kind: z.literal("insight"),
  source: z.enum(["interview", "observation", "survey", "research", "other"]).optional(),
  quote: z.string().trim().min(5).max(2000),
  pain_point: z.string().trim().max(500).optional(),
  target_user: z.string().trim().max(200).optional(),
  tags: z.array(z.string()).max(10).optional(),
});

const ProblemSchema = z.object({
  kind: z.literal("problem"),
  hmw_statement: z.string().trim().min(10).max(500),
  target_user: z.string().trim().max(200).optional(),
  context: z.string().trim().max(1000).optional(),
  success_metric: z.string().trim().max(300).optional(),
});

const IdeaSchema = z.object({
  kind: z.literal("idea"),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  image_url: z.string().url().optional(),
});

const TaskSchema = z.object({
  kind: z.literal("task"),
  title: z.string().trim().min(2).max(200),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const FeedbackSchema = z.object({
  kind: z.literal("feedback"),
  tester_name: z.string().trim().max(100).optional(),
  score: z.number().int().min(1).max(10).optional(),
  note: z.string().trim().min(3).max(2000),
});

const Body = z.discriminatedUnion("kind", [
  InsightSchema, ProblemSchema, IdeaSchema, TaskSchema, FeedbackSchema,
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "잘못된 입력";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const d = parsed.data;
  const base = { project_id: projectId, author_id: user.id };

  let result;
  switch (d.kind) {
    case "insight":
      result = await supabase.from("venture_insights").insert({
        ...base,
        source: d.source ?? "interview",
        quote: d.quote,
        pain_point: d.pain_point ?? null,
        target_user: d.target_user ?? null,
        tags: d.tags ?? [],
      }).select().single();
      break;
    case "problem":
      result = await supabase.from("venture_problems").insert({
        ...base,
        hmw_statement: d.hmw_statement,
        target_user: d.target_user ?? null,
        context: d.context ?? null,
        success_metric: d.success_metric ?? null,
      }).select().single();
      break;
    case "idea":
      result = await supabase.from("venture_ideas").insert({
        ...base,
        title: d.title,
        description: d.description ?? null,
        image_url: d.image_url ?? null,
      }).select().single();
      break;
    case "task": {
      const { data: maxRow } = await supabase
        .from("venture_prototype_tasks")
        .select("sort_order")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextOrder = (maxRow?.sort_order ?? 0) + 1;
      result = await supabase.from("venture_prototype_tasks").insert({
        project_id: projectId,
        title: d.title,
        due_date: d.due_date ?? null,
        sort_order: nextOrder,
      }).select().single();
      break;
    }
    case "feedback":
      result = await supabase.from("venture_feedback").insert({
        ...base,
        tester_name: d.tester_name ?? null,
        score: d.score ?? null,
        note: d.note,
      }).select().single();
      break;
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ success: true, item: result.data });
}

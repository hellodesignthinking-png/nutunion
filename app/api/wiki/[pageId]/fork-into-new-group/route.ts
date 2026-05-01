import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;

const Schema = z.object({
  group_name: z.string().trim().min(2).max(100),
  group_description: z.string().trim().max(1000).optional(),
  new_title: z.string().trim().min(2).max(200).optional(),
  topic_title: z.string().trim().min(2).max(100).optional(),
});

/**
 * POST /api/wiki/[pageId]/fork-into-new-group
 * 원클릭: 새 너트(그룹) 생성 → 기본 토픽 생성 → 페이지 파생.
 * 생성자는 호스트가 됨. 원본 페이지의 original_author_id 는 보존.
 */
export const POST = withRouteLog("wiki.pageId.fork-into-new-group", async (req: NextRequest, ctx: { params: Promise<{ pageId: string }> }) => {
  const { pageId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "잘못된 입력";
    return NextResponse.json({ error: first }, { status: 400 });
  }
  const d = parsed.data;

  // 원본 페이지
  const { data: src } = await supabase
    .from("wiki_pages")
    .select("id, title, content, created_by, original_author_id, fork_depth")
    .eq("id", pageId)
    .maybeSingle();
  if (!src) return NextResponse.json({ error: "원본 탭 없음" }, { status: 404 });

  // 1) 그룹 생성
  const { data: group, error: gErr } = await supabase.from("groups").insert({
    name: d.group_name,
    description: d.group_description ?? null,
    host_id: user.id,
    category: "platform",  // 파생으로 시작하는 그룹의 기본 카테고리
  }).select("id").single();
  if (gErr || !group) return NextResponse.json({ error: gErr?.message ?? "그룹 생성 실패" }, { status: 500 });

  // 2) 호스트를 member 로 등록 (RLS 조건을 위해 필요할 수 있음)
  await supabase.from("group_members").insert({
    group_id: group.id,
    user_id: user.id,
    role: "host",
  });

  // 3) 토픽 생성
  const topicTitle = d.topic_title ?? "시작";
  const { data: topic, error: tErr } = await supabase.from("wiki_topics").insert({
    group_id: group.id,
    title: topicTitle,
    description: `${src.title} 에서 파생`,
  }).select("id").single();
  if (tErr || !topic) return NextResponse.json({ error: tErr?.message ?? "토픽 생성 실패" }, { status: 500 });

  // 4) 페이지 파생
  const { data: forked, error: pErr } = await supabase.from("wiki_pages").insert({
    topic_id: topic.id,
    title: (d.new_title ?? `${src.title} (${d.group_name})`).slice(0, 200),
    content: src.content,
    created_by: user.id,
    last_updated_by: user.id,
    version: 1,
    forked_from: src.id,
    original_author_id: (src.original_author_id as string | null) ?? (src.created_by as string | null),
    fork_depth: ((src.fork_depth as number | null) ?? 0) + 1,
  }).select("id").single();
  if (pErr || !forked) return NextResponse.json({ error: pErr?.message ?? "파생 실패" }, { status: 500 });

  // 5) 자동 연결
  await supabase.from("wiki_page_connections").insert({
    source_id: forked.id,
    target_id: src.id,
    relation: "extends",
    note: `새 너트 '${d.group_name}' 의 시작점`,
    created_by: user.id,
  });

  return NextResponse.json({
    success: true,
    group_id: group.id,
    topic_id: topic.id,
    page_id: forked.id,
  });
});

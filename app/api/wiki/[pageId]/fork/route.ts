import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

const Schema = z.object({
  /** 어느 토픽(또는 그룹의 토픽) 으로 파생할지 */
  target_topic_id: z.string().uuid(),
  new_title: z.string().trim().min(2).max(200).optional(),
});

/**
 * POST /api/wiki/[pageId]/fork
 * 기존 탭(wiki page) 을 다른 토픽으로 파생(fork) 합니다.
 * - forked_from 로 원본 페이지 참조
 * - original_author_id 는 최상위 조상의 원작자 유지 (계보 추적)
 * - fork_depth 증가
 */
export const POST = withRouteLog("wiki.pageId.fork", async (req: NextRequest, ctx: { params: Promise<{ pageId: string }> }) => {
  const { pageId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  // 원본 페이지 조회
  const { data: src } = await supabase
    .from("wiki_pages")
    .select("id, title, content, created_by, original_author_id, fork_depth")
    .eq("id", pageId)
    .maybeSingle();
  if (!src) return NextResponse.json({ error: "원본 탭 없음" }, { status: 404 });

  // 대상 토픽 존재 확인
  const { data: topic } = await supabase
    .from("wiki_topics")
    .select("id")
    .eq("id", parsed.data.target_topic_id)
    .maybeSingle();
  if (!topic) return NextResponse.json({ error: "대상 토픽 없음" }, { status: 404 });

  const { data: inserted, error } = await supabase.from("wiki_pages").insert({
    topic_id: parsed.data.target_topic_id,
    title: (parsed.data.new_title ?? `${src.title} (고도화)`).slice(0, 200),
    content: src.content,
    created_by: user.id,
    last_updated_by: user.id,
    version: 1,
    forked_from: src.id,
    // 최상위 조상의 원작자 — 없으면 src 의 created_by
    original_author_id: (src.original_author_id as string | null) ?? (src.created_by as string | null),
    fork_depth: ((src.fork_depth as number | null) ?? 0) + 1,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 자동으로 연결 생성 (새 페이지 → 원본, relation='extends')
  await supabase.from("wiki_page_connections").insert({
    source_id: inserted.id,
    target_id: src.id,
    relation: "extends",
    created_by: user.id,
    note: "자동 생성 (fork)",
  });

  return NextResponse.json({ success: true, page: inserted });
});

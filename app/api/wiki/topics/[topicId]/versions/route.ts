import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

// GET /api/wiki/topics/[topicId]/versions
// 통합탭의 모든 버전 히스토리 (최신순)
export const GET = withRouteLog("wiki.topics.topicId.versions", async (
  _request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) => {
  const { topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  // RLS will gate access, but we still need topic existence check.
  const { data: topic } = await supabase
    .from("wiki_topics")
    .select("id, group_id")
    .eq("id", topicId)
    .single();
  if (!topic) return NextResponse.json({ error: "주제를 찾을 수 없습니다" }, { status: 404 });

  const { data, error } = await supabase
    .from("wiki_topic_versions")
    .select("id, version_number, content_snapshot, synthesis_input, synthesis_summary, created_at, creator:profiles!wiki_topic_versions_created_by_fkey(nickname)")
    .eq("topic_id", topicId)
    .order("version_number", { ascending: false });

  if (error) {
    // graceful fallback if migration 128 not applied
    return NextResponse.json({ versions: [], migration_pending: true, message: error.message });
  }

  const versions = (data || []).map((v: any) => ({
    id: v.id,
    version_number: v.version_number,
    content_snapshot: v.content_snapshot,
    synthesis_input: v.synthesis_input,
    synthesis_summary: v.synthesis_summary,
    created_at: v.created_at,
    created_by_nickname: v.creator?.nickname || "Unknown",
  }));

  return NextResponse.json({ versions });
});

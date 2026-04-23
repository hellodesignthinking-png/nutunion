import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askClaude } from "@/lib/ai/client";

export const maxDuration = 30;

/**
 * POST /api/ai/feed-summarize
 * Body: { groupId } — 특정 너트의 이번 주 활동을 3줄로 요약.
 */

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await req.json();
  if (!groupId) return NextResponse.json({ error: "groupId required" }, { status: 400 });

  const since = new Date(Date.now() - 7 * 86400000).toISOString();

  const [{ data: group }, { data: posts }, { data: joins }] = await Promise.all([
    supabase.from("groups").select("name, description").eq("id", groupId).maybeSingle(),
    supabase
      .from("crew_posts")
      .select("content, type, created_at, author:profiles!crew_posts_author_id_fkey(nickname)")
      .eq("group_id", groupId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("group_members")
      .select("joined_at, profile:profiles!group_members_user_id_fkey(nickname)")
      .eq("group_id", groupId)
      .eq("status", "active")
      .gte("joined_at", since)
      .limit(10),
  ]);

  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const postLines = (posts ?? []).map((p: any) => {
    const author = Array.isArray(p.author) ? p.author[0] : p.author;
    return `- [${p.type}] ${author?.nickname}: ${(p.content ?? "").slice(0, 60)}`;
  }).join("\n") || "없음";

  const joinLines = (joins ?? []).map((j: any) => {
    const prof = Array.isArray(j.profile) ? j.profile[0] : j.profile;
    return `- ${prof?.nickname}`;
  }).join("\n") || "없음";

  const prompt = `아래는 너트 "${group.name}" 의 이번 주 활동 원시 데이터입니다.
**정확히 3줄 bullet** 로 핵심만 한국어 요약해주세요. 과장 금지, 실제 일어난 일만.

## 게시물 ${posts?.length ?? 0}건
${postLines}

## 신규 합류 ${joins?.length ?? 0}명
${joinLines}

출력 예:
• 김OO이 "문화재단 기획서 템플릿" 탭 공유 (3명 저장)
• 박OO이 새 와셔로 합류, 첫 게시물 작성
• 다음 주 수요일 월례 정모 공지됨

3줄만. 각 bullet 50자 이내.`;

  const result = await askClaude({
    userId: user.id,
    feature: "feed_summarize",
    maxTokens: 300,
    user: prompt,
  });
  if (!result.text) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ summary: result.text.trim(), groupName: group.name });
}

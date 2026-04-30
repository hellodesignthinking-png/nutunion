import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/wiki/topics/[topicId]/restore
// Body: { version_number: number }
// 호스트만. 지정한 버전의 content_snapshot 을 현재 콘텐츠로 복원하면서 새 버전을 생성한다.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  const { topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  let body: { version_number?: number } = {};
  try { body = await request.json(); } catch { /* fallthrough */ }
  const versionNumber = Number(body.version_number);
  if (!Number.isFinite(versionNumber) || versionNumber < 1) {
    return NextResponse.json({ error: "version_number 필요" }, { status: 400 });
  }

  // Load topic + permission (host only for restore)
  const { data: topic } = await supabase
    .from("wiki_topics")
    .select("id, group_id, content, current_version")
    .eq("id", topicId)
    .single();
  if (!topic) return NextResponse.json({ error: "주제를 찾을 수 없습니다" }, { status: 404 });

  const { data: groupRow } = await supabase
    .from("groups")
    .select("host_id")
    .eq("id", topic.group_id)
    .single();
  if (groupRow?.host_id !== user.id) {
    return NextResponse.json({ error: "호스트만 복원 가능합니다" }, { status: 403 });
  }

  // Find target version
  const { data: targetVersion, error: tvErr } = await supabase
    .from("wiki_topic_versions")
    .select("id, version_number, content_snapshot")
    .eq("topic_id", topicId)
    .eq("version_number", versionNumber)
    .maybeSingle();
  if (tvErr || !targetVersion) {
    return NextResponse.json({ error: `v${versionNumber} 을 찾을 수 없습니다` }, { status: 404 });
  }

  const oldVersion = topic.current_version || 0;
  const newVersion = oldVersion + 1;
  const existing = (topic.content || "").trim();

  // Snapshot current content as a version row (preserve before overwrite)
  if (existing && oldVersion > 0) {
    await supabase.from("wiki_topic_versions").insert({
      topic_id: topicId,
      version_number: oldVersion,
      content_snapshot: existing,
      synthesis_summary: "(복원 전 자동 보존)",
      created_by: user.id,
    });
  }

  // Apply restored content
  const { error: updateErr } = await supabase
    .from("wiki_topics")
    .update({
      content: targetVersion.content_snapshot,
      current_version: newVersion,
      last_synthesized_at: new Date().toISOString(),
    } as any)
    .eq("id", topicId);
  if (updateErr) {
    return NextResponse.json({ error: `복원 실패: ${updateErr.message}` }, { status: 500 });
  }

  // Insert new version pointing to restored content
  await supabase.from("wiki_topic_versions").insert({
    topic_id: topicId,
    version_number: newVersion,
    content_snapshot: targetVersion.content_snapshot,
    synthesis_input: { restored_from_version: versionNumber },
    synthesis_summary: `v${versionNumber} 콘텐츠로 복원`,
    created_by: user.id,
  });

  return NextResponse.json({
    success: true,
    topic_id: topicId,
    previous_version: oldVersion,
    current_version: newVersion,
    restored_from: versionNumber,
  });
}

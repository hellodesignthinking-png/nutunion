import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50);
  const hash = crypto.randomUUID().slice(0, 12);
  return `${base}-${hash}`;
}

// ── Verify host access ──────────────────────────────────────────────────
async function verifyHost(supabase: any, groupId: string, userId: string): Promise<boolean> {
  const { data: group } = await supabase
    .from("groups")
    .select("host_id")
    .eq("id", groupId)
    .single();

  if (!group) return false;
  if (group.host_id === userId) return true;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return profile?.role === "admin";
}

// ── POST: Publish the entire group wiki as one "너트 탭" ────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const body = await request.json();

  // Legacy single-topic publish (backward compat)
  if (body.topicId && !body.groupId) {
    return publishSingleTopic(supabase, body.topicId, body.publicDescription, user.id);
  }

  // New: Publish entire group wiki as one unified tab
  const { groupId, tabTitle, tabDescription } = body;
  if (!groupId) return NextResponse.json({ error: "groupId 필요" }, { status: 400 });

  const isHost = await verifyHost(supabase, groupId, user.id);
  if (!isHost) return NextResponse.json({ error: "호스트만 발행할 수 있습니다" }, { status: 403 });

  // Validate: must have at least 1 page
  const { data: topics } = await supabase
    .from("wiki_topics")
    .select("id")
    .eq("group_id", groupId);

  if (!topics || topics.length === 0) {
    return NextResponse.json({ error: "발행하려면 최소 1개 이상의 섹션이 필요합니다" }, { status: 400 });
  }

  const topicIds = topics.map((t: any) => t.id);
  const { count: pageCount } = await supabase
    .from("wiki_pages")
    .select("id", { count: "exact", head: true })
    .in("topic_id", topicIds);

  if (!pageCount || pageCount === 0) {
    return NextResponse.json({ error: "발행하려면 최소 1개 이상의 페이지가 필요합니다" }, { status: 400 });
  }

  // Get group name for slug
  const { data: group } = await supabase.from("groups").select("name, wiki_tab_published_slug").eq("id", groupId).single();

  // Reuse existing slug if already published, otherwise create new
  const slug = group?.wiki_tab_published_slug || generateSlug(tabTitle || group?.name || "nut-tab");

  const now = new Date().toISOString();

  // Mark all topics as public (so they can be read via public wiki)
  await supabase
    .from("wiki_topics")
    .update({ is_public: true, published_at: now })
    .in("id", topicIds);

  // Update group wiki status
  const { error: groupError } = await supabase
    .from("groups")
    .update({
      wiki_tab_goal: tabTitle || null,
      wiki_tab_description: tabDescription || null,
      wiki_tab_status: "published",
      wiki_tab_published_slug: slug,
      wiki_tab_published_at: now,
    })
    .eq("id", groupId);

  if (groupError) return NextResponse.json({ error: groupError.message }, { status: 500 });

  return NextResponse.json({ slug, url: `/wiki/${slug}` });
}

// ── PATCH: Update tab goal/description (no publish) ────────────────────
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { groupId, tabGoal, tabDescription } = await request.json();
  if (!groupId) return NextResponse.json({ error: "groupId 필요" }, { status: 400 });

  const isHost = await verifyHost(supabase, groupId, user.id);
  if (!isHost) return NextResponse.json({ error: "호스트만 수정할 수 있습니다" }, { status: 403 });

  const { error } = await supabase
    .from("groups")
    .update({ wiki_tab_goal: tabGoal || null, wiki_tab_description: tabDescription || null })
    .eq("id", groupId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// ── DELETE: Unpublish (reset to building) ──────────────────────────────
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const body = await request.json();

  // Legacy single-topic unpublish
  if (body.topicId && !body.groupId) {
    const { data: topic } = await supabase
      .from("wiki_topics")
      .select("id, group_id")
      .eq("id", body.topicId)
      .single();

    if (!topic) return NextResponse.json({ error: "토픽을 찾을 수 없습니다" }, { status: 404 });

    const isHost = await verifyHost(supabase, topic.group_id, user.id);
    if (!isHost) return NextResponse.json({ error: "호스트만 비공개할 수 있습니다" }, { status: 403 });

    const { error } = await supabase
      .from("wiki_topics")
      .update({ is_public: false, public_slug: null, published_at: null })
      .eq("id", body.topicId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // New: Unpublish entire group wiki
  const { groupId } = body;
  if (!groupId) return NextResponse.json({ error: "groupId 필요" }, { status: 400 });

  const isHost = await verifyHost(supabase, groupId, user.id);
  if (!isHost) return NextResponse.json({ error: "호스트만 비공개할 수 있습니다" }, { status: 403 });

  // Unpublish all topics
  const { data: topics } = await supabase.from("wiki_topics").select("id").eq("group_id", groupId);
  if (topics && topics.length > 0) {
    await supabase
      .from("wiki_topics")
      .update({ is_public: false })
      .in("id", topics.map((t: any) => t.id));
  }

  // Reset group wiki status to 'building'
  const { error } = await supabase
    .from("groups")
    .update({
      wiki_tab_status: "building",
      wiki_tab_published_slug: null,
      wiki_tab_published_at: null,
    })
    .eq("id", groupId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// ── Legacy: publish single topic ───────────────────────────────────────
async function publishSingleTopic(supabase: any, topicId: string, publicDescription: string, userId: string) {
  const { data: topic } = await supabase
    .from("wiki_topics")
    .select("id, name, group_id")
    .eq("id", topicId)
    .single();

  if (!topic) return NextResponse.json({ error: "토픽을 찾을 수 없습니다" }, { status: 404 });

  const isHost = await verifyHost(supabase, topic.group_id, userId);
  if (!isHost) return NextResponse.json({ error: "호스트만 공개할 수 있습니다" }, { status: 403 });

  const { count: pageCount } = await supabase
    .from("wiki_pages")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topicId);

  if (!pageCount || pageCount === 0) {
    return NextResponse.json({ error: "공개하려면 최소 1개 이상의 탭 페이지가 필요합니다" }, { status: 400 });
  }

  const slug = generateSlug(topic.name);
  const { error } = await supabase
    .from("wiki_topics")
    .update({
      is_public: true,
      public_slug: slug,
      public_description: publicDescription || null,
      published_at: new Date().toISOString(),
    })
    .eq("id", topicId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slug, url: `/wiki/${slug}` });
}

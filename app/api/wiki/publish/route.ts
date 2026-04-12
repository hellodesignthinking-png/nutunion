import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50);
  const hash = Math.random().toString(36).slice(2, 8);
  return `${base}-${hash}`;
}

// POST: Publish a wiki topic
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { topicId, publicDescription } = await request.json();
  if (!topicId) return NextResponse.json({ error: "topicId 필요" }, { status: 400 });

  // Verify user is host of the group
  const { data: topic } = await supabase
    .from("wiki_topics")
    .select("id, name, group_id")
    .eq("id", topicId)
    .single();

  if (!topic) return NextResponse.json({ error: "토픽을 찾을 수 없습니다" }, { status: 404 });

  const { data: group } = await supabase
    .from("groups")
    .select("host_id")
    .eq("id", topic.group_id)
    .single();

  if (!group || group.host_id !== user.id) {
    // Check if admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "호스트만 공개할 수 있습니다" }, { status: 403 });
    }
  }

  // Validate: topic must have at least 1 page
  const { count: pageCount } = await supabase
    .from("wiki_pages")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topicId);

  if (!pageCount || pageCount === 0) {
    return NextResponse.json({ error: "공개하려면 최소 1개 이상의 위키 페이지가 필요합니다" }, { status: 400 });
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

// DELETE: Unpublish a wiki topic
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { topicId } = await request.json();
  if (!topicId) return NextResponse.json({ error: "topicId 필요" }, { status: 400 });

  const { error } = await supabase
    .from("wiki_topics")
    .update({ is_public: false, public_slug: null, published_at: null })
    .eq("id", topicId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

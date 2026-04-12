import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

// GET: Fetch resources for a group, optionally filtered by week
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const weekStart = searchParams.get("weekStart");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 200);

  if (!groupId) {
    return NextResponse.json({ error: "groupId 필요" }, { status: 400 });
  }

  const supabase = await createClient();

  let query = supabase
    .from("wiki_weekly_resources")
    .select("*, sharer:profiles!wiki_weekly_resources_shared_by_fkey(id, nickname, avatar_url), linked_page:wiki_pages!wiki_weekly_resources_linked_wiki_page_id_fkey(id, title)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (weekStart) {
    query = query.eq("week_start", weekStart);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ resources: data || [] });
}

// POST: Share a new resource
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  const body = await request.json();
  const { groupId, title, url, resourceType, description } = body;

  if (!groupId || !url) {
    return NextResponse.json({ error: "groupId, url 필요" }, { status: 400 });
  }

  // Auto-detect resource type from URL
  let detectedType = resourceType || "link";
  if (!resourceType) {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) detectedType = "youtube";
    else if (lowerUrl.endsWith(".pdf") || lowerUrl.includes("/pdf")) detectedType = "pdf";
    else if (lowerUrl.includes("notion.so") || lowerUrl.includes("notion.site")) detectedType = "notion";
    else if (lowerUrl.includes("news") || lowerUrl.includes("blog") || lowerUrl.includes("medium.com") || lowerUrl.includes("velog.io")) detectedType = "article";
  }

  // Extract metadata from URL
  const metadata: Record<string, string> = {};
  if (detectedType === "youtube") {
    const videoId = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)?.[1];
    if (videoId) {
      metadata.video_id = videoId;
      metadata.thumbnail_url = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
  }

  const weekStart = getWeekStart();

  const { data, error } = await supabase
    .from("wiki_weekly_resources")
    .insert({
      group_id: groupId,
      week_start: weekStart,
      shared_by: user.id,
      title: title || url,
      url,
      resource_type: detectedType,
      description: description || null,
      metadata,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, resourceType: detectedType });
}

// PATCH: Link a resource to a wiki page
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { resourceId, wikiPageId } = await request.json();
  if (!resourceId) return NextResponse.json({ error: "resourceId 필요" }, { status: 400 });

  const { error } = await supabase
    .from("wiki_weekly_resources")
    .update({ linked_wiki_page_id: wikiPageId || null })
    .eq("id", resourceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE: Remove a resource (only the sharer or group host can delete)
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  const { resourceId } = await request.json();
  if (!resourceId) {
    return NextResponse.json({ error: "resourceId 필요" }, { status: 400 });
  }

  // Fetch resource to check ownership
  const { data: resource } = await supabase
    .from("wiki_weekly_resources")
    .select("id, shared_by, group_id")
    .eq("id", resourceId)
    .single();

  if (!resource) {
    return NextResponse.json({ error: "리소스를 찾을 수 없습니다" }, { status: 404 });
  }

  // Allow deletion only by sharer or group host
  if (resource.shared_by !== user.id) {
    const { data: group } = await supabase
      .from("groups")
      .select("host_id")
      .eq("id", resource.group_id)
      .single();

    if (!group || group.host_id !== user.id) {
      return NextResponse.json({ error: "삭제 권한이 없습니다" }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from("wiki_weekly_resources")
    .delete()
    .eq("id", resourceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

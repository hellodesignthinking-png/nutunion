import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";

async function verifyGroupMembership(
  supabase: SupabaseClient,
  userId: string,
  groupId: string
): Promise<boolean> {
  // Check if user is the group host
  const { data: group } = await supabase
    .from("groups")
    .select("host_id")
    .eq("id", groupId)
    .single();

  if (group?.host_id === userId) return true;

  // Check if user is an active member
  const { data: member } = await supabase
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  return !!member;
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff)).toISOString().split("T")[0];
}

function detectResourceType(fileType: string | null, url: string): string {
  if (!fileType && !url) return "other";
  const lower = (url || "").toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.endsWith(".pdf") || lower.includes("/pdf")) return "pdf";
  if (lower.includes("docs.google.com/document")) return "docs";
  if (lower.includes("docs.google.com/spreadsheets")) return "sheet";
  if (lower.includes("docs.google.com/presentation")) return "slide";
  if (lower.includes("drive.google.com")) return "drive";
  if (lower.includes("notion.so") || lower.includes("notion.site")) return "notion";
  if (fileType?.startsWith("image/")) return "other";
  if (fileType?.includes("pdf")) return "pdf";

  return "other";
}

// GET: Fetch resources for a group, optionally filtered by week
// Merges wiki_weekly_resources AND file_attachments into one unified list
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const weekStart = searchParams.get("weekStart");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 200);

  if (!groupId) {
    return NextResponse.json({ error: "groupId 필요" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  // wiki_weekly_resources has "select using (true)" RLS — allow any authenticated user to read

  // 1) Fetch wiki_weekly_resources (gracefully skip if table doesn't exist)
  type WeeklyResource = Record<string, unknown> & { url?: string; created_at: string; source?: "weekly" };
  let weeklyResources: WeeklyResource[] = [];
  try {
    let query = supabase
      .from("wiki_weekly_resources")
      .select("*, sharer:profiles!wiki_weekly_resources_shared_by_fkey(id, nickname, avatar_url), linked_page:wiki_pages!wiki_weekly_resources_linked_wiki_page_id_fkey(id, title)")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (weekStart) {
      query = query.eq("week_start", weekStart);
    }

    const { data: weeklyData, error: weeklyError } = await query;

    if (!weeklyError && weeklyData) {
      weeklyResources = (weeklyData as Record<string, unknown>[]).map((r) => ({
        ...r,
        created_at: String(r.created_at),
        source: "weekly" as const,
      }));
    }
    // If table doesn't exist (42P01), just skip silently
  } catch {
    // wiki_weekly_resources table may not exist yet — silently skip
  }

  // 2) Fetch file_attachments for the same group (with optional week filter)
  type FileAttachmentView = {
    id: string;
    title: string;
    url: string;
    resource_type: string;
    description: string | null;
    created_at: string;
    source: "resources";
    sharer: { id: string; nickname: string; avatar_url: string | null } | null;
    _fa_file_type?: string;
    _fa_file_size?: number;
  };
  let fileAttachments: FileAttachmentView[] = [];
  try {
    let faQuery = supabase
      .from("file_attachments")
      .select("*, uploader:profiles!file_attachments_uploaded_by_fkey(id, nickname, avatar_url)")
      .eq("target_type", "group")
      .eq("target_id", groupId)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Apply week filter to file_attachments too
    if (weekStart) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      faQuery = faQuery
        .gte("created_at", new Date(weekStart).toISOString())
        .lt("created_at", weekEnd.toISOString());
    }

    const { data: faData, error: faError } = await faQuery;

    if (!faError && faData) {
      type RawFa = { id: string; file_name: string; file_url: string; file_type: string; file_size?: number; created_at: string; uploader?: { id: string; nickname: string; avatar_url: string | null } };
      fileAttachments = (faData as RawFa[]).map((fa) => ({
        id: fa.id,
        title: fa.file_name,
        url: fa.file_url,
        resource_type: detectResourceType(fa.file_type, fa.file_url),
        description: null,
        created_at: fa.created_at,
        source: "resources" as const,
        sharer: fa.uploader
          ? { id: fa.uploader.id, nickname: fa.uploader.nickname, avatar_url: fa.uploader.avatar_url }
          : null,
        // Preserve original file_attachment fields for reference
        _fa_file_type: fa.file_type,
        _fa_file_size: fa.file_size,
      }));
    }
  } catch {
    // file_attachments table may not exist yet — silently skip
  }

  // 3) Merge & deduplicate (avoid showing the same URL from both tables)
  const weeklyUrls = new Set(weeklyResources.map((r) => r.url).filter((u): u is string => !!u));
  const uniqueFileAttachments = fileAttachments.filter((fa) => !weeklyUrls.has(fa.url));

  const merged = [...weeklyResources, ...uniqueFileAttachments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return NextResponse.json({ resources: merged.slice(0, limit) });
}

// POST: Share a new resource
// Also registers it in file_attachments so it appears in 자료실
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  // Rate limit: 30 resources per hour per user
  const { success: rlOk } = rateLimit(`resource:${user.id}`, 30, 3600_000);
  if (!rlOk) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const body = await request.json();
  const { groupId, title, url, resourceType, description } = body;

  if (!groupId || !url) {
    return NextResponse.json({ error: "groupId, url 필요" }, { status: 400 });
  }

  // Input length validation
  if (url.length > 2048) {
    return NextResponse.json({ error: "URL이 너무 깁니다 (최대 2048자)" }, { status: 400 });
  }
  if (title && title.length > 500) {
    return NextResponse.json({ error: "제목이 너무 깁니다 (최대 500자)" }, { status: 400 });
  }

  // Verify group membership
  const isMember = await verifyGroupMembership(supabase, user.id, groupId);
  if (!isMember) {
    return NextResponse.json({ error: "그룹 멤버만 접근할 수 있습니다" }, { status: 403 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "올바른 URL 형식이 아닙니다" }, { status: 400 });
  }

  // Auto-detect resource type from URL
  let detectedType = resourceType || "link";
  if (!resourceType) {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) detectedType = "youtube";
    else if (lowerUrl.endsWith(".pdf") || lowerUrl.includes("/pdf")) detectedType = "pdf";
    else if (lowerUrl.includes("docs.google.com/document")) detectedType = "docs";
    else if (lowerUrl.includes("docs.google.com/spreadsheets")) detectedType = "sheet";
    else if (lowerUrl.includes("docs.google.com/presentation")) detectedType = "slide";
    else if (lowerUrl.includes("drive.google.com")) detectedType = "drive";
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

  // Try inserting into wiki_weekly_resources (may not exist yet)
  let weeklyResourceId: string | null = null;
  try {
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

    if (!error && data) {
      weeklyResourceId = data.id;
    }
  } catch {
    // wiki_weekly_resources table may not exist — continue with file_attachments
  }

  // Skip duplicate file_attachments insert — wiki_weekly_resources is the primary table.
  // file_attachments are fetched separately in GET and merged, so dual-insert causes duplicates.
  const resultId = weeklyResourceId;
  if (!resultId) {
    return NextResponse.json({ error: "리소스 등록에 실패했습니다" }, { status: 500 });
  }

  return NextResponse.json({ id: resultId, resourceType: detectedType });
}

// PATCH: Link a resource to a wiki page
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { resourceId, wikiPageId } = await request.json();
  if (!resourceId) return NextResponse.json({ error: "resourceId 필요" }, { status: 400 });

  // Verify membership via resource's group
  try {
    const { data: resource } = await supabase
      .from("wiki_weekly_resources")
      .select("id, group_id")
      .eq("id", resourceId)
      .single();

    if (!resource) return NextResponse.json({ error: "리소스를 찾을 수 없습니다" }, { status: 404 });

    const isMember = await verifyGroupMembership(supabase, user.id, resource.group_id);
    if (!isMember) return NextResponse.json({ error: "그룹 멤버만 접근할 수 있습니다" }, { status: 403 });

    const { error } = await supabase
      .from("wiki_weekly_resources")
      .update({ linked_wiki_page_id: wikiPageId || null })
      .eq("id", resourceId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } catch {
    return NextResponse.json({ error: "위키 리소스 테이블이 아직 생성되지 않았습니다" }, { status: 500 });
  }

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

  // Try wiki_weekly_resources first
  try {
    const { data: resource } = await supabase
      .from("wiki_weekly_resources")
      .select("id, shared_by, group_id")
      .eq("id", resourceId)
      .single();

    if (resource) {
      // Verify membership
      const isMember = await verifyGroupMembership(supabase, user.id, resource.group_id);
      if (!isMember) {
        return NextResponse.json({ error: "그룹 멤버만 접근할 수 있습니다" }, { status: 403 });
      }

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

      await supabase.from("wiki_weekly_resources").delete().eq("id", resourceId);
      return NextResponse.json({ success: true });
    }
  } catch {
    // Table may not exist — try file_attachments instead
  }

  // Fallback: try file_attachments
  const { data: fa } = await supabase
    .from("file_attachments")
    .select("id, uploaded_by, target_id")
    .eq("id", resourceId)
    .single();

  if (!fa) {
    return NextResponse.json({ error: "리소스를 찾을 수 없습니다" }, { status: 404 });
  }

  if (fa.uploaded_by !== user.id) {
    const { data: group } = await supabase
      .from("groups")
      .select("host_id")
      .eq("id", fa.target_id)
      .single();

    if (!group || group.host_id !== user.id) {
      return NextResponse.json({ error: "삭제 권한이 없습니다" }, { status: 403 });
    }
  }

  const { error } = await supabase.from("file_attachments").delete().eq("id", resourceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

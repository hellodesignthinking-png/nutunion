import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: List synthesis logs for a group
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const limit = parseInt(searchParams.get("limit") || "10");

  if (!groupId) {
    return NextResponse.json({ error: "groupId 필요" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  // Verify requester is a member of the group
  const { data: membership } = await supabase
    .from("group_members")
    .select("status")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  // Also allow group host (check groups table)
  const { data: groupRow } = await supabase
    .from("groups")
    .select("host_id")
    .eq("id", groupId)
    .single();

  const isHost = groupRow?.host_id === user.id;
  const isMember = membership?.status === "active";

  if (!isHost && !isMember) {
    return NextResponse.json({ error: "그룹 멤버만 접근할 수 있습니다" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("wiki_synthesis_logs")
    .select("id, week_start, week_end, synthesis_type, input_summary, output_data, created_at, creator:profiles!wiki_synthesis_logs_created_by_fkey(nickname)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return lightweight summaries (strip full output_data to save bandwidth)
  const logs = (data || []).map((log: any) => ({
    id: log.id,
    weekStart: log.week_start,
    weekEnd: log.week_end,
    type: log.synthesis_type,
    inputSummary: log.input_summary,
    theme: log.output_data?.weeklyTheme || null,
    pagesCreated: log.output_data?.wikiPageSuggestions?.length || 0,
    compactionNote: log.output_data?.compactionNote || null,
    createdBy: log.creator?.nickname || "Unknown",
    createdAt: log.created_at,
  }));

  return NextResponse.json({ logs });
}

import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext { params: Promise<{ id: string }>; }

/** GET — 메시지 50건 (최신순)  ?before=ISO 로 페이지네이션 */
export const GET = withRouteLog("projects.chat.list", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const before = req.nextUrl.searchParams.get("before");

  let q = supabase
    .from("project_chat_messages")
    .select("id, content, author_id, converted_to, attachment_url, parent_id, created_at, edited_at, author:profiles!project_chat_messages_author_id_fkey(id, nickname, avatar_url)")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (before) q = q.lt("created_at", before);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: (data ?? []).reverse() });   // 클라이언트 표시용 시간순
});

/** POST — 메시지 전송 body: { content, parent_id?, attachment_url? } */
export const POST = withRouteLog("projects.chat.send", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    content?: string; parent_id?: string; attachment_url?: string;
  } | null;
  if (!body?.content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });

  const { data, error } = await supabase
    .from("project_chat_messages")
    .insert({
      project_id: id,
      author_id: user.id,
      content: body.content.trim().slice(0, 4000),
      parent_id: body.parent_id || null,
      attachment_url: body.attachment_url || null,
    })
    .select("id, content, author_id, converted_to, attachment_url, parent_id, created_at, author:profiles!project_chat_messages_author_id_fkey(id, nickname, avatar_url)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data }, { status: 201 });
});

/**
 * /api/file-comments
 *  GET  ?file_id=&file_table=  → list (newest first) + 작성자 닉네임/아바타 join
 *  POST { file_id, file_table, content, page? } → insert
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { parseAndNotifyMentions } from "@/lib/notifications/mentions";
import { log } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

const ALLOWED_TABLES = new Set(["file_attachments", "project_resources"]);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const fileId = url.searchParams.get("file_id");
  const fileTable = url.searchParams.get("file_table");
  if (!fileId || !fileTable) {
    return NextResponse.json({ error: "file_id & file_table required" }, { status: 400 });
  }
  if (!ALLOWED_TABLES.has(fileTable)) {
    return NextResponse.json({ error: "invalid file_table" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("file_comments")
    .select("id, file_id, file_table, user_id, page, content, created_at, author:profiles!file_comments_user_id_fkey(nickname, avatar_url)")
    .eq("file_id", fileId)
    .eq("file_table", fileTable)
    .order("created_at", { ascending: false });

  if (error) {
    // profiles FK alias may not exist — fall back to bare select + separate lookup
    const fallback = await supabase
      .from("file_comments")
      .select("id, file_id, file_table, user_id, page, content, created_at")
      .eq("file_id", fileId)
      .eq("file_table", fileTable)
      .order("created_at", { ascending: false });
    if (fallback.error) {
      log.error(fallback.error, "file_comments.list.failed", { file_id: fileId, file_table: fileTable });
      return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    }
    return NextResponse.json({ items: fallback.data || [] });
  }

  return NextResponse.json({ items: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.file_id || !body?.file_table || !body?.content) {
    return NextResponse.json({ error: "file_id, file_table, content required" }, { status: 400 });
  }
  if (!ALLOWED_TABLES.has(body.file_table)) {
    return NextResponse.json({ error: "invalid file_table" }, { status: 400 });
  }

  const payload = {
    file_id: body.file_id,
    file_table: body.file_table,
    user_id: auth.user.id,
    content: String(body.content).slice(0, 4000),
    page: typeof body.page === "number" ? body.page : null,
  };

  const { data, error } = await supabase
    .from("file_comments")
    .insert(payload)
    .select("id, file_id, file_table, user_id, page, content, created_at")
    .maybeSingle();

  if (error) {
    log.error(error, "file_comments.insert.failed", { user_id: auth.user.id });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  log.info("file_comments.inserted", { id: (data as any)?.id, file_table: body.file_table });

  // @ 멘션 알림 디스패치 — 본인 닉네임 + 멘션 매칭 → in-app/email/push 발송
  let mentions: { matched: string[]; notified: string[] } | null = null;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const svc = createServiceClient(url, key, { auth: { persistSession: false } });
      const { data: meProfile } = await svc.from("profiles").select("nickname").eq("id", auth.user.id).maybeSingle();
      const link = body.file_table === "file_attachments"
        ? `/?focus=${body.file_id}#comment-${(data as any)?.id || ""}`
        : `/?focus=${body.file_id}`;
      mentions = await parseAndNotifyMentions({
        text: payload.content,
        authorId: auth.user.id,
        authorNickname: meProfile?.nickname || null,
        contextLabel: "자료실 댓글",
        linkUrl: link,
        serviceClient: svc,
        metadata: { file_id: body.file_id, file_table: body.file_table, comment_id: (data as any)?.id },
      });
    }
  } catch (e: any) {
    log.warn("file_comments.mention_dispatch_failed", { error_message: e?.message });
  }

  return NextResponse.json({ item: data, mentions });
}

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

const ALLOWED_TABLES = new Set([
  "personal_tasks",
  "project_tasks",
  "events",
  "personal_events",
  "meetings",
  "wiki_pages",
  "chat_messages",
]);

export const POST = withRouteLog("dashboard.ai-agent.undo", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { target_id } = (await req.json().catch(() => ({}))) as {
    action_id?: string;
    target_table?: string; // ignored — server re-reads from user_ai_actions
    target_id?: string;
  };

  if (!target_id) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const db = adminClient() || supabase;

  // 서버가 user_ai_actions 에서 소유자·테이블을 재확인 (클라이언트 입력 신뢰 X)
  const { data: action, error: aErr } = await db
    .from("user_ai_actions")
    .select("id, user_id, target_table, target_id")
    .eq("target_id", target_id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (aErr || !action) {
    return NextResponse.json({ error: "취소 가능한 액션을 찾을 수 없음" }, { status: 404 });
  }

  const table = action.target_table as string;
  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ error: "not undoable" }, { status: 400 });
  }

  const { error } = await db.from(table).delete().eq("id", action.target_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("user_ai_actions").delete().eq("id", action.id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
});

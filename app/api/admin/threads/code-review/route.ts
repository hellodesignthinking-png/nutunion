import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

// POST /api/admin/threads/code-review
// Body: { thread_id: string, is_public: boolean }
// Admin-only: toggles public visibility of a code-mode Thread.

export const POST = withRouteLog("admin.threads.code-review", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const thread_id: string | undefined = body?.thread_id;
  const is_public: boolean = !!body?.is_public;
  if (!thread_id) return NextResponse.json({ error: "thread_id_required" }, { status: 400 });

  const { error } = await supabase
    .from("threads")
    .update({ is_public, updated_at: new Date().toISOString() })
    .eq("id", thread_id)
    .eq("builder_mode", "code");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, is_public });
});

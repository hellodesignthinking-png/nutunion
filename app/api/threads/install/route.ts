import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/threads/install
//   body: { slug, target_type: 'nut'|'bolt', target_id, config? }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_json" }, { status: 400 });
  const { slug, target_type, target_id, config } = body as {
    slug?: string; target_type?: "nut" | "bolt"; target_id?: string; config?: Record<string, any>;
  };
  if (!slug || !target_type || !target_id) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (target_type !== "nut" && target_type !== "bolt") {
    return NextResponse.json({ error: "invalid_target_type" }, { status: 400 });
  }

  // Lookup thread
  const { data: thread, error: threadErr } = await supabase
    .from("threads")
    .select("id, slug, scope")
    .eq("slug", slug)
    .maybeSingle();
  if (threadErr) {
    if (/relation .* does not exist/i.test(threadErr.message) || threadErr.code === "42P01") {
      return NextResponse.json({ error: "migration_115_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: threadErr.message }, { status: 500 });
  }
  if (!thread) return NextResponse.json({ error: "thread_not_found" }, { status: 404 });
  if (!Array.isArray(thread.scope) || !thread.scope.includes(target_type)) {
    return NextResponse.json({ error: "scope_mismatch" }, { status: 400 });
  }

  // Pre-check: user must be host/moderator (nut) or lead (bolt)
  if (target_type === "nut") {
    const { data: gm } = await supabase
      .from("group_members")
      .select("role, status")
      .eq("group_id", target_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!gm || gm.status !== "active" || !["host", "moderator"].includes(gm.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } else {
    const { data: pm } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", target_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!pm || pm.role !== "lead") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  // Next position
  const { data: last } = await supabase
    .from("thread_installations")
    .select("position")
    .eq("target_type", target_type)
    .eq("target_id", target_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = (last?.position ?? -1) + 1;

  const { data: inserted, error: insErr } = await supabase
    .from("thread_installations")
    .insert({
      thread_id: thread.id,
      target_type,
      target_id,
      position: nextPos,
      config: config ?? {},
      is_enabled: true,
      installed_by: user.id,
    })
    .select("*")
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json({ error: "already_installed" }, { status: 409 });
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // Bump install_count (best-effort fetch+increment — RLS will block non-owner, ignore)
  try {
    const { data: cur } = await supabase.from("threads").select("install_count").eq("id", thread.id).maybeSingle();
    if (cur) {
      await supabase.from("threads").update({ install_count: (cur.install_count ?? 0) + 1 }).eq("id", thread.id);
    }
  } catch { /* noop */ }

  return NextResponse.json({ installation: inserted });
}

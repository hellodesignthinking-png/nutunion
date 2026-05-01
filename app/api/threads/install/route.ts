import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

// POST /api/threads/install
//   body: { slug, target_type: 'nut'|'bolt', target_id, config? }
export const POST = withRouteLog("threads.install", async (req: NextRequest) => {
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

  // Lookup thread (code-mode 는 approval_status='approved' 필수)
  const { data: thread, error: threadErr } = await supabase
    .from("threads")
    .select("id, slug, scope, ui_component, approval_status, created_by")
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
  // code-mode 보안 가드 — approved 만 install. 작성자 본인은 미승인 상태도 install 가능
  // (자기 너트/볼트에서 미리보기 목적). 마이그 138 미적용 환경(approval_status null) 은 통과.
  if (
    (thread as any).ui_component === "__code__"
    && (thread as any).approval_status === "pending"
    && (thread as any).created_by !== user.id
  ) {
    return NextResponse.json(
      { error: "code-mode Thread 는 admin 승인 후 설치할 수 있어요", code: "PENDING_APPROVAL" },
      { status: 403 },
    );
  }
  if ((thread as any).approval_status === "rejected") {
    return NextResponse.json(
      { error: "이 Thread 는 승인이 거부됐어요", code: "REJECTED" },
      { status: 403 },
    );
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
});

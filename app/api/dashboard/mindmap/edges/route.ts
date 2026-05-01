import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

const MAX_LABEL = 60;

/** GET /api/dashboard/mindmap/edges  → { edges: [...] } */
export const GET = withRouteLog("dashboard.mindmap.edges.get", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("mindmap_user_edges")
    .select("id, source_id, target_id, label")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ edges: data ?? [] });
});

/** POST body: { source_id, target_id, label? } */
export const POST = withRouteLog("dashboard.mindmap.edges.post", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { source_id?: string; target_id?: string; label?: string } | null;
  if (!body?.source_id || !body?.target_id) {
    return NextResponse.json({ error: "source_and_target_required" }, { status: 400 });
  }
  if (body.source_id === body.target_id) {
    return NextResponse.json({ error: "no_self_loop" }, { status: 400 });
  }
  const label = body.label?.trim().slice(0, MAX_LABEL) || null;

  const { data, error } = await supabase
    .from("mindmap_user_edges")
    .insert({ user_id: user.id, source_id: body.source_id, target_id: body.target_id, label })
    .select("id, source_id, target_id, label")
    .single();
  if (error) {
    // 중복 unique 제약은 23505
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "duplicate" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ edge: data });
});

/** PATCH ?id=...  body: { label: string | null } — 사용자 엣지 라벨 갱신 */
export const PATCH = withRouteLog("dashboard.mindmap.edges.patch", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const body = await req.json().catch(() => null) as { label?: string | null } | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const label = body.label === null
    ? null
    : (typeof body.label === "string" ? body.label.trim().slice(0, MAX_LABEL) || null : null);

  const { data, error } = await supabase
    .from("mindmap_user_edges")
    .update({ label })
    .eq("user_id", user.id)
    .eq("id", id)
    .select("id, source_id, target_id, label")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ edge: data });
});

/** DELETE ?id=... — 사용자가 자기 엣지를 지움 */
export const DELETE = withRouteLog("dashboard.mindmap.edges.delete", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const { error } = await supabase
    .from("mindmap_user_edges")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

const MAX_BODY = 2_000;

/** GET /api/dashboard/mindmap/notes?node_id=... */
export const GET = withRouteLog("dashboard.mindmap.notes.get", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const nodeId = new URL(req.url).searchParams.get("node_id");
  if (!nodeId) return NextResponse.json({ error: "node_id_required" }, { status: 400 });

  const { data, error } = await supabase
    .from("mindmap_node_notes")
    .select("id, body, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("node_id", nodeId)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ notes: data ?? [] });
});

/** POST /api/dashboard/mindmap/notes  body: { node_id, body } */
export const POST = withRouteLog("dashboard.mindmap.notes.post", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { node_id?: string; body?: string } | null;
  if (!body?.node_id || !body?.body) {
    return NextResponse.json({ error: "node_id_and_body_required" }, { status: 400 });
  }
  const trimmed = body.body.trim();
  if (!trimmed) return NextResponse.json({ error: "empty_body" }, { status: 400 });
  if (trimmed.length > MAX_BODY) return NextResponse.json({ error: "body_too_long" }, { status: 413 });

  const { data, error } = await supabase
    .from("mindmap_node_notes")
    .insert({ user_id: user.id, node_id: body.node_id, body: trimmed })
    .select("id, body, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ note: data });
});

/** DELETE /api/dashboard/mindmap/notes?id=... */
export const DELETE = withRouteLog("dashboard.mindmap.notes.delete", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const { error } = await supabase
    .from("mindmap_node_notes")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
});

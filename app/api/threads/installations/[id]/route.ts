import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/threads/installations/[id]
//   body: { position?, config?, is_enabled? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_json" }, { status: 400 });

  const patch: Record<string, any> = {};
  if (typeof body.position === "number") patch.position = body.position;
  if (body.config && typeof body.config === "object") patch.config = body.config;
  if (typeof body.is_enabled === "boolean") patch.is_enabled = body.is_enabled;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("thread_installations")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found_or_forbidden" }, { status: 404 });

  return NextResponse.json({ installation: data });
}

// DELETE /api/threads/installations/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase.from("thread_installations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

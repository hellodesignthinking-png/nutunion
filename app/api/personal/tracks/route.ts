import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("personal_projects")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    if (/relation.*personal_projects.*does not exist/i.test(error.message)) {
      return NextResponse.json({ rows: [], migration_needed: 113 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

  const { data, error } = await supabase
    .from("personal_projects")
    .insert({
      user_id: auth.user.id,
      title: body.title.trim(),
      description: body.description || null,
      status: body.status || "idea",
      category: body.category || null,
      progress: Math.max(0, Math.min(100, Number(body.progress) || 0)),
      target_date: body.target_date || null,
      tags: Array.isArray(body.tags) ? body.tags : [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "description", "status", "category", "progress", "target_date", "tags"]) {
    if (k in body) patch[k] = body[k];
  }

  const { data, error } = await supabase
    .from("personal_projects")
    .update(patch)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("personal_projects")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

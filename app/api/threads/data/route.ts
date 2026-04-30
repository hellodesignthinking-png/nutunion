import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/threads/data?installation_id=&limit=&before=
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const installation_id = url.searchParams.get("installation_id");
  const limit = url.searchParams.get("limit");
  const before = url.searchParams.get("before");
  if (!installation_id) {
    return NextResponse.json({ error: "missing_installation_id" }, { status: 400 });
  }

  let q = supabase
    .from("thread_data")
    .select("*")
    .eq("installation_id", installation_id)
    .order("created_at", { ascending: false });
  if (limit) q = q.limit(Math.min(parseInt(limit, 10) || 50, 200));
  if (before) q = q.lt("created_at", before);

  const { data, error } = await q;
  if (error) {
    if (/relation .* does not exist/i.test(error.message) || (error as any).code === "42P01") {
      return NextResponse.json({ rows: [], warning: "migration_115_missing" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data || [] });
}

// POST /api/threads/data  body: { installation_id, data }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_json" }, { status: 400 });
  const { installation_id, data } = body;
  if (!installation_id || typeof data !== "object") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("thread_data")
    .insert({ installation_id, data, created_by: user.id })
    .select("*")
    .single();
  if (error) {
    if (/relation .* does not exist/i.test(error.message) || (error as any).code === "42P01") {
      return NextResponse.json({ error: "migration_115_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ row });
}

// PATCH /api/threads/data  body: { id, data }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_json" }, { status: 400 });
  const { id, data } = body;
  if (!id || typeof data !== "object") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("thread_data")
    .update({ data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row });
}

// DELETE /api/threads/data  body: { id }
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const { error } = await supabase.from("thread_data").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

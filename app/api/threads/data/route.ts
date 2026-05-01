import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkInstallationMembership, checkRowMembership } from "@/lib/threads/membership";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

// GET /api/threads/data?installation_id=&limit=&before=
export const GET = withRouteLog("threads.data.get", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const installation_id = url.searchParams.get("installation_id");
  const limit = url.searchParams.get("limit");
  const before = url.searchParams.get("before");
  if (!installation_id) {
    return NextResponse.json({ error: "missing_installation_id" }, { status: 400 });
  }

  // Membership gate — RLS on thread_data filters rows by installation membership for nut/bolt,
  // but we want a clear 403 instead of an empty array when an outsider guesses an installation_id.
  const m = await checkInstallationMembership(supabase, installation_id, user.id);
  if (!m.ok) {
    if (m.error === "migration_115_missing") {
      return NextResponse.json({ rows: [], warning: "migration_115_missing" });
    }
    if (m.status === 403) {
      log.warn("threads.data.forbidden", { user_id: user.id, installation_id, op: "GET" });
    }
    return NextResponse.json({ error: m.error }, { status: m.status });
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
});

// POST /api/threads/data  body: { installation_id, data }
export const POST = withRouteLog("threads.data.post", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_json" }, { status: 400 });
  const { installation_id, data } = body;
  if (!installation_id || typeof data !== "object") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const m = await checkInstallationMembership(supabase, installation_id, user.id);
  if (!m.ok) {
    if (m.status === 403) {
      log.warn("threads.data.forbidden", { user_id: user.id, installation_id, op: "POST" });
    }
    return NextResponse.json({ error: m.error }, { status: m.status });
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
});

// PATCH /api/threads/data  body: { id, data }
export const PATCH = withRouteLog("threads.data.patch", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_json" }, { status: 400 });
  const { id, data } = body;
  if (!id || typeof data !== "object") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const m = await checkRowMembership(supabase, id, user.id);
  if (!m.ok) {
    if (m.status === 403) {
      log.warn("threads.data.forbidden", { user_id: user.id, row_id: id, op: "PATCH" });
    }
    return NextResponse.json({ error: m.error }, { status: m.status });
  }

  const { data: row, error } = await supabase
    .from("thread_data")
    .update({ data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row });
});

// DELETE /api/threads/data  body: { id }
export const DELETE = withRouteLog("threads.data.delete", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const m = await checkRowMembership(supabase, body.id, user.id);
  if (!m.ok) {
    if (m.status === 403) {
      log.warn("threads.data.forbidden", { user_id: user.id, row_id: body.id, op: "DELETE" });
    }
    return NextResponse.json({ error: m.error }, { status: m.status });
  }

  const { error } = await supabase.from("thread_data").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

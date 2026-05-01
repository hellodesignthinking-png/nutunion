import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/people — list my people */
export const GET = withRouteLog("people.get", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(500, Number(url.searchParams.get("limit") || "200"));

  let query = supabase
    .from("people")
    .select("id, display_name, role_hint, company, phone, email, kakao_id, relationship, importance, last_contact_at, notes, tags, avatar_url, linked_profile_id, created_at, updated_at")
    .eq("owner_id", auth.user.id)
    .order("importance", { ascending: false })
    .order("display_name", { ascending: true })
    .limit(limit);
  if (q) query = query.ilike("display_name", `%${q}%`);

  const { data, error } = await query;
  if (error) {
    // graceful if table doesn't exist yet
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ rows: [], migration_needed: true });
    }
    log.error(error, "people.list.failed", { user_id: auth.user.id });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data || [] });
});

/** POST /api/people */
export const POST = withRouteLog("people.post", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.display_name?.trim()) {
    return NextResponse.json({ error: "display_name required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("people")
    .insert({
      owner_id: auth.user.id,
      linked_profile_id: body.linked_profile_id || null,
      display_name: body.display_name.trim(),
      role_hint: body.role_hint || null,
      company: body.company || null,
      phone: body.phone || null,
      email: body.email || null,
      kakao_id: body.kakao_id || null,
      relationship: body.relationship || null,
      importance: Number.isFinite(body.importance) ? Math.max(1, Math.min(5, body.importance)) : 3,
      notes: body.notes || null,
      tags: Array.isArray(body.tags) ? body.tags.slice(0, 20) : [],
    })
    .select()
    .single();
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ error: "migration_needed", detail: "101_person_crm.sql" }, { status: 503 });
    }
    log.error(error, "people.create.failed", { user_id: auth.user.id });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ row: data });
});

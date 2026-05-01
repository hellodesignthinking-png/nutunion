import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /api/personal/events?since=ISO&until=ISO */
export const GET = withRouteLog("personal.events.get", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const until = url.searchParams.get("until");
  const limit = Math.min(200, Number(url.searchParams.get("limit") || "100"));

  let q = supabase
    .from("personal_events")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("start_at", { ascending: true })
    .limit(limit);
  if (since) q = q.gte("start_at", since);
  if (until) q = q.lte("start_at", until);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data });
});

export const POST = withRouteLog("personal.events.post", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.title?.trim() || !body?.start_at) {
    return NextResponse.json({ error: "title + start_at required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("personal_events")
    .insert({
      user_id: auth.user.id,
      title: body.title.trim(),
      description: body.description || null,
      start_at: body.start_at,
      end_at: body.end_at || null,
      location: body.location || null,
      url: body.url || null,
      project_id: body.project_id || null,
      group_id: body.group_id || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
});

export const DELETE = withRouteLog("personal.events.delete", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("personal_events")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

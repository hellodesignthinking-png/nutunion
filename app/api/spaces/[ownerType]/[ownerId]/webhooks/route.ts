import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ ownerType: string; ownerId: string }>;
}

const ALLOWED_EVENTS = [
  "page.created", "page.updated", "page.deleted",
  "page.shared", "page.unshared",
  "block.created", "block.updated", "block.deleted",
  "comment.added",
  "mention.created",
] as const;
const ALLOWED_PRESETS = ["slack", "discord", "generic"] as const;

/** GET — 너트/볼트 의 웹훅 목록 (admin RLS 기반 자동 필터). */
export const GET = withRouteLog("spaces.webhooks.get", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { ownerType, ownerId } = await ctx.params;
  if (ownerType !== "nut" && ownerType !== "bolt") {
    return NextResponse.json({ error: "invalid_owner_type" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("space_webhooks")
    .select("id, name, url, preset, events, enabled, last_called_at, last_status, last_error, created_at")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ webhooks: data ?? [] });
});

/** POST  body: { name, url, preset?, events[], secret? } */
export const POST = withRouteLog("spaces.webhooks.post", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { ownerType, ownerId } = await ctx.params;
  if (ownerType !== "nut" && ownerType !== "bolt") {
    return NextResponse.json({ error: "invalid_owner_type" }, { status: 400 });
  }

  const body = await req.json().catch(() => null) as {
    name?: string; url?: string; preset?: string; events?: string[]; secret?: string;
  } | null;
  if (!body?.url || !body.url.startsWith("https://")) {
    return NextResponse.json({ error: "https_url_required" }, { status: 400 });
  }
  const preset = body.preset && (ALLOWED_PRESETS as readonly string[]).includes(body.preset) ? body.preset : "generic";
  const events = (body.events ?? [])
    .filter((e): e is string => typeof e === "string" && (ALLOWED_EVENTS as readonly string[]).includes(e));
  if (events.length === 0) {
    return NextResponse.json({ error: "events_required" }, { status: 400 });
  }
  const name = (body.name ?? "").trim().slice(0, 60) || "Untitled";

  const { data, error } = await supabase
    .from("space_webhooks")
    .insert({
      owner_type: ownerType,
      owner_id: ownerId,
      name,
      url: body.url.slice(0, 500),
      preset,
      events,
      secret: body.secret?.slice(0, 200) || null,
      created_by: user.id,
    })
    .select("id, name, url, preset, events, enabled, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ webhook: data });
});

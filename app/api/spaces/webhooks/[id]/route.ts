import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { dispatchWebhook } from "@/lib/spaces/webhook-dispatcher";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** PATCH  body: { name?, url?, events?, enabled?, preset? } */
export const PATCH = withRouteLog("spaces.webhooks.patch", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    name?: string; url?: string; events?: string[]; enabled?: boolean; preset?: string; secret?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") update.name = body.name.slice(0, 60);
  if (typeof body.url === "string" && body.url.startsWith("https://")) update.url = body.url.slice(0, 500);
  if (Array.isArray(body.events)) update.events = body.events.slice(0, 30);
  if (typeof body.enabled === "boolean") update.enabled = body.enabled;
  if (typeof body.preset === "string") update.preset = body.preset;
  if (typeof body.secret === "string") update.secret = body.secret.slice(0, 200) || null;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "no_changes" }, { status: 400 });

  const { data, error } = await supabase
    .from("space_webhooks")
    .update(update)
    .eq("id", id)
    .select("id, name, url, preset, events, enabled, last_called_at, last_status, last_error")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ webhook: data });
});

export const DELETE = withRouteLog("spaces.webhooks.delete", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { error } = await supabase.from("space_webhooks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

/** POST /test — 테스트 발송 (현재 설정으로 dummy payload). */
export const POST = withRouteLog("spaces.webhooks.test", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { data: hook } = await supabase
    .from("space_webhooks")
    .select("owner_type, owner_id, events")
    .eq("id", id)
    .maybeSingle();
  if (!hook) return NextResponse.json({ error: "webhook_not_found" }, { status: 404 });

  await dispatchWebhook({
    ownerType: hook.owner_type as "nut" | "bolt",
    ownerId: hook.owner_id as string,
    event: hook.events?.[0] || "page.created",
    payload: { test: true, sent_by: user.id, timestamp: new Date().toISOString() },
  });
  return NextResponse.json({ ok: true });
});

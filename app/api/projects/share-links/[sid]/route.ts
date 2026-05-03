import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext { params: Promise<{ sid: string }>; }

/** PATCH — body: { permission?, scope?, expires_at?, revoked_at?, label?, allow_download?, require_email? } */
export const PATCH = withRouteLog("projects.share_link.patch", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { sid } = await ctx.params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const ALLOWED = [
    "permission", "label", "expires_at", "revoked_at",
    "allow_download", "require_email",
    "show_overview", "show_milestones", "show_files",
    "show_meetings", "show_finance", "show_decisions", "show_risks",
  ];
  const update: Record<string, unknown> = {};
  for (const k of ALLOWED) if (k in body) update[k] = body[k];
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "no_changes" }, { status: 400 });

  const { data, error } = await supabase
    .from("project_share_links")
    .update(update)
    .eq("id", sid)
    .select("id, token, permission, label, expires_at, revoked_at, allow_download, require_email, show_overview, show_milestones, show_files, show_meetings, show_finance, show_decisions, show_risks")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data });
});

export const DELETE = withRouteLog("projects.share_link.delete", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { sid } = await ctx.params;
  const { error } = await supabase.from("project_share_links").delete().eq("id", sid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

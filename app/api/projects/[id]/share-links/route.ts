import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext { params: Promise<{ id: string }>; }

const SCOPE_FIELDS = [
  "show_overview", "show_milestones", "show_files",
  "show_meetings", "show_finance", "show_decisions", "show_risks",
] as const;

function newToken(): string {
  return randomBytes(18).toString("base64url");
}
function hashPwd(pwd: string): string {
  return createHash("sha256").update(pwd, "utf-8").digest("hex");
}

/**
 * GET  — 프로젝트의 모든 공유 링크 (lead/pm 만)
 * POST — 새 공유 링크 생성
 *   body: { permission, scope: {show_*}, password?, require_email?, allow_download?,
 *           expires_at?, label? }
 */
export const GET = withRouteLog("projects.share_links.get", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { data, error } = await supabase
    .from("project_share_links")
    .select("id, token, permission, label, expires_at, revoked_at, last_viewed_at, view_count, created_at, require_email, allow_download, show_overview, show_milestones, show_files, show_meetings, show_finance, show_decisions, show_risks")
    .eq("project_id", id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data ?? [] });
});

export const POST = withRouteLog("projects.share_links.post", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    permission?: "view" | "comment" | "upload" | "edit_limited";
    scope?: Partial<Record<typeof SCOPE_FIELDS[number], boolean>>;
    password?: string;
    require_email?: boolean;
    allow_download?: boolean;
    expires_at?: string;
    label?: string;
  } | null;

  const insert: Record<string, unknown> = {
    project_id: id,
    token: newToken(),
    permission: body?.permission || "view",
    label: body?.label?.slice(0, 80) || null,
    require_email: !!body?.require_email,
    allow_download: body?.allow_download !== false,
    expires_at: body?.expires_at || null,
    password_hash: body?.password ? hashPwd(body.password) : null,
    created_by: user.id,
  };
  for (const f of SCOPE_FIELDS) {
    if (body?.scope && typeof body.scope[f] === "boolean") insert[f] = body.scope[f];
  }

  const { data, error } = await supabase
    .from("project_share_links")
    .insert(insert)
    .select("id, token, permission, label, expires_at, require_email, allow_download, show_overview, show_milestones, show_files, show_meetings, show_finance, show_decisions, show_risks, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = `${req.nextUrl.origin}/share/projects/${data.token}`;
  return NextResponse.json({ link: data, url }, { status: 201 });
});

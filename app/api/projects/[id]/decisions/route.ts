import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext { params: Promise<{ id: string }>; }

/**
 * GET  /api/projects/{id}/decisions  — 결정 로그 (decided_at desc)
 * POST /api/projects/{id}/decisions  — 새 결정 추가
 *   body: { title, rationale?, source_kind?, source_id?, related_ids? }
 */

export const GET = withRouteLog("projects.decisions.get", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { data, error } = await supabase
    .from("project_decisions")
    .select("id, title, rationale, decided_at, decided_by, status, source_kind, source_id, related_ids, created_at, decider:profiles!project_decisions_decided_by_fkey(id, nickname, avatar_url)")
    .eq("project_id", id)
    .order("decided_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ decisions: data ?? [] });
});

export const POST = withRouteLog("projects.decisions.post", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    title?: string; rationale?: string;
    source_kind?: "meeting" | "chat" | "page" | "manual";
    source_id?: string;
    related_ids?: unknown[];
  } | null;
  if (!body?.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

  const { data, error } = await supabase
    .from("project_decisions")
    .insert({
      project_id: id,
      title: body.title.trim().slice(0, 200),
      rationale: body.rationale?.slice(0, 2000) || null,
      decided_by: user.id,
      source_kind: body.source_kind || "manual",
      source_id: body.source_id || null,
      related_ids: Array.isArray(body.related_ids) ? body.related_ids : [],
    })
    .select("id, title, rationale, decided_at, decided_by, status, source_kind, source_id, related_ids")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ decision: data }, { status: 201 });
});

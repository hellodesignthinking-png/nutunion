import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext { params: Promise<{ id: string }>; }

export const GET = withRouteLog("projects.risks.get", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { data, error } = await supabase
    .from("project_risks")
    .select("id, title, description, severity, status, owner_id, due_at, detected_by, source_kind, source_id, resolved_at, resolved_by, resolution, created_at, updated_at, owner:profiles!project_risks_owner_id_fkey(id, nickname, avatar_url)")
    .eq("project_id", id)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ risks: data ?? [] });
});

export const POST = withRouteLog("projects.risks.post", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    title?: string;
    description?: string;
    severity?: "low" | "medium" | "high" | "critical";
    owner_id?: string;
    due_at?: string;
    detected_by?: "manual" | "ai" | "rule";
  } | null;
  if (!body?.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

  const { data, error } = await supabase
    .from("project_risks")
    .insert({
      project_id: id,
      title: body.title.trim().slice(0, 200),
      description: body.description?.slice(0, 2000) || null,
      severity: body.severity || "medium",
      owner_id: body.owner_id || null,
      due_at: body.due_at || null,
      detected_by: body.detected_by || "manual",
    })
    .select("id, title, description, severity, status, owner_id, due_at, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ risk: data }, { status: 201 });
});

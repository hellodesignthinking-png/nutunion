/**
 * PATCH /api/projects/[id]/milestones/[mid]
 * DELETE /api/projects/[id]/milestones/[mid]
 *
 * 마일스톤 업데이트 — status 가 'completed' 로 전이될 때
 * automation 이벤트 `project.milestone_completed` 를 dispatch.
 */
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { dispatchEvent } from "@/lib/automation/engine";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; mid: string }> };

export const PATCH = withRouteLog("projects.id.milestones.mid.patch", async (req: NextRequest, { params }: Ctx) => {
  const { id, mid } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) || {};
  const patch: Record<string, any> = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (body.due_date !== undefined) patch.due_date = body.due_date || null;
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.reward_percentage === "number") patch.reward_percentage = body.reward_percentage;
  if (typeof body.is_settled === "boolean") patch.is_settled = body.is_settled;
  if (typeof body.sort_order === "number") patch.sort_order = body.sort_order;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no updatable fields" }, { status: 400 });
  }

  // Fetch current row to detect status transition
  const { data: current, error: fetchErr } = await supabase
    .from("project_milestones")
    .select("id, status, title, project_id")
    .eq("id", mid)
    .eq("project_id", id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "milestone not found" }, { status: 404 });

  const prevStatus = (current as any).status;

  const { data, error } = await supabase
    .from("project_milestones")
    .update(patch)
    .eq("id", mid)
    .eq("project_id", id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Dispatch automation event on transition → completed
  if (patch.status === "completed" && prevStatus !== "completed") {
    await dispatchEvent("project.milestone_completed", {
      project_id: id,
      milestone_id: mid,
      milestone_name: (data as any)?.title || (current as any).title,
    });
  }

  return NextResponse.json({ milestone: data });
});

export const DELETE = withRouteLog("projects.id.milestones.mid.delete", async (_: NextRequest, { params }: Ctx) => {
  const { id, mid } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Cascade: delete tasks first (DB should cascade, but be explicit)
  await supabase.from("project_tasks").delete().eq("milestone_id", mid);
  const { error } = await supabase
    .from("project_milestones")
    .delete()
    .eq("id", mid)
    .eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

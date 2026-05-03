import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext { params: Promise<{ mid: string }>; }

/**
 * POST /api/projects/chat/{mid}/convert
 *   body: { target: 'task' | 'decision' | 'risk', overrides?: { title?, ... } }
 *
 *   메시지 → 해당 항목 생성 + chat_messages.converted_to 에 기록.
 */
export const POST = withRouteLog("projects.chat.convert", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { mid } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    target?: "task" | "decision" | "risk";
    overrides?: {
      title?: string;
      severity?: "low" | "medium" | "high" | "critical";
      due_date?: string;
      rationale?: string;
    };
  } | null;
  if (!body?.target || !["task", "decision", "risk"].includes(body.target)) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }

  const { data: msg } = await supabase
    .from("project_chat_messages")
    .select("id, content, project_id, converted_to")
    .eq("id", mid)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: "message_not_found" }, { status: 404 });

  const projectId = msg.project_id as string;
  const title = (body.overrides?.title || (msg.content as string).split("\n")[0]).slice(0, 200);

  let createdId: string | null = null;
  let createdKind = body.target;

  if (body.target === "task") {
    const { data, error } = await supabase
      .from("project_tasks")
      .insert({
        project_id: projectId,
        title,
        status: "todo",
        due_date: body.overrides?.due_date || null,
      })
      .select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    createdId = data.id as string;
  } else if (body.target === "decision") {
    const { data, error } = await supabase
      .from("project_decisions")
      .insert({
        project_id: projectId,
        title,
        rationale: body.overrides?.rationale || null,
        decided_by: user.id,
        source_kind: "chat",
        source_id: mid,
      })
      .select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    createdId = data.id as string;
  } else if (body.target === "risk") {
    const { data, error } = await supabase
      .from("project_risks")
      .insert({
        project_id: projectId,
        title,
        severity: body.overrides?.severity || "medium",
        detected_by: "manual",
        source_kind: "chat",
        source_id: mid,
      })
      .select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    createdId = data.id as string;
  }

  // converted_to 에 기록 (append)
  const prev = Array.isArray(msg.converted_to) ? msg.converted_to as unknown[] : [];
  await supabase.from("project_chat_messages")
    .update({ converted_to: [...prev, { kind: createdKind, id: createdId, at: new Date().toISOString() }] })
    .eq("id", mid);

  return NextResponse.json({ ok: true, kind: createdKind, id: createdId });
});

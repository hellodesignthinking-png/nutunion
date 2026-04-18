import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** POST /api/venture/[projectId]/enable — host/admin 만 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: profile }, { data: project }, { data: pm }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("projects").select("host_id").eq("id", projectId).maybeSingle(),
    supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!project) return NextResponse.json({ error: "프로젝트 없음" }, { status: 404 });

  const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
  const isHost = (project.host_id as string) === user.id || pm?.role === "host" || pm?.role === "manager" || pm?.role === "owner";
  if (!isAdminStaff && !isHost) {
    return NextResponse.json({ error: "권한 없음 (호스트/admin)" }, { status: 403 });
  }

  const { error } = await supabase
    .from("projects")
    .update({ venture_mode: true, venture_stage: "empathize" })
    .eq("id", projectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

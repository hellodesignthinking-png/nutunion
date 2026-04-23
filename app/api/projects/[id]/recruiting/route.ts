import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

const Schema = z.object({
  recruiting: z.boolean(),
  needed_roles: z.array(z.string().max(50)).max(15).optional(),
  recruiting_note: z.string().max(1000).optional(),
});

/** POST /api/projects/[id]/recruiting — 호스트/admin 만 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const [{ data: profile }, { data: project }, { data: pm }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("projects").select("created_by").eq("id", id).maybeSingle(),
    supabase.from("project_members").select("role").eq("project_id", id).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!project) return NextResponse.json({ error: "프로젝트 없음" }, { status: 404 });
  const isAdmin = profile?.role === "admin" || profile?.role === "staff";
  const isHost = (project as { created_by?: string }).created_by === user.id || pm?.role === "host" || pm?.role === "manager" || pm?.role === "owner";
  if (!isAdmin && !isHost) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const updates: Record<string, unknown> = { recruiting: parsed.data.recruiting };
  if (parsed.data.needed_roles) updates.needed_roles = parsed.data.needed_roles;
  if (parsed.data.recruiting_note !== undefined) updates.recruiting_note = parsed.data.recruiting_note;

  const { error } = await supabase.from("projects").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

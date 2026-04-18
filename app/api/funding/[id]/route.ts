import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

const UpdateSchema = z.object({
  status: z.enum(["draft","submitted","reviewing","funded","rejected","withdrawn"]),
  review_note: z.string().max(2000).optional(),
});

/** PATCH /api/funding/[id] — admin/staff 만 상태 변경 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const updates: Record<string, unknown> = {
    status: parsed.data.status,
    reviewer_id: user.id,
  };
  if (parsed.data.review_note !== undefined) updates.review_note = parsed.data.review_note;
  if (["funded","rejected"].includes(parsed.data.status)) {
    updates.decided_at = new Date().toISOString();
  }

  const { error } = await supabase.from("funding_submissions").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

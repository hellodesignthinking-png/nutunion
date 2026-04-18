import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

const SubmitSchema = z.object({
  project_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  amount_req: z.number().int().nonnegative().optional(),
  contact_email: z.string().email().optional(),
  pitch: z.string().trim().max(3000).optional(),
});

/** POST /api/funding — 사업계획서 펀딩 제출 (멤버+) */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  // 멤버 여부
  const { data: pm } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", parsed.data.project_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isMember = !!pm || profile?.role === "admin" || profile?.role === "staff";
  if (!isMember) return NextResponse.json({ error: "프로젝트 멤버만 제출 가능" }, { status: 403 });

  // plan_id 가 실제 이 프로젝트의 is_current 인지 확인
  const { data: plan } = await supabase
    .from("venture_plans")
    .select("id, project_id, is_current")
    .eq("id", parsed.data.plan_id)
    .maybeSingle();
  if (!plan || plan.project_id !== parsed.data.project_id) {
    return NextResponse.json({ error: "잘못된 사업계획서 참조" }, { status: 400 });
  }

  const { data: inserted, error } = await supabase.from("funding_submissions").insert({
    project_id: parsed.data.project_id,
    plan_id: parsed.data.plan_id,
    submitter_id: user.id,
    status: "submitted",
    amount_req: parsed.data.amount_req ?? null,
    contact_email: parsed.data.contact_email ?? user.email ?? null,
    pitch: parsed.data.pitch ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, submission: inserted });
}

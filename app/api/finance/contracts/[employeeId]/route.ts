import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function checkPermission() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, message: "Unauthorized", userId: "" };
  const { data: profile } = await supabase.from("profiles").select("role,email").eq("id", user.id).single();
  if (!profile) return { ok: false as const, status: 403, message: "Forbidden", userId: "" };
  return { ok: true as const, supabase, userId: user.id, role: profile.role, email: profile.email };
}

/**
 * POST /api/finance/contracts/[employeeId]
 * action: "send" | "sign" | "cancel"
 */
export async function POST(req: NextRequest, context: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await context.params;
  const check = await checkPermission();
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status });

  const body = await req.json();
  const action = body.action as string;

  // 직원 조회
  const { data: employee } = await check.supabase.from("employees").select("*").eq("id", employeeId).single();
  if (!employee) return NextResponse.json({ error: "직원을 찾을 수 없습니다" }, { status: 404 });

  const isAdminStaff = check.role === "admin" || check.role === "staff";
  const isOwner = check.email && employee.email && check.email.toLowerCase() === employee.email.toLowerCase();

  const today = new Date().toISOString().slice(0, 10);

  if (action === "send") {
    // admin/staff만 계약서 발송 가능
    if (!isAdminStaff) return NextResponse.json({ error: "발송 권한이 없습니다" }, { status: 403 });
    const { error } = await check.supabase
      .from("employees")
      .update({ contract_status: "sent", contract_sent_date: today })
      .eq("id", employeeId);
    if (error) return NextResponse.json({ error: "발송 실패" }, { status: 500 });
    return NextResponse.json({ success: true, contract_status: "sent", contract_sent_date: today });
  }

  if (action === "sign") {
    // 본인 또는 admin/staff
    if (!isOwner && !isAdminStaff) {
      return NextResponse.json({ error: "서명 권한이 없습니다" }, { status: 403 });
    }
    const { error } = await check.supabase
      .from("employees")
      .update({
        contract_status: "completed",
        contract_signed: true,
        contract_date: today,
      })
      .eq("id", employeeId);
    if (error) return NextResponse.json({ error: "서명 저장 실패" }, { status: 500 });
    return NextResponse.json({ success: true, contract_status: "completed", contract_date: today });
  }

  if (action === "cancel") {
    if (!isAdminStaff) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    const { error } = await check.supabase
      .from("employees")
      .update({ contract_status: null, contract_sent_date: null })
      .eq("id", employeeId);
    if (error) return NextResponse.json({ error: "취소 실패" }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "지원하지 않는 action입니다" }, { status: 400 });
}
